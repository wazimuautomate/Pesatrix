"use client";

import { useState, useCallback, useRef } from "react";
import { Loader2, Upload, X, ChevronDown, ChevronRight, AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type TaskCategory,
  CATEGORY_LABELS,
  generateQuestionId,
} from "@/lib/task-types";
import { normalizeDatetime } from "@/lib/datetime";

type ParsedTask = {
  title: string;
  category: TaskCategory;
  description: string;
  instructions: string;
  payout_ksh: number | string;
  total_slots: number | string;
  difficulty: string;
  ai_grading_enabled: boolean;
  ai_rubric: string;
  requires_screenshot: boolean;
  requires_url: boolean;
  min_word_count: number | string;
  task_data: Record<string, unknown>;
  publish_at: string | null;
  expires_at: string | null;
  _error?: string;
  _valid: boolean;
};

type TaskImportPanelProps = {
  onClose: () => void;
  onImported: () => void;
};

export function TaskImportPanel({ onClose, onImported }: TaskImportPanelProps) {
  const [parsedTasks, setParsedTasks] = useState<ParsedTask[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [publishAll, setPublishAll] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ imported: number; failed: { index: number; reason: string }[] } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function normalizeTask(raw: Record<string, unknown>): ParsedTask {
    const category = (raw.category as string) ?? "survey";
    const validCategories: TaskCategory[] = ["survey", "data_labeling", "social_engagement", "verification", "content_creation", "watch_respond"];
    const safeCategory = validCategories.includes(category as TaskCategory) ? (category as TaskCategory) : "survey";

    const td = (raw.task_data as Record<string, unknown>) ?? {};
    const questions = (td.questions as Array<Record<string, unknown>>) ?? [];
    const normalizedQuestions = questions.map((q) => ({
      id: q.id ?? generateQuestionId(),
      text: q.text ?? "",
      type: q.type ?? "open_text",
      required: q.required ?? true,
      min_words: q.min_words ?? 0,
      max_words: (q as Record<string, unknown>).max_words ?? 500,
      options: (q.options as string[]) ?? [],
      scale: (q as Record<string, unknown>).scale ?? 5,
    }));

    const normalizedTaskData: Record<string, unknown> = {
      type: safeCategory,
      ...td,
      questions: normalizedQuestions,
    };

    if (safeCategory === "watch_respond") {
      normalizedTaskData.video_url = td.video_url ?? "";
      normalizedTaskData.video_duration_seconds = td.video_duration_seconds ?? 0;
      normalizedTaskData.min_watch_seconds = td.min_watch_seconds ?? 60;
    }

    if (safeCategory === "survey") {
      normalizedTaskData.questions = normalizedQuestions;
    }

    if (safeCategory === "data_labeling") {
      normalizedTaskData.items = (td.items as Array<Record<string, unknown>>) ?? [];
    }

    if (safeCategory === "social_engagement") {
      normalizedTaskData.platform = td.platform ?? "";
      normalizedTaskData.action = td.action ?? "";
      normalizedTaskData.target_url = td.target_url ?? "";
      normalizedTaskData.target_name = td.target_name ?? "";
      normalizedTaskData.requires_screenshot = td.requires_screenshot ?? true;
      normalizedTaskData.requires_username = td.requires_username ?? false;
    }

    if (safeCategory === "verification") {
      normalizedTaskData.target_url = td.target_url ?? "";
      normalizedTaskData.target_description = td.target_description ?? "";
      normalizedTaskData.questions = normalizedQuestions;
      normalizedTaskData.requires_screenshot = td.requires_screenshot ?? true;
      normalizedTaskData.min_time_seconds = td.min_time_seconds ?? 120;
    }

    if (safeCategory === "content_creation") {
      normalizedTaskData.subtype = td.subtype ?? "review";
      normalizedTaskData.prompt = td.prompt ?? "";
      normalizedTaskData.media_url = td.media_url ?? null;
      normalizedTaskData.min_words = td.min_words ?? 30;
      normalizedTaskData.max_words = td.max_words ?? 150;
      normalizedTaskData.language = td.language ?? "english";
    }

    const errors: string[] = [];
    const title = String(raw.title ?? "").trim();
    if (!title || title.length < 3) errors.push("Title must be at least 3 characters");
    const payout = Number(raw.payout_ksh);
    if (isNaN(payout) || payout < 20 || payout > 50) errors.push("payout_ksh must be 20–50");
    const slots = Number(raw.total_slots);
    if (isNaN(slots) || slots < 100 || slots > 400) errors.push("total_slots must be 100–400");
    const instructions = String(raw.instructions ?? "").trim();
    if (!instructions || instructions.length < 10) errors.push("Instructions must be at least 10 characters");

    if (safeCategory === "watch_respond") {
      const videoUrl = String(td.video_url ?? "").trim();
      if (!videoUrl) errors.push("video_url is required");
      const minWatch = Number(td.min_watch_seconds ?? 0);
      const duration = Number(td.video_duration_seconds ?? 0);
      if (duration > 0 && minWatch < Math.ceil(duration * 0.6)) {
        errors.push(`min_watch_seconds must be >= 60% of duration (${Math.ceil(duration * 0.6)}s)`);
      }
      if (questions.length === 0) errors.push("questions must be non-empty");
    }

    return {
      title,
      category: safeCategory,
      description: String(raw.description ?? ""),
      instructions,
      payout_ksh: isNaN(payout) ? "" : payout,
      total_slots: isNaN(slots) ? "" : slots,
      difficulty: ["easy", "medium", "hard"].includes(String(raw.difficulty)) ? String(raw.difficulty) : "easy",
      ai_grading_enabled: raw.ai_grading_enabled !== false,
      ai_rubric: String(raw.ai_rubric ?? ""),
      requires_screenshot: Boolean(raw.requires_screenshot),
      requires_url: Boolean(raw.requires_url),
      min_word_count: isNaN(Number(raw.min_word_count)) ? 0 : Number(raw.min_word_count),
      task_data: normalizedTaskData,
      publish_at: normalizeDatetime(raw.publish_at),
      expires_at: normalizeDatetime(raw.expires_at),
      _error: errors.length > 0 ? errors.join("; ") : undefined,
      _valid: errors.length === 0,
    };
  }

  function processJson(data: unknown) {
    setParseError(null);
    setImportResults(null);

    let rawArray: Record<string, unknown>[];
    if (Array.isArray(data)) {
      rawArray = data as Record<string, unknown>[];
    } else if (typeof data === "object" && data !== null && !Array.isArray(data)) {
      rawArray = [data as Record<string, unknown>];
    } else {
      setParseError("Invalid JSON: expected an object or array of task objects");
      return;
    }

    if (rawArray.length === 0) {
      setParseError("JSON array is empty");
      return;
    }

    const tasks = rawArray.map((raw) => normalizeTask(raw));
    setParsedTasks(tasks);
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const json = JSON.parse(text);
        processJson(json);
      } catch {
        setParseError("Invalid JSON file — please check the file format");
      }
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function updateTask(index: number, updates: Partial<ParsedTask>) {
    setParsedTasks((prev) =>
      prev.map((t, i) => (i === index ? { ...t, ...updates } : t))
    );
  }

  function updateTaskData(index: number, updates: Record<string, unknown>) {
    setParsedTasks((prev) =>
      prev.map((t, i) =>
        i === index ? { ...t, task_data: { ...t.task_data, ...updates } } : t
      )
    );
  }

  function updateQuestion(index: number, qIndex: number, updates: Record<string, unknown>) {
    setParsedTasks((prev) =>
      prev.map((t, i) => {
        if (i !== index) return t;
        const questions = ((t.task_data.questions as Array<Record<string, unknown>>) ?? []);
        return {
          ...t,
          task_data: {
            ...t.task_data,
            questions: questions.map((q, qi) =>
              qi === qIndex ? { ...q, ...updates } : q
            ),
          },
        };
      })
    );
  }

  function addQuestion(index: number, type: string) {
    setParsedTasks((prev) =>
      prev.map((t, i) => {
        if (i !== index) return t;
        const questions = ((t.task_data.questions as Array<Record<string, unknown>>) ?? []);
        return {
          ...t,
          task_data: {
            ...t.task_data,
            questions: [
              ...questions,
              {
                id: generateQuestionId(),
                text: "",
                type,
                required: true,
                min_words: 0,
                options: type === "multiple_choice" ? [""] : [],
                scale: 5,
              },
            ],
          },
        };
      })
    );
  }

  function removeQuestion(index: number, qIndex: number) {
    setParsedTasks((prev) =>
      prev.map((t, i) => {
        if (i !== index) return t;
        const questions = ((t.task_data.questions as Array<Record<string, unknown>>) ?? []);
        return {
          ...t,
          task_data: {
            ...t.task_data,
            questions: questions.filter((_, qi) => qi !== qIndex),
          },
        };
      })
    );
  }

  function removeTask(index: number) {
    setParsedTasks((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleImport(publish: boolean) {
    setImporting(true);
    try {
      const tasksToSend = parsedTasks.map((t) => ({
        title: t.title,
        category: t.category,
        description: t.description || null,
        instructions: t.instructions,
        payout_ksh: Number(t.payout_ksh),
        total_slots: Number(t.total_slots),
        difficulty: t.difficulty,
        ai_grading_enabled: t.ai_grading_enabled,
        ai_rubric: t.ai_rubric || null,
        requires_screenshot: t.requires_screenshot,
        requires_url: t.requires_url,
        min_word_count: Number(t.min_word_count),
        task_data: t.task_data,
        publish_at: publish ? normalizeDatetime(t.publish_at) : null,
        expires_at: normalizeDatetime(t.expires_at),
      }));

      const res = await fetch("/api/admin/tasks/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: tasksToSend, publishAll: publish }),
      });

      const result = await res.json();
      if (!res.ok) {
        toast.error(result?.error?.message ?? result?.error ?? "Import failed");
        return;
      }

      setImportResults({
        imported: result.imported,
        failed: result.failed ?? [],
      });

      if (result.imported > 0) {
        toast.success(`${result.imported} tasks imported successfully`);
        if (result.failed?.length > 0) {
          toast.warning(`${result.failed.length} tasks failed validation`);
        }
        onImported();
      }
    } catch (err) {
      toast.error("Network error during import");
    } finally {
      setImporting(false);
    }
  }

  const validCount = parsedTasks.filter((t) => t._valid).length;
  const invalidCount = parsedTasks.filter((t) => !t._valid).length;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-4xl bg-background shadow-xl overflow-y-auto">
        <div className="sticky top-0 z-10 bg-background border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-navy">Import Tasks</h2>
            <p className="text-sm text-muted-foreground">
              Upload a JSON file, review and edit fields, then save or publish
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {parsedTasks.length === 0 && !parseError && (
            <div
              className={`rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
                isDragging
                  ? "border-pesatrix-blue bg-pesatrix-blue/5"
                  : "border-outline-variant/40"
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-sm font-medium text-navy mb-1">
                Drop your JSON file here
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                or click to browse
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileInput}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose File
              </Button>
            </div>
          )}

          {parseError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-destructive">Parse Error</p>
                <p className="text-sm text-muted-foreground">{parseError}</p>
              </div>
            </div>
          )}

          {parsedTasks.length > 0 && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="success">{validCount} valid</Badge>
                  {invalidCount > 0 && (
                    <Badge variant="destructive">{invalidCount} invalid</Badge>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {parsedTasks.length} tasks loaded
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={publishAll}
                    onCheckedChange={setPublishAll}
                    id="import-publish-all"
                  />
                  <Label htmlFor="import-publish-all" className="text-sm">
                    Publish all on import
                  </Label>
                </div>
              </div>

              <div className="space-y-4">
                {parsedTasks.map((task, idx) => (
                  <ImportTaskCard
                    key={idx}
                    index={idx}
                    task={task}
                    onUpdate={(updates) => updateTask(idx, updates)}
                    onUpdateTaskData={(updates) => updateTaskData(idx, updates)}
                    onUpdateQuestion={(qIdx, updates) =>
                      updateQuestion(idx, qIdx, updates)
                    }
                    onAddQuestion={(type) => addQuestion(idx, type)}
                    onRemoveQuestion={(qIdx) => removeQuestion(idx, qIdx)}
                    onRemove={() => removeTask(idx)}
                  />
                ))}
              </div>

              {importResults && (
                <div className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-teal" />
                    <span className="font-medium">
                      {importResults.imported} tasks imported
                    </span>
                  </div>
                  {importResults.failed.length > 0 && (
                    <div className="space-y-1">
                      {importResults.failed.map((f) => (
                        <div
                          key={f.index}
                          className="flex items-start gap-2 text-sm text-destructive"
                        >
                          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                          <span>
                            Task #{f.index + 1}: {f.reason}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-background border-t py-3">
                <Button variant="outline" onClick={onClose} disabled={importing}>
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleImport(false)}
                  disabled={importing || validCount === 0}
                >
                  {importing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Save All as Drafts
                </Button>
                <Button
                  onClick={() => handleImport(true)}
                  disabled={importing || validCount === 0}
                >
                  {importing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Publish All
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ImportTaskCard({
  index,
  task,
  onUpdate,
  onUpdateTaskData,
  onUpdateQuestion,
  onAddQuestion,
  onRemoveQuestion,
  onRemove,
}: {
  index: number;
  task: ParsedTask;
  onUpdate: (updates: Partial<ParsedTask>) => void;
  onUpdateTaskData: (updates: Record<string, unknown>) => void;
  onUpdateQuestion: (qIndex: number, updates: Record<string, unknown>) => void;
  onAddQuestion: (type: string) => void;
  onRemoveQuestion: (qIndex: number) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const questions =
    ((task.task_data.questions as Array<Record<string, unknown>>) ?? []);

  return (
    <div
      className={`rounded-lg border ${
        task._valid ? "border-green-200" : "border-destructive/40"
      }`}
    >
      <button
        className="w-full flex items-center gap-3 p-4 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-navy truncate">
              {task.title || "(untitled)"}
            </span>
            <Badge
              variant="outline"
              className="shrink-0"
            >
              {CATEGORY_LABELS[task.category]}
            </Badge>
            {task._valid ? (
              <CheckCircle2 className="h-4 w-4 text-teal shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            )}
          </div>
          {!task._valid && (
            <p className="text-xs text-destructive mt-0.5 truncate">
              {task._error}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </button>

      {expanded && (
        <div className="border-t px-4 py-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-3">
              <Label>Task Title</Label>
              <Input
                value={task.title}
                onChange={(e) => onUpdate({ title: e.target.value })}
              />
            </div>

            <div>
              <Label>Category</Label>
              <Select
                value={task.category}
                onValueChange={(v) =>
                  onUpdate({ category: v as TaskCategory })
                }
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
                value={task.payout_ksh}
                onChange={(e) =>
                  onUpdate({ payout_ksh: e.target.value })
                }
              />
            </div>

            <div>
              <Label>Total Slots</Label>
              <Input
                type="number"
                value={task.total_slots}
                onChange={(e) =>
                  onUpdate({ total_slots: e.target.value })
                }
              />
            </div>

            <div>
              <Label>Difficulty</Label>
              <Select
                value={task.difficulty}
                onValueChange={(v) => onUpdate({ difficulty: v })}
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
              <Label>Description</Label>
              <Input
                value={task.description}
                onChange={(e) => onUpdate({ description: e.target.value })}
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <Label>Instructions</Label>
              <Textarea
                value={task.instructions}
                onChange={(e) => onUpdate({ instructions: e.target.value })}
                rows={2}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={task.ai_grading_enabled}
                onCheckedChange={(v) =>
                  onUpdate({ ai_grading_enabled: v })
                }
                id={`ai-${index}`}
              />
              <Label htmlFor={`ai-${index}`}>AI Grading</Label>
            </div>

            {task.ai_grading_enabled && (
              <div className="sm:col-span-2">
                <Label>AI Rubric</Label>
                <Textarea
                  value={task.ai_rubric}
                  onChange={(e) => onUpdate({ ai_rubric: e.target.value })}
                  rows={2}
                />
              </div>
            )}

            <div>
              <Label>Min Word Count</Label>
              <Input
                type="number"
                value={task.min_word_count}
                onChange={(e) =>
                  onUpdate({ min_word_count: Number(e.target.value) })
                }
              />
            </div>
          </div>

          {task.category === "watch_respond" && (
            <>
              <Separator />
              <h4 className="font-medium text-navy">Video Settings</h4>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-3">
                  <Label>Video URL</Label>
                  <Input
                    value={String(task.task_data.video_url ?? "")}
                    onChange={(e) =>
                      onUpdateTaskData({ video_url: e.target.value })
                    }
                    placeholder="https://youtube.com/..."
                  />
                </div>
                <div>
                  <Label>Video Duration (seconds)</Label>
                  <Input
                    type="number"
                    value={String(task.task_data.video_duration_seconds ?? "")}
                    onChange={(e) =>
                      onUpdateTaskData({
                        video_duration_seconds: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Min Watch Seconds</Label>
                  <Input
                    type="number"
                    value={String(task.task_data.min_watch_seconds ?? 60)}
                    onChange={(e) =>
                      onUpdateTaskData({
                        min_watch_seconds: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
            </>
          )}

          {task.category === "survey" && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium text-navy mb-2">Questions</h4>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAddQuestion("multiple_choice")}
                  >
                    Multiple Choice
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAddQuestion("open_text")}
                  >
                    Open Text
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAddQuestion("yes_no")}
                  >
                    Yes/No
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAddQuestion("rating")}
                  >
                    Rating
                  </Button>
                </div>
              </div>
            </>
          )}

          {questions.map((q, qi) => (
            <div
              key={String(q.id ?? qi)}
              className="rounded-lg border p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <Badge variant="muted" className="text-xs">
                  {String(q.type ?? "").replace("_", " ")}
                </Badge>
                <Switch
                  checked={q.required as boolean}
                  onCheckedChange={(v) =>
                    onUpdateQuestion(qi, { required: v })
                  }
                />
                <span className="text-xs text-muted-foreground">Required</span>
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemoveQuestion(qi)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <Input
                value={String(q.text ?? "")}
                onChange={(e) =>
                  onUpdateQuestion(qi, { text: e.target.value })
                }
                placeholder="Question text"
              />
              {q.type === "multiple_choice" && (
                <div className="space-y-1">
                  {((q.options as string[]) ?? []).map((opt, oi) => (
                    <Input
                      key={oi}
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...((q.options as string[]) ?? [])];
                        newOpts[oi] = e.target.value;
                        onUpdateQuestion(qi, { options: newOpts });
                      }}
                      placeholder={`Option ${oi + 1}`}
                      className="text-sm"
                    />
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const opts = [...((q.options as string[]) ?? []), ""];
                      onUpdateQuestion(qi, { options: opts });
                    }}
                  >
                    + Add Option
                  </Button>
                </div>
              )}
              {q.type === "open_text" && (
                <div className="flex gap-4">
                  <div>
                    <Label className="text-xs">Min Words</Label>
                    <Input
                      type="number"
                      value={String(q.min_words ?? 0)}
                      onChange={(e) =>
                        onUpdateQuestion(qi, {
                          min_words: Number(e.target.value),
                        })
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
                    value={String(q.scale ?? 5)}
                    onValueChange={(v) =>
                      onUpdateQuestion(qi, { scale: Number(v) })
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
      )}
    </div>
  );
}
