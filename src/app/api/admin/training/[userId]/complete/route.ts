import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireAdmin, auditLog } from "../../../_lib";
import { ensureTrainingReward } from "@/lib/training";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { error, adminUser, userId: adminAuthId, requestMeta } = await requireAdmin({
    allowedRoles: ["admin"],
  });
  if (error) return error;

  const { userId } = await params;
  const admin = createAdminSupabaseClient();

  const { data: training } = await (admin.from("training_progress" as never) as any)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!training) {
    return NextResponse.json({ error: "Training progress not found" }, { status: 404 });
  }

  if (training.status === "completed") {
    return NextResponse.json({ ok: true, walletTransactionId: training.reward_transaction_id ?? null });
  }

  const now = new Date();
  const walletTransactionId = await ensureTrainingReward(userId, adminAuthId);

  const { error: updateError } = await (admin.from("training_progress" as never) as any)
    .update({
      status: "completed",
      completed_at: now.toISOString(),
      current_day: 7,
      current_stage: 3,
      stage_attempt: 1,
      completed_days: [1, 2, 3, 4, 5, 6, 7],
      next_day_unlock_at: null,
      last_completed_at: now.toISOString(),
      reward_transaction_id: walletTransactionId,
    })
    .eq("user_id", userId);

  if (updateError) {
    return NextResponse.json({ error: "Failed to update training progress" }, { status: 500 });
  }

  await auditLog({
    adminId: adminAuthId!,
    action: "training_manual_complete",
    entityType: "training_progress",
    entityId: userId,
    before: {
      status: training.status,
      current_day: training.current_day,
      completed_days: training.completed_days,
      reward_transaction_id: training.reward_transaction_id,
    },
    after: {
      status: "completed",
      completed_at: now.toISOString(),
      current_day: 7,
      current_stage: 3,
      completed_days: [1, 2, 3, 4, 5, 6, 7],
      reward_transaction_id: walletTransactionId,
    },
    reason: "Admin manual completion",
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ ok: true, walletTransactionId });
}
