import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getVaultSecret } from "@/lib/ai/provider-secrets";
import { getWithdrawalHoldDays } from "@/lib/platform-settings";

const SYSTEM_PROMPT = `You are a strict but fair task submission reviewer for Pesatrix, a Kenyan online earning platform. Your job is to evaluate user task submissions and decide if they meet the required quality standard.

You will be given:
- The task title and category
- The task instructions (what the user was asked to do)
- The grading rubric (specific criteria to evaluate against)
- The user's submitted answers

Your evaluation must be objective, consistent, and fair. You are protecting both the platform (from low-quality work) and the user (from unfair rejection).

SCORING:
- Score from 0 to 100
- 80 and above = APPROVED (user gets paid)
- 50 to 79 = FLAGGED (needs human admin review)
- Below 50 = DECLINED (does not meet quality bar)

OUTPUT FORMAT:
You must respond with ONLY a valid JSON object. No markdown. No explanation outside the JSON. No code blocks. Exactly this structure:
{
  "score": <number 0-100>,
  "decision": "<approved|flagged|declined>",
  "reasoning": "<2-3 sentences explaining your decision in plain English that the user can understand>",
  "criteria_scores": {
    "<criterion name>": <score 0-100>
  }
}

RULES:
- Never approve a submission that is clearly copy-pasted, nonsensical, or does not follow the instructions
- Never decline a submission that genuinely attempts to follow the instructions even if imperfect
- If the submission is too short (below min_word_count), always decline with reasoning
- If screenshot was required but not provided, always decline
- If the rubric is empty or missing, use the task instructions as your evaluation criteria
- Be consistent: similar quality submissions should get similar scores`;

type ProviderConfig = {
  id?: string;
  provider: "nvidia" | "openrouter" | "groq" | "ollama";
  model_id: string;
  display_name?: string | null;
  api_key_secret_name?: string | null;
  base_url: string;
  max_tokens?: number | null;
  temperature?: number | null;
};

type GradingResult = {
  score: number;
  decision: "approved" | "flagged" | "declined";
  reasoning: string;
  criteria_scores: Record<string, number>;
};

const FALLBACK_NVIDIA_MODEL = "minimaxai/minimax-m2.7";
const FALLBACK_NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

