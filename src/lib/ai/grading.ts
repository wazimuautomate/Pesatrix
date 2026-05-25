import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getVaultSecret } from "@/lib/ai/provider-secrets";
import { callTextModelWithFallback } from "@/lib/ai/modelRouter";
import { getWithdrawalHoldDays } from "@/lib/platform-settings";
import { isDataLabelingTaskData, isSocialEngagementTaskData, isVerificationTaskData } from "@/lib/task-data";
import { normalizeSocialTaskData } from "@/lib/social-engagement";
import { gradeVerificationSubmission } from "@/lib/ai/gradeVerificationTask";
import { TASK_SCREENSHOT_BUCKET, parseTaskScreenshotUrl } from "@/lib/task-screenshots";

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
  provider: "nvidia" | "openrouter" | "groq" | "gemini" | "ollama";
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
  admin_note?: string | null;
};

const FALLBACK_NVIDIA_MODEL = "minimaxai/minimax-m2.7";
const FALLBACK_NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
type VisionModelConfig = {
  modelId: string;
  provider: "nvidia" | "openrouter";
  supportsVision: boolean;
  baseUrl: string;
  apiKeyName: "NVIDIA_API_KEY" | "OPENROUTER_API_KEY";
};

const NVIDIA_VISION_MODELS: VisionModelConfig[] = [
  { modelId: "mistralai/mistral-large-3-675b-instruct-2512", provider: "nvidia", supportsVision: true, baseUrl: FALLBACK_NVIDIA_BASE_URL, apiKeyName: "NVIDIA_API_KEY" },
  { modelId: "google/paligemma-3b-pt-224", provider: "nvidia", supportsVision: true, baseUrl: FALLBACK_NVIDIA_BASE_URL, apiKeyName: "NVIDIA_API_KEY" },
];

const OPENROUTER_VISION_MODELS: VisionModelConfig[] = [
  { modelId: "google/gemma-3-27b-it:free", provider: "openrouter", supportsVision: true, baseUrl: OPENROUTER_BASE_URL, apiKeyName: "OPENROUTER_API_KEY" },
];

const VISION_MODELS = [...NVIDIA_VISION_MODELS, ...OPENROUTER_VISION_MODELS];

const AI_REQUEST_TIMEOUT_MS = 25000;
const VISION_MODEL_TIMEOUT_MS = 25000;
const VISION_MODEL_MAX_TOKENS = 1024;

