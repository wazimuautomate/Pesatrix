"use client";

import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ExternalLink, ImagePlus, Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { normalizeVerificationTaskData, type VerificationTaskData } from "./VerificationAdminFields";

export type VerificationSubmission = {
  text_answer?: string;
  screenshot_url?: string;
  submitted_url?: string;
  verification_notes?: string;
};

type Task = {
  id: string;
  title: string;
  instructions: string;
  task_data: Record<string, unknown> | null;
};

type UploadState = {
  storageUrl: string;
  previewUrl: string | null;
  warning: string | null;
};

type VerificationTaskUIProps = {
  task: Task;
  onSubmit: (data: VerificationSubmission) => void | Promise<void>;
  isSubmitting: boolean;
};

const MAX_SCREENSHOT_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function VerificationTaskUI({
  task,
  onSubmit,
  isSubmitting,
}: VerificationTaskUIProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const taskData = normalizeVerificationTaskData(task.task_data);
  const taskUrl = getValidUrl(taskData.verification_url);
  const [textAnswer, setTextAnswer] = useState("");
  const [submittedUrl, setSubmittedUrl] = useState("");
  const [verificationNotes, setVerificationNotes] = useState("");
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const requiredSteps = [
    taskData.requires_text_answer,
    taskData.requires_screenshot,
    taskData.requires_url,
  ].filter(Boolean).length;

  const canSubmit = useMemo(() => {
    if (taskData.requires_text_answer && !textAnswer.trim()) return false;
    if (taskData.requires_screenshot && !upload?.storageUrl) return false;
    if (taskData.requires_url && !getValidUrl(normalizeUrlInput(submittedUrl))) return false;
    return !uploading && !isSubmitting;
  }, [isSubmitting, submittedUrl, taskData, textAnswer, upload?.storageUrl, uploading]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    if (!ALLOWED_TYPES.has(file.type)) {
      const message = "Please upload an image file (JPG, PNG, or WebP).";
      setUploadError(message);
      toast.error(message);
      event.target.value = "";
      return;
    }

    if (file.size > MAX_SCREENSHOT_SIZE) {
      const message = "Screenshot must be 10MB or smaller.";
      setUploadError(message);
      toast.error(message);
      event.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("taskId", task.id);
      formData.append("screenshot", file);

      const response = await fetch("/api/tasks/social-screenshot", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        const message = payload?.error?.message ?? "Screenshot upload failed. Please try again.";
        setUploadError(message);
        toast.error(message);
        return;
      }

      setUpload({
        storageUrl: payload.storageUrl,
        previewUrl: payload.previewUrl || URL.createObjectURL(file),
        warning: payload.warning ?? null,
      });

      if (payload.warning) {
        toast.warning(payload.warning);
      } else {
        toast.success("Screenshot uploaded");
      }
    } catch {
      const message = "Screenshot upload failed. Please retry before submitting.";
      setUploadError(message);
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  async function submitVerification() {
    const normalizedSubmittedUrl = taskData.requires_url
      ? normalizeUrlInput(submittedUrl)
      : submittedUrl.trim();

    if (taskData.requires_url && !getValidUrl(normalizedSubmittedUrl)) {
      toast.error("Please enter a valid URL starting with http:// or https://");
      return;
    }

    setSubmittedUrl(normalizedSubmittedUrl);

    await onSubmit({
      text_answer: textAnswer.trim() || undefined,
      screenshot_url: upload?.storageUrl,
      submitted_url: normalizedSubmittedUrl || undefined,
      verification_notes: verificationNotes.trim() || undefined,
    });
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-5">
      {taskUrl && (
        <div className="rounded-xl border border-pesatrix-blue/20 bg-pesatrix-blue/5 p-4">
          <p className="text-sm font-semibold text-navy">
            Step 1 - Open the link below to complete this task
          </p>
          <Button type="button" size="lg" className="mt-3 w-full" asChild>
            <a href={taskUrl} target="_blank" rel="noopener noreferrer">
              Open Task Link
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {taskData.requires_text_answer && (
          <section className="space-y-2 rounded-xl border bg-white p-4">
            <StepLabel step={taskUrl ? 2 : 1} total={requiredSteps} required>
              {taskData.text_answer_label || "Your Answer"}
            </StepLabel>
            <Textarea
              value={textAnswer}
              onChange={(event) => setTextAnswer(event.target.value)}
              placeholder={taskData.answer_hint || "Enter your answer"}
              rows={4}
            />
          </section>
        )}

        {taskData.requires_screenshot && (
          <section className="space-y-2 rounded-xl border bg-white p-4">
            <StepLabel step={getStepNumber(taskData, "screenshot", taskUrl)} total={requiredSteps} required>
              Upload Screenshot as Proof
            </StepLabel>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex min-h-44 w-full flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/40 p-3 text-center transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-70"
            >
              {upload?.previewUrl ? (
                <img
                  src={upload.previewUrl}
                  alt="Screenshot preview"
                  className="max-h-72 w-full rounded-md object-contain"
                />
              ) : (
                <>
                  {uploading ? (
                    <Loader2 className="mb-2 h-8 w-8 animate-spin text-pesatrix-blue" />
                  ) : (
                    <ImagePlus className="mb-2 h-8 w-8 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium text-navy">
                    {uploading ? "Uploading screenshot..." : "Tap to upload screenshot"}
                  </span>
                  <span className="mt-1 text-xs text-muted-foreground">JPG, PNG, or WebP. Max 10MB.</span>
                </>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
            {uploadError && (
              <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <span>{uploadError}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Retry
                </Button>
              </div>
            )}
            {upload?.warning && <p className="text-xs text-amber-700">{upload.warning}</p>}
            {upload?.previewUrl && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <UploadCloud className="mr-2 h-4 w-4" />
                Replace screenshot
              </Button>
            )}
          </section>
        )}

        {taskData.requires_url && (
          <section className="space-y-2 rounded-xl border bg-white p-4">
            <StepLabel step={getStepNumber(taskData, "url", taskUrl)} total={requiredSteps} required>
              Paste the URL you visited
            </StepLabel>
            <Input
              value={submittedUrl}
              onChange={(event) => setSubmittedUrl(event.target.value)}
              onBlur={() => setSubmittedUrl((value) => normalizeUrlInput(value))}
              placeholder="https://example.com/page"
              inputMode="url"
            />
          </section>
        )}

        <section className="space-y-2 rounded-xl border bg-white p-4">
          <Label htmlFor="verification-notes">Additional Notes</Label>
          <Textarea
            id="verification-notes"
            value={verificationNotes}
            onChange={(event) => setVerificationNotes(event.target.value)}
            placeholder="Add any extra context for the reviewer"
            rows={3}
          />
        </section>

        <Button
          type="button"
          onClick={submitVerification}
          disabled={!canSubmit}
          className="min-h-12 w-full text-base"
        >
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Submit Verification
        </Button>
        {!canSubmit && (
          <p className="text-center text-xs text-muted-foreground">
            Complete all required proof fields to submit.
          </p>
        )}
      </div>
    </div>
  );
}

function StepLabel({
  step,
  total,
  required,
  children,
}: {
  step: number;
  total: number;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <Label className="text-sm font-semibold text-navy">
      {total > 1 ? `Step ${step} - ` : null}
      {children}
      {required ? <span className="ml-1 text-destructive">*</span> : null}
    </Label>
  );
}

function getStepNumber(
  taskData: VerificationTaskData,
  field: "screenshot" | "url",
  taskUrl: string | null
) {
  let step = taskUrl ? 2 : 1;
  if (field === "screenshot" && taskData.requires_text_answer) step += 1;
  if (field === "url") {
    if (taskData.requires_text_answer) step += 1;
    if (taskData.requires_screenshot) step += 1;
  }
  return step;
}

function normalizeUrlInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function getValidUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}
