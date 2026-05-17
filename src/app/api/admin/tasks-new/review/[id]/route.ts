import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog, requireAdmin } from "@/app/api/admin/_lib";
import { getWithdrawalHoldDays } from "@/lib/platform-settings";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const reviewDecisionSchema = z.object({
  decision: z.enum(["approved", "declined"]),
  note: z.string().trim().max(1000).optional().nullable(),
});

export async function GET(request: Request, { params }: RouteContext) {
  const { error } = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "admin", "support"],
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
    allowedRoles: ["super_admin", "admin"],
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
    .select("*, task:tasks(payout_ksh, title)")
    .eq("id", id)
    .maybeSingle();

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    admin_decision: parsed.data.decision,
    admin_note: parsed.data.note ?? null,
    admin_reviewed_by: userId,
    admin_reviewed_at: now,
    status: "admin_reviewed",
  };

  if (parsed.data.decision === "approved") {
    const payoutKsh = Number((submission.task as Record<string, unknown>)?.payout_ksh ?? 0);
    const holdDays = await getWithdrawalHoldDays();
    const availableAt = new Date(Date.now() + holdDays * 24 * 60 * 60 * 1000).toISOString();
    const walletState = holdDays === 0 ? "available" : "pending";

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
        description: `Task earning (admin approved): ${(submission.task as Record<string, unknown>)?.title}`,
        reference_table: "task_submissions",
        reference_id: id,
        available_at: availableAt,
      });

    if (walletError) {
      return NextResponse.json({ error: "Failed to create wallet transaction" }, { status: 500 });
    }
  } else {
    await admin
      .from("task_submissions")
      .update(update)
      .eq("id", id);
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