export async function gradeSubmission(submissionId: string): Promise<void> {
  const start = Date.now();
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

  if (isVerificationTaskData(task.task_data)) {
    const verificationResult = await gradeVerificationSubmission(task, submission);
    const decision: GradingResult["decision"] = verificationResult.manualReview
      ? "flagged"
      : verificationResult.score >= 70
        ? "approved"
        : verificationResult.score >= 50
          ? "flagged"
          : "declined";

    await writeGradingResultAndCredit(supabaseAdmin, submission, task, {
      score: verificationResult.score,
      decision,
      reasoning: verificationResult.reasoning,
      criteria_scores: {
        verification: verificationResult.score,
      },
      grading_detail: verificationResult.gradingDetail,
    });
    return;
  }

  if (task.category === "content_creation") {
    const result = await gradeContentCreationSubmission(supabaseAdmin, submission, task);
    await writeGradingResultAndCredit(supabaseAdmin, submission, task, result);
    return;
  }

  if (task.category === "watch_respond") {
    const result = await gradeWatchRespondSubmission(supabaseAdmin, submission, task);
    await writeGradingResultAndCredit(supabaseAdmin, submission, task, result);
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
    const ai = await callTextModelWithFallback({
      admin: supabaseAdmin,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      maxTokens: 1600,
      temperature: 0.3,
    });

    if (!ai.ok) {
      console.error("[Grading] All AI providers failed:", submissionId, ai.errors);
      await flagForManualReview(
        supabaseAdmin,
        submissionId,
        "AI grading unavailable - flagged for manual review"
      );
      return;
    }

    try {
      result = parseAiResult(ai.content);
    } catch (parseError) {
      console.error("[Grading] AI response parse failed:", submissionId, parseError);
      await flagForManualReview(
        supabaseAdmin,
        submissionId,
        "AI response could not be parsed. Manual review required."
      );
      return;
    }

    const review = await callTextModelWithFallback({
      admin: supabaseAdmin,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `You are the second-pass quality controller for this Pesatrix grading result.

Original grading input:
${userMessage}

First model grading JSON:
${ai.content}

Check whether the first model was fair and consistent with the task, rubric, and user submission. Return ONLY the same JSON shape, correcting the score, decision, reasoning, and criteria_scores only if needed.`,
        },
      ],
      maxTokens: 1600,
      temperature: 0.2,
    });

    if (review.ok) {
      try {
        result = parseAiResult(review.content);
      } catch (reviewParseError) {
        console.error("[Grading] Second-pass AI response parse failed:", submissionId, reviewParseError);
      }
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
  console.log(`[AI Grade] submission=${submissionId} elapsed=${Date.now() - start}ms`);
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
      ...(result.admin_note ? { admin_note: result.admin_note } : {}),
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

  const hasAnyApiKey = process.env.NVIDIA_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!hasAnyApiKey) {
    return {
      score: 50,
      decision: "flagged",
      reasoning: "AI vision unavailable - manual review required.",
      criteria_scores: {},
      grading_detail: { social_ai_error: "missing_api_keys" },
    };
  }

  const visionResult = await callVisionModelWithFallback(image, prompt, submission.id);

  if (!visionResult.success) {
    console.error("[Social Grading] All vision models failed:", {
      submissionId: submission.id,
      errors: visionResult.errors,
    });
    return {
      score: 50,
      decision: "flagged",
      reasoning: "AI vision unavailable - manual review required.",
      criteria_scores: {},
      grading_detail: {
        social_ai_error: "all_vision_models_failed",
        errors: visionResult.errors,
      },
    };
  }

  const content = visionResult.response;
  if (!content) {
    return {
      score: 50,
      decision: "flagged",
      reasoning: "AI vision returned empty response - manual review required.",
      criteria_scores: {},
      grading_detail: {
        social_ai_error: "empty_response",
        model_used: visionResult.modelUsed,
      },
    };
  }

  let parsed: ReturnType<typeof parseSocialVisionResult>;
  try {
    parsed = parseSocialVisionResult(content);
  } catch (parseError) {
    console.error("[Social Grading] Malformed AI JSON:", {
      submissionId: submission.id,
      rawResponse: content.slice(0, 2000),
      error: parseError,
    });
    return {
      score: 50,
      decision: "flagged",
      reasoning: "AI response could not be parsed. Manual review required.",
      criteria_scores: {},
      grading_detail: {
        social_ai_error: "malformed_json",
        raw_response: content.slice(0, 2000),
        model_used: visionResult.modelUsed,
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
      vision_model_used: visionResult.modelUsed,
    },
  };
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

async function gradeContentCreationSubmission(
  supabaseAdmin: ReturnType<typeof createAdminSupabaseClient>,
  submission: {
    id: string;
    answers: unknown;
  },
  task: {
    id?: string | null;
    category?: string | null;
    task_data?: unknown;
    ai_rubric?: string | null;
    min_word_count?: number | string | null;
  }
): Promise<GradingResult> {
  const taskData = isRecord(task.task_data) ? task.task_data : {};
  const answers = isRecord(submission.answers) ? submission.answers : {};
  const content = typeof answers.content === "string" ? answers.content.trim() : "";
  const wordCount = countWords(content);

  const { data: existingSubmissions } = await supabaseAdmin
    .from("task_submissions")
    .select("answers")
    .eq("task_id", task.id)
    .neq("id", submission.id)
    .in("status", ["approved", "pending", "ai_reviewing"])
    .order("submitted_at", { ascending: false })
    .limit(10);

  const existingContent: string[] = (existingSubmissions ?? [])
    .map((row: { answers?: unknown }) => isRecord(row.answers) && typeof row.answers.content === "string" ? row.answers.content : null)
    .filter((value: string | null): value is string => Boolean(value));

  const prompt = `You are grading a content creation task submitted by a Kenyan user on Pesatrix.
Task type: ${String(taskData.content_type ?? taskData.subtype ?? "content_creation")}
Task prompt: ${String(taskData.prompt ?? "")}
Grading rubric: ${task.ai_rubric || "Evaluate based on the task prompt."}
Minimum word count required: ${Number(task.min_word_count ?? 0)} words
Language note: The user may write in English, Swahili, or Kenyan Sheng. Do NOT penalize correct Swahili or Sheng - grade for quality and relevance, not language choice.
User's submission:
"${content}"
Word count submitted: ${wordCount}
Prior submissions on this task (check for copy-paste plagiarism):
${existingContent.length > 0 ? existingContent.map((c: string, i: number) => `Submission ${i + 1}: "${c.substring(0, 200)}..."`).join("\n") : "None"}
Grade on these criteria:

Relevance to the task prompt (0-25 points)
Grammar and clarity - appropriate for the language used (0-25 points)
Creativity and originality (0-25 points)
Similarity to prior submissions - penalize heavily if near-identical (0-25 points, 25 = fully unique)

If word count is below ${Number(task.min_word_count ?? 0)}: cap total score at 40 regardless of quality.
If submission appears AI-generated (repetitive filler, generic phrasing, no personal voice): cap score at 50.
Respond ONLY with valid JSON (no markdown):
{
"score": <0-100>,
"reasoning": "<2-3 sentences covering each criterion briefly>",
"passed": <true if score >= 60>,
"similarity_flag": <true if content is suspiciously similar to a prior submission>,
"ai_generated_flag": <true if content appears AI-generated>
}`;

  const ai = await callFallbackTextJson(prompt);
  if (!ai.success) {
    return {
      score: 50,
      decision: "flagged",
      reasoning: "AI grading unavailable. Manual review required.",
      criteria_scores: {},
      grading_detail: { content_ai_error: ai.error },
    };
  }

  let parsed: ReturnType<typeof parseContentCreationResult>;
  try {
    parsed = parseContentCreationResult(ai.content);
  } catch (error) {
    console.error("[Content Grading] Malformed AI JSON:", submission.id, error);
    return {
      score: 50,
      decision: "flagged",
      reasoning: "AI response could not be parsed. Manual review required.",
      criteria_scores: {},
      grading_detail: { content_ai_error: "malformed_json", raw_response: ai.content.slice(0, 2000) },
    };
  }

  const review = await callFallbackTextJson(`You are the second-pass quality controller for a Pesatrix content creation grading result.
Original task prompt:
${String(taskData.prompt ?? "")}

User submission:
"${content}"

First model grading JSON:
${ai.content}

Check whether the first model was fair and consistent. Return ONLY the same JSON shape, correcting the score/reasoning/flags only if needed:
{
"score": <0-100>,
"reasoning": "<2-3 sentences>",
"passed": <true if score >= 60>,
"similarity_flag": <true if suspiciously similar to prior submissions>,
"ai_generated_flag": <true if likely AI-generated>
}`);

  if (review.success) {
    try {
      parsed = parseContentCreationResult(review.content);
      ai.modelUsed = `${ai.modelUsed ?? "unknown"} -> ${review.modelUsed ?? "review"}`;
    } catch (error) {
      console.error("[Content Grading] Second-pass AI JSON malformed:", submission.id, error);
    }
  }

  const notes: string[] = [];
  if (parsed.similarity_flag) notes.push("AI flagged: similar to prior submission");
  if (parsed.ai_generated_flag) notes.push("AI flagged: possible AI-generated content");

  const decision: GradingResult["decision"] =
    notes.length > 0
      ? "flagged"
      : parsed.passed
        ? "approved"
        : parsed.score >= 50
          ? "flagged"
          : "declined";

  return {
    score: parsed.score,
    decision,
    reasoning: parsed.reasoning,
    criteria_scores: { content_quality: parsed.score },
    // FIXED: Similarity/AI-generated flags are stored for admins only, not returned to the user UI.
    admin_note: notes.length ? notes.join("; ") : null,
    grading_detail: {
      type: "content_creation",
      similarity_flag: parsed.similarity_flag,
      ai_generated_flag: parsed.ai_generated_flag,
      model_used: ai.modelUsed,
      prior_submission_count: existingContent.length,
    },
  };
}

async function gradeWatchRespondSubmission(
  _supabaseAdmin: ReturnType<typeof createAdminSupabaseClient>,
  submission: {
    id: string;
    answers: unknown;
  },
  task: {
    task_data?: unknown;
    instructions?: string | null;
  }
): Promise<GradingResult> {
  const taskData = normalizeWatchTaskData(task.task_data);
  const submissionAnswers = isRecord(submission.answers) && Array.isArray(submission.answers.answers)
    ? submission.answers.answers
    : [];
  const byQuestion = new Map(
    submissionAnswers
      .filter(isRecord)
      .map((answer) => [String(answer.question_id ?? ""), String(answer.answer ?? "")])
  );

  if (Number(isRecord(submission.answers) ? submission.answers.cheat_strikes ?? 0 : 0) >= 3) {
    return {
      score: 0,
      decision: "declined",
      reasoning: "The watch session was forfeited due to repeated cheating strikes.",
      criteria_scores: { watch_integrity: 0 },
      grading_detail: { type: "watch_respond", forfeited: true },
    };
  }

  const scores: number[] = [];
  const details: Record<string, unknown>[] = [];

  for (const question of taskData.questions) {
    const answer = byQuestion.get(question.id) ?? "";
    if (question.type === "multiple_choice" && question.correct_option) {
      // VERIFIED: OK - exact multiple-choice answers with correct_option are graded in code without AI.
      const correct = answer.trim() === question.correct_option.trim();
      scores.push(correct ? 100 : 0);
      details.push({ question_id: question.id, score: correct ? 100 : 0, exact_match: correct });
      continue;
    }

    const prompt = `You are grading a Watch & Respond task answer for Pesatrix.
Task instructions: ${task.instructions || "Watch the content and answer the questions."}
Content type: ${taskData.content_type}
Content URL/context: ${taskData.content_url}
Question: ${question.question}
User answer: "${answer}"

Grade answer relevance and quality from 0-100. For multiple choice without a correct option, grade whether the answer is plausible for the question. For open-ended answers, grade relevance, specificity, and comprehension. Respond ONLY with valid JSON:
{"score": <0-100>, "reasoning": "<one sentence>"}`;

    const ai = await callFallbackTextJson(prompt);
    if (!ai.success) {
      scores.push(50);
      details.push({ question_id: question.id, score: 50, error: ai.error });
      continue;
    }

    try {
      const parsed = parseWatchAnswerResult(ai.content);
      scores.push(parsed.score);
      details.push({ question_id: question.id, score: parsed.score, reasoning: parsed.reasoning, model_used: ai.modelUsed });
    } catch (error) {
      scores.push(50);
      details.push({ question_id: question.id, score: 50, error: "malformed_json" });
    }
  }

  const score = scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0;
  const decision: GradingResult["decision"] = score >= 70 ? "approved" : score >= 50 ? "flagged" : "declined";

  return {
    score,
    decision,
    reasoning: `Watch & Respond answers scored ${score}%. ${decision === "approved" ? "Answers met the comprehension threshold." : "Manual review or decline is needed based on answer quality."}`,
    criteria_scores: { comprehension: score },
    // FIXED: Watch & Respond uses the configured fallback chain for open-ended grading and exact code checks for known MC answers.
    grading_detail: {
      type: "watch_respond",
      question_results: details,
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

async function callFallbackTextJson(prompt: string): Promise<{
  success: boolean;
  content: string;
  modelUsed?: string;
  error?: string;
}> {
  const admin = createAdminSupabaseClient();
  const result = await callTextModelWithFallback({
    admin,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 1200,
    temperature: 0.2,
  });

  return {
    success: result.ok,
    content: result.content,
    modelUsed: result.model,
    error: result.ok ? undefined : result.errors.map((item) => `${item.provider}/${item.model}: ${item.error}`).join("; "),
  };
}

function parseContentCreationResult(content: string) {
  const candidate = parseJsonObject(content);
  const score = Math.max(0, Math.min(100, Math.round(Number(candidate.score))));
  if (!Number.isFinite(score) || typeof candidate.reasoning !== "string") {
    throw new Error("Content grading response missing required fields.");
  }

  return {
    score,
    reasoning: candidate.reasoning.trim(),
    passed: candidate.passed === true || score >= 60,
    similarity_flag: candidate.similarity_flag === true,
    ai_generated_flag: candidate.ai_generated_flag === true,
  };
}

function parseWatchAnswerResult(content: string) {
  const candidate = parseJsonObject(content);
  const score = Math.max(0, Math.min(100, Math.round(Number(candidate.score))));
  if (!Number.isFinite(score)) {
    throw new Error("Watch grading response missing score.");
  }

  return {
    score,
    reasoning: typeof candidate.reasoning === "string" ? candidate.reasoning.trim() : "",
  };
}

function parseJsonObject(content: string) {
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned);
  if (!isRecord(parsed)) {
    throw new Error("AI response was not a JSON object.");
  }
  return parsed;
}

function normalizeWatchTaskData(taskData: unknown) {
  const data = isRecord(taskData) ? taskData : {};
  const questions = Array.isArray(data.questions) ? data.questions : [];
  return {
    content_type: String(data.content_type ?? "youtube"),
    content_url: String(data.content_url ?? data.video_url ?? ""),
    questions: questions
      .filter(isRecord)
      .map((question, index) => ({
        id: String(question.id ?? `q-${index}`),
        type: question.type === "multiple_choice" ? "multiple_choice" : "open_ended",
        question: String(question.question ?? question.text ?? ""),
        options: Array.isArray(question.options) ? question.options.map(String) : undefined,
        correct_option: typeof question.correct_option === "string" ? question.correct_option : undefined,
      })),
  };
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter((word) => word.length > 0).length;
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
      ai_score: null,
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

type VisionModelResult = {
  success: boolean;
  response?: string;
  modelUsed?: string;
  errors: Array<{ model: string; error: string; isTimeout?: boolean; isRateLimit?: boolean; isInvalidResponse?: boolean }>;
};

async function callVisionModelWithFallback(
  image: { base64: string; mediaType: string },
  prompt: string,
  submissionId: string
): Promise<VisionModelResult> {
  const errors: VisionModelResult["errors"] = [];

  for (let i = 0; i < VISION_MODELS.length; i++) {
    const modelConfig = VISION_MODELS[i];
    const apiKey = process.env[modelConfig.apiKeyName] ?? null;

    if (!apiKey) {
      console.warn(`[Social Grading] No API key for ${modelConfig.apiKeyName}, skipping model: ${modelConfig.modelId}`);
      errors.push({
        model: modelConfig.modelId,
        error: `Missing API key: ${modelConfig.apiKeyName}`,
      });
      continue;
    }

    try {
      const result = await callVisionModel(apiKey, modelConfig, image, prompt, submissionId);

      if (result.success && result.response) {
        return {
          success: true,
          response: result.response,
          modelUsed: modelConfig.modelId,
          errors: [],
        };
      }

      errors.push({
        model: modelConfig.modelId,
        error: result.error || "Unknown error",
        isTimeout: result.isTimeout,
        isRateLimit: result.isRateLimit,
        isInvalidResponse: result.isInvalidResponse,
      });

      console.warn(`[Social Grading] Model ${modelConfig.modelId} failed:`, result.error);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({
        model: modelConfig.modelId,
        error: errorMessage,
      });
      console.error(`[Social Grading] Model ${modelConfig.modelId} exception:`, errorMessage);
    }
  }

  console.error(`[Social Grading] All ${VISION_MODELS.length} models failed for submission:`, submissionId);
  return { success: false, errors };
}

type SingleModelResult = {
  success: boolean;
  response?: string;
  error?: string;
  isTimeout?: boolean;
  isRateLimit?: boolean;
  isInvalidResponse?: boolean;
};

async function callVisionModel(
  apiKey: string,
  modelConfig: VisionModelConfig,
  image: { base64: string; mediaType: string },
  prompt: string,
  _submissionId: string
): Promise<SingleModelResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VISION_MODEL_TIMEOUT_MS);

  try {
    const messages = modelConfig.supportsVision
      ? [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${image.mediaType};base64,${image.base64}`,
                },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ]
      : [
          {
            role: "user",
            content: `[Image analysis required] ${prompt}\n\nNote: This model does not support direct image input. Please respond with: {"decision": "flagged", "score": 50, "checks": {"correct_platform": false, "target_visible": false, "action_completed": false, "looks_authentic": false}, "reasoning": "Model does not support vision - manual review required", "issues": ["vision_not_supported"]}`,
          },
        ];

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };

    if (modelConfig.provider === "openrouter") {
      headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://pesatrix.com";
      headers["X-Title"] = "Pesatrix";
    }

    const response = await fetch(`${modelConfig.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: modelConfig.modelId,
        messages,
        temperature: 0.3,
        max_tokens: VISION_MODEL_MAX_TOKENS,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status === 429) {
      return {
        success: false,
        error: "Rate limited",
        isRateLimit: true,
      };
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        success: false,
        error: `API error: ${response.status} - ${errorText.slice(0, 200)}`,
      };
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return {
        success: false,
        error: "Empty response from model",
        isInvalidResponse: true,
      };
    }

    try {
      JSON.parse(content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim());
    } catch {
      return {
        success: false,
        error: "Response is not valid JSON",
        isInvalidResponse: true,
      };
    }

    return {
      success: true,
      response: content,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      return {
        success: false,
        error: "Request timeout",
        isTimeout: true,
      };
    }
    throw error;
  }
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

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
