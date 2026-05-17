"use client";

import { useState, useEffect } from "react";
import { Eye, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  type TaskCategory,
  type TaskDifficulty,
  type TaskStatus,
  CATEGORY_LABELS,
  generateItemId,
  generateQuestionId,
  createEmptyTaskData,
  taskInsertSchema,
} from "@/lib/task-types";
import { DataLabelingTask } from "@/components/tasks/DataLabelingTask";
import { normalizeDatetime } from "@/lib/datetime";
import type { TaskRow } from "./TaskCard";

type TaskFormProps = {
  task?: TaskRow | null;
  onSave: (payload: Record<string, unknown>, publish: boolean) => Promise<void>;
  onCancel: () => void;
};

type MetaState = {
  title: string;
  category: TaskCategory;
  description: string;
  instructions: string;
  payout_ksh: string;
  total_slots: string;
  difficulty: TaskDifficulty;
  ai_grading_enabled: boolean;
  ai_rubric: string;
  requires_screenshot: boolean;
  requires_url: boolean;
  min_word_count: string;
};

const emptyMeta: MetaState = {
  title: "",
  category: "survey",
  description: "",
  instructions: "",
  payout_ksh: "",
  total_slots: "",
  difficulty: "easy",
  ai_grading_enabled: true,
  ai_rubric: "",
  requires_screenshot: false,
  requires_url: false,
  min_word_count: "0",
};

