import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireAdmin } from "../../_lib";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { userId } = await params;
  const admin = createAdminSupabaseClient();

  const [{ data: training }, { data: profile }] = await Promise.all([
    (admin.from("training_progress" as never) as any)
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
    (admin.from("profiles" as never) as any)
      .select("id, full_name, phone, email")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  let rewardTransaction = null;
  if (training?.reward_transaction_id) {
    const { data: txn } = await (admin.from("wallet_transactions" as never) as any)
      .select("id, amount, status, created_at")
      .eq("id", training.reward_transaction_id)
      .maybeSingle();
    rewardTransaction = txn;
  }

  const completedDays = Array.isArray(training?.completed_days)
    ? training.completed_days.sort((a: number, b: number) => a - b)
    : [];
  const failedAttempts =
    training?.failed_stage_attempts && typeof training.failed_stage_attempts === "object"
      ? training.failed_stage_attempts
      : {};
  const currentDay = training?.current_day ?? 1;

  const dayBreakdown = [];
  for (let day = 1; day <= 7; day++) {
    const isCompleted = completedDays.includes(day);
    const isCurrent = day === currentDay;
    const isLocked = day > currentDay;

    const stages = [];
    for (let stage = 1; stage <= 3; stage++) {
      const key = `day${day}_stage${stage}`;
      stages.push({
        stage,
        attempts: Number(failedAttempts[key] ?? 0),
      });
    }

    dayBreakdown.push({ day, is_completed: isCompleted, is_current: isCurrent, is_locked: isLocked, stages });
  }

  return NextResponse.json({
    profile,
    training_progress: training,
    day_breakdown: dayBreakdown,
    reward_transaction: rewardTransaction,
  });
}