export async function gradeSubmission(submissionId: string): Promise<void> {
  const supabaseAdmin = createAdminSupabaseClient();

  const { data: submission, error: submissionError } = await supabaseAdmin
    .from("task_submissions")
    .select(`
      id, user_id, answers, screenshot_url, submitted_url, status, ai_reviewed_at, payout_credited,
      tasks (
        id, title, category, instructions, ai_rubric,
        payout_ksh, requires_screenshot, requires_url, min_word_count, ai_grading_enabled
      )
    `)
    .eq("id", submissionId)
    .single();

  if (submissionError || !submission) {
    console.error("[Grading] Submission not found:", submissionId, submissionError);
    return;
  }

  if (submission.ai_reviewed_at) {
    return;
  }

  const task = Array.isArray(submission.tasks)
    ? submission.tasks[0]
    : submission.tasks;

  if (!task?.ai_grading_enabled) {
    return;
  }

  const provider = await getActiveProviderConfig(supabaseAdmin);
  if (!provider) {
    await flagForManualReview(
      supabaseAdmin,
      submissionId,
      "No active AI provider configured. Manual review required."
    );
    return;
  }

  const apiKey = await getProviderApiKey(supabaseAdmin, provider);
  if (!apiKey) {
    console.warn("[Grading] Missing API key for provider:", provider.provider, provider.id);
    await flagForManualReview(
      supabaseAdmin,
      submissionId,
      "AI provider secret could not be loaded. Manual review required."
    );
    return;
  }

  const userMessage = `TASK TITLE: ${task.title}
CATEGORY: ${task.category}
INSTRUCTIONS: ${task.instructions}
GRADING RUBRIC: ${task.ai_rubric || "Evaluate based on instructions above"}
MINIMUM WORD COUNT REQUIRED: ${task.min_word_count || 0}
SCREENSHOT REQUIRED: ${task.requires_screenshot}
URL REQUIRED: ${task.requires_url}

USER SUBMISSION:
${JSON.stringify(submission.answers, null, 2)}
SUBMITTED URL: ${submission.submitted_url || "None"}
SCREENSHOT PROVIDED: ${submission.screenshot_url ? "Yes" : "No"}`;

  let result: GradingResult;

  try {
    const response = await fetch(`${trimTrailingSlash(provider.base_url)}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model_id,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: Number(provider.temperature ?? 0.3),
        max_tokens: Number(provider.max_tokens ?? 8192),
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[Grading] AI API error:", response.status, errorText);
      await flagForManualReview(
        supabaseAdmin,
        submissionId,
        "AI provider returned an error. Manual review required."
      );
      return;
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    try {
      result = parseAiResult(typeof content === "string" ? content : "");
    } catch (parseError) {
      console.error("[Grading] AI response parse failed:", submissionId, parseError);
      await flagForManualReview(
        supabaseAdmin,
        submissionId,
        "AI response could not be parsed. Manual review required."
      );
      return;
    }
  } catch (error) {
    console.error("[Grading] AI request failed:", submissionId, error);
    await flagForManualReview(
      supabaseAdmin,
      submissionId,
      "AI grading failed. Manual review required."
    );
    return;
  }

  const mappedStatus = result.decision;
  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("task_submissions")
    .update({
      ai_score: result.score,
      ai_reasoning: result.reasoning,
      ai_reviewed_at: now,
      status: mappedStatus,
    })
    .eq("id", submissionId)
    .is("ai_reviewed_at", null)
    .select("id, payout_credited")
    .maybeSingle();

  if (updateError || !updated) {
    if (updateError) {
      console.error("[Grading] Failed to write grading result:", submissionId, updateError);
    }
    return;
  }

  if (mappedStatus !== "approved" || updated.payout_credited === true) {
    return;
  }

  const holdDays = await getWithdrawalHoldDays();
  const availableAt = new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000).toISOString();
  const walletState = holdDays === 0 ? "available" : "pending";

  const { error: walletError } = await supabaseAdmin
    .from("wallet_transactions")
    .insert({
      user_id: submission.user_id,
      type: "task_earning",
      direction: "credit",
      amount: Math.round(Number(task.payout_ksh ?? 0)),
      status: walletState,
      bucket: walletState,
      description: `Task approved: ${task.title}`,
      reference_table: "task_submissions",
      reference_id: submission.id,
      available_at: availableAt,
    });

  if (walletError) {
    console.error("[Grading] Wallet credit failed:", submissionId, walletError);
    return;
  }

  const creditedAt = new Date().toISOString();
  const { error: creditUpdateError } = await supabaseAdmin
    .from("task_submissions")
    .update({
      payout_credited: true,
      payout_credited_at: creditedAt,
    })
    .eq("id", submissionId);

  if (creditUpdateError) {
    console.error("[Grading] Failed to mark payout credited:", submissionId, creditUpdateError);
  }
}

async function getActiveProviderConfig(supabaseAdmin: ReturnType<typeof createAdminSupabaseClient>) {
  const { data: providerConfig, error } = await supabaseAdmin
    .from("ai_provider_configs")
    .select("*")
    .eq("is_active", true)
    .single();

  if (providerConfig) {
    return providerConfig as ProviderConfig;
  }

  if (error) {
    console.warn("[Grading] Active AI provider lookup failed:", error);
  }

  if (process.env.NVIDIA_API_KEY) {
    return {
      provider: "nvidia",
      model_id: FALLBACK_NVIDIA_MODEL,
      display_name: "NVIDIA fallback",
      base_url: FALLBACK_NVIDIA_BASE_URL,
      max_tokens: 8192,
      temperature: 0.3,
    } satisfies ProviderConfig;
  }

  return null;
}

async function getProviderApiKey(
  supabaseAdmin: ReturnType<typeof createAdminSupabaseClient>,
  providerConfig: ProviderConfig
) {
  if (!providerConfig.api_key_secret_name) {
    return process.env.NVIDIA_API_KEY ?? null;
  }

  const { data: secret, error } = await getVaultSecret(
    supabaseAdmin,
    providerConfig.api_key_secret_name
  );

  if (error || !secret) {
    console.warn("[Grading] Vault secret fetch failed:", providerConfig.api_key_secret_name, error);
    return null;
  }

  return secret;
}

async function flagForManualReview(
  supabaseAdmin: ReturnType<typeof createAdminSupabaseClient>,
  submissionId: string,
  reasoning: string
) {
  const { error } = await supabaseAdmin
    .from("task_submissions")
    .update({
      status: "flagged",
      ai_reasoning: reasoning,
      ai_reviewed_at: new Date().toISOString(),
    })
    .eq("id", submissionId)
    .is("ai_reviewed_at", null);

  if (error) {
    console.error("[Grading] Failed to flag submission:", submissionId, error);
  }
}

function parseAiResult(content: string): GradingResult {
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("AI response could not be parsed. Manual review required.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("AI response could not be parsed. Manual review required.");
  }

  const candidate = parsed as Record<string, unknown>;
  const score = Number(candidate.score);
  const decision = candidate.decision;
  const reasoning = candidate.reasoning;

  if (
    !Number.isFinite(score) ||
    !["approved", "flagged", "declined"].includes(String(decision)) ||
    typeof reasoning !== "string" ||
    reasoning.trim().length === 0
  ) {
    throw new Error("AI response missing required fields. Manual review required.");
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    decision: decision as GradingResult["decision"],
    reasoning: reasoning.trim(),
    criteria_scores: normalizeCriteriaScores(candidate.criteria_scores),
  };
}

function normalizeCriteriaScores(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, score]) => [key, Math.max(0, Math.min(100, Number(score)))])
      .filter(([, score]) => Number.isFinite(score))
  );
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}
