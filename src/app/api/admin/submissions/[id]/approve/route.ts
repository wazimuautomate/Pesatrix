import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog, requireAdmin } from "@/app/api/admin/_lib";
import { getWithdrawalHoldDays } from "@/lib/platform-settings";
import { normalizeSocialTaskData } from "@/lib/social-engagement";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const authResult = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });
  if (authResult.error) return authResult.error;
  if (!authResult.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { userId, adminUser, requestMeta } = authResult;
  const admin = createAdminSupabaseClient();

  const { data: submission, error: fetchError } = await admin
    .from("task_submissions")
    .select("*, tasks!task_submissions_task_id_fkey(id, title, payout_ksh, task_data)")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const sub = submission as Record<string, unknown>;
  const taskData = sub.tasks as Record<string, unknown> | null;

  if (sub.payout_credited === true) {
    return NextResponse.json(
      { error: "Payout already credited for this submission" },
      { status: 409 }
    );
  }

  if (sub.status === "approved") {
    return NextResponse.json(
      { error: "Submission is already approved" },
      { status: 409 }
    );
  }

  const payoutKsh = Math.round(Number(taskData?.payout_ksh ?? 0));
  const now = new Date().toISOString();
  const socialTaskData = normalizeSocialTaskData(taskData?.task_data);
  const holdDays = socialTaskData?.hold_days ?? await getWithdrawalHoldDays();
  const availableAt = new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000).toISOString();
  const walletState = holdDays === 0 && !socialTaskData ? "available" : "pending";

  const { error: updateError } = await admin
    .from("task_submissions")
    .update({
      status: "approved",
      admin_decision: "approved",
      admin_reviewed_by: userId,
      admin_reviewed_at: now,
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
      user_id: sub.user_id,
      type: "task_earning",
      direction: "credit",
      amount: payoutKsh,
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
        status: "pending",
        admin_decision: null,
        admin_reviewed_by: null,
        admin_reviewed_at: null,
      })
      .eq("id", id);

    return NextResponse.json(
      { error: "Failed to create wallet transaction" },
      { status: 500 }
    );
  }

  await auditLog({
    adminId: userId,
    action: "submission_approved",
    entityType: "task_submissions",
    entityId: id,
    before: { status: sub.status, payout_credited: sub.payout_credited },
    after: { status: "approved", payout_credited: true, payout_amount: payoutKsh },
    reason: "Admin approved submission and credited wallet",
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ ok: true, payout_credited: payoutKsh });
}
