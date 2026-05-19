import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { ensureTrainingReward } from "@/lib/training";
import { auditLog, requireAdmin } from "../../_lib";

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("adjust_progress"),
    currentDay: z.number().int().min(1).max(7),
    currentStage: z.number().int().min(1).max(3),
    status: z.enum(["not_started", "in_progress", "awaiting_test", "completed"]),
    stageAttempt: z.number().int().min(1).max(50).optional(),
    reason: z.string().trim().min(3).max(240).optional(),
  }),
  z.object({
    action: z.literal("reset_progress"),
    reason: z.string().trim().min(3).max(240).optional(),
  }),
  z.object({
    action: z.literal("mark_completed"),
    reason: z.string().trim().min(3).max(240).optional(),
  }),
]);

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { error, userId: adminAuthId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "admin"],
  });
  if (error) return error;

  const { userId } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid training update" } },
      { status: 422 }
    );
  }

  const admin = createAdminSupabaseClient();
  const { data: existingTraining, error: trainingError } = await (admin.from("training_progress" as never) as any)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (trainingError) {
    return NextResponse.json({ error: "Failed to load training progress" }, { status: 500 });
  }

  const before = existingTraining ?? null;
  const now = new Date().toISOString();

  if (parsed.data.action === "reset_progress") {
    const { error: upsertError } = await (admin.from("training_progress" as never) as any)
      .upsert(
        {
          user_id: userId,
          status: "not_started",
          current_day: 1,
          current_stage: 1,
          stage_attempt: 1,
          completed_days: [],
          failed_stage_attempts: {},
          next_day_unlock_at: null,
          last_completed_at: null,
          completed_at: null,
          reward_transaction_id: null,
          task_unlock_at: null,
          task_unlock_accelerated: false,
        },
        { onConflict: "user_id" }
      );

    if (upsertError) {
      return NextResponse.json({ error: "Failed to reset training progress" }, { status: 500 });
    }

    await auditLog({
      adminId: adminAuthId!,
      action: "training_progress_reset",
      entityType: "training_progress",
      entityId: userId,
      before,
      after: {
        status: "not_started",
        current_day: 1,
        current_stage: 1,
        completed_days: [],
      },
      reason: parsed.data.reason ?? "Admin reset training progress",
      ip: requestMeta?.ip ?? undefined,
      userAgent: requestMeta?.userAgent ?? undefined,
    });

    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "mark_completed") {
    const rewardTransactionId = await ensureTrainingReward(userId, adminAuthId);

    const { error: updateError } = await (admin.from("training_progress" as never) as any)
      .upsert(
        {
          user_id: userId,
          status: "completed",
          current_day: 7,
          current_stage: 3,
          stage_attempt: 1,
          completed_days: [1, 2, 3, 4, 5, 6, 7],
          failed_stage_attempts: existingTraining?.failed_stage_attempts ?? {},
          next_day_unlock_at: null,
          last_completed_at: now,
          completed_at: now,
          reward_transaction_id: rewardTransactionId,
          task_unlock_at: existingTraining?.task_unlock_at ?? now,
          task_unlock_accelerated: Boolean(existingTraining?.task_unlock_accelerated),
        },
        { onConflict: "user_id" }
      );

    if (updateError) {
      return NextResponse.json({ error: "Failed to mark training completed" }, { status: 500 });
    }

    await auditLog({
      adminId: adminAuthId!,
      action: "training_progress_completed",
      entityType: "training_progress",
      entityId: userId,
      before,
      after: {
        status: "completed",
        current_day: 7,
        current_stage: 3,
        reward_transaction_id: rewardTransactionId,
      },
      reason: parsed.data.reason ?? "Admin marked training completed",
      ip: requestMeta?.ip ?? undefined,
      userAgent: requestMeta?.userAgent ?? undefined,
    });

    return NextResponse.json({ ok: true, rewardTransactionId });
  }

  const adjustData = parsed.data;
  const filteredCompletedDays = (existingTraining?.completed_days ?? [])
    .map((value: unknown) => Number(value))
    .filter((value: number) => Number.isInteger(value) && value >= 1 && value <= adjustData.currentDay);
  const nextCompletedDays =
    adjustData.status === "completed"
      ? [1, 2, 3, 4, 5, 6, 7]
      : Array.from(new Set<number>(filteredCompletedDays)).sort((left, right) => left - right);

  const rewardTransactionId =
    adjustData.status === "completed"
      ? await ensureTrainingReward(userId, adminAuthId)
      : existingTraining?.reward_transaction_id ?? null;

  const payload = {
    user_id: userId,
    status: adjustData.status,
    current_day: adjustData.status === "completed" ? 7 : adjustData.currentDay,
    current_stage: adjustData.status === "completed" ? 3 : adjustData.currentStage,
    stage_attempt: adjustData.stageAttempt ?? Math.max(1, Number(existingTraining?.stage_attempt ?? 1)),
    completed_days: nextCompletedDays,
    failed_stage_attempts: existingTraining?.failed_stage_attempts ?? {},
    next_day_unlock_at: adjustData.status === "completed" ? null : existingTraining?.next_day_unlock_at ?? null,
    last_completed_at: existingTraining?.last_completed_at ?? null,
    completed_at: adjustData.status === "completed" ? existingTraining?.completed_at ?? now : null,
    reward_transaction_id: rewardTransactionId,
    task_unlock_at: adjustData.status === "completed" ? existingTraining?.task_unlock_at ?? now : null,
    task_unlock_accelerated: Boolean(existingTraining?.task_unlock_accelerated),
  };

  const { error: upsertError } = await (admin.from("training_progress" as never) as any)
    .upsert(payload, { onConflict: "user_id" });

  if (upsertError) {
    return NextResponse.json({ error: "Failed to update training progress" }, { status: 500 });
  }

  await auditLog({
    adminId: adminAuthId!,
    action: "training_progress_adjusted",
    entityType: "training_progress",
    entityId: userId,
    before,
    after: payload,
    reason: parsed.data.reason ?? "Admin adjusted training progress",
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ ok: true });
}
