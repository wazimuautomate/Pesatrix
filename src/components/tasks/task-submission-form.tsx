"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
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
import { CATEGORY_LABELS, CATEGORY_COLORS } from "@/lib/task-types";

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
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [watchSeconds, setWatchSeconds] = useState(0);
  const [watchTimer, setWatchTimer] = useState<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLIFrameElement>(null);

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
            {existingSubmission.ai_score != null && (
              <p>AI Score: {existingSubmission.ai_score}%</p>
            )}
            {existingSubmission.ai_reasoning && (
              <p className="text-muted-foreground">{existingSubmission.ai_reasoning}</p>
            )}
          </div>
          <Button className="mt-6" onClick={() => router.push("/tasks")}>
            Back to Tasks
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (taskType === "watch_respond" && !watchTimer) {
    const minWatchSeconds = (taskData.min_watch_seconds as number) ?? 60;
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push("/tasks")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Tasks
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>{task.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
              <iframe
                ref={videoRef}
                src={getYouTubeEmbedUrl(taskData.video_url as string)}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Watch for at least {minWatchSeconds} seconds before submitting.
              </p>
              <p className="text-sm font-semibold">
                {watchSeconds}/{minWatchSeconds}s
              </p>
            </div>
            <Button
              onClick={() => startWatchTimer(minWatchSeconds)}
              disabled={watchSeconds >= minWatchSeconds}
              className="w-full"
            >
              {watchSeconds >= minWatchSeconds
                ? "Ready to Submit"
                : `Start Watching (${minWatchSeconds - watchSeconds}s remaining)`}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  function startWatchTimer(minSeconds: number) {
    const timer = setInterval(() => {
      setWatchSeconds((prev) => {
        if (prev + 1 >= minSeconds) {
          clearInterval(timer);
          return minSeconds;
        }
        return prev + 1;
      });
    }, 1000);
    setWatchTimer(timer);
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        taskId: task.id,
        answers,
        screenshotUrl: task.requires_screenshot ? (screenshotUrl || null) : null,
        submittedUrl: task.requires_url ? (submittedUrl || null) : null,
      };

      if (taskType === "social_engagement" && (taskData as Record<string, unknown>).requires_username) {
        (payload as Record<string, unknown>).username = username;
      }

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
      toast.success("Task submitted successfully!");
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
      const minWords = (taskData.min_words as number) ?? 0;
      if (minWords > 0) {
        return answer.trim().split(/\s+/).length >= minWords;
      }
      return true;
    }
    if (taskType === "watch_respond") {
      const minWatchSeconds = (taskData.min_watch_seconds as number) ?? 60;
      if (watchSeconds < minWatchSeconds) return false;
      const questions = (taskData.questions as Array<{ id: string }>) ?? [];
      return questions.every((q) => answers[q.id] !== undefined);
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
            <DataLabelingForm
              items={taskData.items as Array<Record<string, unknown>>}
              answers={answers}
              setAnswers={setAnswers}
            />
          )}
          {taskType === "social_engagement" && (
            <SocialEngagementForm
              taskData={taskData}
              screenshotUrl={screenshotUrl}
              setScreenshotUrl={setScreenshotUrl}
              submittedUrl={submittedUrl}
              setSubmittedUrl={setSubmittedUrl}
              username={username}
              setUsername={setUsername}
            />
          )}
          {taskType === "verification" && (
            <VerificationForm
              questions={taskData.questions as Array<Record<string, unknown>>}
              answers={answers}
              setAnswers={setAnswers}
              screenshotUrl={screenshotUrl}
              setScreenshotUrl={setScreenshotUrl}
            />
          )}
          {taskType === "content_creation" && (
            <ContentCreationForm
              taskData={taskData}
              answers={answers}
              setAnswers={setAnswers}
            />
          )}
          {taskType === "watch_respond" && (
            <WatchRespondForm
              questions={taskData.questions as Array<Record<string, unknown>>}
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

          {task.requires_url && (
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

function SocialEngagementForm({
  taskData,
  screenshotUrl,
  setScreenshotUrl,
  submittedUrl,
  setSubmittedUrl,
  username,
  setUsername,
}: {
  taskData: Record<string, unknown>;
  screenshotUrl: string;
  setScreenshotUrl: (v: string) => void;
  submittedUrl: string;
  setSubmittedUrl: (v: string) => void;
  username: string;
  setUsername: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted p-4">
        <p className="text-sm">
          <strong>Action:</strong> {String(taskData.action)} on {String(taskData.platform)}
        </p>
        <p className="text-sm">
          <strong>Target:</strong> {String(taskData.target_name)}
        </p>
        <a
          href={String(taskData.target_url)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-sm text-pesatrix-blue underline"
        >
          Open {String(taskData.target_url)}
        </a>
      </div>
      {(taskData.requires_username as boolean) && (
        <div>
          <Label htmlFor="username">Your Username</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="@username"
          />
        </div>
      )}
      {(taskData.requires_screenshot as boolean) && (
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
  taskData,
  answers,
  setAnswers,
}: {
  taskData: Record<string, unknown>;
  answers: Record<string, unknown>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
}) {
  const content = (answers.content as string) ?? "";
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const minWords = (taskData.min_words as number) ?? 0;
  const maxWords = (taskData.max_words as number) ?? 500;

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-muted p-4">
        <p className="text-sm font-medium">{String(taskData.prompt)}</p>
      </div>
      <div>
        <Label htmlFor="content">Your Content</Label>
        <Textarea
          id="content"
          value={content}
          onChange={(e) => setAnswers((a) => ({ ...a, content: e.target.value }))}
          placeholder="Write your content here..."
          rows={6}
        />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>
            {wordCount} words
            {minWords > 0 && wordCount < minWords && (
              <span className="text-destructive ml-2">
                (minimum {minWords} required)
              </span>
            )}
          </span>
          <span>Max: {maxWords}</span>
        </div>
      </div>
    </div>
  );
}

function WatchRespondForm({
  questions,
  answers,
  setAnswers,
}: {
  questions: Array<Record<string, unknown>>;
  answers: Record<string, unknown>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
}) {
  return (
    <div className="space-y-4">
      {questions?.map((q) => (
        <div key={String(q.id)} className="space-y-2">
          <Label>
            {String(q.text)}
            {(q.min_words as number) > 0 && (
              <span className="text-xs text-muted-foreground ml-1">
                (min {(q.min_words as number)} words)
              </span>
            )}
          </Label>
          <Textarea
            value={String(answers[q.id as string] ?? "")}
            onChange={(e) => setAnswers((a) => ({ ...a, [q.id as string]: e.target.value }))}
            placeholder="Your answer"
            rows={3}
          />
        </div>
      ))}
    </div>
  );
}

function getYouTubeEmbedUrl(url: string): string {
  if (!url) return "";
  const videoId = url.match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/watch\?.+&v=))([\w-]{11})/);
  if (videoId) {
    return `https://www.youtube.com/embed/${videoId[1]}?autoplay=1`;
  }
  return url;
}
