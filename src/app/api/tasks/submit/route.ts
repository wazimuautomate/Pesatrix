import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getTrainingProgramSnapshotForUser } from "@/lib/training";
import { gradeSubmission } from "@/lib/ai/grading";
import { getDailyTaskLimit } from "@/lib/platform-settings";
import { isDataLabelingTaskData } from "@/lib/task-data";

const submissionSchema = z.object({
  taskId: z.string().uuid(),
  answers: z.record(z.unknown()),
  screenshotUrl: z.string().url().nullable().optional(),
  submittedUrl: z.string().url().nullable().optional(),
});

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
    .select("slots_remaining, status, ai_grading_enabled, task_data")
    .eq("id", taskId)
    .single();

  if (!task || task.slots_remaining <= 0 || task.status !== "active") {
    return NextResponse.json(
      { error: "This task is no longer available" },
      { status: 409 }
    );
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

  const { data: existingSubmission } = await admin
    .from("task_submissions")
    .select("id")
    .eq("task_id", taskId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingSubmission) {
    return NextResponse.json(
      { error: "You have already submitted this task" },
      { status: 409 }
    );
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
      screenshot_url: screenshotUrl ?? null,
      submitted_url: submittedUrl ?? null,
      status: initialStatus,
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
  }

  if (task.ai_grading_enabled) {
    await admin
      .from("task_submissions")
      .update({ status: "ai_reviewing" })
      .eq("id", submission.id);

    if (isDataLabelingTaskData(task.task_data)) {
      await gradeSubmission(submission.id);
    } else {
      gradeSubmission(submission.id).catch((err) => {
        console.error("[Grading] Failed for submission:", submission.id, err);
      });
    }
  }

  const { data: reviewedSubmission } = task.ai_grading_enabled && isDataLabelingTaskData(task.task_data)
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