export function TaskForm({ task, onSave, onCancel }: TaskFormProps) {
  const [meta, setMeta] = useState<MetaState>(emptyMeta);
  const [taskData, setTaskData] = useState<Record<string, unknown>>(() =>
    createEmptyTaskData("survey") as Record<string, unknown>
  );
  const [publishAt, setPublishAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [publishImmediately, setPublishImmediately] = useState(true);
  const [loading, setLoading] = useState(false);
  const [titleError, setTitleError] = useState("");

  useEffect(() => {
    if (task) {
      setMeta({
        title: task.title,
        category: task.category,
        description: task.description ?? "",
        instructions: task.instructions,
        payout_ksh: String(task.payout_ksh),
        total_slots: String(task.total_slots),
        difficulty: task.difficulty,
        ai_grading_enabled: task.ai_grading_enabled,
        ai_rubric: task.ai_rubric ?? "",
        requires_screenshot: task.requires_screenshot ?? false,
        requires_url: task.requires_url ?? false,
        min_word_count: String(task.min_word_count ?? 0),
      });
      setTaskData((task as Record<string, unknown>).task_data as Record<string, unknown> ?? {});
      setPublishAt(task.publish_at ? new Date(task.publish_at).toISOString().slice(0, 16) : "");
      setExpiresAt(task.expires_at ? new Date(task.expires_at).toISOString().slice(0, 16) : "");
      setPublishImmediately(!task.publish_at);
    }
  }, [task]);

  function handleCategoryChange(category: TaskCategory) {
    setMeta((m) => ({ ...m, category }));
    setTaskData(createEmptyTaskData(category) as Record<string, unknown>);
  }

  function canSubmit(): boolean {
    return (
      meta.title.trim().length >= 3 &&
      meta.instructions.trim().length >= 10 &&
      Number(meta.payout_ksh) > 0 &&
      Number(meta.total_slots) > 0
    );
  }

  async function handleSubmit(publish: boolean) {
    setLoading(true);
    setTitleError("");
    try {
      const payload: Record<string, unknown> = {
        title: meta.title.trim(),
        category: meta.category,
        description: meta.description.trim() || null,
        instructions: meta.instructions.trim(),
        payout_ksh: Number(meta.payout_ksh),
        total_slots: Number(meta.total_slots),
        difficulty: meta.difficulty,
        ai_grading_enabled: meta.ai_grading_enabled,
        ai_rubric: meta.ai_rubric.trim() || null,
        requires_screenshot: meta.requires_screenshot,
        requires_url: meta.requires_url,
        min_word_count: Number(meta.min_word_count),
        task_data: taskData,
        publish_at: publish && publishImmediately ? null : normalizeDatetime(publishAt),
        expires_at: normalizeDatetime(expiresAt),
      };

      if (task) {
        payload.id = task.id;
      }

      const parsed = taskInsertSchema.safeParse(payload);
      if (!parsed.success) {
        toast.error(parsed.error.errors[0]?.message ?? "Validation failed");
        return;
      }

      if (task) {
        await onSave(parsed.data as Record<string, unknown>, publish);
      } else {
        const res = await fetch("/api/admin/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...parsed.data,
            publish_at: publish && publishImmediately ? null : normalizeDatetime(publishAt),
          }),
        });
        const result = await res.json();
        if (!res.ok) {
          if (res.status === 409) {
            setTitleError(result?.error ?? "A task with this title and category already exists");
          } else {
            toast.error(result?.error?.message ?? result?.error ?? "Failed to save task");
          }
          return;
        }
        toast.success(publish ? "Task published!" : "Task saved as draft");
        onCancel();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-navy">
          {task ? "Edit Task" : "New Task"}
        </h2>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-3">
          <Label htmlFor="tf-title">Task Title</Label>
          <Input
            id="tf-title"
            value={meta.title}
            onChange={(e) => { setMeta((m) => ({ ...m, title: e.target.value })); setTitleError(""); }}
            placeholder="e.g. How Do You Buy Airtime?"
          />
          {titleError && (
            <p className="text-sm text-destructive mt-1">{titleError}</p>
          )}
        </div>

        <div>
          <Label>Category</Label>
          <Select
            value={meta.category}
            onValueChange={(v) => handleCategoryChange(v as TaskCategory)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="survey">Survey</SelectItem>
              <SelectItem value="data_labeling">Data Labeling</SelectItem>
              <SelectItem value="social_engagement">Social Engagement</SelectItem>
              <SelectItem value="verification">Verification</SelectItem>
              <SelectItem value="content_creation">Content Creation</SelectItem>
              <SelectItem value="watch_respond">Watch & Respond</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Payout (KSh)</Label>
          <Input
            type="number"
            min="1"
            value={meta.payout_ksh}
            onChange={(e) =>
              setMeta((m) => ({ ...m, payout_ksh: e.target.value }))
            }
            placeholder="25"
          />
        </div>

        <div>
          <Label>Total Slots</Label>
          <Input
            type="number"
            min="1"
            value={meta.total_slots}
            onChange={(e) =>
              setMeta((m) => ({ ...m, total_slots: e.target.value }))
            }
            placeholder="300"
          />
        </div>

        <div>
          <Label>Difficulty</Label>
          <Select
            value={meta.difficulty}
            onValueChange={(v) =>
              setMeta((m) => ({ ...m, difficulty: v as TaskDifficulty }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="sm:col-span-2 lg:col-span-3">
          <Label htmlFor="tf-desc">Description (optional)</Label>
          <Input
            id="tf-desc"
            value={meta.description}
            onChange={(e) =>
              setMeta((m) => ({ ...m, description: e.target.value }))
            }
            placeholder="Short description for users"
          />
        </div>

        <div className="sm:col-span-2 lg:col-span-3">
          <Label htmlFor="tf-instructions">Instructions</Label>
          <Textarea
            id="tf-instructions"
            value={meta.instructions}
            onChange={(e) =>
              setMeta((m) => ({ ...m, instructions: e.target.value }))
            }
            placeholder="Detailed instructions for users"
            rows={3}
          />
        </div>

        <div className="flex items-center gap-3">
          <Switch
            checked={meta.requires_screenshot}
            onCheckedChange={(v) =>
              setMeta((m) => ({ ...m, requires_screenshot: v }))
            }
            id="tf-screenshot"
          />
          <Label htmlFor="tf-screenshot">Requires screenshot</Label>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            checked={meta.requires_url}
            onCheckedChange={(v) =>
              setMeta((m) => ({ ...m, requires_url: v }))
            }
            id="tf-url"
          />
          <Label htmlFor="tf-url">Requires URL</Label>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            checked={meta.ai_grading_enabled}
            onCheckedChange={(v) =>
              setMeta((m) => ({ ...m, ai_grading_enabled: v }))
            }
            id="tf-ai"
          />
          <Label htmlFor="tf-ai">AI grading</Label>
        </div>

        {meta.ai_grading_enabled && (
          <div className="sm:col-span-2 lg:col-span-3">
            <Label htmlFor="tf-rubric">AI Grading Rubric</Label>
            <Textarea
              id="tf-rubric"
              value={meta.ai_rubric}
              onChange={(e) =>
                setMeta((m) => ({ ...m, ai_rubric: e.target.value }))
              }
              placeholder="Describe what a good submission looks like"
              rows={2}
            />
          </div>
        )}

        <div>
          <Label htmlFor="tf-minwords">Min Word Count</Label>
          <Input
            id="tf-minwords"
            type="number"
            min="0"
            value={meta.min_word_count}
            onChange={(e) =>
              setMeta((m) => ({ ...m, min_word_count: e.target.value }))
            }
            placeholder="0"
          />
        </div>
      </div>

      <Separator />

      <TaskDataEditor
        category={meta.category}
        taskData={taskData}
        setTaskData={setTaskData}
      />

      <Separator />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-3">
          <Switch
            checked={publishImmediately}
            onCheckedChange={setPublishImmediately}
            id="tf-publish-now"
          />
          <Label htmlFor="tf-publish-now">Publish immediately when saved</Label>
        </div>

        {!publishImmediately && (
          <div>
            <Label htmlFor="tf-publish-at">Schedule Date</Label>
            <Input
              id="tf-publish-at"
              type="datetime-local"
              value={publishAt}
              onChange={(e) => setPublishAt(e.target.value)}
            />
          </div>
        )}

        <div>
          <Label htmlFor="tf-expires">Expiry Date (optional)</Label>
          <Input
            id="tf-expires"
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="outline"
          onClick={() => handleSubmit(false)}
          disabled={loading || !canSubmit()}
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save Draft
        </Button>
        <Button
          onClick={() => handleSubmit(true)}
          disabled={loading || !canSubmit()}
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {publishImmediately ? "Publish Now" : "Schedule"}
        </Button>
      </div>
    </div>
  );
}

function TaskDataEditor({
  category,
  taskData,
  setTaskData,
}: {
  category: TaskCategory;
  taskData: Record<string, unknown>;
  setTaskData: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
}) {
  if (category === "survey") {
    return (
      <SurveyEditor
        taskData={taskData}
        setTaskData={setTaskData}
      />
    );
  }
  if (category === "watch_respond") {
    return (
      <WatchRespondEditor
        taskData={taskData}
        setTaskData={setTaskData}
      />
    );
  }
  if (category === "data_labeling") {
    return (
      <DataLabelingEditor
        taskData={taskData}
        setTaskData={setTaskData}
      />
    );
  }
  if (category === "social_engagement") {
    return (
      <SocialEngagementEditor
        taskData={taskData}
        setTaskData={setTaskData}
      />
    );
  }
  if (category === "verification") {
    return (
      <VerificationEditor
        taskData={taskData}
        setTaskData={setTaskData}
      />
    );
  }
  if (category === "content_creation") {
    return (
      <ContentCreationEditor
        taskData={taskData}
        setTaskData={setTaskData}
      />
    );
  }
  return null;
}

function SurveyEditor({
  taskData,
  setTaskData,
}: {
  taskData: Record<string, unknown>;
  setTaskData: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
}) {
  const questions = ((taskData.questions as Array<Record<string, unknown>>) ?? []);

  function addQuestion(type: string) {
    const newQ: Record<string, unknown> = {
      id: generateQuestionId(),
      text: "",
      type,
      required: true,
      ...(type === "multiple_choice" || type === "multi_select"
        ? { options: [""] }
        : {}),
      ...(type === "open_text" ? { min_words: 0, max_words: 500 } : {}),
      ...(type === "rating" ? { scale: 5 } : {}),
    };
    setTaskData((d) => ({ ...d, questions: [...questions, newQ] }));
  }

  function updateQuestion(index: number, updates: Record<string, unknown>) {
    setTaskData((d) => ({
      ...d,
      questions: questions.map((q, i) =>
        i === index ? { ...q, ...updates } : q
      ),
    }));
  }

  function removeQuestion(index: number) {
    setTaskData((d) => ({
      ...d,
      questions: questions.filter((_, i) => i !== index),
    }));
  }

  function addOption(qIndex: number) {
    const q = questions[qIndex];
    const options = [...((q?.options as string[]) ?? []), ""];
    updateQuestion(qIndex, { options });
  }

  function updateOption(qIndex: number, oIndex: number, value: string) {
    const q = questions[qIndex];
    const options = [...((q?.options as string[]) ?? [])];
    options[oIndex] = value;
    updateQuestion(qIndex, { options });
  }

  function removeOption(qIndex: number, oIndex: number) {
    const q = questions[qIndex];
    const options = ((q?.options as string[]) ?? []).filter(
      (_, i) => i !== oIndex
    );
    updateQuestion(qIndex, { options });
  }

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-navy">Survey Questions</h3>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => addQuestion("multiple_choice")}
        >
          <Plus className="mr-1 h-3 w-3" /> Multiple Choice
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => addQuestion("open_text")}
        >
          <Plus className="mr-1 h-3 w-3" /> Open Text
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => addQuestion("multi_select")}
        >
          <Plus className="mr-1 h-3 w-3" /> Multi Select
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => addQuestion("rating")}
        >
          <Plus className="mr-1 h-3 w-3" /> Rating
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => addQuestion("yes_no")}
        >
          <Plus className="mr-1 h-3 w-3" /> Yes/No
        </Button>
      </div>

      {questions.length === 0 && (
        <p className="text-sm text-muted-foreground">No questions yet.</p>
      )}

      {questions.map((q, qi) => (
        <div
          key={String(q.id ?? qi)}
          className="rounded-lg border p-4 space-y-2"
        >
          <div className="flex items-center gap-2">
            <Badge variant="muted">
              {String(q.type ?? "").replace("_", " ")}
            </Badge>
            <Switch
              checked={q.required as boolean}
              onCheckedChange={(v) => updateQuestion(qi, { required: v })}
            />
            <span className="text-xs text-muted-foreground">Required</span>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeQuestion(qi)}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
          <Input
            value={String(q.text ?? "")}
            onChange={(e) => updateQuestion(qi, { text: e.target.value })}
            placeholder="Question text"
          />
          {(q.type === "multiple_choice" || q.type === "multi_select") && (
            <div className="space-y-1">
              {((q.options as string[]) ?? []).map((opt, oi) => (
                <div key={oi} className="flex gap-2">
                  <Input
                    value={opt}
                    onChange={(e) => updateOption(qi, oi, e.target.value)}
                    placeholder={`Option ${oi + 1}`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeOption(qi, oi)}
                    disabled={((q.options as string[]) ?? []).length <= 2}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <Button variant="ghost" size="sm" onClick={() => addOption(qi)}>
                <Plus className="mr-1 h-3 w-3" /> Add Option
              </Button>
            </div>
          )}
          {q.type === "open_text" && (
            <div className="flex gap-4">
              <div>
                <Label className="text-xs">Min Words</Label>
                <Input
                  type="number"
                  value={String((q as Record<string, unknown>).min_words ?? 0)}
                  onChange={(e) =>
                    updateQuestion(qi, { min_words: Number(e.target.value) })
                  }
                  className="w-24"
                />
              </div>
              <div>
                <Label className="text-xs">Max Words</Label>
                <Input
                  type="number"
                  value={String((q as Record<string, unknown>).max_words ?? 500)}
                  onChange={(e) =>
                    updateQuestion(qi, { max_words: Number(e.target.value) })
                  }
                  className="w-24"
                />
              </div>
            </div>
          )}
          {q.type === "rating" && (
            <div>
              <Label className="text-xs">Scale</Label>
              <Select
                value={String((q as Record<string, unknown>).scale ?? 5)}
                onValueChange={(v) =>
                  updateQuestion(qi, { scale: Number(v) })
                }
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">1-5</SelectItem>
                  <SelectItem value="10">1-10</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function WatchRespondEditor({
  taskData,
  setTaskData,
}: {
  taskData: Record<string, unknown>;
  setTaskData: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
}) {
  const questions =
    ((taskData.questions as Array<Record<string, unknown>>) ?? []);

  function addQuestion() {
    setTaskData((d) => ({
      ...d,
      questions: [
        ...questions,
        {
          id: `w${Date.now()}`,
          text: "",
          type: "open_text",
          min_words: 10,
        },
      ],
    }));
  }

  function updateQuestion(index: number, updates: Record<string, unknown>) {
    setTaskData((d) => ({
      ...d,
      questions: questions.map((q, i) =>
        i === index ? { ...q, ...updates } : q
      ),
    }));
  }

  function removeQuestion(index: number) {
    setTaskData((d) => ({
      ...d,
      questions: questions.filter((_, i) => i !== index),
    }));
  }

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-navy">Watch & Respond Settings</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Video URL</Label>
          <Input
            value={String(taskData.video_url ?? "")}
            onChange={(e) =>
              setTaskData((d) => ({ ...d, video_url: e.target.value }))
            }
            placeholder="https://youtube.com/..."
          />
        </div>
        <div>
          <Label>Video Duration (seconds)</Label>
          <Input
            type="number"
            value={String(taskData.video_duration_seconds ?? "")}
            onChange={(e) =>
              setTaskData((d) => ({
                ...d,
                video_duration_seconds: Number(e.target.value),
              }))
            }
            placeholder="300"
          />
        </div>
        <div>
          <Label>Min Watch Seconds</Label>
          <Input
            type="number"
            value={String(taskData.min_watch_seconds ?? 60)}
            onChange={(e) =>
              setTaskData((d) => ({
                ...d,
                min_watch_seconds: Number(e.target.value),
              }))
            }
          />
        </div>
      </div>
      <Separator />
      <div>
        <Label>Questions</Label>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={addQuestion}
        >
          <Plus className="mr-1 h-3 w-3" /> Add Question
        </Button>
      </div>
      {questions.map((q, i) => (
        <div
          key={String(q.id ?? i)}
          className="rounded-lg border p-4 space-y-2"
        >
          <Input
            value={String(q.text ?? "")}
            onChange={(e) => updateQuestion(i, { text: e.target.value })}
            placeholder="Question about the video"
          />
          <div className="flex gap-2">
            <div>
              <Label className="text-xs">Type</Label>
              <Select
                value={String(q.type ?? "open_text")}
                onValueChange={(v) => updateQuestion(i, { type: v })}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open_text">Open Text</SelectItem>
                  <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                  <SelectItem value="yes_no">Yes/No</SelectItem>
                  <SelectItem value="rating">Rating</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Min Words</Label>
              <Input
                type="number"
                value={String(q.min_words ?? 10)}
                onChange={(e) =>
                  updateQuestion(i, { min_words: Number(e.target.value) })
                }
                className="w-24"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="self-end"
              onClick={() => removeQuestion(i)}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function DataLabelingEditor({
  taskData,
  setTaskData,
}: {
  taskData: Record<string, unknown>;
  setTaskData: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
}) {
  const [newLabel, setNewLabel] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const labelOptions = ((taskData.label_options as string[]) ?? []);
  const items = ((taskData.items as Array<Record<string, unknown>>) ?? []);
  const allSameCorrectLabel =
    items.length >= 2 &&
    new Set(items.map((item) => String(item.correct_label ?? ""))).size === 1 &&
    Boolean(items[0]?.correct_label);

  function updateTaskData(updates: Record<string, unknown>) {
    setTaskData((current) => {
      const next = { ...current, ...updates };
      const nextItems = (next.items as Array<Record<string, unknown>>) ?? [];
      return { ...next, batch_size: nextItems.length };
    });
  }

  function addLabel() {
    const label = newLabel.trim();
    if (!label) return;
    if (labelOptions.length >= 6) {
      toast.error("Maximum 6 labels allowed");
      return;
    }
    if (labelOptions.some((existing) => existing.toLowerCase() === label.toLowerCase())) {
      toast.error("Label already exists");
      return;
    }
    updateTaskData({ label_options: [...labelOptions, label] });
    setNewLabel("");
  }

  function removeLabel(label: string) {
    if (labelOptions.length <= 2) {
      toast.error("At least 2 labels are required");
      return;
    }
    updateTaskData({
      label_options: labelOptions.filter((option) => option !== label),
      items: items.map((item) => ({
        ...item,
        correct_label: item.correct_label === label ? "" : item.correct_label,
      })),
    });
  }

  function addItem() {
    if (items.length >= 15) {
      toast.error("Maximum 15 items allowed");
      return;
    }
    updateTaskData({
      items: [
        ...items,
        {
          id: generateItemId(),
          content: "",
          content_type: "text",
          correct_label: labelOptions[0] ?? "",
        },
      ],
    });
  }

  function updateItem(index: number, updates: Record<string, unknown>) {
    updateTaskData({
      items: items.map((item, i) =>
        i === index ? { ...item, ...updates } : item
      ),
    });
  }

  function removeItem(index: number) {
    updateTaskData({
      items: items.filter((_, i) => i !== index),
    });
  }

  function importItems() {
    setImportError("");
    try {
      const parsed = JSON.parse(importText) as unknown;
      if (!Array.isArray(parsed)) {
        setImportError("JSON must be an array of items");
        return;
      }
      if (parsed.length < 5 || parsed.length > 15) {
        setImportError("Import must include 5 to 15 items");
        return;
      }

      const imported = parsed.map((raw, index) => {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
          throw new Error(`Item ${index + 1} is not an object`);
        }
        const item = raw as Record<string, unknown>;
        const content = String(item.content ?? "").trim();
        const contentType = String(item.content_type ?? "text");
        const correctLabel = String(item.correct_label ?? "").trim();
        if (!content) throw new Error(`Item ${index + 1} is missing content`);
        if (!["text", "image_url"].includes(contentType)) {
          throw new Error(`Item ${index + 1} has an invalid content_type`);
        }
        if (!labelOptions.includes(correctLabel)) {
          throw new Error(`Item ${index + 1} correct_label must match an existing label option`);
        }
        return {
          id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : generateItemId(),
          content,
          content_type: contentType,
          correct_label: correctLabel,
        };
      });

      updateTaskData({ items: imported });
      setImportText("");
      setImportOpen(false);
      toast.success("Items imported");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Invalid JSON");
    }
  }

  const previewTaskData = {
    type: "data_labeling" as const,
    subtype: String(taskData.subtype ?? "sentiment"),
    batch_size: items.length,
    label_options: labelOptions,
    items: items.map((item) => ({
      id: String(item.id),
      content: String(item.content ?? ""),
      content_type: (item.content_type === "image_url" ? "image_url" : "text") as "text" | "image_url",
    })),
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Subtype</Label>
          <Select
            value={String(taskData.subtype ?? "sentiment")}
            onValueChange={(value) => updateTaskData({ subtype: value })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sentiment">Sentiment Analysis</SelectItem>
              <SelectItem value="image_classification">Image Classification</SelectItem>
              <SelectItem value="language_detection">Language Detection</SelectItem>
              <SelectItem value="text_correction">Text Correction</SelectItem>
              <SelectItem value="category_tagging">Category Tagging</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Batch Size</Label>
          <Input value={String(items.length)} disabled />
        </div>
      </div>

      <div className="space-y-2 rounded-lg border p-4">
        <Label>Label Options</Label>
        <div className="flex gap-2">
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addLabel();
              }
            }}
            placeholder="Add a label"
          />
          <Button type="button" variant="outline" onClick={addLabel}>
            Add
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {labelOptions.map((label) => (
            <Badge key={label} variant="outline" className="gap-1">
              {label}
              <button type="button" onClick={() => removeLabel(label)} aria-label={`Remove ${label}`}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Minimum 2 labels, maximum 6. Duplicates are blocked.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={addItem} disabled={items.length >= 15}>
          <Plus className="mr-1 h-3 w-3" /> Add Item
        </Button>
        <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
          Import from JSON
        </Button>
        <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)} disabled={items.length === 0}>
          <Eye className="mr-1 h-3 w-3" /> Preview
        </Button>
        <span className="text-xs text-muted-foreground">{items.length}/15 items</span>
      </div>
      {items.length > 0 && items.length < 5 && (
        <p className="text-sm text-amber-700">Minimum 5 items required before saving.</p>
      )}
      {allSameCorrectLabel && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          All correct labels are the same. Review this task before publishing.
        </p>
      )}
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">No items yet.</p>
      )}
      {items.map((item, i) => (
        <div
          key={String(item.id ?? i)}
          className="rounded-lg border p-4 space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <Badge variant="muted">Item {i + 1}</Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => removeItem(i)}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
          <Textarea
            value={String(item.content ?? "")}
            onChange={(e) => updateItem(i, { content: e.target.value })}
            placeholder="Sentence, description, or image URL"
            rows={2}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Content Type</Label>
              <Select
                value={String(item.content_type ?? "text")}
                onValueChange={(value) => updateItem(i, { content_type: value })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="image_url">Image URL</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Correct Label</Label>
              <Select
                value={String(item.correct_label ?? "")}
                onValueChange={(value) => updateItem(i, { correct_label: value })}
              >
                <SelectTrigger><SelectValue placeholder="Select label" /></SelectTrigger>
                <SelectContent>
                  {labelOptions.map((label) => (
                    <SelectItem key={label} value={label}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ))}

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Data Labeling Items</DialogTitle>
          </DialogHeader>
          <Textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={10}
            placeholder='[{"content":"...","content_type":"text","correct_label":"Positive"}]'
            className="font-mono text-xs"
          />
          {importError && <p className="text-sm text-destructive">{importError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button onClick={importItems}>Import</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Preview</DialogTitle>
          </DialogHeader>
          <DataLabelingTask
            taskId="admin-preview"
            taskData={previewTaskData}
            payoutKsh={0}
            onSubmitSuccess={() => setPreviewOpen(false)}
            previewMode
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SocialEngagementEditor({
  taskData,
  setTaskData,
}: {
  taskData: Record<string, unknown>;
  setTaskData: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
}) {
  return (
    <div className="space-y-4">
      <h3 className="font-medium text-navy">Social Engagement Settings</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Platform</Label>
          <Input
            value={String(taskData.platform ?? "")}
            onChange={(e) =>
              setTaskData((d) => ({ ...d, platform: e.target.value }))
            }
            placeholder="facebook, twitter, tiktok"
          />
        </div>
        <div>
          <Label>Action</Label>
          <Input
            value={String(taskData.action ?? "")}
            onChange={(e) =>
              setTaskData((d) => ({ ...d, action: e.target.value }))
            }
            placeholder="follow, like, share, comment"
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Target URL</Label>
          <Input
            value={String(taskData.target_url ?? "")}
            onChange={(e) =>
              setTaskData((d) => ({ ...d, target_url: e.target.value }))
            }
            placeholder="https://facebook.com/pagename"
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Target Name</Label>
          <Input
            value={String(taskData.target_name ?? "")}
            onChange={(e) =>
              setTaskData((d) => ({ ...d, target_name: e.target.value }))
            }
            placeholder="Page or account name"
          />
        </div>
      </div>
    </div>
  );
}

function VerificationEditor({
  taskData,
  setTaskData,
}: {
  taskData: Record<string, unknown>;
  setTaskData: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
}) {
  const questions =
    ((taskData.questions as Array<Record<string, unknown>>) ?? []);

  function addQuestion() {
    setTaskData((d) => ({
      ...d,
      questions: [
        ...questions,
        { id: `v${Date.now()}`, text: "", type: "yes_no" },
      ],
    }));
  }

  function updateQuestion(index: number, text: string) {
    setTaskData((d) => ({
      ...d,
      questions: questions.map((q, i) =>
        i === index ? { ...q, text } : q
      ),
    }));
  }

  function removeQuestion(index: number) {
    setTaskData((d) => ({
      ...d,
      questions: questions.filter((_, i) => i !== index),
    }));
  }

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-navy">Verification Settings</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Target URL</Label>
          <Input
            value={String(taskData.target_url ?? "")}
            onChange={(e) =>
              setTaskData((d) => ({ ...d, target_url: e.target.value }))
            }
            placeholder="https://..."
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Target Description</Label>
          <Input
            value={String(taskData.target_description ?? "")}
            onChange={(e) =>
              setTaskData((d) => ({
                ...d,
                target_description: e.target.value,
              }))
            }
            placeholder="What user is checking"
          />
        </div>
        <div>
          <Label>Min Time (seconds)</Label>
          <Input
            type="number"
            value={String(taskData.min_time_seconds ?? 120)}
            onChange={(e) =>
              setTaskData((d) => ({
                ...d,
                min_time_seconds: Number(e.target.value),
              }))
            }
          />
        </div>
      </div>
      <Separator />
      <div>
        <Label>Verification Questions</Label>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={addQuestion}
        >
          <Plus className="mr-1 h-3 w-3" /> Add Question
        </Button>
      </div>
      {questions.map((q, i) => (
        <div key={String(q.id ?? i)} className="flex gap-2">
          <Input
            value={String(q.text ?? "")}
            onChange={(e) => updateQuestion(i, e.target.value)}
            placeholder="Verification question"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeQuestion(i)}
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function ContentCreationEditor({
  taskData,
  setTaskData,
}: {
  taskData: Record<string, unknown>;
  setTaskData: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
}) {
  return (
    <div className="space-y-4">
      <h3 className="font-medium text-navy">Content Creation Settings</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Subtype</Label>
          <Select
            value={String(taskData.subtype ?? "review")}
            onValueChange={(v) =>
              setTaskData((d) => ({ ...d, subtype: v }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="social_post">Social Post</SelectItem>
              <SelectItem value="article">Article</SelectItem>
              <SelectItem value="caption">Caption</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Language</Label>
          <Input
            value={String(taskData.language ?? "english")}
            onChange={(e) =>
              setTaskData((d) => ({ ...d, language: e.target.value }))
            }
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Prompt</Label>
          <Textarea
            value={String(taskData.prompt ?? "")}
            onChange={(e) =>
              setTaskData((d) => ({ ...d, prompt: e.target.value }))
            }
            placeholder="Write a 2-3 sentence review..."
            rows={3}
          />
        </div>
        <div>
          <Label>Min Words</Label>
          <Input
            type="number"
            value={String(taskData.min_words ?? 30)}
            onChange={(e) =>
              setTaskData((d) => ({
                ...d,
                min_words: Number(e.target.value),
              }))
            }
          />
        </div>
        <div>
          <Label>Max Words</Label>
          <Input
            type="number"
            value={String(taskData.max_words ?? 150)}
            onChange={(e) =>
              setTaskData((d) => ({
                ...d,
                max_words: Number(e.target.value),
              }))
            }
          />
        </div>
      </div>
    </div>
  );
}
