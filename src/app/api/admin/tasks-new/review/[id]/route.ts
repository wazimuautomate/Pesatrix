import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog, requireAdmin } from "@/app/api/admin/_lib";
import { getWithdrawalHoldDays } from "@/lib/platform-settings";
import { normalizeSocialTaskData } from "@/lib/social-engagement";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const reviewDecisionSchema = z.object({
  decision: z.enum(["approved", "declined"]).optional(),
  action: z.enum(["flag_fraud", "ban_task"]).optional(),
  note: z.string().trim().max(1000).optional().nullable(),
}).refine((value) => Boolean(value.decision) !== Boolean(value.action), {
  message: "Provide either a decision or an action",
});

export async function GET(request: Request, { params }: RouteContext) {
  const { error } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });
  if (error) return error;

  const { id } = await params;
  const admin = createAdminSupabaseClient();

  const { data: submission } = await admin
    .from("task_submissions")
    .select(`
      *,
      task:tasks(title, category, payout_ksh, instructions, task_data),
      profile:profiles!task_submissions_user_id_fkey(full_name, email, phone)
    `)
    .eq("id", id)
    .maybeSingle();

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  return NextResponse.json({ submission });
}

export async function POST(request: Request, { params }: RouteContext) {
  const { error, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const parsed = reviewDecisionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message } },
      { status: 422 }
    );
  }

  const admin = createAdminSupabaseClient();

  const { data: submission } = await admin
    .from("task_submissions")
    .select("*, task:tasks(payout_ksh, title, task_data)")
    .eq("id", id)
    .maybeSingle();

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const now = new Date().toISOString();

  if (parsed.data.action === "flag_fraud") {
    await adjustRiskScore(admin, submission.user_id, 15);
    const { data: verification } = await admin
      .from("user_verification")
      .select("flags")
      .eq("user_id", submission.user_id)
      .maybeSingle();
    const flags = verification?.flags && typeof verification.flags === "object"
      ? verification.flags as Record<string, unknown>
      : {};
    await admin
      .from("user_verification")
      .upsert({
        user_id: submission.user_id,
        flags: {
          ...flags,
          social_engagement_fraud_review: true,
          social_engagement_fraud_review_at: now,
          social_engagement_fraud_submission_id: id,
        },
        updated_at: now,
      });

    await auditLog({
      adminId: userId,
      action: "submission_flag_fraud",
      entityType: "task_submissions",
      entityId: id,
      after: { fraud_review: true, note: parsed.data.note },
      reason: parsed.data.note ?? "Flagged account for fraud review",
      ip: requestMeta?.ip ?? undefined,
      userAgent: requestMeta?.userAgent ?? undefined,
    });

    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "ban_task") {
    const { error: updateError } = await admin
      .from("task_submissions")
      .update({
        status: "declined",
        user_task_banned: true,
        admin_decision: "declined",
        admin_note: parsed.data.note ?? "Banned from this task by admin review.",
        admin_reviewed_by: userId,
        admin_reviewed_at: now,
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to ban user from task" }, { status: 500 });
    }

    await adjustRiskScore(admin, submission.user_id, 8);
    await auditLog({
      adminId: userId,
      action: "submission_task_ban",
      entityType: "task_submissions",
      entityId: id,
      after: { user_task_banned: true, note: parsed.data.note },
      reason: parsed.data.note ?? "Banned user from task",
      ip: requestMeta?.ip ?? undefined,
      userAgent: requestMeta?.userAgent ?? undefined,
    });

    return NextResponse.json({ ok: true });
  }

  const update: Record<string, unknown> = {
    admin_decision: parsed.data.decision,
    admin_note: parsed.data.note ?? null,
    admin_reviewed_by: userId,
    admin_reviewed_at: now,
    status: "admin_reviewed",
  };

  if (parsed.data.decision === "approved") {
    const task = submission.task as Record<string, unknown>;
    const payoutKsh = Number(task?.payout_ksh ?? 0);
    const socialTaskData = normalizeSocialTaskData(task?.task_data);
    const holdDays = socialTaskData?.hold_days ?? await getWithdrawalHoldDays();
    const availableAt = new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000).toISOString();
    const walletState = holdDays === 0 && !socialTaskData ? "available" : "pending";

    const { error: updateError } = await admin
      .from("task_submissions")
      .update({
        ...update,
        payout_credited: true,
        payout_credited_at: now,
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update submission" }, { status: 500 });
    }

    const { error: walletError } = await admin
      .from("wallet_transactions")
      .insert({
        user_id: submission.user_id,
        type: "task_earning",
        direction: "credit",
        amount: Math.round(payoutKsh),
        status: walletState,
        bucket: walletState,
        description: `Task earning (admin approved): ${task?.title}`,
        reference_table: "task_submissions",
        reference_id: id,
        available_at: availableAt,
      });

    if (walletError) {
      return NextResponse.json({ error: "Failed to create wallet transaction" }, { status: 500 });
    }
    await queueTaskNotification(admin, submission.user_id, "task_proof_approved", {
      submission_id: id,
      task_title: task?.title,
      amount: Math.round(payoutKsh),
      hold_days: holdDays,
    });
  } else {
    await admin
      .from("task_submissions")
      .update(update)
      .eq("id", id);

    const socialTaskData = normalizeSocialTaskData((submission.task as Record<string, unknown>)?.task_data);
    if (socialTaskData) {
      await adjustRiskScore(admin, submission.user_id, 8);
    }
    await queueTaskNotification(admin, submission.user_id, "task_proof_declined", {
      submission_id: id,
      task_title: (submission.task as Record<string, unknown>)?.title,
      reasoning: parsed.data.note ?? "Declined by admin review.",
    });
  }

  await auditLog({
    adminId: userId,
    action: "submission_review",
    entityType: "task_submissions",
    entityId: id,
    after: { decision: parsed.data.decision, note: parsed.data.note },
    reason: `Admin ${parsed.data.decision} submission`,
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ ok: true });
}

async function adjustRiskScore(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  userId: string,
  delta: number
) {
  const { data } = await admin
    .from("user_verification")
    .select("risk_score")
    .eq("user_id", userId)
    .maybeSingle();
  await admin
    .from("user_verification")
    .upsert({
      user_id: userId,
      risk_score: Math.max(0, Number(data?.risk_score ?? 0) + delta),
      updated_at: new Date().toISOString(),
    });
}

async function queueTaskNotification(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  userId: string,
  eventType: string,
  payload: Record<string, unknown>
) {
  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  await admin.from("notification_outbox").insert({
    channel: "email",
    event_type: eventType,
    recipient_user_id: userId,
    recipient_email: profile?.email ?? null,
    payload,
    status: "pending",
    provider: null,
    external_id: null,
    error_message: null,
    sent_at: null,
  });
}
