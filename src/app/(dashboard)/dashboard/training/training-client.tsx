"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import type { TrainingProgramSnapshot } from "@/lib/training";
import type { TrainingSafeQuestion, TrainingSafeTest, TrainingViewData } from "@/lib/training-view";

type TrainingClientProps = {
  initialSnapshot: TrainingProgramSnapshot;
  initialView: TrainingViewData;
  fullName: string;
};

type ProgressResponse = {
  snapshot: TrainingProgramSnapshot;
  view: TrainingViewData;
  result?: {
    stageId?: 1 | 2 | 3;
    day?: number;
    passed: boolean;
    score: number;
    totalQuestions: number;
    passMark: number;
  };
  error?: {
    code: string;
    message: string;
  };
};

type GradeResponse = {
  grade?: GradedAnswer;
  error?: {
    code: string;
    message: string;
  };
};

type GradedAnswer = {
  questionId: string;
  selectedOptionId: string;
  correctOptionId: string;
  isCorrect: boolean;
  explanation: string;
};

type QuestionSet = "lesson" | "stage_test";

const enterTransition = {
  duration: 0.5,
  ease: [0.16, 1, 0.3, 1] as const,
};

const confettiPieces = Array.from({ length: 44 }, (_, index) => ({
  id: index,
  left: `${(index * 23) % 100}%`,
  delay: `${(index % 9) * 0.08}s`,
  duration: `${1.8 + (index % 5) * 0.18}s`,
  color: ["#2563eb", "#14b8a6", "#f59e0b", "#ef4444", "#8b5cf6", "#22c55e"][index % 6],
  rotate: `${(index % 12) * 30}deg`,
}));

function formatUnlockCountdown(nextUnlockAt: string | null, now: number) {
  if (!nextUnlockAt) return "Ready now";

  const remainingMs = new Date(nextUnlockAt).getTime() - now;

  if (remainingMs <= 0) {
    return "Ready now";
  }

  const totalHours = Math.floor(remainingMs / (1000 * 60 * 60));
  const totalMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

  if (totalHours > 0) {
    return `${totalHours}h ${totalMinutes}m remaining`;
  }

  return `${Math.max(totalMinutes, 1)}m remaining`;
}

function cleanSectionTitle(title: string) {
  return title.replace(/^\d+(?:\.\d+)?\s+/, "").trim();
}

function ConfettiBurst() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden="true">
      <style jsx global>{`
        @keyframes pesatrix-confetti-fall {
          0% {
            opacity: 0;
            transform: translate3d(0, -24px, 0) rotate(0deg);
          }
          12% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate3d(var(--drift), 100vh, 0) rotate(720deg);
          }
        }
      `}</style>
      {confettiPieces.map((piece) => (
        <span
          key={piece.id}
          className="absolute top-0 h-3 w-2 rounded-sm"
          style={{
            left: piece.left,
            backgroundColor: piece.color,
            animation: `pesatrix-confetti-fall ${piece.duration} ease-out ${piece.delay} forwards`,
            transform: `rotate(${piece.rotate})`,
            ["--drift" as string]: `${piece.id % 2 === 0 ? 1 : -1}${24 + (piece.id % 7) * 12}px`,
          }}
        />
      ))}
    </div>
  );
}

