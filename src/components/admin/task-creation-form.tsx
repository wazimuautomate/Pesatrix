"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, GripVertical, ArrowLeft, ArrowRight, Check, Eye } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  type TaskCategory,
  type TaskDifficulty,
  type Question,
  type TaskInsert,
  type TaskData,
  CATEGORY_LABELS,
  generateQuestionId,
  createEmptyTaskData,
  taskInsertSchema,
} from "@/lib/task-types";

const STEPS = ["Task Meta", "Task Data", "Publishing"] as const;
type Step = (typeof STEPS)[number];

const emptyMeta = {
  title: "",
  category: "survey" as TaskCategory,
  description: "",
  instructions: "",
  payout_ksh: "",
  total_slots: "",
  difficulty: "easy" as TaskDifficulty,
  ai_grading_enabled: true,
  ai_rubric: "",
  requires_screenshot: false,
  requires_url: false,
  min_word_count: "0",
};

export function TaskCreationForm() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [meta, setMeta] = useState(emptyMeta);
  const [taskData, setTaskData] = useState<any>(() => createEmptyTaskData("survey"));
  const [publishAt, setPublishAt] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [publishImmediately, setPublishImmediately] = useState(true);
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  function handleCategoryChange(category: TaskCategory) {
    setMeta((m) => ({ ...m, category }));
    setTaskData(createEmptyTaskData(category));
  }

  function canProceed(): boolean {
    if (currentStep === 0) {
      return meta.title.trim().length >= 3 && meta.instructions.trim().length >= 10 && Number(meta.payout_ksh) > 0 && Number(meta.total_slots) > 0;
    }
    if (currentStep === 1) {
      if (meta.category === "survey") {
        return taskData.questions?.length > 0;
      }
      if (meta.category === "data_labeling") {
        return taskData.items?.length > 0;
      }
      if (meta.category === "social_engagement") {
        return !!taskData.target_url && !!taskData.target_name;
      }
      if (meta.category === "verification") {
        return !!taskData.target_url && taskData.questions?.length > 0;
      }
      if (meta.category === "content_creation") {
        return !!taskData.prompt;
      }
      if (meta.category === "watch_respond") {
        return !!taskData.video_url && taskData.questions?.length > 0;
      }
      return true;
    }
    return true;
  }

  async function handleSubmit(publish: boolean) {
    setLoading(true);
    try {
      const payload: Partial<TaskInsert> = {
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
        publish_at: publishImmediately ? null : (publishAt || null),
        expires_at: expiresAt || null,
      };

      const parsed = taskInsertSchema.safeParse(payload);
      if (!parsed.success) {
        toast.error(parsed.error.errors[0]?.message ?? "Validation failed");
        return;
      }

      const response = await fetch("/api/admin/tasks-new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...parsed.data,
          publish_at: publish ? (publishImmediately ? null : publishAt || null) : null,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        toast.error(result?.error?.message ?? result?.error ?? "Failed to create task");
        return;
      }

      toast.success(publish ? "Task published!" : "Task saved as draft");
      router.push("/wazim/tasks");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {STEPS.map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                i < currentStep
                  ? "bg-pesatrix-blue text-white"
                  : i === currentStep
                    ? "bg-pesatrix-blue/20 text-pesatrix-blue ring-2 ring-pesatrix-blue"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i < currentStep ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-sm font-medium ${i === currentStep ? "text-navy" : "text-muted-foreground"}`}>
              {step}
            </span>
            {i < STEPS.length - 1 && <Separator className="w-8" />}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[currentStep]}</CardTitle>
        </CardHeader>
        <CardContent>
          {currentStep === 0 && (
            <Step1Meta meta={meta} setMeta={setMeta} onCategoryChange={handleCategoryChange} />
          )}
          {currentStep === 1 && (
            <Step2TaskData category={meta.category} taskData={taskData} setTaskData={setTaskData} />
          )}
          {currentStep === 2 && (
            <Step3Publishing
              publishImmediately={publishImmediately}
              setPublishImmediately={setPublishImmediately}
              publishAt={publishAt}
              setPublishAt={setPublishAt}
              expiresAt={expiresAt}
              setExpiresAt={setExpiresAt}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {currentStep > 0 && (
            <Button variant="outline" onClick={() => setCurrentStep((s) => s - 1)}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPreviewOpen(true)} disabled={!canProceed()}>
            <Eye className="mr-2 h-4 w-4" /> Preview
          </Button>
          {currentStep < STEPS.length - 1 ? (
            <Button onClick={() => setCurrentStep((s) => s + 1)} disabled={!canProceed()}>
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleSubmit(false)} disabled={loading || !canProceed()}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save Draft
              </Button>
              <Button onClick={() => handleSubmit(true)} disabled={loading || !canProceed()}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {publishImmediately ? "Publish Now" : "Schedule"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Step1Meta({
  meta,
  setMeta,
  onCategoryChange,
}: {
  meta: typeof emptyMeta;
  setMeta: React.Dispatch<React.SetStateAction<typeof emptyMeta>>;
  onCategoryChange: (category: TaskCategory) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="sm:col-span-2 lg:col-span-3">
        <Label htmlFor="title">Task Title</Label>
        <Input
          id="title"
          value={meta.title}
          onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))}
          placeholder="e.g. How Do You Buy Airtime?"
        />
      </div>

      <div>
        <Label>Category</Label>
        <Select value={meta.category} onValueChange={(v) => onCategoryChange(v as TaskCategory)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
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
          onChange={(e) => setMeta((m) => ({ ...m, payout_ksh: e.target.value }))}
          placeholder="25"
        />
      </div>

      <div>
        <Label>Total Slots</Label>
        <Input
          type="number"
          min="1"
          value={meta.total_slots}
          onChange={(e) => setMeta((m) => ({ ...m, total_slots: e.target.value }))}
          placeholder="300"
        />
      </div>

      <div>
        <Label>Difficulty</Label>
        <Select value={meta.difficulty} onValueChange={(v) => setMeta((m) => ({ ...m, difficulty: v as "easy" | "medium" | "hard" }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="easy">Easy</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="hard">Hard</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="sm:col-span-2 lg:col-span-3">
        <Label htmlFor="description">Description (optional)</Label>
        <Input
          id="description"
          value={meta.description}
          onChange={(e) => setMeta((m) => ({ ...m, description: e.target.value }))}
          placeholder="Short description for users"
        />
      </div>

      <div className="sm:col-span-2 lg:col-span-3">
        <Label htmlFor="instructions">Instructions</Label>
        <Textarea
          id="instructions"
          value={meta.instructions}
          onChange={(e) => setMeta((m) => ({ ...m, instructions: e.target.value }))}
          placeholder="Detailed instructions for users on how to complete this task"
          rows={3}
        />
      </div>

      <div className="flex items-center gap-3">
        <Switch
          checked={meta.requires_screenshot}
          onCheckedChange={(v) => setMeta((m) => ({ ...m, requires_screenshot: v }))}
          id="screenshot"
        />
        <Label htmlFor="screenshot">Requires screenshot</Label>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          checked={meta.requires_url}
          onCheckedChange={(v) => setMeta((m) => ({ ...m, requires_url: v }))}
          id="url"
        />
        <Label htmlFor="url">Requires URL submission</Label>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          checked={meta.ai_grading_enabled}
          onCheckedChange={(v) => setMeta((m) => ({ ...m, ai_grading_enabled: v }))}
          id="ai"
        />
        <Label htmlFor="ai">AI grading enabled</Label>
      </div>

      {meta.ai_grading_enabled && (
        <div className="sm:col-span-2 lg:col-span-3">
          <Label htmlFor="rubric">AI Grading Rubric</Label>
          <Textarea
            id="rubric"
            value={meta.ai_rubric}
            onChange={(e) => setMeta((m) => ({ ...m, ai_rubric: e.target.value }))}
            placeholder="Describe what a good submission looks like. E.g. 'Approve if all required questions answered, open text is coherent and meets min word count.'"
            rows={3}
          />
        </div>
      )}

      <div>
        <Label htmlFor="minWords">Min Word Count</Label>
        <Input
          id="minWords"
          type="number"
          min="0"
          value={meta.min_word_count}
          onChange={(e) => setMeta((m) => ({ ...m, min_word_count: e.target.value }))}
          placeholder="0"
        />
      </div>
    </div>
  );
}

function Step2TaskData({
  category,
  taskData,
  setTaskData,
}: {
  category: TaskCategory;
  taskData: any;
  setTaskData: React.Dispatch<React.SetStateAction<any>>;
}) {
  if (category === "survey") {
    return <SurveyBuilder taskData={taskData} setTaskData={setTaskData} />;
  }
  if (category === "data_labeling") {
    return <DataLabelingBuilder taskData={taskData} setTaskData={setTaskData} />;
  }
  if (category === "social_engagement") {
    return <SocialEngagementBuilder taskData={taskData} setTaskData={setTaskData} />;
  }
  if (category === "verification") {
    return <VerificationBuilder taskData={taskData} setTaskData={setTaskData} />;
  }
  if (category === "content_creation") {
    return <ContentCreationBuilder taskData={taskData} setTaskData={setTaskData} />;
  }
  if (category === "watch_respond") {
    return <WatchRespondBuilder taskData={taskData} setTaskData={setTaskData} />;
  }
  return null;
}

function SurveyBuilder({
  taskData,
  setTaskData,
}: {
  taskData: any;
  setTaskData: React.Dispatch<React.SetStateAction<any>>;
}) {
  const questions = (taskData.questions as Question[]) ?? [];

  function addQuestion(type: Question["type"]) {
    const newQuestion: Question = {
      id: generateQuestionId(),
      text: "",
      type,
      required: true,
      ...(type === "multiple_choice" || type === "multi_select" ? { options: [""] } : {}),
      ...(type === "open_text" ? { min_words: 0, max_words: 500 } : {}),
      ...(type === "rating" ? { scale: 5 } : {}),
    } as Question;
    setTaskData((d: any) => ({ ...d, questions: [...questions, newQuestion] }));
  }

  function updateQuestion(index: number, updates: Partial<Question>) {
    setTaskData((d: any) => ({
      ...d,
      questions: questions.map((q, i) => (i === index ? { ...q, ...updates } : q)),
    }));
  }

  function removeQuestion(index: number) {
    setTaskData((d: any) => ({
      ...d,
      questions: questions.filter((_, i) => i !== index),
    }));
  }

  function addOption(qIndex: number) {
    const q = questions[qIndex] as any;
    const options = [...(q.options ?? []), ""];
    updateQuestion(qIndex, { options });
  }

  function updateOption(qIndex: number, oIndex: number, value: string) {
    const q = questions[qIndex] as any;
    const options = [...(q.options ?? [])];
    options[oIndex] = value;
    updateQuestion(qIndex, { options });
  }

  function removeOption(qIndex: number, oIndex: number) {
    const q = questions[qIndex] as any;
    const options = (q.options ?? []).filter((_: unknown, i: number) => i !== oIndex);
    updateQuestion(qIndex, { options });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => addQuestion("multiple_choice")}>
          <Plus className="mr-1 h-3 w-3" /> Multiple Choice
        </Button>
        <Button variant="outline" size="sm" onClick={() => addQuestion("open_text")}>
          <Plus className="mr-1 h-3 w-3" /> Open Text
        </Button>
        <Button variant="outline" size="sm" onClick={() => addQuestion("multi_select")}>
          <Plus className="mr-1 h-3 w-3" /> Multi Select
        </Button>
        <Button variant="outline" size="sm" onClick={() => addQuestion("rating")}>
          <Plus className="mr-1 h-3 w-3" /> Rating
        </Button>
        <Button variant="outline" size="sm" onClick={() => addQuestion("yes_no")}>
          <Plus className="mr-1 h-3 w-3" /> Yes/No
        </Button>
      </div>

      {questions.length === 0 && (
        <p className="text-sm text-muted-foreground">No questions yet. Add one above.</p>
      )}

      {questions.map((q, qi) => (
        <Card key={q.id}>
          <CardContent className="space-y-3 pt-4">
            <div className="flex items-start gap-2">
              <GripVertical className="mt-2 h-4 w-4 text-muted-foreground" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="muted">{q.type.replace("_", " ")}</Badge>
                  <Switch
                    checked={q.required}
                    onCheckedChange={(v) => updateQuestion(qi, { required: v })}
                  />
                  <span className="text-xs text-muted-foreground">Required</span>
                </div>
                <Input
                  value={q.text}
                  onChange={(e) => updateQuestion(qi, { text: e.target.value })}
                  placeholder="Question text"
                />
                {(q.type === "multiple_choice" || q.type === "multi_select") && (
                  <div className="space-y-1">
                    {(q as any).options?.map((opt: string, oi: number) => (
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
                          disabled={((q as any).options ?? []).length <= 2}
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
                        value={(q as any).min_words ?? 0}
                        onChange={(e) => updateQuestion(qi, { min_words: Number(e.target.value) })}
                        className="w-24"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Max Words</Label>
                      <Input
                        type="number"
                        value={(q as any).max_words ?? 500}
                        onChange={(e) => updateQuestion(qi, { max_words: Number(e.target.value) })}
                        className="w-24"
                      />
                    </div>
                  </div>
                )}
                {q.type === "rating" && (
                  <div>
                    <Label className="text-xs">Scale</Label>
                    <Select
                      value={String((q as any).scale ?? 5)}
                      onValueChange={(v) => updateQuestion(qi, { scale: Number(v) })}
                    >
                      <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">1-5</SelectItem>
                        <SelectItem value="10">1-10</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeQuestion(qi)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DataLabelingBuilder({
  taskData,
  setTaskData,
}: {
  taskData: any;
  setTaskData: React.Dispatch<React.SetStateAction<any>>;
}) {
  const items = (taskData.items as Array<{ id: string; content: string; content_type: string; label_options: string[]; correct_label?: string }>) ?? [];

  function addItem() {
    const newItem = {
      id: `item${Date.now()}`,
      content: "",
      content_type: "text",
      label_options: ["Positive", "Negative", "Neutral"],
      correct_label: "",
    };
    setTaskData((d: any) => ({ ...d, items: [...items, newItem] }));
  }

  function updateItem(index: number, updates: Record<string, unknown>) {
    setTaskData((d: any) => ({
      ...d,
      items: items.map((item, i) => (i === index ? { ...item, ...updates } : item)),
    }));
  }

  function removeItem(index: number) {
    setTaskData((d: any) => ({ ...d, items: items.filter((_, i) => i !== index) }));
  }

  return (
    <div className="space-y-4">
      <Button variant="outline" size="sm" onClick={addItem}>
        <Plus className="mr-1 h-3 w-3" /> Add Item
      </Button>
      {items.length === 0 && <p className="text-sm text-muted-foreground">No items yet.</p>}
      {items.map((item, i) => (
        <Card key={item.id}>
          <CardContent className="space-y-3 pt-4">
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <Input
                  value={item.content}
                  onChange={(e) => updateItem(i, { content: e.target.value })}
                  placeholder="Text or image URL to label"
                />
                <Input
                  value={(item.label_options ?? []).join(", ")}
                  onChange={(e) => updateItem(i, { label_options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                  placeholder="Label options (comma separated)"
                />
                <Input
                  value={item.correct_label ?? ""}
                  onChange={(e) => updateItem(i, { correct_label: e.target.value })}
                  placeholder="Correct label (optional)"
                />
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeItem(i)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SocialEngagementBuilder({
  taskData,
  setTaskData,
}: {
  taskData: any;
  setTaskData: React.Dispatch<React.SetStateAction<any>>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label>Platform</Label>
        <Input
          value={(taskData.platform as string) ?? ""}
          onChange={(e) => setTaskData((d: any) => ({ ...d, platform: e.target.value }))}
          placeholder="facebook, twitter, instagram, tiktok"
        />
      </div>
      <div>
        <Label>Action</Label>
        <Input
          value={(taskData.action as string) ?? ""}
          onChange={(e) => setTaskData((d: any) => ({ ...d, action: e.target.value }))}
          placeholder="follow, like, share, comment"
        />
      </div>
      <div className="sm:col-span-2">
        <Label>Target URL</Label>
        <Input
          value={(taskData.target_url as string) ?? ""}
          onChange={(e) => setTaskData((d: any) => ({ ...d, target_url: e.target.value }))}
          placeholder="https://facebook.com/pagename"
        />
      </div>
      <div className="sm:col-span-2">
        <Label>Target Name</Label>
        <Input
          value={(taskData.target_name as string) ?? ""}
          onChange={(e) => setTaskData((d: any) => ({ ...d, target_name: e.target.value }))}
          placeholder="Page or account name"
        />
      </div>
      <div className="flex items-center gap-3">
        <Switch
          checked={(taskData.requires_screenshot as boolean) ?? true}
          onCheckedChange={(v) => setTaskData((d: any) => ({ ...d, requires_screenshot: v }))}
        />
        <Label>Requires screenshot</Label>
      </div>
      <div className="flex items-center gap-3">
        <Switch
          checked={(taskData.requires_username as boolean) ?? false}
          onCheckedChange={(v) => setTaskData((d: any) => ({ ...d, requires_username: v }))}
        />
        <Label>Requires username</Label>
      </div>
    </div>
  );
}

function VerificationBuilder({
  taskData,
  setTaskData,
}: {
  taskData: any;
  setTaskData: React.Dispatch<React.SetStateAction<any>>;
}) {
  const questions = (taskData.questions as Array<{ id: string; text: string; type: string }>) ?? [];

  function addQuestion() {
    setTaskData((d: any) => ({
      ...d,
      questions: [...questions, { id: `v${Date.now()}`, text: "", type: "yes_no" }],
    }));
  }

  function updateQuestion(index: number, text: string) {
    setTaskData((d: any) => ({
      ...d,
      questions: questions.map((q, i) => (i === index ? { ...q, text } : q)),
    }));
  }

  function removeQuestion(index: number) {
    setTaskData((d: any) => ({ ...d, questions: questions.filter((_, i) => i !== index) }));
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label>Target URL</Label>
          <Input
            value={(taskData.target_url as string) ?? ""}
            onChange={(e) => setTaskData((d: any) => ({ ...d, target_url: e.target.value }))}
            placeholder="https://..."
          />
        </div>
        <div className="sm:col-span-2">
          <Label>Target Description</Label>
          <Input
            value={(taskData.target_description as string) ?? ""}
            onChange={(e) => setTaskData((d: any) => ({ ...d, target_description: e.target.value }))}
            placeholder="What user is checking"
          />
        </div>
        <div>
          <Label>Min Time (seconds)</Label>
          <Input
            type="number"
            value={(taskData.min_time_seconds as number) ?? 120}
            onChange={(e) => setTaskData((d: any) => ({ ...d, min_time_seconds: Number(e.target.value) }))}
          />
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={(taskData.requires_screenshot as boolean) ?? true}
            onCheckedChange={(v) => setTaskData((d: any) => ({ ...d, requires_screenshot: v }))}
          />
          <Label>Requires screenshot</Label>
        </div>
      </div>
      <Separator />
      <div>
        <Label>Verification Questions</Label>
        <Button variant="outline" size="sm" className="mt-2" onClick={addQuestion}>
          <Plus className="mr-1 h-3 w-3" /> Add Question
        </Button>
      </div>
      {questions.map((q, i) => (
        <div key={q.id} className="flex gap-2">
          <Input
            value={q.text}
            onChange={(e) => updateQuestion(i, e.target.value)}
            placeholder="Verification question"
          />
          <Button variant="ghost" size="sm" onClick={() => removeQuestion(i)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function ContentCreationBuilder({
  taskData,
  setTaskData,
}: {
  taskData: any;
  setTaskData: React.Dispatch<React.SetStateAction<any>>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <Label>Subtype</Label>
        <Select
          value={(taskData.subtype as string) ?? "review"}
          onValueChange={(v) => setTaskData((d: any) => ({ ...d, subtype: v }))}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
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
          value={(taskData.language as string) ?? "english"}
          onChange={(e) => setTaskData((d: any) => ({ ...d, language: e.target.value }))}
        />
      </div>
      <div className="sm:col-span-2">
        <Label>Prompt</Label>
        <Textarea
          value={(taskData.prompt as string) ?? ""}
          onChange={(e) => setTaskData((d: any) => ({ ...d, prompt: e.target.value }))}
          placeholder="Write a 2-3 sentence review for this product..."
          rows={3}
        />
      </div>
      <div>
        <Label>Min Words</Label>
        <Input
          type="number"
          value={(taskData.min_words as number) ?? 30}
          onChange={(e) => setTaskData((d: any) => ({ ...d, min_words: Number(e.target.value) }))}
        />
      </div>
      <div>
        <Label>Max Words</Label>
        <Input
          type="number"
          value={(taskData.max_words as number) ?? 150}
          onChange={(e) => setTaskData((d: any) => ({ ...d, max_words: Number(e.target.value) }))}
        />
      </div>
    </div>
  );
}

function WatchRespondBuilder({
  taskData,
  setTaskData,
}: {
  taskData: any;
  setTaskData: React.Dispatch<React.SetStateAction<any>>;
}) {
  const questions = (taskData.questions as Array<{ id: string; text: string; type: string; min_words?: number }>) ?? [];

  function addQuestion() {
    setTaskData((d: any) => ({
      ...d,
      questions: [...questions, { id: `w${Date.now()}`, text: "", type: "open_text", min_words: 10 }],
    }));
  }

  function updateQuestion(index: number, updates: Record<string, unknown>) {
    setTaskData((d: any) => ({
      ...d,
      questions: questions.map((q, i) => (i === index ? { ...q, ...updates } : q)),
    }));
  }

  function removeQuestion(index: number) {
    setTaskData((d: any) => ({ ...d, questions: questions.filter((_, i) => i !== index) }));
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Video URL</Label>
        <Input
          value={(taskData.video_url as string) ?? ""}
          onChange={(e) => setTaskData((d: any) => ({ ...d, video_url: e.target.value }))}
          placeholder="https://youtube.com/..."
        />
      </div>
      <div>
        <Label>Min Watch Seconds</Label>
        <Input
          type="number"
          value={(taskData.min_watch_seconds as number) ?? 60}
          onChange={(e) => setTaskData((d: any) => ({ ...d, min_watch_seconds: Number(e.target.value) }))}
        />
      </div>
      <Separator />
      <div>
        <Label>Questions</Label>
        <Button variant="outline" size="sm" className="mt-2" onClick={addQuestion}>
          <Plus className="mr-1 h-3 w-3" /> Add Question
        </Button>
      </div>
      {questions.map((q, i) => (
        <Card key={q.id}>
          <CardContent className="space-y-2 pt-4">
            <Input
              value={q.text}
              onChange={(e) => updateQuestion(i, { text: e.target.value })}
              placeholder="Question about the video"
            />
            <div className="flex gap-2">
              <Input
                type="number"
                value={q.min_words ?? 10}
                onChange={(e) => updateQuestion(i, { min_words: Number(e.target.value) })}
                placeholder="Min words"
                className="w-24"
              />
              <Button variant="ghost" size="sm" onClick={() => removeQuestion(i)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Step3Publishing({
  publishImmediately,
  setPublishImmediately,
  publishAt,
  setPublishAt,
  expiresAt,
  setExpiresAt,
}: {
  publishImmediately: boolean;
  setPublishImmediately: (v: boolean) => void;
  publishAt: string;
  setPublishAt: (v: string) => void;
  expiresAt: string;
  setExpiresAt: (v: string) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex items-center gap-3">
        <Switch checked={publishImmediately} onCheckedChange={setPublishImmediately} id="publish-now" />
        <Label htmlFor="publish-now">Publish immediately when saved</Label>
      </div>

      {!publishImmediately && (
        <div>
          <Label htmlFor="publish-at">Schedule Publish Date</Label>
          <Input
            id="publish-at"
            type="datetime-local"
            value={publishAt}
            onChange={(e) => setPublishAt(e.target.value)}
          />
        </div>
      )}

      <div>
        <Label htmlFor="expires-at">Expiry Date (optional)</Label>
        <Input
          id="expires-at"
          type="datetime-local"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
        />
      </div>
    </div>
  );
}
