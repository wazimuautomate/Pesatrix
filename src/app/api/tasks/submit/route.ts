import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

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

  const [{ data: accountStatus }, { data: activationPayment }] = await Promise.all([
    supabase
      .from("account_status")
      .select("is_activated")
      .eq("user_id", user.id)
      .maybeSingle(),
    (supabase.from("activation_payments" as never) as any)
      .select("id, status")
      .eq("user_id", user.id)
      .eq("status", "paid")
      .maybeSingle(),
  ]);

  const isActivated = Boolean(accountStatus?.is_activated) || Boolean(activationPayment?.status === "paid");

  if (!isActivated) {
    return NextResponse.json(
      { error: "Account not activated" },
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
    .select("*")
    .eq("id", taskId)
    .eq("status", "active")
    .gt("slots_remaining", 0)
    .maybeSingle();

  if (!task) {
    return NextResponse.json(
      { error: "Task not available" },
      { status: 404 }
    );
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

  const initialStatus = task.ai_grading_enabled ? "ai_reviewing" : "flagged";

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

  if (task.ai_grading_enabled) {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/tasks/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: submission.id,
          taskId,
          userId: user.id,
        }),
      });
    } catch {
      await admin
        .from("task_submissions")
        .update({ status: "flagged" })
        .eq("id", submission.id);
    }
  }

  return NextResponse.json({
    submission: {
      id: submission.id,
      status: submission.status,
      submittedAt: submission.submitted_at,
    },
  });
}
