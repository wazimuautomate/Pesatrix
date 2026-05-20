"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle, Clock, ExternalLink, FileText, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/task-types";
import { DataLabelingTask } from "@/components/tasks/DataLabelingTask";
import { SocialEngagementTask } from "@/components/tasks/SocialEngagementTask";
import {
  VerificationTaskUI,
  type VerificationSubmission,
} from "@/components/tasks/verification/VerificationTaskUI";

type Task = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  instructions: string;
  payout_ksh: number;
  total_slots: number;
  slots_remaining: number;
  difficulty: string;
  expires_at: string | null;
  ai_grading_enabled: boolean;
  requires_screenshot: boolean;
  requires_url: boolean;
  min_word_count: number;
  task_data: Record<string, unknown>;
};

type Submission = {
  id: string;
  status: string;
  submitted_at: string;
  ai_score: number | null;
  ai_reasoning: string | null;
};

type WatchSessionState = {
  session_token: string;
  started_at: string;
  min_watch_seconds: number;
  cheat_strikes: number;
  content_url?: string;
};

type WatchQuestion = {
  id: string;
  type: "multiple_choice" | "open_ended";
  question: string;
  options?: string[];
  correct_option?: string;
};

type NormalizedWatchData = {
  content_type: "youtube" | "supabase_video" | "external_url";
  content_url: string;
  min_watch_seconds: number;
  questions: WatchQuestion[];
};

