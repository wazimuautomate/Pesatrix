import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getTrainingProgramSnapshotForUser } from "@/lib/training";
import { gradeSubmission } from "@/lib/ai/grading";
import { getDailyTaskLimit } from "@/lib/platform-settings";
import { isDataLabelingTaskData, isSocialEngagementTaskData } from "@/lib/task-data";
import { normalizeSocialTaskData } from "@/lib/social-engagement";

const submissionSchema = z.object({
  taskId: z.string().uuid(),
  answers: z.record(z.unknown()),
  screenshotUrl: z.string().url().nullable().optional(),
  submittedUrl: z.string().url().nullable().optional(),
});

const TASK_SCREENSHOT_BUCKET = "task-screenshots";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await getTrainingProgramSnapshotForUser(user.id);

  if (!access.activated) {
    return NextResponse.json(
      { error: "Account not activated" },
      { status: 403 }
    );
  }

  if (!access.canStartTasks) {
    return NextResponse.json(
      { error: access.gateMessage ?? "Task access is locked" },
      { status: 403 }
    );
  }

  const parsed = submissionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message } },
      { status: 422 }
    );
  }

  const { taskId, answers, screenshotUrl, submittedUrl } = parsed.data;

  const admin = createAdminSupabaseClient();

  const { data: task } = await admin
    .from("tasks")
    .select("slots_remaining, status, ai_grading_enabled, task_data, category")
    .eq("id", taskId)
    .single();

  if (!task || task.slots_remaining <= 0 || task.status !== "active") {
    return NextResponse.json(
      { error: "This task is no longer available" },
      { status: 409 }
    );
  }

  const socialTaskData = normalizeSocialTaskData(task.task_data);
  const isSocialTask = isSocialEngagementTaskData(task.task_data) && Boolean(socialTaskData);
  let socialScreenshotUrl: string | null = null;
  let socialScreenshotHash: string | null = null;
  let socialAutoFlag = false;
  const requestIp = getClientIp(request);

  if (isSocialTask && socialTaskData) {
    const { data: verification } = await admin
      .from("user_verification")
      .select("risk_score")
      .eq("user_id", user.id)
      .maybeSingle();
    const riskScore = Number(verification?.risk_score ?? 0);

    if (riskScore > 80) {
      return NextResponse.json(
        { error: "Your account is blocked from social engagement tasks. Contact support for review." },
        { status: 403 }
      );
    }

    socialAutoFlag = riskScore > 50;

    const validationError = await validateSocialEngagementSubmission({
      admin,
      taskId,
      taskData: socialTaskData,
      answers,
      requestIp,
    });
    if (validationError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: validationError.message } },
        { status: validationError.status }
      );
    }

    socialScreenshotUrl = String(answers.screenshot_url);
    const imageBytes = await downloadScreenshotBytes(admin, socialScreenshotUrl);
    if (!imageBytes) {
      return NextResponse.json(
        { error: { code: "INVALID_SCREENSHOT", message: "Screenshot could not be read. Please upload it again." } },
        { status: 422 }
      );
    }

    socialScreenshotHash = createHash("md5").update(imageBytes).digest("hex");
    const { data: duplicate } = await admin
      .from("task_submissions")
      .select("id")
      .eq("task_id", taskId)
      .eq("screenshot_hash", socialScreenshotHash)
      .neq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (duplicate) {
      return NextResponse.json(
        { error: { code: "DUPLICATE_SCREENSHOT", message: "This screenshot has already been submitted by another user" } },
        { status: 422 }
      );
    }
  }

  if (isDataLabelingTaskData(task.task_data)) {
    const validationError = validateDataLabelingAnswers(task.task_data, answers);
    if (validationError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: validationError } },
        { status: 422 }
      );
    }
  }

  let existingQuery = admin
    .from("task_submissions")
    .select("id")
    .eq("task_id", taskId)
    .eq("user_id", user.id);

  if (isSocialTask) {
    existingQuery = existingQuery.neq("status", "declined");
  }

  const { data: existingSubmission } = await existingQuery.limit(1).maybeSingle();

  if (existingSubmission) {
    return NextResponse.json(
      { error: "You have already submitted this task" },
      { status: 409 }
    );
  }

  if (isSocialTask) {
    const { data: bannedSubmission } = await admin
      .from("task_submissions")
      .select("id")
      .eq("task_id", taskId)
      .eq("user_id", user.id)
      .eq("user_task_banned", true)
      .limit(1)
      .maybeSingle();

    if (bannedSubmission) {
      return NextResponse.json(
        { error: "You are no longer eligible to submit this task." },
        { status: 403 }
      );
    }

    const { data: declinedRows } = await admin
      .from("task_submissions")
      .select("id, submitted_at")
      .eq("task_id", taskId)
      .eq("user_id", user.id)
      .eq("status", "declined")
      .order("submitted_at", { ascending: false })
      .limit(2);

    const declines = declinedRows ?? [];
    if (declines.length >= 2) {
      return NextResponse.json(
        { error: "You cannot resubmit this task after two declined attempts." },
        { status: 403 }
      );
    }

    if (declines.length === 1) {
      const declinedAt = new Date(declines[0].submitted_at as string).getTime();
      if (declinedAt < Date.now() - 24 * 60 * 60 * 1000) {
        return NextResponse.json(
          { error: "The resubmission window for this task has expired." },
          { status: 403 }
        );
      }
    }
  }

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const dailyLimit = await getDailyTaskLimit();
  const { count: todaySubmissionCount, error: countError } = await admin
    .from("task_submissions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("submitted_at", todayStart.toISOString());

  if (countError) {
    console.error("[Submission] Daily limit count failed:", countError);
    return NextResponse.json(
      { error: "Unable to check your daily task limit. Please try again." },
      { status: 500 }
    );
  }

  if (todaySubmissionCount !== null && todaySubmissionCount >= dailyLimit) {
    return NextResponse.json(
      { error: `You have reached your daily limit of ${dailyLimit} tasks. Come back tomorrow.` },
      { status: 429 }
    );
  }

  const initialStatus = task.ai_grading_enabled ? "ai_reviewing" : "pending";

  const { data: submission, error: insertError } = await admin
    .from("task_submissions")
    .insert({
      task_id: taskId,
      user_id: user.id,
      answers,
      screenshot_url: socialScreenshotUrl ?? screenshotUrl ?? null,
      submitted_url: submittedUrl ?? null,
      status: initialStatus,
      screenshot_hash: socialScreenshotHash,
      ip: requestIp,
      ...(socialAutoFlag ? { grading_detail: { social_auto_flag_reason: "risk_score_above_50" } } : {}),
    })
    .select("*")
    .single();

  if (insertError || !submission) {
    return NextResponse.json(
      { error: "Failed to submit task" },
      { status: 500 }
    );
  }

  const { data: decremented, error: slotError } = await admin
    .rpc("decrement_task_slot", { p_task_id: taskId });

  if (slotError) {
    console.error("[Submission] Slot decrement failed:", slotError);
  }

  if (decremented === false) {
    console.warn("[Submission] Slot was 0 at decrement time for task:", taskId);
    await admin.from("task_submissions").delete().eq("id", submission.id);
    return NextResponse.json(
      { error: "This task is now full. Check back for more tasks." },
      { status: 409 }
    );
  }

  if (task.ai_grading_enabled) {
    await admin
      .from("task_submissions")
      .update({ status: "ai_reviewing" })
      .eq("id", submission.id);

    if (isDataLabelingTaskData(task.task_data) || isSocialTask) {
      await gradeSubmission(submission.id);
    } else {
      gradeSubmission(submission.id).catch((err) => {
        console.error("[Grading] Failed for submission:", submission.id, err);
      });
    }
  }

  const { data: reviewedSubmission } = task.ai_grading_enabled && (isDataLabelingTaskData(task.task_data) || isSocialTask)
    ? await admin
      .from("task_submissions")
      .select("id, status, submitted_at, ai_score, ai_reasoning")
      .eq("id", submission.id)
      .maybeSingle()
    : { data: null };

  return NextResponse.json({
    submission: {
      id: reviewedSubmission?.id ?? submission.id,
      status: reviewedSubmission?.status ?? submission.status,
      submittedAt: reviewedSubmission?.submitted_at ?? submission.submitted_at,
      aiScore: reviewedSubmission?.ai_score ?? null,
      aiReasoning: reviewedSubmission?.ai_reasoning ?? null,
    },
  });
}

