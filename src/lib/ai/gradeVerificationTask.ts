import { getVaultSecret } from "@/lib/ai/provider-secrets";
import { analyzeImageWithVision } from "@/lib/ai/visionClient";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type ProviderConfig = {
  id?: string;
  provider: "nvidia" | "openrouter" | "groq" | "ollama";
  model_id: string;
  api_key_secret_name?: string | null;
  base_url: string;
  max_tokens?: number | null;
  temperature?: number | null;
};

type VerificationTaskData = {
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

type Task = {
  title?: string | null;
  instructions?: string | null;
  ai_rubric?: string | null;
  task_data?: unknown;
};

type TaskSubmission = {
  answers?: unknown;
  screenshot_url?: string | null;
  submitted_url?: string | null;
};

type VerificationGradeResult = {
  score: number;
  reasoning: string;
  passed: boolean;
  manualReview?: boolean;
  gradingDetail?: Record<string, unknown>;
};

type TextGrade = {
  text_score: number;
  text_reasoning: string;
  text_passed: boolean;
};

type VisionGrade = {
  score: number;
  reasoning: string;
  passed: boolean;
};

export async function gradeVerificationSubmission(
  task: Task,
  submission: TaskSubmission
): Promise<VerificationGradeResult> {
  const taskData = normalizeVerificationTaskData(task.task_data);
  const answers = isRecord(submission.answers) ? submission.answers : {};
  const textAnswer = typeof answers.text_answer === "string" ? answers.text_answer.trim() : "";
  const verificationNotes =
    typeof answers.verification_notes === "string" ? answers.verification_notes.trim() : "";
  const screenshotUrl = typeof submission.screenshot_url === "string" ? submission.screenshot_url.trim() : "";
  const expectedAnswer = taskData.expected_answer?.trim() ?? "";

  const hasText = textAnswer.length > 0;
  const hasScreenshot = screenshotUrl.length > 0;
  const hasExpected = expectedAnswer.length > 0;
  const hasRubric = Boolean(task.ai_rubric?.trim());
  const requiresManualSpotCheck = !hasRubric && !hasExpected;

  let textGrade: TextGrade | null = null;
  let visionGrade: VisionGrade | null = null;
  const reasoningParts: string[] = [];
  const gradingDetail: Record<string, unknown> = {
    type: "verification",
    has_text: hasText,
    has_screenshot: hasScreenshot,
    has_expected_answer: hasExpected,
  };

  if (hasText) {
    try {
      textGrade = await gradeTextSubmission({
        task,
        taskData,
        textAnswer,
        verificationNotes,
        submittedUrl: submission.submitted_url,
      });
      reasoningParts.push(`Text: ${textGrade.text_reasoning}`);
      gradingDetail.text = textGrade;
    } catch (error) {
      console.error("[Verification Grading] Text grading failed:", error);
      textGrade = {
        text_score: 0,
        text_reasoning: "Text grading failed",
        text_passed: false,
      };
      reasoningParts.push("Text: Text grading failed.");
      gradingDetail.text_error = error instanceof Error ? error.message : String(error);
    }
  }

  if (hasScreenshot) {
    try {
      const rawVision = await analyzeImageWithVision(
        screenshotUrl,
        buildVisionPrompt({ task, taskData, hasExpected })
      );
      visionGrade = parseVisionGrade(rawVision);
      reasoningParts.push(`Screenshot: ${visionGrade.reasoning}`);
      gradingDetail.vision = visionGrade;
    } catch (error) {
      console.error("[Verification Grading] Screenshot review failed:", error);
      reasoningParts.push("Screenshot review unavailable - pending manual check.");
      gradingDetail.vision_error = error instanceof Error ? error.message : String(error);
    }
  }

  const scores: number[] = [];
  if (textGrade) scores.push(textGrade.text_score);
  if (visionGrade) scores.push(visionGrade.score);

  let finalScore =
    scores.length > 0
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length
      : 70;

  if (requiresManualSpotCheck) {
    finalScore = Math.min(finalScore, 75);
    reasoningParts.push("No AI rubric or expected answer was configured, so this needs admin spot-check.");
  }

  const roundedScore = Math.max(0, Math.min(100, Math.round(finalScore)));

  return {
    score: roundedScore,
    reasoning: reasoningParts.join(" ").trim() || "No direct proof was available for AI review; manual review recommended.",
    passed: roundedScore >= 60,
    manualReview: requiresManualSpotCheck || (hasScreenshot && !visionGrade),
    gradingDetail,
  };
}

async function gradeTextSubmission(args: {
  task: Task;
  taskData: VerificationTaskData;
  textAnswer: string;
  verificationNotes: string;
  submittedUrl?: string | null;
}): Promise<TextGrade> {
  const admin = createAdminSupabaseClient();
  const provider = await getActiveProviderConfig(admin);
  if (!provider) {
    throw new Error("No active AI provider configured.");
  }

  const apiKey = await getProviderApiKey(admin, provider);
  if (!apiKey) {
    throw new Error("AI provider secret could not be loaded.");
  }

  const response = await fetch(`${trimTrailingSlash(provider.base_url)}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model_id,
      messages: [
        {
          role: "user",
          content: buildTextPrompt(args),
        },
      ],
      temperature: Number(provider.temperature ?? 0.2),
      max_tokens: Number(provider.max_tokens ?? 1024),
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`AI provider returned ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  return parseTextGrade(typeof content === "string" ? content : "");
}

function buildTextPrompt({
  task,
  taskData,
  textAnswer,
  verificationNotes,
  submittedUrl,
}: {
  task: Task;
  taskData: VerificationTaskData;
  textAnswer: string;
  verificationNotes: string;
  submittedUrl?: string | null;
}) {
  const hasExpected = Boolean(taskData.expected_answer?.trim());

  return `You are verifying a task submission on Pesatrix, a Kenyan online task platform.
Task: ${task.title ?? "Untitled task"}
Task instructions: ${task.instructions ?? ""}
Grading rubric: ${task.ai_rubric || "Evaluate based on the task instructions and common sense. Score conservatively."}
${hasExpected ? `Expected answer: "${taskData.expected_answer}"` : ""}
${taskData.expected_answer_strict ? "This is a STRICT match - the user must give the same answer (minor spelling ok)." : "This is a FLEXIBLE match - the meaning must be close, not exact wording."}
User submitted text answer: "${textAnswer}"
${verificationNotes ? `User notes: "${verificationNotes}"` : ""}
${submittedUrl ? `User visited URL: "${submittedUrl}"` : ""}
Evaluate whether this submission correctly verifies the task. Consider: accuracy of answer, completeness, and whether it matches the expected answer if provided.
Respond ONLY with valid JSON (no markdown):
{ "text_score": <0-100>, "text_reasoning": "<1-2 sentences>", "text_passed": <true if text_score >= 60> }`;
}

function buildVisionPrompt({
  task,
  taskData,
  hasExpected,
}: {
  task: Task;
  taskData: VerificationTaskData;
  hasExpected: boolean;
}) {
  return `You are verifying a screenshot submitted as proof for this task on Pesatrix:
Task: ${task.title ?? "Untitled task"}
Instructions: ${task.instructions ?? ""}
Grading rubric: ${task.ai_rubric || "Evaluate based on the task instructions and common sense. Score conservatively."}
${hasExpected ? `The user was supposed to find/confirm: "${taskData.expected_answer}"` : ""}
Analyze the screenshot carefully. Check:

Does the screenshot show the expected platform, website, or app?
Is the required action or information visible?
Does the screenshot appear genuine and unedited?
If an expected answer is set, is it visibly confirmed in the screenshot?

Respond ONLY with valid JSON (no markdown):
{ "score": <0-100>, "reasoning": "<1-2 sentences>", "passed": <true if score >= 60> }`;
}

async function getActiveProviderConfig(
  supabaseAdmin: ReturnType<typeof createAdminSupabaseClient>
) {
  const { data: providerConfig, error } = await supabaseAdmin
    .from("ai_provider_configs")
    .select("*")
    .eq("is_active", true)
    .single();

  if (providerConfig) {
    return providerConfig as ProviderConfig;
  }

  if (error) {
    console.warn("[Verification Grading] Active AI provider lookup failed:", error);
  }

  return null;
}

async function getProviderApiKey(
  supabaseAdmin: ReturnType<typeof createAdminSupabaseClient>,
  providerConfig: ProviderConfig
) {
  if (providerConfig.api_key_secret_name) {
    const { data: secret, error } = await getVaultSecret(
      supabaseAdmin,
      providerConfig.api_key_secret_name
    );

    if (error || !secret) {
      console.warn("[Verification Grading] Vault secret fetch failed:", providerConfig.api_key_secret_name, error);
      return null;
    }

    return secret;
  }

  const envName = `${providerConfig.provider.toUpperCase()}_API_KEY`;
  return process.env[envName] ?? null;
}

function parseTextGrade(content: string): TextGrade {
  const parsed = parseJsonObject(content);
  const score = Number(parsed.text_score);
  const reasoning = parsed.text_reasoning;

  if (!Number.isFinite(score) || typeof reasoning !== "string") {
    throw new Error("AI text response missing required fields.");
  }

  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
  return {
    text_score: normalizedScore,
    text_reasoning: reasoning.trim(),
    text_passed: parsed.text_passed === true || normalizedScore >= 60,
  };
}

function parseVisionGrade(content: string): VisionGrade {
  const parsed = parseJsonObject(content);
  const score = Number(parsed.score);
  const reasoning = parsed.reasoning;

  if (!Number.isFinite(score) || typeof reasoning !== "string") {
    throw new Error("AI vision response missing required fields.");
  }

  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score: normalizedScore,
    reasoning: reasoning.trim(),
    passed: parsed.passed === true || normalizedScore >= 60,
  };
}

function parseJsonObject(content: string) {
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned) as unknown;

  if (!isRecord(parsed)) {
    throw new Error("AI response was not a JSON object.");
  }

  return parsed;
}

function normalizeVerificationTaskData(value: unknown): VerificationTaskData {
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
    text_answer_label: typeof data.text_answer_label === "string" ? data.text_answer_label : "Your Answer",
    expected_answer: typeof data.expected_answer === "string" ? data.expected_answer : null,
    expected_answer_strict: data.expected_answer_strict === true,
    answer_hint: typeof data.answer_hint === "string" ? data.answer_hint : null,
    verification_url: typeof data.verification_url === "string" ? data.verification_url : null,
  };
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

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
