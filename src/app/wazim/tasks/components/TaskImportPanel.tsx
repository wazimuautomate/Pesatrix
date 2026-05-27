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
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  type TaskCategory,
  CATEGORY_LABELS,
  generateQuestionId,
} from "@/lib/task-types";
import { validateTaskFinancials } from "@/lib/financial-limits";
import { normalizeDatetime } from "@/lib/datetime";
import { TaskForm } from "./TaskForm";

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
  visibility_mode: string;
  min_referrals_required: number | string;
  is_starter: boolean;
  starter_day: number | string;
  _errors: string[];
  _originalIndex: number;
};

type FailedRowResponse = {
  row: number;
  title: string;
  errors: string[];
};

type TaskImportPanelProps = {
  onClose: () => void;
  onImported: () => void;
};

const VALID_CATEGORIES: TaskCategory[] = [
  "survey",
  "data_labeling",
  "social_engagement",
  "verification",
  "content_creation",
  "watch_respond",
];

function validateRow(raw: Record<string, unknown>, index: number): { errors: string[]; task: ParsedTask } {
  const errors: string[] = [];

  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) errors.push("title is missing or empty");

  const rawCategory = typeof raw.category === "string" ? raw.category.trim() : "";
  const category: TaskCategory = VALID_CATEGORIES.includes(rawCategory as TaskCategory)
    ? (rawCategory as TaskCategory)
    : rawCategory ? ("survey" as TaskCategory)
    : ("survey" as TaskCategory);
  if (!rawCategory) errors.push("category is missing or empty");
  else if (!VALID_CATEGORIES.includes(rawCategory as TaskCategory)) errors.push(`category "${rawCategory}" is not valid`);

  const instructions = typeof raw.instructions === "string" ? raw.instructions.trim() : "";
  if (!instructions) errors.push("instructions is missing or empty");

  const payoutRaw = raw.payout_ksh;
  const payout = typeof payoutRaw === "number" ? payoutRaw : Number(payoutRaw);
  if (isNaN(payout) || payout <= 0) errors.push("payout_ksh must be a number greater than 0");

  const slotsRaw = raw.total_slots;
  const slots = typeof slotsRaw === "number" ? slotsRaw : Number(slotsRaw);
  if (isNaN(slots) || !Number.isInteger(slots) || slots <= 0) errors.push("total_slots must be an integer greater than 0");

  if (!isNaN(payout) && !isNaN(slots) && Number.isInteger(slots) && payout > 0 && slots > 0) {
    const financialError = validateTaskFinancials({
      payoutKsh: payout,
      totalSlots: slots,
    });
    if (financialError) {
      errors.push(financialError.message);
    }
  }

  let taskData: Record<string, unknown> = {};
  const tdRaw = raw.task_data;
  if (tdRaw === null || tdRaw === undefined) {
    errors.push("task_data is required");
  } else if (typeof tdRaw === "string") {
    try {
      const parsed = JSON.parse(tdRaw);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        errors.push("task_data must be a valid JSON object");
      } else {
        taskData = parsed;
      }
    } catch {
      errors.push("task_data must be a valid JSON object");
    }
  } else if (typeof tdRaw !== "object" || Array.isArray(tdRaw)) {
    errors.push("task_data must be a valid JSON object");
  } else {
    taskData = tdRaw as Record<string, unknown>;
  }

  let publishAt: string | null = null;
  if (raw.publish_at !== undefined && raw.publish_at !== null && raw.publish_at !== "") {
    const d = new Date(String(raw.publish_at));
    if (isNaN(d.getTime())) {
      errors.push("publish_at is not a valid date");
    } else {
      publishAt = d.toISOString();
    }
  }

  let expiresAt: string | null = null;
  if (raw.expires_at !== undefined && raw.expires_at !== null && raw.expires_at !== "") {
    const d = new Date(String(raw.expires_at));
    if (isNaN(d.getTime())) {
      errors.push("expires_at is not a valid date");
    } else {
      expiresAt = d.toISOString();
    }
  }

  const visibilityModeRaw = String(raw.visibility_mode ?? "all").trim();
  const visibility_mode = ["all", "referral_gated", "assigned_only", "proof_tier"].includes(visibilityModeRaw)
    ? visibilityModeRaw
    : "all";

  const minReferralsRaw = raw.min_referrals_required;
  const min_referrals_required = typeof minReferralsRaw === "number"
    ? minReferralsRaw
    : isNaN(Number(minReferralsRaw))
    ? (visibility_mode === "referral_gated" ? 3 : 0)
    : Number(minReferralsRaw);

  if (visibility_mode === "referral_gated" && min_referrals_required < 3) {
    errors.push("min_referrals_required must be at least 3 for referral gated tasks");
  }

  const is_starter = raw.is_starter === true || raw.is_starter === "true";
  const starterDayRaw = raw.starter_day;
  const starter_day = typeof starterDayRaw === "number"
    ? starterDayRaw
    : isNaN(Number(starterDayRaw))
    ? (is_starter ? 1 : "")
    : Number(starterDayRaw);

  if (is_starter && (isNaN(Number(starter_day)) || Number(starter_day) < 1 || Number(starter_day) > 6)) {
    errors.push("starter_day must be an integer between 1 and 6 for starter tasks");
  }

  const td = taskData;
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
    type: category,
    ...td,
    questions: normalizedQuestions,
  };

  if (category === "watch_respond") {
    normalizedTaskData.video_url = td.video_url ?? "";
    normalizedTaskData.video_duration_seconds = td.video_duration_seconds ?? 0;
    normalizedTaskData.min_watch_seconds = td.min_watch_seconds ?? 60;
  }
  if (category === "survey") {
    normalizedTaskData.questions = normalizedQuestions;
  }
  if (category === "data_labeling") {
    const rawItems = (td.items as Array<Record<string, unknown>>) ?? [];
    const labelOptions =
      ((td.label_options as string[]) ?? (rawItems[0]?.label_options as string[]) ?? ["Positive", "Negative", "Neutral"])
        .map((label) => String(label).trim())
        .filter(Boolean);
    normalizedTaskData.subtype = td.subtype ?? "sentiment";
    normalizedTaskData.label_options = Array.from(new Set(labelOptions));
    normalizedTaskData.items = rawItems.map((item, itemIndex) => ({
      id: item.id ?? `item${itemIndex + 1}`,
      content: item.content ?? "",
      content_type: item.content_type === "image" ? "image_url" : item.content_type ?? "text",
      correct_label: item.correct_label ?? "",
    }));
    normalizedTaskData.batch_size = (normalizedTaskData.items as Array<unknown>).length;
  }
  if (category === "social_engagement") {
    normalizedTaskData.platform = td.platform ?? "";
    normalizedTaskData.action = td.action ?? "";
    normalizedTaskData.target_url = td.target_url ?? "";
    normalizedTaskData.target_name = td.target_name ?? "";
    normalizedTaskData.requires_screenshot = td.requires_screenshot ?? true;
    normalizedTaskData.requires_username = td.requires_username ?? false;
  }
  if (category === "verification") {
    normalizedTaskData.target_url = td.target_url ?? "";
    normalizedTaskData.target_description = td.target_description ?? "";
    normalizedTaskData.questions = normalizedQuestions;
    normalizedTaskData.requires_screenshot = td.requires_screenshot ?? true;
    normalizedTaskData.min_time_seconds = td.min_time_seconds ?? 120;
  }
  if (category === "content_creation") {
    normalizedTaskData.subtype = td.subtype ?? "review";
    normalizedTaskData.prompt = td.prompt ?? "";
    normalizedTaskData.media_url = td.media_url ?? null;
    normalizedTaskData.min_words = td.min_words ?? 30;
    normalizedTaskData.max_words = td.max_words ?? 150;
    normalizedTaskData.language = td.language ?? "english";
  }

  const task: ParsedTask = {
    title,
    category,
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
    publish_at: publishAt,
    expires_at: expiresAt,
    visibility_mode,
    min_referrals_required,
    is_starter,
    starter_day,
    _errors: errors,
    _originalIndex: index,
  };

  return { errors, task };
}