export function TaskSubmissionForm({
  task,
  existingSubmission,
}: {
  task: Task;
  existingSubmission: Submission | null;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [submittedUrl, setSubmittedUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [watchSeconds, setWatchSeconds] = useState(0);
  const [watchSession, setWatchSession] = useState<WatchSessionState | null>(null);
  const [watchPaused, setWatchPaused] = useState(false);
  const [watchForfeited, setWatchForfeited] = useState(false);
  const lastStrikeAtRef = useRef(0);

  const taskData = task.task_data;
  const taskType = taskData.type as string;

  if (existingSubmission) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-teal" />
          <h3 className="mt-4 text-lg font-semibold text-navy">Already Submitted</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            You have already submitted this task.
          </p>
          <div className="mt-4 space-y-2 text-sm">
            <Badge
              variant={
                existingSubmission.status === "approved"
                  ? "success"
                  : existingSubmission.status === "declined"
                    ? "destructive"
                    : "warning"
              }
            >
              Status: {existingSubmission.status}
            </Badge>
            {/* FIXED: Do not expose grading score, flags, or AI reasoning to users after submission. */}
          </div>
          <Button className="mt-6" onClick={() => router.push("/tasks")}>
            Back to Tasks
          </Button>
        </CardContent>
      </Card>
    );
  }

  const watchData = normalizeWatchRespondTaskData(taskData);
  const minWatchSeconds = watchData.min_watch_seconds;
  const watchUnlocked = taskType === "watch_respond" && watchSession !== null && watchSeconds >= minWatchSeconds && !watchForfeited;

  useEffect(() => {
    if (taskType !== "watch_respond" || !watchSession || watchPaused || watchForfeited || watchSeconds >= minWatchSeconds) {
      return;
    }

    const timer = window.setInterval(() => {
      setWatchSeconds((current) => Math.min(current + 1, minWatchSeconds));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [minWatchSeconds, taskType, watchForfeited, watchPaused, watchSeconds, watchSession]);

  useEffect(() => {
    if (taskType !== "watch_respond" || !watchSession || watchForfeited) {
      return;
    }

    const activeSession = watchSession;

    async function recordStrike(reason: "tab_hidden" | "window_blur") {
      const now = Date.now();
      if (now - lastStrikeAtRef.current < 3000) {
        return;
      }
      lastStrikeAtRef.current = now;

      const response = await fetch("/api/tasks/watch/cheat-strike", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_token: activeSession.session_token, reason }),
      });
      const payload = await response.json().catch(() => null);
      const strikes = Number(payload?.strikes ?? activeSession.cheat_strikes + 1);
      setWatchSession((current) => current ? { ...current, cheat_strikes: strikes } : current);

      if (payload?.invalidated === true || strikes >= 3) {
        setWatchForfeited(true);
        setWatchPaused(true);
        toast.error("You have left the watch page too many times. This task has been forfeited.");
        return;
      }

      toast.warning(`Warning: Leaving the page pauses your progress. Strike ${strikes}/3.`);
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        setWatchPaused(true);
        void recordStrike("tab_hidden");
      } else {
        setWatchPaused(false);
      }
    }

    function handleWindowBlur() {
      setWatchPaused(true);
      void recordStrike("window_blur");
    }

    // FIXED: Watch anti-cheat now listens for tab hiding and window blur, with server-side strike recording.
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [taskType, watchForfeited, watchSession]);

  async function startWatchSession() {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks/watch/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: task.id }),
      });
      const payload = await res.json();
      if (!res.ok) {
        toast.error(payload?.error?.message ?? payload?.error ?? "Could not start watch session");
        return;
      }

      setWatchSession({
        session_token: payload.session_token,
        started_at: payload.started_at,
        min_watch_seconds: payload.min_watch_seconds,
        cheat_strikes: 0,
        content_url: payload.content_url,
      });
      setWatchSeconds(0);
      setWatchPaused(false);
      setWatchForfeited(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      let submissionAnswers = answers;
      if (taskType === "content_creation") {
        const content = typeof answers.content === "string" ? answers.content : "";
        submissionAnswers = {
          content,
          word_count: countWords(content),
        };
      }
      if (taskType === "watch_respond") {
        submissionAnswers = {
          watch_session_token: watchSession?.session_token ?? "",
          watch_completed: watchUnlocked,
          watch_duration_seconds: watchSeconds,
          cheat_strikes: watchSession?.cheat_strikes ?? 0,
          answers: watchData.questions.map((question) => ({
            question_id: question.id,
            answer: String(answers[question.id] ?? ""),
          })),
        };
      }

      const payload: Record<string, unknown> = {
        taskId: task.id,
        answers: submissionAnswers,
        screenshotUrl: task.requires_screenshot ? (screenshotUrl || null) : null,
        submittedUrl: task.requires_url ? (submittedUrl || null) : null,
      };

      const res = await fetch("/api/tasks/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data?.error?.message ?? data?.error ?? "Submission failed");
        return;
      }

      setSubmitted(true);
      // FIXED: Content creation users only see a review message, never AI score or flags.
      toast.success(taskType === "content_creation" ? "Your content is being reviewed" : "Task submitted successfully!");
      router.push("/tasks");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerificationSubmit(data: VerificationSubmission) {
    setLoading(true);
    try {
      const res = await fetch("/api/tasks/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          answers: {
            text_answer: data.text_answer ?? null,
            verification_notes: data.verification_notes ?? null,
          },
          screenshotUrl: data.screenshot_url ?? null,
          submittedUrl: data.submitted_url ?? null,
        }),
      });

      const payload = await res.json();

      if (!res.ok) {
        toast.error(payload?.error?.message ?? payload?.error ?? "Submission failed");
        return;
      }

      setSubmitted(true);
      toast.success("Verification submitted successfully!");
      router.push("/tasks");
    } finally {
      setLoading(false);
    }
  }

  function canSubmit(): boolean {
    if (taskType === "survey") {
      const questions = (taskData.questions as Array<{ id: string; required: boolean }>) ?? [];
      return questions.every((q) => {
        if (!q.required) return true;
        return answers[q.id] !== undefined && answers[q.id] !== "";
      });
    }
    if (taskType === "data_labeling") {
      const items = (taskData.items as Array<{ id: string }>) ?? [];
      return items.every((item) => answers[item.id] !== undefined);
    }
    if (taskType === "social_engagement") {
      return true;
    }
    if (taskType === "verification") {
      const questions = (taskData.questions as Array<{ id: string }>) ?? [];
      return questions.every((q) => answers[q.id] !== undefined);
    }
    if (taskType === "content_creation") {
      const answer = answers.content as string;
      if (!answer) return false;
      // FIXED: Client UX now uses tasks.min_word_count, matching the server-side enforcement column.
      if (task.min_word_count > 0) {
        return countWords(answer) >= task.min_word_count;
      }
      return true;
    }
    if (taskType === "watch_respond") {
      if (!watchUnlocked || watchForfeited) return false;
      return watchData.questions.every((q) => String(answers[q.id] ?? "").trim().length > 0);
    }
    return true;
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => router.push("/tasks")}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Tasks
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{task.title}</CardTitle>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge className={CATEGORY_COLORS[task.category as keyof typeof CATEGORY_COLORS]}>
                  {CATEGORY_LABELS[task.category as keyof typeof CATEGORY_LABELS]}
                </Badge>
                <Badge variant="outline">KSh {task.payout_ksh}</Badge>
                <Badge variant="outline">{task.difficulty}</Badge>
              </div>
            </div>
            <p className="text-2xl font-bold text-pesatrix-blue">KSh {task.payout_ksh}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
          <Separator />
          <div>
            <Label className="font-semibold">Instructions</Label>
            <p className="mt-1 text-sm">{task.instructions}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Submission</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {taskType === "survey" && (
            <SurveyForm
              questions={taskData.questions as Array<Record<string, unknown>>}
              answers={answers}
              setAnswers={setAnswers}
            />
          )}
          {taskType === "data_labeling" && (
            <DataLabelingTask
              taskId={task.id}
              taskData={taskData as {
                type: "data_labeling";
                subtype: string;
                batch_size: number;
                label_options: string[];
                items: Array<{ id: string; content: string; content_type: "text" | "image_url" }>;
              }}
              payoutKsh={task.payout_ksh}
              onSubmitSuccess={() => {
                setSubmitted(true);
              }}
            />
          )}
          {taskType === "social_engagement" && (
            <SocialEngagementTask
              taskId={task.id}
              taskData={taskData as {
                type: "social_engagement";
                platform: string;
                action: string;
                target_url: string;
                target_name: string;
                target_identifier: string;
                proof_requirements: {
                  requires_screenshot: boolean;
                  requires_username: boolean;
                  requires_text_input: boolean;
                  text_input_label: string | null;
                  text_input_placeholder: string | null;
                };
                screenshot_instructions: string;
                comment_prompt: string | null;
                hold_days: number;
              }}
              payoutKsh={task.payout_ksh}
              onSubmitSuccess={() => {
                setSubmitted(true);
              }}
            />
          )}
          {taskType === "verification" && (
            <VerificationTaskUI
              task={task}
              onSubmit={handleVerificationSubmit}
              isSubmitting={loading}
            />
          )}
          {taskType === "content_creation" && (
            <ContentCreationForm
              task={task}
              taskData={taskData}
              answers={answers}
              setAnswers={setAnswers}
            />
          )}
          {taskType === "watch_respond" && (
            <WatchRespondForm
              taskData={watchData}
              session={watchSession}
              watchSeconds={watchSeconds}
              watchUnlocked={watchUnlocked}
              watchPaused={watchPaused}
              forfeited={watchForfeited}
              onStart={startWatchSession}
              answers={answers}
              setAnswers={setAnswers}
            />
          )}

          {task.requires_screenshot && taskType !== "social_engagement" && taskType !== "verification" && (
            <div>
              <Label htmlFor="screenshot">Screenshot URL</Label>
              <Input
                id="screenshot"
                value={screenshotUrl}
                onChange={(e) => setScreenshotUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          )}

          {task.requires_url && taskType !== "verification" && (
            <div>
              <Label htmlFor="submittedUrl">Submitted URL</Label>
              <Input
                id="submittedUrl"
                value={submittedUrl}
                onChange={(e) => setSubmittedUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          )}

          {taskType !== "data_labeling" && taskType !== "verification" && (
            <>
              <Button
                onClick={handleSubmit}
                disabled={loading || !canSubmit()}
                className="w-full"
              >
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Submit Task
              </Button>

              {!canSubmit() && (
                <p className="text-center text-xs text-muted-foreground">
                  Complete all required fields to submit
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function TaskDetailsPreview({ task }: { task: Task }) {
  const router = useRouter();
  const taskData = task.task_data;
  const hasDescription = typeof task.description === "string" && task.description.trim().length > 0;
  const requirementItems = [
    task.requires_screenshot ? "Screenshot proof required" : null,
    task.requires_url ? "Submitted link required" : null,
    task.min_word_count > 0 ? `Minimum ${task.min_word_count} words` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Tasks
      </Button>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={CATEGORY_COLORS[task.category as keyof typeof CATEGORY_COLORS] ?? "bg-slate-100 text-slate-800"}>
              {CATEGORY_LABELS[task.category as keyof typeof CATEGORY_LABELS] ?? task.category}
            </Badge>
            <Badge variant="outline">{task.difficulty}</Badge>
          </div>
          <CardTitle className="text-2xl text-navy">{task.title}</CardTitle>
          <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              KSh {task.payout_ksh}
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {task.slots_remaining} spots remaining
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {task.expires_at ? `Expires ${new Date(task.expires_at).toLocaleString()}` : "No expiry set"}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {hasDescription && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Overview</h3>
              <p className="text-sm leading-6 text-foreground">{task.description}</p>
            </section>
          )}

          <Separator />

          <section className="space-y-2">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Instructions</h3>
            <div className="whitespace-pre-wrap text-sm leading-6 text-foreground">{task.instructions}</div>
          </section>

          {requirementItems.length > 0 && (
            <>
              <Separator />
              <section className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Submission Requirements</h3>
                <div className="flex flex-wrap gap-2">
                  {requirementItems.map((item) => (
                    <Badge key={item} variant="secondary">
                      {item}
                    </Badge>
                  ))}
                </div>
              </section>
            </>
          )}

          {task.category === "data_labeling" && (
            <>
              <Separator />
              <section className="space-y-2">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Task Scope</h3>
                <p className="text-sm leading-6 text-foreground">
                  This labeling task contains {Number(taskData.batch_size ?? ((taskData.items as unknown[]) ?? []).length ?? 0)} items. You can review the requirements here before opening the labeling interface.
                </p>
              </section>
            </>
          )}

          <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-4 text-sm text-muted-foreground">
            The preview shows what this task involves and how to complete it. Questions and answer inputs only appear after you choose <span className="font-medium text-foreground">Start Task</span>.
          </div>

          <div className="flex gap-3">
            <Button asChild className="flex-1">
              <Link href={`/tasks/${task.id}`}>Start Task</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/tasks">Back to task list</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SurveyForm({
  questions,
  answers,
  setAnswers,
}: {
  questions: Array<Record<string, unknown>>;
  answers: Record<string, unknown>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
}) {
  return (
    <div className="space-y-6">
      {questions?.map((q) => (
        <div key={String(q.id)} className="space-y-2">
          <Label>
            {String(q.text)}
            {(q.required as boolean) && <span className="text-destructive ml-1">*</span>}
          </Label>
          {q.type === "multiple_choice" && (
            <RadioGroup
              value={String(answers[q.id as string] ?? "")}
              onValueChange={(v) => setAnswers((a) => ({ ...a, [q.id as string]: v }))}
            >
              {((q.options as string[]) ?? []).map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <RadioGroupItem value={opt} id={`${q.id}-${i}`} />
                  <Label htmlFor={`${q.id}-${i}`} className="font-normal">{opt}</Label>
                </div>
              ))}
            </RadioGroup>
          )}
          {q.type === "multi_select" && (
            <div className="space-y-1">
              {((q.options as string[]) ?? []).map((opt, i) => {
                const selected = ((answers[q.id as string] as string[]) ?? []);
                return (
                  <div key={i} className="flex items-center gap-2">
                    <Checkbox
                      id={`${q.id}-${i}`}
                      checked={selected.includes(opt)}
                      onCheckedChange={(checked) => {
                        const current = selected as string[];
                        const next = checked
                          ? [...current, opt]
                          : current.filter((v) => v !== opt);
                        setAnswers((a) => ({ ...a, [q.id as string]: next }));
                      }}
                    />
                    <Label htmlFor={`${q.id}-${i}`} className="font-normal">{opt}</Label>
                  </div>
                );
              })}
            </div>
          )}
          {q.type === "open_text" && (
            <Textarea
              value={String(answers[q.id as string] ?? "")}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id as string]: e.target.value }))}
              placeholder="Your answer"
              rows={3}
            />
          )}
          {q.type === "rating" && (
            <div className="flex gap-2">
              {Array.from({ length: (q.scale as number) ?? 5 }, (_, i) => i + 1).map((n) => (
                <Button
                  key={n}
                  variant={answers[q.id as string] === n ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAnswers((a) => ({ ...a, [q.id as string]: n }))}
                >
                  {n}
                </Button>
              ))}
            </div>
          )}
          {q.type === "yes_no" && (
            <RadioGroup
              value={String(answers[q.id as string] ?? "")}
              onValueChange={(v) => setAnswers((a) => ({ ...a, [q.id as string]: v }))}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="yes" id={`${q.id}-yes`} />
                <Label htmlFor={`${q.id}-yes`} className="font-normal">Yes</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="no" id={`${q.id}-no`} />
                <Label htmlFor={`${q.id}-no`} className="font-normal">No</Label>
              </div>
            </RadioGroup>
          )}
        </div>
      ))}
    </div>
  );
}

