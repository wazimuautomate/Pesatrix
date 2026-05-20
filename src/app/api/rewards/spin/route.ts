import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getAccountProgressSnapshot,
  mergeAccountMetadata,
  resolveAccountFlags,
} from "@/lib/account-progress";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getWalletSummaryForUser } from "@/lib/wallet";

const FREE_REFERENCE = "daily_rewards_free";
const PAID_REFERENCE = "daily_rewards_paid";
const PAID_SPIN_COST = 50;
const MAX_FREE_SPINS_PER_DAY = 2;
const MAX_PAID_SPINS_PER_DAY = 8;

const FREE_REWARDS = [
  { label: "Miss", amount: 0, weight: 12 },
  { label: "KSh 5", amount: 5, weight: 15 },
  { label: "KSh 10", amount: 10, weight: 24 },
  { label: "KSh 15", amount: 15, weight: 19 },
  { label: "KSh 20", amount: 20, weight: 13 },
  { label: "KSh 25", amount: 25, weight: 10 },
  { label: "KSh 40", amount: 40, weight: 7 },
] as const;

const PAID_REWARDS = [
  { label: "x0", amount: 0, weight: 24 },
  { label: "x1", amount: 50, weight: 24 },
  { label: "x2", amount: 100, weight: 18 },
  { label: "x3", amount: 150, weight: 8 },
  { label: "x4", amount: 200, weight: 4 },
] as const;

type SpinMode = "free" | "paid";

const spinRequestSchema = z.object({
  mode: z.enum(["free", "paid"]).optional(),
  adConfirmed: z.boolean().optional(),
});

type RewardTransactionRow = {
  id: string;
  amount: number;
  created_at: string;
  description: string | null;
  reference_table: string | null;
  direction: string | null;
};

function startOfUtcDayIso(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString();
}

function nextUtcDayIso(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1)).toISOString();
}

function dateStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function previousDateStamp(date = new Date()) {
  const previous = new Date(date.getTime() - 86400000);
  return dateStamp(previous);
}

function weightedPick<T extends { weight: number }>(pool: readonly T[]) {
  const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
  let ticket = randomInt(totalWeight);

  for (const item of pool) {
    if (ticket < item.weight) {
      return item;
    }
    ticket -= item.weight;
  }

  return pool[pool.length - 1];
}

function chooseReward(mode: SpinMode, consecutiveSmallWins: number) {
  const pool =
    mode === "paid"
      ? consecutiveSmallWins >= 2
        ? [
            { label: "x0", amount: 0, weight: 44 },
            { label: "x1", amount: 50, weight: 27 },
            { label: "x2", amount: 100, weight: 18 },
            { label: "x3", amount: 150, weight: 8 },
            { label: "x4", amount: 200, weight: 3 },
          ]
        : PAID_REWARDS
      : consecutiveSmallWins >= 2
        ? [
            { label: "Miss", amount: 0, weight: 48 },
            { label: "KSh 5", amount: 5, weight: 18 },
            { label: "KSh 10", amount: 10, weight: 18 },
            { label: "KSh 15", amount: 15, weight: 10 },
            { label: "KSh 20", amount: 20, weight: 6 },
          ]
        : FREE_REWARDS;

  return weightedPick(pool);
}

function buildVisualStop(reward: { label: string; amount: number }) {
  return {
    wheelLabel: reward.label,
    nearMissLabel: null,
  };
}

function summarizeDailyTransactions(rows: RewardTransactionRow[]) {
  const freeRewards = rows.filter(
    (row) => row.reference_table === FREE_REFERENCE && row.direction === "credit"
  );
  const paidRewards = rows.filter(
    (row) => row.reference_table === PAID_REFERENCE && row.direction === "credit"
  );
  const paidCharges = rows.filter(
    (row) => row.reference_table === PAID_REFERENCE && row.direction === "debit"
  );

  return {
    freeSpinsUsed: freeRewards.length,
    paidSpinsUsed: paidCharges.length,
    latestFreeReward: freeRewards[0] ?? null,
    latestPaidReward: paidRewards[0] ?? null,
  };
}

