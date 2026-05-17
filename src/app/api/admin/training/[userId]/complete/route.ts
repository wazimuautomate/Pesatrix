import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireAdmin, auditLog } from "../../../_lib";
import { getTrainingCompletionRewardKsh } from "@/lib/platform-settings";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { error, adminUser, userId: adminAuthId, requestMeta } = await requireAdmin({
    allowedRoles: ["super_admin"],
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
    return NextResponse.json({ error: "Training is already completed" }, { status: 409 });
  }

  if (training.reward_transaction_id) {
    return NextResponse.json({ error: "Training reward already credited" }, { status: 409 });
  }

  const rewardAmount = await getTrainingCompletionRewardKsh();
  const now = new Date();
  const availableAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const { data: walletTx, error: walletError } = await (admin.from("wallet_transactions" as never) as any)
    .insert({
      user_id: userId,
      type: "reward",
      direction: "credit",
      amount: rewardAmount,
      status: "pending",
      bucket: "pending",
      description: "Training completion reward — admin manual credit",
      reference_table: "training_progress",
      reference_id: userId,
      available_at: availableAt.toISOString(),
      created_by_admin_id: adminAuthId,
    })
    .select("id")
    .single();

  if (walletError || !walletTx) {
    return NextResponse.json({ error: "Failed to create wallet transaction" }, { status: 500 });
  }

  const { error: updateError } = await (admin.from("training_progress" as never) as any)
    .update({
      status: "completed",
      completed_at: now.toISOString(),
      current_day: 7,
      completed_days: [1, 2, 3, 4, 5, 6, 7],
      reward_transaction_id: walletTx.id,
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
      completed_days: [1, 2, 3, 4, 5, 6, 7],
      reward_transaction_id: walletTx.id,
    },
    reason: "Admin manual completion",
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ ok: true, walletTransactionId: walletTx.id });
}