async function validateSocialEngagementSubmission({
  admin,
  taskId,
  taskData,
  answers,
  requestIp,
}: {
  admin: ReturnType<typeof createAdminSupabaseClient>;
  taskId: string;
  taskData: NonNullable<ReturnType<typeof normalizeSocialTaskData>>;
  answers: Record<string, unknown>;
  requestIp: string | null;
}) {
  const screenshotUrl = typeof answers.screenshot_url === "string" ? answers.screenshot_url.trim() : "";
  if (!screenshotUrl || !parseTaskScreenshotUrl(screenshotUrl)) {
    return { status: 422, message: "A valid uploaded screenshot is required." };
  }

  if (taskData.proof_requirements.requires_username) {
    const username = typeof answers.username === "string" ? answers.username.trim() : "";
    if (!username) {
      return { status: 422, message: "Your username is required for this task." };
    }
  }

  if (taskData.proof_requirements.requires_text_input) {
    const textInput = typeof answers.text_input === "string" ? answers.text_input.trim() : "";
    const wordCount = textInput ? textInput.split(/\s+/).filter(Boolean).length : 0;
    if (wordCount < 3) {
      return { status: 422, message: "Please enter at least 3 words for the required text proof." };
    }
  }

  if (answers.platform !== taskData.platform || answers.action !== taskData.action) {
    return { status: 422, message: "Submission platform or action does not match this task." };
  }

  if (requestIp) {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: ipSubmission } = await admin
      .from("task_submissions")
      .select("id")
      .eq("task_id", taskId)
      .eq("ip", requestIp)
      .gte("submitted_at", since)
      .limit(1)
      .maybeSingle();

    if (ipSubmission) {
      return { status: 429, message: "This task was already submitted from this network recently. Try again later." };
    }
  }

  return null;
}

