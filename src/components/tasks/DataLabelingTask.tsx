"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ImageOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface DataLabelingTaskProps {
  taskId: string;
  taskData: {
    type: "data_labeling";
    subtype: string;
    batch_size: number;
    label_options: string[];
    items: Array<{
      id: string;
      content: string;
      content_type: "text" | "image_url";
    }>;
  };
  payoutKsh: number;
  onSubmitSuccess: () => void;
  previewMode?: boolean;
}

export function DataLabelingTask({
  taskId,
  taskData,
  payoutKsh,
  onSubmitSuccess,
  previewMode = false,
}: DataLabelingTaskProps) {
  const storageKey = `pesatrix:data-labeling:${taskId}`;
  const items = taskData.items ?? [];
  const batchSize = taskData.batch_size || items.length;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null);
  const [submissionScore, setSubmissionScore] = useState<number | null>(null);
  const [imageFailed, setImageFailed] = useState<Record<string, boolean>>({});
  const [openedAt] = useState(() => new Date().toISOString());
  const currentItem = items[currentIndex];
  const selectedLabel = currentItem ? answers[currentItem.id] ?? null : null;
  const isLast = currentIndex >= items.length - 1;
  const answeredCount = useMemo(
    () => items.filter((item) => answers[item.id]).length,
    [answers, items]
  );
  const progress = batchSize > 0 ? Math.round((answeredCount / batchSize) * 100) : 0;

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { currentIndex?: number; answers?: Record<string, string> };
      if (parsed.answers && typeof parsed.answers === "object") {
        setAnswers(parsed.answers);
      }
      if (typeof parsed.currentIndex === "number") {
        setCurrentIndex(Math.min(Math.max(parsed.currentIndex, 0), Math.max(items.length - 1, 0)));
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [items.length, storageKey]);

  useEffect(() => {
    if (isComplete) return;
    window.localStorage.setItem(storageKey, JSON.stringify({ currentIndex, answers }));
  }, [answers, currentIndex, isComplete, storageKey]);

  function selectLabel(label: string) {
    if (!currentItem) return;
    setAnswers((current) => ({ ...current, [currentItem.id]: label }));
  }

  function goBack() {
    setCurrentIndex((index) => Math.max(0, index - 1));
  }

  async function goNext() {
    if (!currentItem || !selectedLabel) return;
    if (!isLast) {
      setCurrentIndex((index) => Math.min(items.length - 1, index + 1));
      return;
    }

    if (previewMode) {
      setCurrentIndex(0);
      return;
    }

    const complete = items.every((item) => answers[item.id]);
    if (!complete || Object.keys(answers).length !== batchSize) {
      toast.error("Please label all items before submitting");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/tasks/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, answers, openedAt }),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? payload?.error ?? "Submission failed");
        return;
      }

      window.localStorage.removeItem(storageKey);
      setSubmissionStatus(payload?.submission?.status ?? null);
      setSubmissionScore(typeof payload?.submission?.aiScore === "number" ? payload.submission.aiScore : null);
      setIsComplete(true);
      onSubmitSuccess();
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isComplete) {
    const message =
      submissionStatus === "approved"
        ? `Submitted! KSh ${payoutKsh} is pending in your wallet.`
        : submissionStatus === "declined"
          ? `Submission declined. You answered ${submissionScore ?? 0}% correctly. Minimum is 70%.`
          : submissionStatus === "flagged"
            ? "Your submission is under review. We'll notify you within 24 hours."
            : "Submitted. Your response is waiting for review.";

    return (
      <div className="rounded-lg border border-teal/30 bg-teal/5 px-5 py-8 text-center">
        <Check className="mx-auto h-10 w-10 rounded-full bg-teal p-2 text-white" />
        <h3 className="mt-4 text-lg font-semibold text-navy">Submitted</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {message}
        </p>
      </div>
    );
  }

  if (!currentItem) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        This labeling task has no items.
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-5">
      <div className="space-y-2">
        {currentIndex > 0 && (
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-navy"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-navy">Item {currentIndex + 1} of {batchSize}</span>
          <span className="text-muted-foreground">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2.5" />
      </div>

      <div className="flex min-h-[320px] flex-col justify-between rounded-lg border bg-white p-5 shadow-sm">
        <div className="flex justify-start">
          <Badge variant="outline" className="uppercase">
            {taskData.subtype.replace(/_/g, " ")}
          </Badge>
        </div>

        <div className="flex min-h-[220px] items-center justify-center py-5">
          {currentItem.content_type === "image_url" ? (
            imageFailed[currentItem.id] ? (
              <div className="flex h-52 w-full flex-col items-center justify-center rounded-md border border-dashed bg-muted text-sm text-muted-foreground">
                <ImageOff className="mb-2 h-8 w-8" />
                Image unavailable
              </div>
            ) : (
              <img
                src={currentItem.content}
                alt={`Item ${currentIndex + 1}`}
                className="max-h-56 w-full rounded-md object-contain"
                onError={() => setImageFailed((current) => ({ ...current, [currentItem.id]: true }))}
              />
            )
          ) : (
            <p className="max-w-prose text-center text-lg font-medium leading-relaxed text-navy">
              &quot;{currentItem.content}&quot;
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {taskData.label_options.map((label) => {
          const selected = selectedLabel === label;
          return (
            <Button
              key={label}
              type="button"
              variant={selected ? "default" : "outline"}
              onClick={() => selectLabel(label)}
              className={cn("min-h-11 justify-center gap-2 whitespace-normal", selected && "shadow-sm")}
            >
              {selected && <Check className="h-4 w-4" />}
              {label}
            </Button>
          );
        })}
      </div>

      <Button
        type="button"
        onClick={goNext}
        disabled={!selectedLabel || isSubmitting}
        className="w-full"
      >
        {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {isLast ? (previewMode ? "Restart Preview" : "Submit All") : "Next ->"}
      </Button>
    </div>
  );
}
