import { NextResponse } from "next/server";
import { z } from "zod";

import { auditLog, requireAdmin } from "@/app/api/admin/_lib";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

const schema = z.object({
  action: z.enum(["confirm_suspend", "lift_suspend", "clear_flags"]),
  reason: z.string().trim().min(1, "Reason is required"),
});

export async function POST(request: Request, { params }: RouteContext) {
  const { userId: targetUserId } = await params;
  const { error, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid request" }, { status: 422 });
  }

  const admin = createAdminSupabaseClient();
  const warning = await getHeldWithdrawalWarning(admin, targetUserId);

  if (parsed.data.action === "clear_flags") {
    const { data: before } = await (admin.from("user_verification" as never) as any)
      .select("user_id, risk_score, flags")
      .eq("user_id", targetUserId)
      .maybeSingle();

    const { data: updated, error: updateError } = await (admin.from("user_verification" as never) as any)
      .update({ risk_score: 0, flags: {} })
      .eq("user_id", targetUserId)
      .select("user_id, risk_score, flags")
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: "Failed to clear flags" }, { status: 500 });
    }

    await auditLog({
      adminId: userId,
      action: "fraud_flags_clear",
      entityType: "user_verification",
      entityId: targetUserId,
      before,
      after: updated,
      reason: parsed.data.reason,
      ip: requestMeta?.ip ?? undefined,
      userAgent: requestMeta?.userAgent ?? undefined,
    });

    return NextResponse.json({ ok: true, warning });
  }

  const { data: before } = await (admin.from("account_status" as never) as any)
    .select("user_id, status, state, suspension_reason, suspended_at")
    .eq("user_id", targetUserId)
    .maybeSingle();

  const update =
    parsed.data.action === "confirm_suspend"
      ? {
          status: "suspended",
          state: "suspended",
          suspension_reason: parsed.data.reason,
          suspended_at: before?.suspended_at ?? new Date().toISOString(),
        }
      : {
          status: "active",
          state: "activated",
          suspension_reason: null,
          suspended_at: null,
        };

  const { data: updated, error: updateError } = await (admin.from("account_status" as never) as any)
    .upsert({ user_id: targetUserId, ...update }, { onConflict: "user_id" })
    .select("user_id, status, state, suspension_reason, suspended_at")
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: "Failed to update suspension status" }, { status: 500 });
  }

  await auditLog({
    adminId: userId,
    action: parsed.data.action === "confirm_suspend" ? "fraud_suspend_confirm" : "fraud_suspend_lift",
    entityType: "account_status",
    entityId: targetUserId,
    before,
    after: updated,
    reason: parsed.data.reason,
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ ok: true, warning });
}

async function getHeldWithdrawalWarning(admin: any, userId: string) {
  const { count } = await (admin.from("withdrawal_requests" as never) as any)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "held");

  return count && count > 0
    ? `This user has ${count} held withdrawal${count === 1 ? "" : "s"}. Review withdrawals manually before release.`
    : null;
}