export function TaskImportPanel({ onClose, onImported }: TaskImportPanelProps) {
  const [parsedTasks, setParsedTasks] = useState<ParsedTask[]>([]);
  const [jsonInput, setJsonInput] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);

  const [savedCount, setSavedCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingTaskIndex, setEditingTaskIndex] = useState<number | null>(null);

  function processJson(data: unknown) {
    setParseError(null);
    setSavedCount(0);

    if (data === null || typeof data !== "object") {
      setParseError("Invalid JSON file. Please check the file format.");
      return;
    }

    let rawArray: Record<string, unknown>[];
    if (Array.isArray(data)) {
      rawArray = data;
    } else {
      rawArray = [data as Record<string, unknown>];
    }

    if (rawArray.length === 0) {
      setParseError("JSON file contains no tasks");
      return;
    }

    const tasks: ParsedTask[] = [];
    for (let i = 0; i < rawArray.length; i++) {
      const { task } = validateRow(rawArray[i], i);
      tasks.push(task);
    }
    setParsedTasks(tasks);
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        setJsonInput(text);
        const json = JSON.parse(text);
        processJson(json);
      } catch {
        setParseError("Invalid JSON file. Please check the file format.");
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

  function handlePasteImport() {
    try {
      const json = JSON.parse(jsonInput);
      processJson(json);
    } catch {
      setParseError("Invalid JSON file. Please check the file format.");
    }
  }

  function updateTask(index: number, updates: Partial<ParsedTask>) {
    setParsedTasks((prev) => {
      const next = prev.map((t, i) => {
        if (i !== index) return t;
        const merged = { ...t, ...updates };
        const revalidate = validateRow(merged as unknown as Record<string, unknown>, t._originalIndex);
        return { ...merged, _errors: revalidate.errors };
      });
      return next;
    });
  }

  async function handleFormSave(payload: Record<string, unknown>, publish?: boolean) {
    if (editingTaskIndex === null) return;
    
    const updatedTask: ParsedTask = {
      title: String(payload.title),
      category: payload.category as TaskCategory,
      description: String(payload.description ?? ""),
      instructions: String(payload.instructions),
      payout_ksh: Number(payload.payout_ksh),
      total_slots: Number(payload.total_slots),
      difficulty: String(payload.difficulty),
      ai_grading_enabled: Boolean(payload.ai_grading_enabled),
      ai_rubric: String(payload.ai_rubric ?? ""),
      requires_screenshot: Boolean(payload.requires_screenshot),
      requires_url: Boolean(payload.requires_url),
      min_word_count: Number(payload.min_word_count ?? 0),
      task_data: (payload.task_data as Record<string, unknown>) ?? {},
      publish_at: payload.publish_at ? String(payload.publish_at) : null,
      expires_at: payload.expires_at ? String(payload.expires_at) : null,
      visibility_mode: String(payload.visibility_mode ?? "all"),
      min_referrals_required: Number(payload.min_referrals_required ?? 0),
      is_starter: Boolean(payload.is_starter),
      starter_day: payload.starter_day ? Number(payload.starter_day) : "",
      
      _errors: [],
      _originalIndex: parsedTasks[editingTaskIndex]._originalIndex,
    };
    
    const rawRecord: Record<string, unknown> = {
      title: updatedTask.title,
      category: updatedTask.category,
      description: updatedTask.description,
      instructions: updatedTask.instructions,
      payout_ksh: updatedTask.payout_ksh,
      total_slots: updatedTask.total_slots,
      difficulty: updatedTask.difficulty,
      ai_grading_enabled: updatedTask.ai_grading_enabled,
      ai_rubric: updatedTask.ai_rubric,
      requires_screenshot: updatedTask.requires_screenshot,
      requires_url: updatedTask.requires_url,
      min_word_count: updatedTask.min_word_count,
      task_data: updatedTask.task_data,
      publish_at: updatedTask.publish_at,
      expires_at: updatedTask.expires_at,
      visibility_mode: updatedTask.visibility_mode,
      min_referrals_required: updatedTask.min_referrals_required,
      is_starter: updatedTask.is_starter,
      starter_day: updatedTask.starter_day,
    };

    const revalidate = validateRow(rawRecord, updatedTask._originalIndex);
    updatedTask._errors = revalidate.errors;

    setParsedTasks((prev) =>
      prev.map((t, i) => (i === editingTaskIndex ? updatedTask : t))
    );
    setEditingTaskIndex(null);
    toast.success("Task updated successfully");
    return Promise.resolve();
  }

  function updateTaskData(index: number, updates: Record<string, unknown>) {
    setParsedTasks((prev) =>
      prev.map((t, i) => {
        if (i !== index) return t;
        const merged = { ...t, task_data: { ...t.task_data, ...updates } };
        const revalidate = validateRow(merged as unknown as Record<string, unknown>, t._originalIndex);
        return { ...merged, _errors: revalidate.errors };
      })
    );
  }

  function updateQuestion(index: number, qIndex: number, updates: Record<string, unknown>) {
    setParsedTasks((prev) =>
      prev.map((t, i) => {
        if (i !== index) return t;
        const questions = ((t.task_data.questions as Array<Record<string, unknown>>) ?? []);
        const merged = {
          ...t,
          task_data: {
            ...t.task_data,
            questions: questions.map((q, qi) =>
              qi === qIndex ? { ...q, ...updates } : q
            ),
          },
        };
        const revalidate = validateRow(merged as unknown as Record<string, unknown>, t._originalIndex);
        return { ...merged, _errors: revalidate.errors };
      })
    );
  }

  function addQuestion(index: number, type: string) {
    setParsedTasks((prev) =>
      prev.map((t, i) => {
        if (i !== index) return t;
        const questions = ((t.task_data.questions as Array<Record<string, unknown>>) ?? []);
        const merged = {
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
        const revalidate = validateRow(merged as unknown as Record<string, unknown>, t._originalIndex);
        return { ...merged, _errors: revalidate.errors };
      })
    );
  }

  function removeQuestion(index: number, qIndex: number) {
    setParsedTasks((prev) =>
      prev.map((t, i) => {
        if (i !== index) return t;
        const questions = ((t.task_data.questions as Array<Record<string, unknown>>) ?? []);
        const merged = {
          ...t,
          task_data: {
            ...t.task_data,
            questions: questions.filter((_, qi) => qi !== qIndex),
          },
        };
        const revalidate = validateRow(merged as unknown as Record<string, unknown>, t._originalIndex);
        return { ...merged, _errors: revalidate.errors };
      })
    );
  }

  function removeTask(index: number) {
    setParsedTasks((prev) => prev.filter((_, i) => i !== index));
  }

  async function sendTasks(tasks: Record<string, unknown>[]) {
    const res = await fetch("/api/admin/tasks/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tasks }),
    });

    if (!res.ok) {
      const result = await res.json().catch(() => null);
      throw new Error(result?.error?.message ?? result?.error ?? "Import failed");
    }

    const result = await res.json();
    return {
      saved: result.saved ?? 0,
      failed: (result.failed ?? []) as FailedRowResponse[],
    };
  }

  function tasksToSend(tasks: ParsedTask[]): Record<string, unknown>[] {
    return tasks.map((t) => ({
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
      publish_at: t.publish_at,
      expires_at: t.expires_at,
      visibility_mode: t.visibility_mode,
      min_referrals_required: Number(t.min_referrals_required),
      is_starter: t.is_starter,
      starter_day: t.is_starter ? Number(t.starter_day) : null,
    }));
  }

  async function handleSaveValid() {
    const validTasks = parsedTasks.filter((t) => t._errors.length === 0);
    if (validTasks.length === 0) {
      toast.error("No valid tasks to save. Fix the errors below first.");
      return;
    }

    setSaving(true);
    try {
      const result = await sendTasks(tasksToSend(validTasks));
      setSavedCount((prev) => prev + result.saved);
      
      if (result.failed.length > 0) {
        const failedIndices = new Set(result.failed.map((fr) => fr.row - 1));
        const errorMap = new Map<number, string[]>();
        result.failed.forEach((fr) => {
          errorMap.set(fr.row - 1, fr.errors);
        });

        setParsedTasks((prev) => {
          const next: ParsedTask[] = [];
          let validIndex = 0;
          for (const t of prev) {
            if (t._errors.length > 0) {
              next.push(t);
            } else {
              if (failedIndices.has(validIndex)) {
                const serverErrors = errorMap.get(validIndex) ?? [];
                next.push({
                  ...t,
                  _errors: Array.from(new Set([...t._errors, ...serverErrors])),
                });
              }
              validIndex++;
            }
          }
          return next;
        });

        toast.warning(
          `${result.saved} tasks saved, ${result.failed.length} failed. Please correct the errors below.`
        );
      } else {
        const remainingInvalid = parsedTasks.filter((t) => t._errors.length > 0);
        if (remainingInvalid.length > 0) {
          setParsedTasks(remainingInvalid);
          toast.success(`${result.saved} tasks saved. Please fix the remaining invalid tasks.`);
        } else {
          toast.success(`${result.saved} tasks imported successfully`);
          onImported();
          onClose();
        }
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Save failed due to an error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const validCount = parsedTasks.filter((t) => t._errors.length === 0).length;
  const invalidCount = parsedTasks.filter((t) => t._errors.length > 0).length;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-4xl bg-background shadow-xl overflow-y-auto">
        <div className="sticky top-0 z-10 bg-background border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-navy">Import Tasks</h2>
            <p className="text-sm text-muted-foreground">
              Upload a JSON file, review and edit fields, then save as drafts
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {savedCount > 0 && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-green-800">{savedCount} tasks imported successfully</p>
              </div>
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

          {parsedTasks.length === 0 && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-3 rounded-xl border p-4">
                <div>
                  <h3 className="font-medium text-navy">Paste JSON</h3>
                  <p className="text-sm text-muted-foreground">
                    Paste one task object or an array of tasks.
                  </p>
                </div>
                <Textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder='[{"title":"Sample task","category":"survey",...}]'
                  rows={14}
                  className="font-mono text-sm"
                />
                <div className="flex justify-end">
                  <Button onClick={handlePasteImport} disabled={!jsonInput.trim()}>
                    Parse Pasted JSON
                  </Button>
                </div>
              </div>

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
                  Upload JSON File
                </p>
                <p className="text-xs text-muted-foreground mb-4">
                  Drop a `.json` file here or click to browse
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
              </div>

              <div className="space-y-4">
                {parsedTasks.map((task, idx) => (
                  <ImportTaskCard
                    key={`${task._originalIndex}-${idx}`}
                    index={idx}
                    task={task}
                    onEdit={() => setEditingTaskIndex(idx)}
                    onRemove={() => removeTask(idx)}
                  />
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2 sticky bottom-0 bg-background border-t py-3">
                <Button variant="outline" onClick={onClose} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveValid}
                  disabled={saving || validCount === 0}
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Save Valid as Drafts ({validCount})
                </Button>
              </div>

              <Dialog
                open={editingTaskIndex !== null}
                onOpenChange={(open) => {
                  if (!open) setEditingTaskIndex(null);
                }}
              >
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogTitle>Edit Imported Task</DialogTitle>
                  {editingTaskIndex !== null ? (
                    <TaskForm
                      task={parsedTasks[editingTaskIndex] as any}
                      onSave={handleFormSave}
                      onCancel={() => setEditingTaskIndex(null)}
                    />
                  ) : null}
                </DialogContent>
              </Dialog>
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
  onEdit,
  onRemove,
}: {
  index: number;
  task: ParsedTask;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const isValid = task._errors.length === 0;

  return (
    <div
      className={`rounded-lg border bg-white p-4 flex items-center justify-between gap-4 ${
        isValid ? "border-green-200" : "border-destructive/40"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-navy truncate max-w-[300px]">
            {task.title || "(untitled)"}
          </span>
          <Badge variant="outline" className="shrink-0">
            {CATEGORY_LABELS[task.category]}
          </Badge>
          {task.is_starter && (
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              Starter (Day {task.starter_day})
            </Badge>
          )}
          <Badge variant="secondary" className="font-mono text-xs">
            KSh {task.payout_ksh}
          </Badge>
          {isValid ? (
            <CheckCircle2 className="h-4 w-4 text-teal shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          )}
        </div>
        {!isValid && (
          <ul className="text-xs text-destructive mt-2 space-y-0.5">
            {task._errors.map((err, i) => (
              <li key={i} className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {err}
              </li>
            ))}
          </ul>
        )}
      </div>
      
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" onClick={onEdit}>
          Edit Task
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