function DataLabelingForm({
  items,
  answers,
  setAnswers,
}: {
  items: Array<Record<string, unknown>>;
  answers: Record<string, unknown>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
}) {
  return (
    <div className="space-y-4">
      {items?.map((item) => (
        <Card key={String(item.id)}>
          <CardContent className="pt-4">
            <p className="font-medium mb-2">{String(item.content)}</p>
            <RadioGroup
              value={String(answers[item.id as string] ?? "")}
              onValueChange={(v) => setAnswers((a) => ({ ...a, [item.id as string]: v }))}
            >
              {((item.label_options as string[]) ?? []).map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <RadioGroupItem value={opt} id={`${item.id}-${i}`} />
                  <Label htmlFor={`${item.id}-${i}`} className="font-normal">{opt}</Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function VerificationForm({
  questions,
  answers,
  setAnswers,
  screenshotUrl,
  setScreenshotUrl,
}: {
  questions: Array<Record<string, unknown>>;
  answers: Record<string, unknown>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  screenshotUrl: string;
  setScreenshotUrl: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      {questions?.map((q) => (
        <div key={String(q.id)} className="space-y-2">
          <Label>{String(q.text)}</Label>
          {q.type === "yes_no" ? (
            <RadioGroup
              value={String(answers[q.id as string] ?? "")}
              onValueChange={(v) => setAnswers((a) => ({ ...a, [q.id as string]: v }))}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="yes" id={`${q.id}-yes`} />
                <Label htmlFor={`${q.id}-yes`} className="font-normal">Yes</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="no" id={`${q.id}-no`} />
                <Label htmlFor={`${q.id}-no`} className="font-normal">No</Label>
              </div>
            </RadioGroup>
          ) : (
            <Textarea
              value={String(answers[q.id as string] ?? "")}
              onChange={(e) => setAnswers((a) => ({ ...a, [q.id as string]: e.target.value }))}
              placeholder="Your answer"
            />
          )}
        </div>
      ))}
      <div>
        <Label htmlFor="screenshot">Screenshot URL (proof)</Label>
        <Input
          id="screenshot"
          value={screenshotUrl}
          onChange={(e) => setScreenshotUrl(e.target.value)}
          placeholder="https://..."
        />
      </div>
    </div>
  );
}

function ContentCreationForm({
  task,
  taskData,
  answers,
  setAnswers,
}: {
  task: Task;
  taskData: Record<string, unknown>;
  answers: Record<string, unknown>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
}) {
  const content = (answers.content as string) ?? "";
  const wordCount = countWords(content);
  const minWords = task.min_word_count ?? 0;
  const maxCharacters = typeof taskData.max_characters === "number" ? taskData.max_characters : undefined;
  const contentType = getContentCreationLabel(String(taskData.content_type ?? taskData.subtype ?? "review"));
  const exampleOutput = typeof taskData.example_output === "string" ? taskData.example_output.trim() : "";
  const languageHint = typeof taskData.language_hint === "string" ? taskData.language_hint.trim() : "";
  const minimumMet = minWords === 0 || wordCount >= minWords;

  return (
    <div className="space-y-4">
      {/* FIXED: Content creation UI now shows the required type label, prompt, example, live word count, and character cap. */}
      <Badge variant="outline">{contentType}</Badge>
      <div className="rounded-lg bg-muted p-4">
        <p className="text-sm font-medium">{String(taskData.prompt)}</p>
        {languageHint && <p className="mt-2 text-xs text-muted-foreground">{languageHint}</p>}
      </div>
      {exampleOutput && (
        <blockquote className="rounded-lg border-l-4 border-pesatrix-blue bg-muted/50 p-4 text-sm text-muted-foreground">
          <p className="mb-1 font-medium text-foreground">Example (do not copy)</p>
          {exampleOutput}
        </blockquote>
      )}
      <div>
        <Label htmlFor="content">Your Content</Label>
        <Textarea
          id="content"
          value={content}
          onChange={(e) => setAnswers((a) => ({ ...a, content: e.target.value }))}
          placeholder="Write your content here..."
          rows={6}
          maxLength={maxCharacters}
        />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span className={minimumMet ? "text-green-700" : "text-destructive"}>
            {wordCount} / {minWords} words minimum
          </span>
          <span>
            {maxCharacters ? `${content.length} / ${maxCharacters} characters` : `${content.length} characters`}
          </span>
        </div>
      </div>
    </div>
  );
}

function WatchRespondForm({
  taskData,
  session,
  watchSeconds,
  watchUnlocked,
  watchPaused,
  forfeited,
  onStart,
  answers,
  setAnswers,
}: {
  taskData: NormalizedWatchData;
  session: WatchSessionState | null;
  watchSeconds: number;
  watchUnlocked: boolean;
  watchPaused: boolean;
  forfeited: boolean;
  onStart: () => void;
  answers: Record<string, unknown>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
}) {
  const contentError = validateWatchContent(taskData);
  const effectiveTaskData = session?.content_url ? { ...taskData, content_url: session.content_url } : taskData;

  return (
    <div className="space-y-4">
      {contentError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {contentError}
        </div>
      ) : (
        <>
          <div className="rounded-lg border p-4">
            {!session ? (
              <Button onClick={onStart} className="w-full">
                Start Watching
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {watchPaused ? "Progress paused while the watch page is not active." : "Watch progress"}
                  </span>
                  <span className="font-medium">
                    {watchSeconds}/{taskData.min_watch_seconds}s
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-pesatrix-blue transition-all"
                    style={{ width: `${Math.min(100, (watchSeconds / taskData.min_watch_seconds) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Strikes: {session.cheat_strikes}/3
                </p>
              </div>
            )}
          </div>

          {session && (
            <>
              {/* FIXED: Content rendering happens after session start so Supabase videos use the server-issued signed URL. */}
              <WatchContentRenderer taskData={effectiveTaskData} />
            </>
          )}

          {!watchUnlocked && !forfeited && (
            <div className="rounded-lg border border-dashed bg-muted/40 p-4 text-center text-sm text-muted-foreground">
              Complete watching to unlock questions.
            </div>
          )}

          {watchUnlocked && (
            <div className="space-y-4">
              {/* VERIFIED: OK - all questions must be answered before the shared submit button enables. */}
              {taskData.questions.map((q) => (
                <div key={q.id} className="space-y-2">
                  <Label>{q.question}</Label>
                  {q.type === "multiple_choice" ? (
                    <RadioGroup
                      value={String(answers[q.id] ?? "")}
                      onValueChange={(value) => setAnswers((a) => ({ ...a, [q.id]: value }))}
                      className="space-y-2"
                    >
                      {(q.options ?? []).map((option, index) => (
                        <Label
                          key={`${q.id}-${index}`}
                          htmlFor={`${q.id}-${index}`}
                          className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border p-3 font-normal"
                        >
                          <RadioGroupItem value={option} id={`${q.id}-${index}`} />
                          <span>{option}</span>
                        </Label>
                      ))}
                    </RadioGroup>
                  ) : (
                    <Textarea
                      value={String(answers[q.id] ?? "")}
                      onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                      placeholder="Your answer"
                      rows={3}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <Dialog open={forfeited}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Task forfeited
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                You have left the watch page too many times. This task has been forfeited.
              </p>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

function WatchContentRenderer({ taskData }: { taskData: NormalizedWatchData }) {
  if (taskData.content_type === "youtube") {
    const embedUrl = getYouTubeEmbedUrl(taskData.content_url);
    if (!embedUrl) {
      return <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">Invalid YouTube URL.</div>;
    }

    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
        <iframe
          src={embedUrl}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  if (taskData.content_type === "supabase_video") {
    return (
      <video className="aspect-video w-full rounded-lg bg-black" src={taskData.content_url} controls>
        Your browser does not support the video tag.
      </video>
    );
  }

  return (
    <div className="rounded-lg border p-4 text-sm">
      <p className="mb-3 text-muted-foreground">
        Open the link, watch the content, then return here to answer.
      </p>
      <Button asChild variant="outline">
        <a href={taskData.content_url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="mr-2 h-4 w-4" />
          Open Content in New Tab
        </a>
      </Button>
    </div>
  );
}

function normalizeWatchRespondTaskData(taskData: Record<string, unknown>): NormalizedWatchData {
  const rawQuestions = Array.isArray(taskData.questions) ? taskData.questions : [];
  return {
    content_type: isWatchContentType(taskData.content_type) ? taskData.content_type : "youtube",
    content_url: String(taskData.content_url ?? taskData.video_url ?? ""),
    min_watch_seconds: Number(taskData.min_watch_seconds ?? 60),
    questions: rawQuestions.map((question, index) => {
      const q = question as Record<string, unknown>;
      const type = q.type === "multiple_choice" ? "multiple_choice" : "open_ended";
      return {
        id: String(q.id ?? `q-${index}`),
        type,
        question: String(q.question ?? q.text ?? ""),
        options: Array.isArray(q.options) ? q.options.map(String).filter(Boolean) : undefined,
        correct_option: typeof q.correct_option === "string" ? q.correct_option : undefined,
      };
    }),
  };
}

function validateWatchContent(taskData: NormalizedWatchData) {
  if (!taskData.content_url) {
    return "This watch task has an invalid or missing content URL.";
  }

  if (taskData.content_type === "supabase_video") {
    return null;
  }

  if (!isValidHttpUrl(taskData.content_url)) {
    return "This watch task has an invalid or missing content URL.";
  }

  if (taskData.content_type === "youtube" && !getYouTubeVideoId(taskData.content_url)) {
    return "This watch task has an invalid YouTube URL.";
  }

  return null;
}

function getYouTubeEmbedUrl(url: string): string | null {
  const videoId = getYouTubeVideoId(url);
  return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
}

function getYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    }
    if (parsed.hostname.endsWith("youtube.com")) {
      if (parsed.pathname === "/watch") return parsed.searchParams.get("v");
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (["embed", "v", "shorts"].includes(parts[0])) return parts[1] ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter((word) => word.length > 0).length;
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isWatchContentType(value: unknown): value is NormalizedWatchData["content_type"] {
  return value === "youtube" || value === "supabase_video" || value === "external_url";
}

function getContentCreationLabel(value: string) {
  const labels: Record<string, string> = {
    short_text: "Write short text",
    paragraph: "Write a paragraph",
    article: "Write an article",
    tweet: "Write a tweet",
    caption: "Write a caption",
    review: "Write a short review",
    social_post: "Write a social post",
  };
  return labels[value] ?? "Write content";
}