function errorResponse(message: string, code: string, status = 400) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status }
  );
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }

    const admin = createAdminSupabaseClient();
    const todayStart = startOfUtcDayIso();

    const [{ data: profile }, { data: accountStatus }, { data: activationPayment }, { data: rewardRows }, walletSummary] =
      await Promise.all([
        (admin.from("profiles" as never) as any)
          .select("metadata")
          .eq("id", user.id)
          .maybeSingle(),
        (admin.from("account_status" as never) as any)
          .select("state, status, is_activated, is_setup_complete")
          .eq("user_id", user.id)
          .maybeSingle(),
        (admin.from("activation_payments" as never) as any)
          .select("id, status")
          .eq("user_id", user.id)
          .eq("status", "paid")
          .maybeSingle(),
        (admin.from("wallet_transactions" as never) as any)
          .select("id, amount, created_at, description, reference_table, direction")
          .eq("user_id", user.id)
          .in("reference_table", [FREE_REFERENCE, PAID_REFERENCE])
          .gte("created_at", todayStart)
          .order("created_at", { ascending: false }),
        getWalletSummaryForUser(user.id),
      ]);

    const accountFlags = resolveAccountFlags(accountStatus);
    const hasPaidActivation = Boolean(activationPayment?.status === "paid");
    const activated = accountFlags.activated || hasPaidActivation;
    const progress = getAccountProgressSnapshot(profile?.metadata);
    const today = summarizeDailyTransactions((rewardRows ?? []) as RewardTransactionRow[]);

    return NextResponse.json({
      activated: activated,
      wallet: walletSummary,
      rewardState: progress.rewards,
      free: {
        canSpin: activated && today.freeSpinsUsed < MAX_FREE_SPINS_PER_DAY,
        spinsUsed: today.freeSpinsUsed,
        spinsRemaining: Math.max(0, MAX_FREE_SPINS_PER_DAY - today.freeSpinsUsed),
        nextSpinAt: today.freeSpinsUsed >= MAX_FREE_SPINS_PER_DAY ? nextUtcDayIso() : null,
        latestReward: today.latestFreeReward,
      },
      paid: {
        enabled: true,
        cost: PAID_SPIN_COST,
        canSpin:
          activated &&
          walletSummary.available >= PAID_SPIN_COST &&
          today.paidSpinsUsed < MAX_PAID_SPINS_PER_DAY,
        spinsUsed: today.paidSpinsUsed,
        spinsRemaining: Math.max(0, MAX_PAID_SPINS_PER_DAY - today.paidSpinsUsed),
        latestReward: today.latestPaidReward,
      },
    });
  } catch (error) {
    console.error("[GET /api/rewards/spin]", error);
    return errorResponse("Failed to load reward status", "INTERNAL_ERROR", 500);
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }

    const parsed = spinRequestSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message ?? "Invalid reward spin request.", "VALIDATION_ERROR", 422);
    }
    const body = parsed.data;
    const mode: SpinMode = body.mode === "paid" ? "paid" : "free";

    const admin = createAdminSupabaseClient();
    const todayStart = startOfUtcDayIso();

    const [{ data: profile }, { data: accountStatus }, { data: rewardRows }, walletSummary] =
      await Promise.all([
        (admin.from("profiles" as never) as any)
          .select("metadata")
          .eq("id", user.id)
          .maybeSingle(),
        (admin.from("account_status" as never) as any)
          .select("state, status, is_activated, is_setup_complete")
          .eq("user_id", user.id)
          .maybeSingle(),
        (admin.from("wallet_transactions" as never) as any)
          .select("id, amount, created_at, description, reference_table, direction")
          .eq("user_id", user.id)
          .in("reference_table", [FREE_REFERENCE, PAID_REFERENCE])
          .gte("created_at", todayStart)
          .order("created_at", { ascending: false }),
        getWalletSummaryForUser(user.id),
      ]);

    const accountFlags = resolveAccountFlags(accountStatus);
    if (!accountFlags.activated) {
      return errorResponse("Activate your account before using the reward wheel.", "ACTIVATION_REQUIRED", 403);
    }

    const progress = getAccountProgressSnapshot(profile?.metadata);
    const today = summarizeDailyTransactions((rewardRows ?? []) as RewardTransactionRow[]);

    if (mode === "free") {
      if (!body.adConfirmed) {
        return errorResponse("Confirm the ad-based free spin before continuing.", "AD_CONFIRMATION_REQUIRED", 422);
      }

      if (today.freeSpinsUsed >= MAX_FREE_SPINS_PER_DAY) {
        return errorResponse("Today's free spins are finished. Try again after midnight UTC.", "FREE_SPIN_LIMIT", 409);
      }
    }

    if (mode === "paid") {
      if (today.paidSpinsUsed >= MAX_PAID_SPINS_PER_DAY) {
        return errorResponse("Today's paid spin limit has been reached.", "PAID_SPIN_LIMIT", 409);
      }

      if (walletSummary.available < PAID_SPIN_COST) {
        return errorResponse("Your available wallet balance is too low for a paid spin.", "INSUFFICIENT_BALANCE", 409);
      }
    }

    const reward = chooseReward(mode, progress.rewards.consecutiveSmallWins);
    const referenceTable = mode === "free" ? FREE_REFERENCE : PAID_REFERENCE;
    const nowIso = new Date().toISOString();

    if (mode === "paid") {
      const { error: debitError } = await (admin.from("wallet_transactions" as never) as any).insert({
        user_id: user.id,
        type: "reward",
        direction: "debit",
        amount: PAID_SPIN_COST,
        status: "available",
        bucket: "available",
        description: "Paid reward wheel spin cost",
        reference_table: referenceTable,
        available_at: nowIso,
      });

      if (debitError) {
        throw debitError;
      }
    }

    let rewardRow: RewardTransactionRow | null = null;
    if (reward.amount > 0) {
      const { data: insertedReward, error: creditError } = await (admin.from("wallet_transactions" as never) as any)
        .insert({
          user_id: user.id,
          type: "reward",
          direction: "credit",
          amount: reward.amount,
          status: "available",
          bucket: "available",
          description:
            mode === "free"
              ? `Free reward spin win: KSh ${reward.amount}`
              : `Paid reward spin win: KSh ${reward.amount}`,
          reference_table: referenceTable,
          available_at: nowIso,
        })
        .select("id, amount, created_at, description, reference_table, direction")
        .single();

      if (creditError) {
        throw creditError;
      }

      rewardRow = insertedReward as RewardTransactionRow;
    }

    const todayStamp = dateStamp();
    const shouldIncreaseStreak =
      mode === "free" &&
      progress.rewards.streakLastDate !== todayStamp &&
      (progress.rewards.streakLastDate === previousDateStamp() || progress.rewards.dailyStreak === 0);
    const shouldResetStreak =
      mode === "free" &&
      progress.rewards.streakLastDate !== null &&
      progress.rewards.streakLastDate !== todayStamp &&
      progress.rewards.streakLastDate !== previousDateStamp();

    const consecutiveSmallWins =
      reward.amount > 0 && reward.amount <= 50
        ? progress.rewards.consecutiveSmallWins + 1
        : 0;

    const nextMetadata = mergeAccountMetadata(profile?.metadata, {
      rewards: {
        ...progress.rewards,
        lastOutcomeAt: nowIso,
        streakLastDate: mode === "free" ? todayStamp : progress.rewards.streakLastDate,
        dailyStreak:
          mode === "free"
            ? shouldIncreaseStreak
              ? progress.rewards.dailyStreak + 1
              : shouldResetStreak
                ? 1
                : progress.rewards.dailyStreak || 1
            : progress.rewards.dailyStreak,
        consecutiveSmallWins,
      },
    });

    const { error: metadataError } = await (admin.from("profiles" as never) as any)
      .update({
        metadata: nextMetadata,
        updated_at: nowIso,
      })
      .eq("id", user.id);

    if (metadataError) {
      throw metadataError;
    }

    const refreshedWallet = await getWalletSummaryForUser(user.id);
    const visual = buildVisualStop(reward);

    return NextResponse.json({
      mode,
      outcome: {
        amount: reward.amount,
        label: reward.label,
        wheelLabel: visual.wheelLabel,
        nearMissLabel: visual.nearMissLabel,
      },
      reward: rewardRow,
      wallet: refreshedWallet,
      rewardState: getAccountProgressSnapshot(nextMetadata).rewards,
      nextSpinAt: mode === "free" ? nextUtcDayIso() : null,
      cost: mode === "paid" ? PAID_SPIN_COST : 0,
    });
  } catch (error) {
    console.error("[POST /api/rewards/spin]", error);
    return errorResponse("Failed to complete reward spin", "INTERNAL_ERROR", 500);
  }
}
