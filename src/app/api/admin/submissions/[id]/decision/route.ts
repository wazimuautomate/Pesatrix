import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog, requireAdmin } from "@/app/api/admin/_lib";
import { getWithdrawalHoldDays } from "@/lib/platform-settings";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const decisionSchema = z.object({
  decision: z.enum(["approved", "declined"]),
  reason: z.string().trim().max(2000).optional().nullable(),
});

export async function POST(request: Request, { params }: RouteContext) {
  const { error, userId, adminUser, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const parsed = decisionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message } },
      { status: 422 }
    );
  }

  if (parsed.data.decision === "declined" && !parsed.data.reason) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Reason is required when declining" } },
      { status: 422 }
    );
  }

  const admin = createAdminSupabaseClient();

  const { data: submission } = await admin
    .from("task_submissions")
    .select("*, task:tasks(payout_ksh, title)")
    .eq("id", id)
    .maybeSingle();

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  if ((submission as Record<string, unknown>).payout_credited === true) {
    return NextResponse.json(
      { error: { code: "ALREADY_CREDITED", message: "Already credited" } },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();

  if (parsed.data.decision === "approved") {
    const taskData = submission.task as Record<string, unknown> | null;
    const payoutKsh = Number(taskData?.payout_ksh ?? 0);
    const holdDays = await getWithdrawalHoldDays();
    const availableAt = new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000).toISOString();
    const walletState = holdDays === 0 ? "available" : "pending";

    const { error: updateError } = await admin
      .from("task_submissions")
      .update({
        admin_decision: "approved",
        admin_note: parsed.data.reason ?? null,
        admin_reviewed_by: userId,
        admin_reviewed_at: now,
        status: "admin_reviewed",
        payout_credited: true,
        payout_credited_at: now,
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update submission" },
        { status: 500 }
      );
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
        description: `Task earning (admin approved): ${taskData?.title ?? "Task"}`,
        reference_table: "task_submissions",
        reference_id: id,
        available_at: availableAt,
        created_by_admin_id: userId,
      });

    if (walletError) {
      await admin
        .from("task_submissions")
        .update({
          payout_credited: false,
          payout_credited_at: null,
          admin_decision: null,
          admin_note: null,
          admin_reviewed_by: null,
          admin_reviewed_at: null,
          status: submission.status,
        })
        .eq("id", id);

      return NextResponse.json(
        { error: "Failed to create wallet transaction" },
        { status: 500 }
      );
    }
  } else {
    const { error: updateError } = await admin
      .from("task_submissions")
      .update({
        admin_decision: "declined",
        admin_note: parsed.data.reason,
        admin_reviewed_by: userId,
        admin_reviewed_at: now,
        status: "admin_reviewed",
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update submission" },
        { status: 500 }
      );
    }
  }

  await auditLog({
    adminId: userId,
    action: "submission_decision",
    entityType: "task_submissions",
    entityId: id,
    after: { decision: parsed.data.decision, reason: parsed.data.reason },
    reason: `Admin ${parsed.data.decision} submission`,
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ ok: true });
}
