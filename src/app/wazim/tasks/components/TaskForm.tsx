"use client";

import { useState, useEffect } from "react";
import { Eye, GripVertical, Loader2, Plus, Trash2, X } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { VerificationAdminFields } from "@/components/tasks/verification/VerificationAdminFields";
import { normalizeDatetime } from "@/lib/datetime";
import {
  ACTION_LABELS,
  PLATFORM_ACTIONS,
  PLATFORM_COLORS,
  PLATFORM_LABELS,
  SOCIAL_PLATFORMS,
  normalizeSocialAction,
  normalizeSocialPlatform,
  proofDefaultsForAction,
  suggestAiCriteria,
  suggestScreenshotInstructions,
} from "@/lib/social-engagement";
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
    setMeta((m) => ({
      ...m,
      category,
      requires_screenshot: category === "social_engagement" ? true : category === "verification" ? false : m.requires_screenshot,
      requires_url: category === "verification" ? false : m.requires_url,
      min_word_count: category === "verification" ? "1" : m.min_word_count,
      ai_grading_enabled: category === "social_engagement" || category === "verification" ? true : m.ai_grading_enabled,
    }));
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
        onVerificationRequirementChange={(requirements) =>
          setMeta((current) => ({ ...current, ...requirements }))
        }
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
  onVerificationRequirementChange,
}: {
  category: TaskCategory;
  taskData: Record<string, unknown>;
  setTaskData: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  onVerificationRequirementChange: (requirements: {
    requires_screenshot?: boolean;
    requires_url?: boolean;
    min_word_count?: string;
  }) => void;
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
      <VerificationAdminFields
        taskData={taskData}
        setTaskData={setTaskData}
        onRequirementChange={onVerificationRequirementChange}
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
          question: "",
          type: "open_ended",
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
        <div>
          <Label>Content Type</Label>
          <Select
            value={String(taskData.content_type ?? "youtube")}
            onValueChange={(value) => setTaskData((d) => ({ ...d, content_type: value }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="supabase_video">Supabase Video</SelectItem>
              <SelectItem value="external_url">External URL</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Content URL</Label>
          <Input
            value={String(taskData.content_url ?? taskData.video_url ?? "")}
            onChange={(e) =>
              setTaskData((d) => ({ ...d, content_url: e.target.value }))
            }
            placeholder="YouTube URL, storage path, or external URL"
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
            value={String(q.question ?? q.text ?? "")}
            onChange={(e) => updateQuestion(i, { question: e.target.value })}
            placeholder="Question about the video"
          />
          <div className="flex gap-2">
            <div>
              <Label className="text-xs">Type</Label>
              <Select
                value={String(q.type ?? "open_ended")}
                onValueChange={(v) => updateQuestion(i, { type: v })}
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open_ended">Open Ended</SelectItem>
                  <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                </SelectContent>
              </Select>
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
          {q.type === "multiple_choice" && (
            <div className="space-y-2">
              <Input
                value={((q.options as string[]) ?? []).join(", ")}
                onChange={(e) => updateQuestion(i, { options: e.target.value.split(",").map((option) => option.trim()).filter(Boolean) })}
                placeholder="Options (comma separated)"
              />
              <Input
                value={String(q.correct_option ?? "")}
                onChange={(e) => updateQuestion(i, { correct_option: e.target.value })}
                placeholder="Correct option (optional)"
              />
            </div>
          )}
        </div>
      ))}
      {/* FIXED: Watch & Respond admin fields now match content_type/content_url and question builder requirements. */}
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
  const [previewOpen, setPreviewOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [activeTab, setActiveTab] = useState("manual");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const labelOptions = ((taskData.label_options as string[]) ?? []);
  const items = ((taskData.items as Array<Record<string, unknown>>) ?? []);
  const canEditItems = labelOptions.length >= 2;
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
    if (!canEditItems) {
      toast.error("Set at least 2 label options before adding items");
      return;
    }
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

  function moveItem(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= items.length) return;
    const reordered = [...items];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    updateTaskData({ items: reordered });
  }

  function importItems() {
    setImportError("");
    if (!canEditItems) {
      setImportError("Set at least 2 label options before importing items");
      return;
    }
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
        if (!("content" in item)) throw new Error(`Item ${index + 1}: content is required`);
        if (!("content_type" in item)) throw new Error(`Item ${index + 1}: content_type is required`);
        if (!("correct_label" in item)) throw new Error(`Item ${index + 1}: correct_label is required`);
        if (!content) throw new Error(`Item ${index + 1}: content cannot be empty`);
        if (!["text", "image_url"].includes(contentType)) {
          throw new Error(`Item ${index + 1}: content_type must be "text" or "image_url"`);
        }
        if (!labelOptions.includes(correctLabel)) {
          throw new Error(`Item ${index + 1}: correct_label "${correctLabel}" is not in your label options`);
        }
        return {
          id: typeof item.id === "string" && item.id.trim() ? item.id.trim() : generateItemId(),
          content,
          content_type: contentType,
          correct_label: correctLabel,
        };
      });

      updateTaskData({ items: imported });
      setActiveTab("manual");
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

      {!canEditItems && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Add at least 2 label options before adding or importing items.
        </p>
      )}
      {items.length > 0 && items.length < 5 && (
        <p className="text-sm text-amber-700">Minimum 5 items required before saving.</p>
      )}
      {allSameCorrectLabel && (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Warning: all items have the same label. This makes grading meaningless. Add variety.
        </p>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="manual">Manual Entry</TabsTrigger>
          <TabsTrigger value="bulk">Bulk JSON Import</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={addItem} disabled={!canEditItems || items.length >= 15}>
              <Plus className="mr-1 h-3 w-3" /> Add Item
            </Button>
            <span className="text-xs text-muted-foreground">{items.length}/15 items</span>
          </div>
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground">No items yet. Add rows manually or import JSON.</p>
          )}
          {items.map((item, i) => (
            <div
              key={String(item.id ?? i)}
              className="rounded-lg border p-4 space-y-2"
              draggable
              onDragStart={() => setDraggedIndex(i)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggedIndex !== null) moveItem(draggedIndex, i);
                setDraggedIndex(null);
              }}
              onDragEnd={() => setDraggedIndex(null)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
                  <Badge variant="muted">Item {i + 1}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(i)}
                  aria-label={`Delete item ${i + 1}`}
                >
                  <X className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
              <Textarea
                value={String(item.content ?? "")}
                onChange={(e) => updateItem(i, { content: e.target.value })}
                placeholder="Sentence, description, or image URL"
                rows={2}
                required
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
        </TabsContent>

        <TabsContent value="bulk" className="space-y-3">
          <Textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={12}
            placeholder={`[
  {
    "content": "The food arrived cold and the packaging was damaged.",
    "content_type": "text",
    "correct_label": "Negative"
  },
  {
    "content": "Excellent service, will definitely order again!",
    "content_type": "text",
    "correct_label": "Positive"
  }
]`}
            className="font-mono text-xs"
          />
          {importError && <p className="text-sm text-destructive">{importError}</p>}
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Import replaces the shared item list. Existing manual rows stay intact until parsing succeeds.
            </p>
            <Button onClick={importItems} disabled={!canEditItems}>
              Parse & Import
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)} disabled={items.length === 0}>
          <Eye className="mr-1 h-3 w-3" /> Preview
        </Button>
      </div>

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
  const platform = normalizeSocialPlatform(taskData.platform);
  const action = normalizeSocialAction(taskData.action);
  const proofRequirements = taskData.proof_requirements && typeof taskData.proof_requirements === "object"
    ? taskData.proof_requirements as Record<string, unknown>
    : proofDefaultsForAction(action);
  const availableActions = PLATFORM_ACTIONS[platform];
  const targetIdentifier = String(taskData.target_identifier ?? "");

  function update(updates: Record<string, unknown>) {
    setTaskData((current) => ({ ...current, ...updates }));
  }

  function updateAction(nextAction: string) {
    const normalizedAction = normalizeSocialAction(nextAction);
    const nextProof = proofDefaultsForAction(normalizedAction);
    update({
      action: normalizedAction,
      proof_requirements: nextProof,
      screenshot_instructions: suggestScreenshotInstructions(platform, normalizedAction, targetIdentifier),
      ai_check_criteria: suggestAiCriteria(platform, normalizedAction),
      comment_prompt: ["comment", "review"].includes(normalizedAction)
        ? String(taskData.comment_prompt ?? "")
        : null,
    });
  }

  function updatePlatform(nextPlatform: string) {
    const normalizedPlatform = normalizeSocialPlatform(nextPlatform);
    const nextActions = PLATFORM_ACTIONS[normalizedPlatform];
    const nextAction = nextActions.includes(action) ? action : nextActions[0];
    update({
      platform: normalizedPlatform,
      action: nextAction,
      screenshot_instructions: suggestScreenshotInstructions(normalizedPlatform, nextAction, targetIdentifier),
      ai_check_criteria: suggestAiCriteria(normalizedPlatform, nextAction),
    });
  }

  function updateProof(updates: Record<string, unknown>) {
    update({
      proof_requirements: {
        ...proofRequirements,
        ...updates,
        requires_screenshot: true,
      },
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
      <h3 className="font-medium text-navy">Social Engagement Settings</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Platform</Label>
          <Select value={platform} onValueChange={updatePlatform}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SOCIAL_PLATFORMS.map((item) => (
                <SelectItem key={item} value={item}>{PLATFORM_LABELS[item]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Action</Label>
          <Select value={action} onValueChange={updateAction}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {availableActions.map((item) => (
                <SelectItem key={item} value={item}>{ACTION_LABELS[item]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Target URL</Label>
          <Input
            value={String(taskData.target_url ?? "")}
            onChange={(e) => update({ target_url: e.target.value })}
            placeholder="https://facebook.com/pagename"
          />
          {String(taskData.target_url ?? "").startsWith("http") && (
            <Button type="button" variant="ghost" size="sm" className="mt-1" asChild>
              <a href={String(taskData.target_url)} target="_blank" rel="noopener noreferrer">Test Link</a>
            </Button>
          )}
        </div>
        <div>
          <Label>Target Name</Label>
          <Input
            value={String(taskData.target_name ?? "")}
            onChange={(e) => update({ target_name: e.target.value })}
            placeholder="Page or account name"
          />
        </div>
        <div>
          <Label>Target Identifier</Label>
          <Input
            value={targetIdentifier}
            onChange={(e) => {
              const value = e.target.value;
              update({
                target_identifier: value,
                screenshot_instructions: suggestScreenshotInstructions(platform, action, value),
              });
            }}
            placeholder="@pesatrix_ke or channel ID"
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Screenshot Instructions</Label>
          <Textarea
            value={String(taskData.screenshot_instructions ?? "")}
            onChange={(e) => update({ screenshot_instructions: e.target.value })}
            rows={3}
          />
        </div>
        <div className="sm:col-span-2">
          <Label>AI Check Criteria</Label>
          <Textarea
            value={String(taskData.ai_check_criteria ?? "")}
            onChange={(e) => update({ ai_check_criteria: e.target.value })}
            rows={3}
          />
        </div>
        {["comment", "review"].includes(action) && (
          <div className="sm:col-span-2">
            <Label>Comment Prompt</Label>
            <Textarea
              value={String(taskData.comment_prompt ?? "")}
              onChange={(e) => update({ comment_prompt: e.target.value })}
              placeholder="What exactly should the user write?"
              rows={2}
            />
          </div>
        )}
        <div>
          <Label>Hold Days</Label>
          <Input
            type="number"
            min="1"
            max="30"
            value={String(taskData.hold_days ?? 7)}
            onChange={(e) => update({ hold_days: Math.max(1, Number(e.target.value) || 1) })}
          />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch
            checked={Boolean(taskData.reverification_enabled)}
            onCheckedChange={(value) => update({ reverification_enabled: value })}
          />
          <Label>Reverification enabled</Label>
        </div>
        <div className="sm:col-span-2 rounded-lg border p-4">
          <h4 className="text-sm font-semibold text-navy">Proof Requirements</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <Switch checked disabled />
              <Label>Requires Screenshot</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={Boolean(proofRequirements.requires_username)}
                onCheckedChange={(value) => updateProof({ requires_username: value })}
              />
              <Label>Requires Username</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={Boolean(proofRequirements.requires_text_input)}
                onCheckedChange={(value) => updateProof({ requires_text_input: value })}
              />
              <Label>Requires Text Input</Label>
            </div>
            {Boolean(proofRequirements.requires_text_input) && (
              <>
                <Input
                  value={String(proofRequirements.text_input_label ?? "")}
                  onChange={(e) => updateProof({ text_input_label: e.target.value })}
                  placeholder="Text input label"
                />
                <Input
                  value={String(proofRequirements.text_input_placeholder ?? "")}
                  onChange={(e) => updateProof({ text_input_placeholder: e.target.value })}
                  placeholder="Placeholder"
                />
              </>
            )}
          </div>
        </div>
      </div>
      </div>
      <div className="space-y-3">
        <h3 className="font-medium text-navy">User Preview</h3>
        <div className="flex flex-wrap gap-2">
          <Badge
            style={{
              backgroundColor: PLATFORM_COLORS[platform],
              borderColor: PLATFORM_COLORS[platform],
              color: "white",
            }}
          >
            {PLATFORM_LABELS[platform]}
          </Badge>
          <Badge variant="outline">{ACTION_LABELS[action]}</Badge>
        </div>
        <div className="space-y-4 rounded-lg border bg-white p-4 text-sm">
          <div>
            <p className="text-lg font-semibold text-navy">
              {ACTION_LABELS[action]} {String(taskData.target_name || "Target Name")}
            </p>
            <p className="text-muted-foreground">
              Target: {targetIdentifier || String(taskData.target_name || "Target")}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="font-semibold uppercase text-muted-foreground">Instructions</p>
            <ol className="mt-2 space-y-1">
              <li>1. Open the target link.</li>
              <li>2. Complete the {ACTION_LABELS[action].toLowerCase()} action.</li>
              <li>3. {String(taskData.screenshot_instructions || "Take a screenshot showing proof.")}</li>
              <li>4. Upload below.</li>
            </ol>
          </div>
          <Button type="button" className="w-full" disabled>
            Open {PLATFORM_LABELS[platform]}
          </Button>
          <div className="rounded-lg border border-dashed bg-muted/40 p-6 text-center text-muted-foreground">
            Tap to upload screenshot
          </div>
          {Boolean(proofRequirements.requires_username) && (
            <div>
              <Label>Your {PLATFORM_LABELS[platform]} username</Label>
              <Input disabled placeholder="@username" />
            </div>
          )}
          {Boolean(proofRequirements.requires_text_input) && (
            <div>
              <Label>{String(proofRequirements.text_input_label || "Text proof")}</Label>
              <Textarea disabled rows={2} />
            </div>
          )}
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
          <Label>Content Type</Label>
          <Select
            value={String(taskData.content_type ?? taskData.subtype ?? "review")}
            onValueChange={(v) =>
              setTaskData((d) => ({ ...d, content_type: v }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="short_text">Short Text</SelectItem>
              <SelectItem value="paragraph">Paragraph</SelectItem>
              <SelectItem value="tweet">Tweet</SelectItem>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="article">Article</SelectItem>
              <SelectItem value="caption">Caption</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Language Hint</Label>
          <Input
            value={String(taskData.language_hint ?? taskData.language ?? "")}
            onChange={(e) =>
              setTaskData((d) => ({ ...d, language_hint: e.target.value }))
            }
            placeholder="English or Swahili accepted"
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
          <Label>Max Characters (optional)</Label>
          <Input
            type="number"
            value={String(taskData.max_characters ?? "")}
            onChange={(e) =>
              setTaskData((d) => ({
                ...d,
                max_characters: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Example Output (optional)</Label>
          <Textarea
            value={String(taskData.example_output ?? "")}
            onChange={(e) =>
              setTaskData((d) => ({
                ...d,
                example_output: e.target.value,
              }))
            }
            placeholder="Shown as Example (do not copy)"
            rows={2}
          />
        </div>
      </div>
      {/* FIXED: Content creation admin fields now use content_type, max_characters, language_hint, and example_output. */}
    </div>
  );
}