async function downloadScreenshotBytes(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  screenshotUrl: string
) {
  const parsed = parseTaskScreenshotUrl(screenshotUrl);
  if (!parsed) return null;

  const { data, error } = await admin.storage
    .from(TASK_SCREENSHOT_BUCKET)
    .download(parsed.path);

  if (error || !data) {
    console.error("[Submission] Screenshot download failed:", error);
    return null;
  }

  return Buffer.from(await data.arrayBuffer());
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
    return { path };
  } catch {
    return null;
  }
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip") || request.headers.get("cf-connecting-ip");
}

function validateDataLabelingAnswers(taskData: unknown, answers: Record<string, unknown>) {
  if (!isDataLabelingTaskData(taskData)) return null;

  const items = taskData.items ?? [];
  const batchSize = taskData.batch_size ?? items.length;
  const labelOptions = taskData.label_options ?? [];
  const itemIds = new Set(items.map((item) => item.id));
  const answerEntries = Object.entries(answers);

  if (answerEntries.length !== batchSize || items.some((item) => answers[item.id] === undefined)) {
    return "Please label all items before submitting";
  }

  for (const [itemId, answer] of answerEntries) {
    if (!itemIds.has(itemId)) {
      return "Submitted answers include an unknown item";
    }

    if (typeof answer !== "string" || !labelOptions.includes(answer)) {
      return "Submitted answers include an invalid label";
    }
  }

  return null;
}
