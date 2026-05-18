import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getVaultSecret } from "@/lib/ai/provider-secrets";
import { getWithdrawalHoldDays } from "@/lib/platform-settings";
import { isDataLabelingTaskData, isSocialEngagementTaskData } from "@/lib/task-data";
import { normalizeSocialTaskData } from "@/lib/social-engagement";

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
  grading_detail?: Record<string, unknown>;
};

const FALLBACK_NVIDIA_MODEL = "minimaxai/minimax-m2.7";
const FALLBACK_NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const ANTHROPIC_VISION_MODEL = "claude-sonnet-4-20250514";
const TASK_SCREENSHOT_BUCKET = "task-screenshots";

export async function gradeSubmission(submissionId: string): Promise<void> {
  const supabaseAdmin = createAdminSupabaseClient();

  const { data: submission, error: submissionError } = await supabaseAdmin
    .from("task_submissions")
    .select(`
      id, user_id, answers, screenshot_url, submitted_url, status, ai_reviewed_at, payout_credited, grading_detail,
      tasks (
        id, title, category, instructions, ai_rubric,
        payout_ksh, requires_screenshot, requires_url, min_word_count, ai_grading_enabled, task_data
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

  if (isDataLabelingTaskData(task.task_data)) {
    const result = gradeDataLabelingSubmission(task.task_data, submission.answers as Record<string, unknown>);
    await writeGradingResultAndCredit(supabaseAdmin, submission, task, result);
    return;
  }

  if (isSocialEngagementTaskData(task.task_data)) {
    const result = await gradeSocialEngagementSubmission(supabaseAdmin, submission, task);
    await writeGradingResultAndCredit(supabaseAdmin, submission, task, result);
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

  await writeGradingResultAndCredit(supabaseAdmin, submission, task, result);
}

async function writeGradingResultAndCredit(
  supabaseAdmin: ReturnType<typeof createAdminSupabaseClient>,
  submission: {
    id: string;
    user_id: string;
    payout_credited: boolean | null;
  },
  task: {
    title?: string | null;
    payout_ksh?: number | string | null;
    task_data?: unknown;
  },
  result: GradingResult
) {
  const mappedStatus = result.decision;
  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("task_submissions")
    .update({
      ai_score: result.score,
      ai_reasoning: result.reasoning,
      ai_reviewed_at: now,
      status: mappedStatus,
      ...(result.grading_detail ? { grading_detail: result.grading_detail } : {}),
    })
    .eq("id", submission.id)
    .is("ai_reviewed_at", null)
    .select("id, payout_credited")
    .maybeSingle();

  if (updateError || !updated) {
    if (updateError) {
      console.error("[Grading] Failed to write grading result:", submission.id, updateError);
    }
    return;
  }

  if (mappedStatus !== "approved" || updated.payout_credited === true) {
    if (mappedStatus === "declined") {
      await adjustRiskScore(supabaseAdmin, submission.user_id, getRiskDelta(task.task_data, "ai_declined"));
      await queueTaskNotification(supabaseAdmin, {
        userId: submission.user_id,
        eventType: "task_proof_declined",
        payload: {
          submission_id: submission.id,
          task_title: task.title,
          reasoning: result.reasoning,
        },
      });
    } else if (mappedStatus === "flagged") {
      await queueTaskNotification(supabaseAdmin, {
        userId: submission.user_id,
        eventType: "task_proof_flagged",
        payload: {
          submission_id: submission.id,
          task_title: task.title,
          reasoning: result.reasoning,
        },
      });
    }
    return;
  }

  const socialTaskData = normalizeSocialTaskData(task.task_data);
  const holdDays = socialTaskData?.hold_days ?? await getWithdrawalHoldDays();
  const availableAt = new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000).toISOString();
  const walletState = holdDays === 0 && !socialTaskData ? "available" : "pending";

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
    console.error("[Grading] Wallet credit failed:", submission.id, walletError);
    return;
  }

  const creditedAt = new Date().toISOString();
  const { error: creditUpdateError } = await supabaseAdmin
    .from("task_submissions")
    .update({
      payout_credited: true,
      payout_credited_at: creditedAt,
    })
    .eq("id", submission.id);

  if (creditUpdateError) {
    console.error("[Grading] Failed to mark payout credited:", submission.id, creditUpdateError);
  }

  await adjustRiskScore(supabaseAdmin, submission.user_id, getRiskDelta(task.task_data, "ai_approved"));
  await queueTaskNotification(supabaseAdmin, {
    userId: submission.user_id,
    eventType: "task_proof_approved",
    payload: {
      submission_id: submission.id,
      task_title: task.title,
      amount: Math.round(Number(task.payout_ksh ?? 0)),
      hold_days: holdDays,
    },
  });
}

async function gradeSocialEngagementSubmission(
  supabaseAdmin: ReturnType<typeof createAdminSupabaseClient>,
  submission: {
    id: string;
    answers: unknown;
    screenshot_url: string | null;
    grading_detail?: Record<string, unknown> | null;
  },
  task: {
    title?: string | null;
    task_data?: unknown;
  }
): Promise<GradingResult> {
  const taskData = normalizeSocialTaskData(task.task_data);
  if (!taskData) {
    return {
      score: 0,
      decision: "flagged",
      reasoning: "Social engagement task data could not be read. Manual review required.",
      criteria_scores: {},
    };
  }

  const answers = isRecord(submission.answers) ? submission.answers : {};
  const screenshotUrl =
    typeof answers.screenshot_url === "string"
      ? answers.screenshot_url
      : submission.screenshot_url;

  if (!screenshotUrl) {
    return {
      score: 0,
      decision: "declined",
      reasoning: "No screenshot was provided for a task that requires screenshot proof.",
      criteria_scores: {},
    };
  }

  const image = await fetchImageAsBase64(supabaseAdmin, screenshotUrl);
  if (!image) {
    return {
      score: 50,
      decision: "flagged",
      reasoning: "AI vision unavailable - manual review required.",
      criteria_scores: {},
      grading_detail: { social_ai_error: "screenshot_fetch_failed" },
    };
  }

  const prompt = buildSocialVisionPrompt({
    platform: taskData.platform,
    action: taskData.action,
    targetName: taskData.target_name,
    targetIdentifier: taskData.target_identifier,
    username: typeof answers.username === "string" ? answers.username : null,
    textInput: typeof answers.text_input === "string" ? answers.text_input : null,
    aiCriteria: taskData.ai_check_criteria,
  });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      score: 50,
      decision: "flagged",
      reasoning: "AI vision unavailable - manual review required.",
      criteria_scores: {},
      grading_detail: { social_ai_error: "missing_anthropic_api_key" },
    };
  }

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_VISION_MODEL,
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: image.mediaType,
                  data: image.base64,
                },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[Social Grading] Anthropic API error:", response.status, errorText);
      return {
        score: 50,
        decision: "flagged",
        reasoning: "AI vision unavailable - manual review required.",
        criteria_scores: {},
        grading_detail: { social_ai_error: "anthropic_api_error", status: response.status },
      };
    }

    const payload = await response.json();
    const content = payload?.content?.[0]?.text;
    let parsed: ReturnType<typeof parseSocialVisionResult>;
    try {
      parsed = parseSocialVisionResult(typeof content === "string" ? content : "");
    } catch (parseError) {
      console.error("[Social Grading] Malformed AI JSON:", {
        submissionId: submission.id,
        rawResponse: typeof content === "string" ? content.slice(0, 2000) : content,
        error: parseError,
      });
      return {
        score: 50,
        decision: "flagged",
        reasoning: "AI response could not be parsed. Manual review required.",
        criteria_scores: {},
        grading_detail: {
          social_ai_error: "malformed_json",
          raw_response: typeof content === "string" ? content.slice(0, 2000) : null,
        },
      };
    }
    const checks = parsed.checks;
    const autoFlag = submission.grading_detail?.social_auto_flag_reason === "risk_score_above_50";
    const decision = autoFlag ? "flagged" : parsed.decision;
    const reasoning = autoFlag
      ? `${parsed.reasoning} Account risk score requires manual review.`
      : parsed.reasoning;

    return {
      score: parsed.score,
      decision,
      reasoning,
      criteria_scores: {
        correct_platform: checks.correct_platform ? 100 : 0,
        target_visible: checks.target_visible ? 100 : 0,
        action_completed: checks.action_completed ? 100 : 0,
        looks_authentic: checks.looks_authentic ? 100 : 0,
      },
      grading_detail: {
        type: "social_engagement",
        checks,
        issues: parsed.issues,
        raw_decision: parsed.decision,
        auto_flag_reason: autoFlag ? "risk_score_above_50" : null,
      },
    };
  } catch (error) {
    console.error("[Social Grading] AI request or parse failed:", submission.id, error);
    return {
      score: 50,
      decision: "flagged",
      reasoning: "AI vision unavailable - manual review required.",
      criteria_scores: {},
      grading_detail: {
        social_ai_error: error instanceof Error ? error.message : "unknown_error",
      },
    };
  }
}

function gradeDataLabelingSubmission(
  taskData: unknown,
  answers: Record<string, unknown>
): GradingResult {
  if (!isDataLabelingTaskData(taskData)) {
    return {
      score: 0,
      decision: "flagged",
      reasoning: "Task data could not be read. Manual review required.",
      criteria_scores: {},
    };
  }

  const items = taskData.items ?? [];
  let correct = 0;
  const itemResults = items.map((item) => {
    const userAnswer = typeof answers[item.id] === "string" ? answers[item.id] : null;
    const isCorrect = userAnswer === item.correct_label;
    if (isCorrect) correct++;
    return {
      id: item.id,
      user_answer: userAnswer,
      correct_label: item.correct_label,
      correct: isCorrect,
    };
  });

  const total = items.length;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;
  let decision: GradingResult["decision"];
  if (score >= 70) decision = "approved";
  else if (score >= 50) decision = "flagged";
  else decision = "declined";

  return {
    decision,
    score,
    reasoning: `User got ${correct}/${total} labels correct (${score}%). Threshold: 70% to approve.`,
    criteria_scores: { accuracy: score },
    grading_detail: {
      type: "data_labeling",
      correct,
      total,
      score,
      itemResults,
    },
  };
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

function parseSocialVisionResult(content: string) {
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;
  const decision = parsed.decision;
  const score = Number(parsed.score);
  const reasoning = parsed.reasoning;
  const checks = parsed.checks;

  if (
    !["approved", "flagged", "declined"].includes(String(decision)) ||
    !Number.isFinite(score) ||
    typeof reasoning !== "string" ||
    !isRecord(checks)
  ) {
    throw new Error("AI response could not be parsed. Manual review required.");
  }

  return {
    decision: decision as GradingResult["decision"],
    score: Math.max(0, Math.min(100, Math.round(score))),
    reasoning: reasoning.trim(),
    checks: {
      correct_platform: checks.correct_platform === true,
      target_visible: checks.target_visible === true,
      action_completed: checks.action_completed === true,
      looks_authentic: checks.looks_authentic === true,
    },
    issues: Array.isArray(parsed.issues) ? parsed.issues.map(String) : [],
  };
}

async function fetchImageAsBase64(
  supabaseAdmin: ReturnType<typeof createAdminSupabaseClient>,
  screenshotUrl: string
) {
  const parsed = parseTaskScreenshotUrl(screenshotUrl);
  if (!parsed) return null;

  const { data, error } = await supabaseAdmin.storage
    .from(TASK_SCREENSHOT_BUCKET)
    .download(parsed.path);

  if (error || !data) {
    console.error("[Social Grading] Screenshot download failed:", error);
    return null;
  }

  const bytes = Buffer.from(await data.arrayBuffer());
  return {
    base64: bytes.toString("base64"),
    mediaType: parsed.mediaType,
  };
}

function parseTaskScreenshotUrl(value: string) {
  try {
    const url = new URL(value);
    const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    if (url.origin !== supabaseUrl.origin) return null;

    const prefix = `/storage/v1/object/${TASK_SCREENSHOT_BUCKET}/`;
    if (!url.pathname.startsWith(prefix)) return null;

    const path = decodeURIComponent(url.pathname.slice(prefix.length));
    if (!path || path.includes("..")) return null;
    const ext = path.split(".").pop()?.toLowerCase();
    const mediaType =
      ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : "image/jpeg";
    return { path, mediaType };
  } catch {
    return null;
  }
}

function buildSocialVisionPrompt(args: {
  platform: string;
  action: string;
  targetName: string;
  targetIdentifier: string;
  username: string | null;
  textInput: string | null;
  aiCriteria: string;
}) {
  return `
You are a strict screenshot verification agent for Pesatrix, a Kenyan earning platform.

A user claims to have completed this social media task:
- Platform: ${args.platform}
- Action: ${args.action}
- Target page/channel/account: ${args.targetName} (${args.targetIdentifier})
- User's stated username: ${args.username || "not provided"}
- User's stated comment/text: ${args.textInput || "not provided"}

ADMIN VERIFICATION CRITERIA:
${args.aiCriteria}

Examine the screenshot carefully and answer:
1. Does the screenshot show the correct platform (${args.platform})?
2. Is the target page/channel/account (${args.targetName}) visible?
3. Does the screenshot show evidence that the action (${args.action}) was completed?
   - For follow/subscribe: is the button showing "Following", "Subscribed", or equivalent?
   - For like: is the like button in active/filled state?
   - For comment: is the user's comment visible in the comments section?
   - For share: is there evidence of sharing (share confirmation, shared post)?
   - For review/rate: is the review or star rating visible and submitted?
   - For download: is the app shown as installed or downloading?
4. Is the screenshot recent (not obviously old or from a different date context)?
5. Does anything look edited, fake, or suspicious?

Respond ONLY in this JSON format:
{
  "decision": "approved" | "declined" | "flagged",
  "score": 0-100,
  "checks": {
    "correct_platform": true | false,
    "target_visible": true | false,
    "action_completed": true | false,
    "looks_authentic": true | false
  },
  "reasoning": "2-3 sentence explanation of your decision",
  "issues": ["list any specific problems found"]
}

Rules:
- "approved": all 4 checks pass and screenshot is convincing
- "declined": action clearly not completed, wrong page, or obvious fake
- "flagged": uncertain, partially completed, or needs human eyes
- When in doubt: flag, do not approve
`;
}

async function adjustRiskScore(
  supabaseAdmin: ReturnType<typeof createAdminSupabaseClient>,
  userId: string,
  delta: number
) {
  if (delta === 0) return;

  const { data } = await supabaseAdmin
    .from("user_verification")
    .select("risk_score")
    .eq("user_id", userId)
    .maybeSingle();

  const nextRiskScore = Math.max(0, Number(data?.risk_score ?? 0) + delta);
  await supabaseAdmin
    .from("user_verification")
    .upsert({
      user_id: userId,
      risk_score: nextRiskScore,
      updated_at: new Date().toISOString(),
    });
}

function getRiskDelta(taskData: unknown, event: "ai_approved" | "ai_declined") {
  if (!isSocialEngagementTaskData(taskData)) return 0;
  return event === "ai_approved" ? 2 : 5;
}

async function queueTaskNotification(
  supabaseAdmin: ReturnType<typeof createAdminSupabaseClient>,
  args: {
    userId: string;
    eventType: string;
    payload: Record<string, unknown>;
  }
) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("email")
    .eq("id", args.userId)
    .maybeSingle();

  await supabaseAdmin
    .from("notification_outbox")
    .insert({
      channel: "email",
      event_type: args.eventType,
      recipient_user_id: args.userId,
      recipient_email: profile?.email ?? null,
      payload: args.payload,
      status: "pending",
      provider: null,
      external_id: null,
      error_message: null,
      sent_at: null,
    });
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
