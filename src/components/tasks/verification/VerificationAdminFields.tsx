"use client";

import type { Dispatch, SetStateAction } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export type VerificationTaskData = {
  type: "verification";
  verification_type: "text_only" | "screenshot_only" | "url_only" | "mixed";
  requires_text_answer: boolean;
  requires_screenshot: boolean;
  requires_url: boolean;
  text_answer_label?: string | null;
  expected_answer?: string | null;
  expected_answer_strict?: boolean;
  answer_hint?: string | null;
  verification_url?: string | null;
};

type VerificationAdminFieldsProps = {
  taskData: Record<string, unknown>;
  setTaskData: Dispatch<SetStateAction<Record<string, unknown>>>;
  onRequirementChange?: (requirements: {
    requires_screenshot?: boolean;
    requires_url?: boolean;
    min_word_count?: string;
  }) => void;
};

export function normalizeVerificationTaskData(value: unknown): VerificationTaskData {
  const data = isRecord(value) ? value : {};
  const requiresText = data.requires_text_answer !== false;
  const requiresScreenshot = data.requires_screenshot === true;
  const requiresUrl = data.requires_url === true;

  return {
    type: "verification",
    verification_type: getVerificationType(requiresText, requiresScreenshot, requiresUrl),
    requires_text_answer: requiresText,
    requires_screenshot: requiresScreenshot,
    requires_url: requiresUrl,
    text_answer_label:
      typeof data.text_answer_label === "string" && data.text_answer_label.trim()
        ? data.text_answer_label
        : "Your Answer",
    expected_answer:
      typeof data.expected_answer === "string" && data.expected_answer.trim()
        ? data.expected_answer
        : null,
    expected_answer_strict: data.expected_answer_strict === true,
    answer_hint:
      typeof data.answer_hint === "string" && data.answer_hint.trim()
        ? data.answer_hint
        : null,
    verification_url:
      typeof data.verification_url === "string" && data.verification_url.trim()
        ? data.verification_url
        : null,
  };
}

export function VerificationAdminFields({
  taskData,
  setTaskData,
  onRequirementChange,
}: VerificationAdminFieldsProps) {
  const data = normalizeVerificationTaskData(taskData);

  function update(updates: Partial<VerificationTaskData>) {
    setTaskData((current) => {
      const merged = normalizeVerificationTaskData({ ...current, ...updates });
      return {
        ...current,
        ...merged,
        verification_type: getVerificationType(
          merged.requires_text_answer,
          merged.requires_screenshot,
          merged.requires_url
        ),
      };
    });
  }

  function updateRequirement(
    key: "requires_text_answer" | "requires_screenshot" | "requires_url",
    checked: boolean
  ) {
    const next = {
      requires_text_answer: data.requires_text_answer,
      requires_screenshot: data.requires_screenshot,
      requires_url: data.requires_url,
      [key]: checked,
    };

    if (!next.requires_text_answer && !next.requires_screenshot && !next.requires_url) {
      next.requires_text_answer = true;
    }

    update(next);
    onRequirementChange?.({
      requires_screenshot: next.requires_screenshot,
      requires_url: next.requires_url,
      min_word_count: next.requires_text_answer ? "1" : "0",
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-medium text-navy">Verification Settings</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the proof users must submit. Expected answers are used only by AI/admin review and are never shown to users.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="verification-url">Verification URL (optional)</Label>
          <Input
            id="verification-url"
            value={data.verification_url ?? ""}
            onChange={(event) => update({ verification_url: event.target.value })}
            placeholder="https://example.com/task"
          />
        </div>

        <RequirementSwitch
          id="verification-requires-text"
          label="Require text answer"
          checked={data.requires_text_answer}
          onCheckedChange={(checked) => updateRequirement("requires_text_answer", checked)}
        />
        <RequirementSwitch
          id="verification-requires-screenshot"
          label="Require screenshot upload"
          checked={data.requires_screenshot}
          onCheckedChange={(checked) => updateRequirement("requires_screenshot", checked)}
        />
        <RequirementSwitch
          id="verification-requires-url"
          label="Require URL submission from user"
          checked={data.requires_url}
          onCheckedChange={(checked) => updateRequirement("requires_url", checked)}
        />

        {data.requires_text_answer && (
          <>
            <div>
              <Label htmlFor="verification-text-label">Text answer label</Label>
              <Input
                id="verification-text-label"
                value={data.text_answer_label ?? ""}
                onChange={(event) => update({ text_answer_label: event.target.value })}
                placeholder="What price did you see?"
              />
            </div>

            <div>
              <Label htmlFor="verification-answer-hint">Answer hint (optional)</Label>
              <Input
                id="verification-answer-hint"
                value={data.answer_hint ?? ""}
                onChange={(event) => update({ answer_hint: event.target.value })}
                placeholder="e.g. Enter the price exactly as shown"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="verification-expected-answer">Expected answer (optional)</Label>
              <Textarea
                id="verification-expected-answer"
                value={data.expected_answer ?? ""}
                onChange={(event) => update({ expected_answer: event.target.value })}
                placeholder="Correct answer for AI comparison"
                rows={2}
              />
            </div>

            <RequirementSwitch
              id="verification-strict-answer"
              label="Expected answer strict?"
              checked={data.expected_answer_strict === true}
              onCheckedChange={(checked) => update({ expected_answer_strict: checked })}
            />
          </>
        )}
      </div>
    </div>
  );
}

function RequirementSwitch({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <Label htmlFor={id}>{label}</Label>
    </div>
  );
}

function getVerificationType(
  requiresText: boolean,
  requiresScreenshot: boolean,
  requiresUrl: boolean
): VerificationTaskData["verification_type"] {
  const enabled = [requiresText, requiresScreenshot, requiresUrl].filter(Boolean).length;
  if (enabled > 1) return "mixed";
  if (requiresScreenshot) return "screenshot_only";
  if (requiresUrl) return "url_only";
  return "text_only";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
