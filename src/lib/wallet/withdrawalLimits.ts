import type { SupabaseClient } from "@supabase/supabase-js";

import {
  HIGH_TASK_PAYOUT_THRESHOLD_KEY,
  HIGH_TASK_REFERRAL_REQUIREMENT_KEY,
  WITHDRAWAL_MAX_DAILY_AMOUNT_KEY,
  WITHDRAWAL_MAX_DAILY_COUNT_KEY,
  WITHDRAWAL_MAX_SINGLE_AMOUNT_KEY,
} from "@/lib/platform-setting-keys";

export const WITHDRAWAL_LIMIT_DEFAULTS = {
  maxSingleAmount: 500,
  maxDailyAmount: 1000,
  maxDailyCount: 1,
};

export const HIGH_TASK_DEFAULTS = {
  payoutThreshold: 100,
  referralRequirement: 5,
};

type LimitCode = "LIMIT_SINGLE" | "LIMIT_DAILY_AMOUNT" | "LIMIT_DAILY_COUNT";

export type WithdrawalLimitResult =
  | { allowed: true; todayCount: number; todayTotalAmount: number }
  | { allowed: false; code: LimitCode; message: string; todayCount: number; todayTotalAmount: number };

export async function checkWithdrawalLimits(
  userId: string,
  requestedAmount: number,
  supabaseAdmin: SupabaseClient | any
): Promise<WithdrawalLimitResult> {
  const settings = await getNumberSettings(
    supabaseAdmin,
    {
      [WITHDRAWAL_MAX_SINGLE_AMOUNT_KEY]: WITHDRAWAL_LIMIT_DEFAULTS.maxSingleAmount,
      [WITHDRAWAL_MAX_DAILY_AMOUNT_KEY]: WITHDRAWAL_LIMIT_DEFAULTS.maxDailyAmount,
      [WITHDRAWAL_MAX_DAILY_COUNT_KEY]: WITHDRAWAL_LIMIT_DEFAULTS.maxDailyCount,
    }
  );
  const startOfTodayUtc = new Date();
  startOfTodayUtc.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabaseAdmin
    .from("withdrawal_requests")
    .select("id, amount, status, created_at")
    .eq("user_id", userId)
    .gte("created_at", startOfTodayUtc.toISOString())
    .neq("status", "failed");

  if (error) {
    throw error;
  }

  const rows = data ?? [];
  const todayCount = rows.length;
  const todayTotalAmount = rows.reduce((sum: number, row: { amount?: number | string | null }) => {
    return sum + Number(row.amount ?? 0);
  }, 0);

  const maxSingleAmount = settings[WITHDRAWAL_MAX_SINGLE_AMOUNT_KEY];
  const maxDailyAmount = settings[WITHDRAWAL_MAX_DAILY_AMOUNT_KEY];
  const maxDailyCount = settings[WITHDRAWAL_MAX_DAILY_COUNT_KEY];

  if (requestedAmount > maxSingleAmount) {
    return {
      allowed: false,
      code: "LIMIT_SINGLE",
      message: `Maximum single withdrawal amount is KSh ${maxSingleAmount.toLocaleString("en-KE")}`,
      todayCount,
      todayTotalAmount,
    };
  }

  if (todayTotalAmount + requestedAmount > maxDailyAmount) {
    return {
      allowed: false,
      code: "LIMIT_DAILY_AMOUNT",
      message: `Daily withdrawal total is KSh ${maxDailyAmount.toLocaleString("en-KE")}`,
      todayCount,
      todayTotalAmount,
    };
  }

  if (todayCount >= maxDailyCount) {
    return {
      allowed: false,
      code: "LIMIT_DAILY_COUNT",
      message: `Daily withdrawal request limit is ${maxDailyCount.toLocaleString("en-KE")}`,
      todayCount,
      todayTotalAmount,
    };
  }

  return { allowed: true, todayCount, todayTotalAmount };
}

export async function getHighTaskGateSettings(supabaseAdmin: SupabaseClient | any) {
  const settings = await getNumberSettings(supabaseAdmin, {
    [HIGH_TASK_PAYOUT_THRESHOLD_KEY]: HIGH_TASK_DEFAULTS.payoutThreshold,
    [HIGH_TASK_REFERRAL_REQUIREMENT_KEY]: HIGH_TASK_DEFAULTS.referralRequirement,
  });

  return {
    payoutThreshold: settings[HIGH_TASK_PAYOUT_THRESHOLD_KEY],
    referralRequirement: settings[HIGH_TASK_REFERRAL_REQUIREMENT_KEY],
  };
}

export async function countActivatedReferrals(userId: string, supabaseAdmin: SupabaseClient | any) {
  const { data: referrals, error: referralError } = await supabaseAdmin
    .from("referrals")
    .select("referee_id")
    .eq("referrer_id", userId);

  if (referralError) {
    throw referralError;
  }

  const refereeIds = (referrals ?? [])
    .map((row: { referee_id?: string | null }) => row.referee_id)
    .filter(Boolean);

  if (refereeIds.length === 0) {
    return 0;
  }

  const { count, error } = await supabaseAdmin
    .from("account_status")
    .select("user_id", { count: "exact", head: true })
    .in("user_id", refereeIds)
    .eq("is_activated", true);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function getNumberSettings(
  supabaseAdmin: SupabaseClient | any,
  defaults: Record<string, number>
) {
  const keys = Object.keys(defaults);
  const { data, error } = await supabaseAdmin
    .from("platform_settings")
    .select("key, value")
    .in("key", keys);

  if (error) {
    throw error;
  }

  const values = { ...defaults };
  for (const row of data ?? []) {
    const parsed = Number(row.value);
    if (Number.isFinite(parsed) && parsed > 0) {
      values[row.key] = Math.floor(parsed);
    }
  }

  return values;
}
