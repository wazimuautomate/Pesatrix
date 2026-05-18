"use client";

import { useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, ExternalLink, ImagePlus, Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ACTION_LABELS,
  PLATFORM_COLORS,
  PLATFORM_LABELS,
  normalizeSocialAction,
  normalizeSocialPlatform,
  type SocialAction,
  type SocialPlatform,
} from "@/lib/social-engagement";

interface SocialEngagementTaskProps {
  taskId: string;
  taskData: {
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
  };
  payoutKsh: number;
  onSubmitSuccess: () => void;
}

type UploadState = {
  storageUrl: string;
  previewUrl: string | null;
  warning: string | null;
};

const MAX_SCREENSHOT_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function SocialEngagementTask({
  taskId,
  taskData,
  payoutKsh,
  onSubmitSuccess,
}: SocialEngagementTaskProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const platform = normalizeSocialPlatform(taskData.platform);
  const action = normalizeSocialAction(taskData.action);
  const proofRequirements = taskData.proof_requirements;
  const [username, setUsername] = useState("");
  const [textInput, setTextInput] = useState("");
  const [proofOpenedAt, setProofOpenedAt] = useState<string | null>(null);
  const [upload, setUpload] = useState<UploadState | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completeMessage, setCompleteMessage] = useState<string | null>(null);

  const platformLabel = PLATFORM_LABELS[platform];
  const actionLabel = ACTION_LABELS[action];
  const targetLabel = taskData.target_identifier || taskData.target_name;
  const textInputLabel =
    proofRequirements.text_input_label || defaultTextInputLabel(action);

  const canSubmit = useMemo(() => {
    if (proofRequirements.requires_screenshot && !upload?.storageUrl) return false;
    if (proofRequirements.requires_username && !username.trim()) return false;
    if (proofRequirements.requires_text_input && !textInput.trim()) return false;
    return true;
  }, [proofRequirements, textInput, upload?.storageUrl, username]);

  function openTarget() {
    setProofOpenedAt(new Date().toISOString());
    window.open(taskData.target_url, "_blank", "noopener,noreferrer");
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.has(file.type)) {
      toast.error("Please upload an image file (JPG, PNG)");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_SCREENSHOT_SIZE) {
      toast.error("Screenshot must be 10MB or smaller.");
      event.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("taskId", taskId);
      formData.append("screenshot", file);

      const response = await fetch("/api/tasks/social-screenshot", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? "Screenshot upload failed");
        return;
      }

      const previewUrl = payload.previewUrl || URL.createObjectURL(file);
      setUpload({
        storageUrl: payload.storageUrl,
        previewUrl,
        warning: payload.warning ?? null,
      });
      if (payload.warning) {
        toast.warning(payload.warning);
      } else {
        toast.success("Screenshot uploaded");
      }
    } finally {
      setUploading(false);
    }
  }

  async function submitProof() {
    if (!proofOpenedAt) {
      toast.warning(`Please complete the action on ${platformLabel} before submitting proof`);
    }

    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const response = await fetch("/api/tasks/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          answers: {
            screenshot_url: upload?.storageUrl,
            username: username.trim() || null,
            text_input: textInput.trim() || null,
            proof_opened_at: proofOpenedAt,
            platform,
            action,
          },
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? payload?.error ?? "Submission failed");
        return;
      }

      const status = payload?.submission?.status;
      const aiReasoning = payload?.submission?.aiReasoning;
      const message =
        status === "approved"
          ? `Proof approved! KSh ${payoutKsh} pending. Available in ${Math.max(1, Number(taskData.hold_days || 7))} days.`
          : status === "declined"
            ? `Proof not accepted. Reason: ${aiReasoning ?? "Please re-read the screenshot instructions and try again."}`
            : "Your proof is under manual review. We'll notify you within 24 hours.";

      setCompleteMessage(message);
      onSubmitSuccess();
    } finally {
      setSubmitting(false);
    }
  }

  if (completeMessage) {
    return (
      <div className="rounded-lg border border-teal/30 bg-teal/5 px-5 py-8 text-center">
        <Check className="mx-auto h-10 w-10 rounded-full bg-teal p-2 text-white" />
        <h3 className="mt-4 text-lg font-semibold text-navy">Submitted</h3>
        <p className="mt-2 text-sm text-muted-foreground">{completeMessage}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-5">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <SocialBadge platform={platform}>{platformLabel}</SocialBadge>
          <Badge variant="outline">{actionLabel}</Badge>
        </div>
        <div>
          <h2 className="text-xl font-bold text-navy">
            {actionLabel} {taskData.target_name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Target: {targetLabel}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <h3 className="text-sm font-semibold uppercase text-muted-foreground">Instructions</h3>
        <ol className="mt-3 space-y-2 text-sm text-navy">
          <li>1. Open the target link.</li>
          <li>2. Complete the {actionLabel.toLowerCase()} action for {taskData.target_name}.</li>
          {taskData.comment_prompt && <li>3. Use this prompt: {taskData.comment_prompt}</li>}
          <li>{taskData.comment_prompt ? "4" : "3"}. {taskData.screenshot_instructions}</li>
          <li>{taskData.comment_prompt ? "5" : "4"}. Upload your screenshot below.</li>
        </ol>
      </div>

      <Button type="button" size="lg" className="w-full" onClick={openTarget}>
        Open {platformLabel}
        <ExternalLink className="ml-2 h-4 w-4" />
      </Button>

      <div className="space-y-4 border-t pt-5">
        <h3 className="text-center text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Submit Your Proof
        </h3>

        {proofRequirements.requires_screenshot && (
          <div className="space-y-2">
            <Label>Screenshot</Label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-44 w-full flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed bg-muted/40 p-3 text-center transition hover:bg-muted"
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
                  <span className="text-sm font-medium text-navy">Tap to upload screenshot</span>
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
          </div>
        )}

        {proofRequirements.requires_username && (
          <div className="space-y-2">
            <Label htmlFor="social-username">Your {platformLabel} username</Label>
            <Input
              id="social-username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="@username"
            />
          </div>
        )}

        {proofRequirements.requires_text_input && (
          <div className="space-y-2">
            <Label htmlFor="social-text-input">{textInputLabel}</Label>
            <Textarea
              id="social-text-input"
              value={textInput}
              onChange={(event) => setTextInput(event.target.value)}
              placeholder={proofRequirements.text_input_placeholder ?? textInputLabel}
              rows={3}
            />
          </div>
        )}

        <Button
          type="button"
          onClick={submitProof}
          disabled={uploading || submitting || !canSubmit}
          className="w-full"
        >
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Submit Proof
        </Button>
        {!canSubmit && (
          <p className="text-center text-xs text-muted-foreground">Complete all required proof fields to submit.</p>
        )}
      </div>
    </div>
  );
}

function SocialBadge({
  platform,
  children,
}: {
  platform: SocialPlatform;
  children: ReactNode;
}) {
  return (
    <Badge
      style={{
        backgroundColor: PLATFORM_COLORS[platform],
        color: "white",
        borderColor: PLATFORM_COLORS[platform],
      }}
    >
      {children}
    </Badge>
  );
}

function defaultTextInputLabel(action: SocialAction) {
  if (action === "purchase") return "Enter the transaction confirmation number";
  if (action === "review") return "Paste your review text";
  return "Paste the exact comment you wrote";
}