function QuestionList({
  questions,
  answers,
  feedback,
  grading,
  onAnswer,
}: {
  questions: TrainingSafeQuestion[];
  answers: Record<string, string>;
  feedback: Record<string, GradedAnswer>;
  grading: Record<string, boolean>;
  onAnswer: (questionId: string, optionId: string) => void;
}) {
  return (
    <div className="space-y-4">
      {questions.map((question, index) => {
        const result = feedback[question.id];

        return (
          <div key={question.id} className="rounded-xl border border-outline-variant/50 bg-white p-4">
            <p className="text-sm font-semibold leading-6 text-foreground">
              <span className="mr-2 text-primary">{index + 1}.</span>
              {question.prompt}
            </p>
            <div className="mt-3 grid gap-2">
              {question.options.map((option) => {
                const selected = answers[question.id] === option.id;
                const isCorrectOption = result?.correctOptionId === option.id;
                const isWrongSelection = selected && result && !result.isCorrect;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onAnswer(question.id, option.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
                      isCorrectOption
                        ? "border-teal bg-teal/10 font-medium text-teal"
                        : isWrongSelection
                          ? "border-destructive/40 bg-destructive/10 font-medium text-destructive"
                          : selected
                            ? "border-primary bg-primary/5 font-medium text-foreground"
                            : "border-outline-variant/50 bg-surface-container-low text-muted-foreground hover:bg-white"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span>{option.label}</span>
                      {grading[question.id] && selected ? (
                        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                      ) : isCorrectOption ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>

            {result ? (
              <div
                className={`mt-3 rounded-xl border p-3 text-sm ${
                  result.isCorrect
                    ? "border-teal/25 bg-teal/5 text-teal"
                    : "border-amber-500/25 bg-amber-50 text-amber-900"
                }`}
              >
                <p className="font-semibold">{result.isCorrect ? "Correct" : "Review this answer"}</p>
                <p className="mt-1 leading-6">{result.explanation}</p>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function TrainingClient({ initialSnapshot, initialView, fullName }: TrainingClientProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [view, setView] = useState(initialView);
  const [submittingLesson, setSubmittingLesson] = useState(false);
  const [submittingTest, setSubmittingTest] = useState(false);
  const [lessonAnswers, setLessonAnswers] = useState<Record<string, string>>({});
  const [testAnswers, setTestAnswers] = useState<Record<string, string>>({});
  const [lessonFeedback, setLessonFeedback] = useState<Record<string, GradedAnswer>>({});
  const [testFeedback, setTestFeedback] = useState<Record<string, GradedAnswer>>({});
  const [grading, setGrading] = useState<Record<string, boolean>>({});
  const [clockNow, setClockNow] = useState(Date.now());
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<QuestionSet>("lesson");
  const [contentPage, setContentPage] = useState(0);
  const [showQuestions, setShowQuestions] = useState(false);
  const [confettiVisible, setConfettiVisible] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setClockNow(Date.now());
    }, 60000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!confettiVisible) return;

    const timer = window.setTimeout(() => {
      setConfettiVisible(false);
    }, 2800);

    return () => window.clearTimeout(timer);
  }, [confettiVisible]);

  const awaitingTest = snapshot.training.status === "awaiting_test";
  const unlockCountdown = formatUnlockCountdown(snapshot.training.next_day_unlock_at, clockNow);
  const trainingLocked = !snapshot.activated;
  const activeTest = view.activeTest;
  const currentLesson = view.currentLesson;
  const currentStep = useMemo(
    () => view.steps.find((step) => step.state === "current") ?? view.steps[view.steps.length - 1],
    [view.steps]
  );
  const dayLockedByTimer =
    snapshot.training.next_day_unlock_at !== null &&
    new Date(snapshot.training.next_day_unlock_at).getTime() > clockNow;
  const modalTest: TrainingSafeTest | null =
    modalMode === "stage_test" ? activeTest : currentLesson?.practice ?? null;
  const modalAnswers = modalMode === "stage_test" ? testAnswers : lessonAnswers;
  const modalFeedback = modalMode === "stage_test" ? testFeedback : lessonFeedback;
  const modalSections = currentLesson?.sections ?? [];
  const visibleSection = modalSections[contentPage];
  const answeredCount = modalTest
    ? modalTest.questions.filter((question) => Boolean(modalAnswers[question.id])).length
    : 0;
  const allQuestionsAnswered = modalTest ? answeredCount === modalTest.questions.length : false;
  const currentPageLabel =
    modalMode === "lesson" && !showQuestions && modalSections.length > 0
      ? `${Math.min(contentPage + 1, modalSections.length)}/${modalSections.length} pages`
      : `${answeredCount}/${modalTest?.totalQuestions ?? 0} answered`;

  function applyProgress(payload: ProgressResponse) {
    setSnapshot(payload.snapshot);
    setView(payload.view);
  }

  function openLessonModal() {
    if (trainingLocked) {
      toast.error("Activate your account before starting training.");
      return;
    }

    if (dayLockedByTimer) {
      toast.error("This training day has not unlocked yet.");
      return;
    }

    if (!currentLesson) return;

    setModalMode("lesson");
    setContentPage(0);
    setShowQuestions(false);
    setModalOpen(true);
  }

  function openStageTestModal() {
    if (!activeTest) return;

    setModalMode("stage_test");
    setContentPage(0);
    setShowQuestions(true);
    setModalOpen(true);
  }

  async function gradeAnswer(questionSet: QuestionSet, questionId: string, optionId: string) {
    if (questionSet === "stage_test") {
      setTestAnswers((current) => ({ ...current, [questionId]: optionId }));
    } else {
      setLessonAnswers((current) => ({ ...current, [questionId]: optionId }));
    }

    setGrading((current) => ({ ...current, [questionId]: true }));

    try {
      const response = await fetch("/api/training/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "grade_question",
          questionSet,
          questionId,
          selectedOptionId: optionId,
        }),
      });

      const payload = (await response.json()) as GradeResponse;

      if (!response.ok || !payload.grade) {
        toast.error(payload.error?.message || "Could not mark this answer");
        return;
      }

      if (questionSet === "stage_test") {
        setTestFeedback((current) => ({ ...current, [questionId]: payload.grade! }));
      } else {
        setLessonFeedback((current) => ({ ...current, [questionId]: payload.grade! }));
      }
    } catch {
      toast.error("Could not mark this answer");
    } finally {
      setGrading((current) => ({ ...current, [questionId]: false }));
    }
  }

  async function handleCompleteDay() {
    if (trainingLocked || submittingLesson) return;

    const practice = currentLesson?.practice;
    if (!practice) return;

    const hasMissingAnswer = practice.questions.some((question) => !lessonAnswers[question.id]);
    if (hasMissingAnswer) {
      toast.error("Answer the lesson questions before submitting.");
      return;
    }

    setSubmittingLesson(true);

    try {
      const response = await fetch("/api/training/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete_day", answers: lessonAnswers }),
      });

      const payload = (await response.json()) as ProgressResponse;

      if (!response.ok || !payload.snapshot || !payload.view) {
        toast.error(payload.error?.message || "Could not update training progress");
        return;
      }

      applyProgress(payload);
      setLessonAnswers({});
      setLessonFeedback({});
      setModalOpen(false);
      setConfettiVisible(false);
      window.setTimeout(() => setConfettiVisible(true), 0);

      if (payload.snapshot.training.status === "awaiting_test") {
        toast.success(
          payload.result
            ? `Lesson passed: ${payload.result.score}/${payload.result.totalQuestions}. Stage check unlocked.`
            : "Lesson complete. Your check is now unlocked."
        );
      } else {
        toast.success(
          payload.result
            ? `Lesson passed: ${payload.result.score}/${payload.result.totalQuestions}. Next step unlocks in 1 minute.`
            : "Training day completed. The next step unlocks in 1 minute."
        );
      }
    } catch {
      toast.error("Could not update training progress");
    } finally {
      setSubmittingLesson(false);
    }
  }

  async function handleSubmitStageTest() {
    if (!activeTest || submittingTest) return;

    const hasMissingAnswer = activeTest.questions.some((question) => !testAnswers[question.id]);

    if (hasMissingAnswer) {
      toast.error("Answer every question before submitting.");
      return;
    }

    setSubmittingTest(true);

    try {
      const response = await fetch("/api/training/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit_stage_test", answers: testAnswers }),
      });

      const payload = (await response.json()) as ProgressResponse;

      if (!response.ok || !payload.snapshot || !payload.view || !payload.result) {
        toast.error(payload.error?.message || "Could not submit the check");
        return;
      }

      applyProgress(payload);
      setTestAnswers({});
      setTestFeedback({});
      setModalOpen(false);

      if (payload.result.passed) {
        toast.success(
          payload.result.stageId === 3
            ? `Training completed. KSh ${view.rewardAmount} has been added to the wallet.`
            : "Check passed. The next step unlocks in 1 minute."
        );
      } else {
        toast.error("Check failed. Review this stage again before continuing.");
      }
    } catch {
      toast.error("Could not submit the check");
    } finally {
      setSubmittingTest(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={enterTransition}
        className="rounded-xl border border-outline-variant/40 bg-white p-5 shadow-sm sm:p-6"
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Training
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-navy sm:text-3xl">
              Your 7-day journey
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Read each lesson in the overlay, move through the content pages, then answer the marked quiz before the next step opens.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[360px]">
            <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                <Wallet className="h-4 w-4 text-teal" />
                Reward
              </div>
              <p className="mt-2 text-lg font-bold tabular-nums text-navy">KSh {view.rewardAmount}</p>
            </div>
            <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Progress
              </div>
              <p className="mt-2 text-lg font-bold tabular-nums text-navy">{Math.round(view.progressValue)}%</p>
            </div>
          </div>
        </div>
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-navy">
              {view.completedDays} / {view.totalDays} days completed
            </span>
            <span className="text-right text-muted-foreground">
              {snapshot.trainingCompleted ? "Finished" : unlockCountdown}
            </span>
          </div>
          <Progress value={view.progressValue} />
        </div>
      </motion.div>

      {!snapshot.activated ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-50 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-amber-900">Activation required before training can start</p>
              <p className="mt-1 text-sm text-amber-800">
                Activate your account, then return here to begin Day 1.
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/dashboard/activate">
                Activate account
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...enterTransition, delay: 0.08 }}
          className="space-y-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-navy">Training modules</h2>
              <p className="text-sm text-muted-foreground">Tap the current day to study inside the overlay.</p>
            </div>
            <Badge variant={snapshot.trainingCompleted ? "success" : "muted"}>
              {snapshot.trainingCompleted ? "Certified" : view.currentStage.level}
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {view.steps.map((step, index) => {
              const completed = step.state === "completed";
              const current = step.state === "current";
              const locked = step.state === "locked";
              const canOpen = current && !awaitingTest && !trainingLocked && !dayLockedByTimer;

              return (
                <motion.button
                  key={step.day}
                  type="button"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...enterTransition, delay: 0.12 + index * 0.035 }}
                  onClick={canOpen ? openLessonModal : undefined}
                  className={`rounded-xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-primary ${
                    completed
                      ? "border-teal/25 bg-teal/5"
                      : current
                        ? "border-primary/30 bg-primary/5 hover:bg-primary/10"
                        : "border-outline-variant/40 bg-white opacity-70"
                  } ${canOpen ? "cursor-pointer" : "cursor-default"}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 gap-3">
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                          completed
                            ? "bg-teal text-white"
                            : current
                              ? "bg-primary text-white"
                              : "bg-surface-container-high text-muted-foreground"
                        }`}
                      >
                        {completed ? <CheckCircle2 className="h-5 w-5" /> : locked ? <Lock className="h-5 w-5" /> : step.day}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-[11px]">
                            Day {step.day}
                          </Badge>
                          <span className="text-xs font-semibold text-primary">{step.focus}</span>
                        </div>
                        <h3 className="mt-2 font-semibold text-foreground">{step.title}</h3>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{step.summary}</p>
                      </div>
                    </div>
                    {current ? <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-primary" /> : null}
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...enterTransition, delay: 0.16 }}
          className="rounded-xl border border-outline-variant/40 bg-white shadow-sm"
        >
          <div className="border-b border-outline-variant/40 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Badge variant="muted" className="mb-3">
                  {snapshot.trainingCompleted
                    ? "Complete"
                    : awaitingTest
                      ? view.currentStage.name
                      : `Day ${currentStep.day}`}
                </Badge>
                <h2 className="text-xl font-bold text-navy">
                  {snapshot.trainingCompleted
                    ? `Certificate unlocked for ${fullName}`
                    : activeTest
                      ? activeTest.title
                      : currentLesson?.title ?? "Current lesson"}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {snapshot.trainingCompleted
                    ? "Training is complete and task access can open when the rest of your account is ready."
                    : activeTest
                      ? `${activeTest.totalQuestions} questions. Pass mark: ${activeTest.passMark}.`
                      : currentLesson?.summary ?? "Your next lesson appears here when it unlocks."}
                </p>
              </div>
              <div className="rounded-xl bg-primary/10 p-3 text-primary">
                {snapshot.trainingCompleted ? <Award className="h-6 w-6" /> : <BookOpen className="h-6 w-6" />}
              </div>
            </div>
          </div>

          <div className="space-y-5 p-5">
            {snapshot.trainingCompleted ? (
              <div className="rounded-xl border border-teal/25 bg-teal/5 p-5">
                <div className="flex items-start gap-3">
                  <Award className="mt-0.5 h-5 w-5 text-teal" />
                  <div>
                    <p className="font-semibold text-navy">Training complete</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Your one-time KSh {view.rewardAmount} training reward has been credited.
                    </p>
                    <Button asChild variant="outline" className="mt-4" size="sm">
                      <Link href="/dashboard/wallet">
                        View wallet
                        <Wallet className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            ) : activeTest ? (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-navy">Stage check ready</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Open the overlay to answer and mark every question instantly.
                    </p>
                  </div>
                  <Button onClick={openStageTestModal}>
                    Start check
                    <ShieldCheck className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : trainingLocked ? (
              <div className="rounded-xl border border-amber-500/25 bg-amber-50 p-5">
                <div className="flex items-start gap-3">
                  <Lock className="mt-0.5 h-5 w-5 text-amber-600" />
                  <div>
                    <p className="font-semibold text-amber-900">Training is locked</p>
                    <p className="mt-1 text-sm text-amber-800">
                      Activate your account first. Day 1 appears after activation.
                    </p>
                  </div>
                </div>
              </div>
            ) : currentLesson ? (
              <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-navy">{currentLesson.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {modalSections.length} content pages, {currentLesson.practice.totalQuestions} marked questions.
                    </p>
                    <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock3 className="h-4 w-4" />
                      {unlockCountdown}
                    </div>
                  </div>
                  <Button onClick={openLessonModal} disabled={dayLockedByTimer}>
                    Start training
                    <BookOpen className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-outline-variant/40 bg-surface-container-low p-5">
                <p className="font-semibold text-navy">No lesson open right now</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The next step appears after your current requirement is complete.
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {confettiVisible ? <ConfettiBurst /> : null}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="flex h-[100dvh] w-screen max-w-none flex-col gap-0 overflow-hidden border-0 bg-surface p-0 shadow-2xl sm:h-[92dvh] sm:w-[min(1040px,calc(100vw-2rem))] sm:rounded-2xl sm:border">
          <div className="shrink-0 border-b border-outline-variant/40 bg-surface px-4 py-4 pr-12 sm:px-8 sm:py-5">
            <div className="flex justify-end gap-2">
              <Badge variant="muted">
                {modalMode === "stage_test" ? view.currentStage.name : `Day ${currentLesson?.day ?? currentStep.day}`}
              </Badge>
              <Badge variant="outline">{currentPageLabel}</Badge>
            </div>
            <DialogHeader className="mx-auto mt-3 max-w-3xl items-center space-y-3 text-center">
              <DialogTitle className="text-2xl font-extrabold leading-tight text-navy sm:text-3xl">
                {modalMode === "stage_test" ? activeTest?.title : currentLesson?.title}
              </DialogTitle>
              <DialogDescription className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
                {modalMode === "stage_test"
                  ? `Pass mark: ${activeTest?.passMark ?? 0} out of ${activeTest?.totalQuestions ?? 0}.`
                  : showQuestions
                    ? `Pass mark: ${currentLesson?.practice.passMark ?? 0} out of ${currentLesson?.practice.totalQuestions ?? 0}.`
                    : currentLesson?.summary}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7">
            {modalMode === "lesson" && !showQuestions && visibleSection ? (
              <div className="mx-auto max-w-3xl space-y-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
                  Section {contentPage + 1}
                </p>
                <h3 className="text-2xl font-bold leading-tight text-navy sm:text-3xl">
                  {cleanSectionTitle(visibleSection.title)}
                </h3>
                <div className="space-y-4 text-sm leading-7 text-muted-foreground sm:text-base sm:leading-8">
                  {visibleSection.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
                {visibleSection.bullets.length > 0 ? (
                  <ul className="space-y-3 rounded-xl border border-outline-variant/40 bg-white p-4 text-sm text-muted-foreground">
                    {visibleSection.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-teal" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : modalTest ? (
              <div className="mx-auto max-w-3xl space-y-5">
                {modalMode === "lesson" ? (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <p className="font-semibold text-navy">{currentLesson?.practice.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Marking happens immediately after each answer. You can change an answer before final submission.
                    </p>
                  </div>
                ) : null}
                <QuestionList
                  questions={modalTest.questions}
                  answers={modalAnswers}
                  feedback={modalFeedback}
                  grading={grading}
                  onAnswer={(questionId, optionId) => gradeAnswer(modalMode, questionId, optionId)}
                />
              </div>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-outline-variant/40 bg-white px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] sm:px-8 sm:py-4">
            <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (modalMode === "stage_test" || showQuestions) {
                    setShowQuestions(false);
                    setContentPage(Math.max(modalSections.length - 1, 0));
                    if (modalMode === "stage_test") setModalOpen(false);
                    return;
                  }

                  setContentPage((page) => Math.max(page - 1, 0));
                }}
                disabled={modalMode === "lesson" && !showQuestions && contentPage === 0}
                className="min-h-11 flex-1 rounded-full sm:max-w-40"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                {modalMode === "stage_test" ? "Close" : "Back"}
              </Button>

              <div className="flex flex-1 justify-end">
                {modalMode === "lesson" && !showQuestions ? (
                  <Button
                    type="button"
                    onClick={() => {
                      if (contentPage < modalSections.length - 1) {
                        setContentPage((page) => page + 1);
                      } else {
                        setShowQuestions(true);
                      }
                    }}
                    className="min-h-11 w-full rounded-full sm:max-w-56"
                  >
                    {contentPage < modalSections.length - 1 ? "Next section" : "Start questions"}
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : modalMode === "stage_test" ? (
                  <Button
                    onClick={handleSubmitStageTest}
                    disabled={submittingTest || !allQuestionsAnswered}
                    className="min-h-11 w-full rounded-full sm:max-w-56"
                  >
                    {submittingTest ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="mr-2 h-4 w-4" />
                    )}
                    Submit check
                  </Button>
                ) : (
                  <Button
                    onClick={handleCompleteDay}
                    disabled={submittingLesson || dayLockedByTimer || !allQuestionsAnswered}
                    className="min-h-11 w-full rounded-full sm:max-w-56"
                  >
                    {submittingLesson ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <BookOpen className="mr-2 h-4 w-4" />
                    )}
                    Complete day
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
