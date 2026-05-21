import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { FINANCIAL_LIMITS } from "@/lib/constants";
import {
  ACTIVATION_FEE_KSH_KEY,
  DAILY_TASK_LIMIT_KEY,
  LEGACY_MIN_WITHDRAWAL_KSH_KEY,
  MAX_TASK_BATCH_VALUE_KSH_KEY,
  MAX_TASK_PAYOUT_KSH_KEY,
  MIN_WITHDRAWAL_KSH_KEY,
  REFERRAL_ACTIVATION_RULE_KEY,
  REFERRAL_LEVEL_1_REWARD_KEY,
  TRAINING_REWARD_SETTING_KEY,
  WITHDRAWAL_FEE_KSH_KEY,
  WITHDRAWAL_HOLD_DAYS_KEY,
  WITHDRAWAL_N8N_WEBHOOK_URL_KEY,
  WITHDRAWAL_PROCESSING_DAYS_KEY,
} from "@/lib/platform-setting-keys";

export const TRAINING_UNLOCK_SETTING_KEY = "training_day_unlock_minutes";
export const DEFAULT_TRAINING_UNLOCK_MINUTES = 1;

export {
  ACTIVATION_FEE_KSH_KEY,
  TRAINING_REWARD_SETTING_KEY,
  WITHDRAWAL_HOLD_DAYS_KEY,
  WITHDRAWAL_N8N_WEBHOOK_URL_KEY,
  WITHDRAWAL_PROCESSING_DAYS_KEY,
};
export const DEFAULT_TRAINING_REWARD_KSH = 50;
export const DEFAULT_WITHDRAWAL_HOLD_DAYS = 7;
export const DEFAULT_WITHDRAWAL_PROCESSING_DAYS = 3;

export const TASK_UNLOCK_DELAY_HOURS_KEY = "task_unlock_delay_hours";
export const DEFAULT_TASK_UNLOCK_DELAY_HOURS = 0;

export const REFERRAL_TASK_UNLOCK_REDUCTION_KEY = "referral_task_unlock_reduction";
export const DEFAULT_REFERRAL_TASK_UNLOCK_REDUCTION = 0.5;
export { DEFAULT_REFERRAL_ACTIVATION_RULE, DEFAULT_REFERRAL_REWARD_KSH } from "@/lib/referral-program-utils";

export const DEFAULT_DAILY_TASK_LIMIT = 3;
export { DAILY_TASK_LIMIT_KEY };
export {
  REFERRAL_ACTIVATION_RULE_KEY,
  REFERRAL_LEVEL_1_REWARD_KEY,
};

export type PlatformSetting = {
  key: string;
  value: string;
  description: string | null;
  updated_at?: string | null;
};

function normalizePositiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.floor(parsed);
}

function normalizeNonNegativeNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function normalizeReductionFraction(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  if (parsed <= 1) {
    return parsed;
  }

  if (parsed <= 100) {
    return parsed / 100;
  }

  return fallback;
}

function normalizeIntegerInRange(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return fallback;
  }

  return parsed;
}

function warnMissingSetting(key: string, fallback: number) {
  console.warn(`[PlatformSettings] Missing ${key}; using default ${fallback}`);
}

async function getFirstPlatformSetting(keys: string[]) {
  for (const key of keys) {
    const setting = await getPlatformSetting(key);
    if (setting) {
      return setting;
    }
  }

  return null;
}

function normalizeIntegerWithFloor(value: unknown, floor: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return floor;
  }

  return Math.max(parsed, floor);
}

function normalizeRequiredPositiveInteger(value: unknown, key: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`[PlatformSettings] ${key} must be a whole number of at least 1`);
  }

  return parsed;
}

export async function getPlatformSetting(key: string): Promise<PlatformSetting | null> {
  const admin = createAdminSupabaseClient();

  const { data, error } = await (admin.from("platform_settings" as never) as any)
    .select("key, value, description, updated_at")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    const message = `${error.message ?? ""} ${error.code ?? ""}`.toLowerCase();
    if (message.includes("platform_settings") || message.includes("schema cache")) {
      return null;
    }

    throw error;
  }

  return (data as PlatformSetting | null) ?? null;
}

export async function getTrainingDayUnlockMinutes() {
  const setting = await getPlatformSetting(TRAINING_UNLOCK_SETTING_KEY);
  return normalizePositiveInteger(setting?.value, DEFAULT_TRAINING_UNLOCK_MINUTES);
}

export async function getTrainingCompletionRewardKsh() {
  const setting = await getPlatformSetting(TRAINING_REWARD_SETTING_KEY);
  if (!setting) {
    warnMissingSetting(TRAINING_REWARD_SETTING_KEY, DEFAULT_TRAINING_REWARD_KSH);
  }

  return normalizeIntegerInRange(setting?.value, DEFAULT_TRAINING_REWARD_KSH, 0, 10000);
}

export async function getActivationFeeKsh() {
  const setting = await getPlatformSetting(ACTIVATION_FEE_KSH_KEY);
  if (!setting) {
    throw new Error(`[PlatformSettings] Missing required ${ACTIVATION_FEE_KSH_KEY}`);
  }

  return normalizeRequiredPositiveInteger(setting.value, ACTIVATION_FEE_KSH_KEY);
}

export async function getWithdrawalHoldDays() {
  const setting = await getPlatformSetting(WITHDRAWAL_HOLD_DAYS_KEY);
  if (!setting) {
    warnMissingSetting(WITHDRAWAL_HOLD_DAYS_KEY, DEFAULT_WITHDRAWAL_HOLD_DAYS);
  }

  return normalizeIntegerInRange(setting?.value, DEFAULT_WITHDRAWAL_HOLD_DAYS, 0, 30);
}

export async function getWithdrawalProcessingDays() {
  const setting = await getPlatformSetting(WITHDRAWAL_PROCESSING_DAYS_KEY);
  if (!setting) {
    warnMissingSetting(WITHDRAWAL_PROCESSING_DAYS_KEY, DEFAULT_WITHDRAWAL_PROCESSING_DAYS);
  }

  return normalizeNonNegativeNumber(setting?.value, DEFAULT_WITHDRAWAL_PROCESSING_DAYS);
}

export async function getTaskUnlockDelayHours() {
  const setting = await getPlatformSetting(TASK_UNLOCK_DELAY_HOURS_KEY);
  if (!setting) {
    warnMissingSetting(TASK_UNLOCK_DELAY_HOURS_KEY, DEFAULT_TASK_UNLOCK_DELAY_HOURS);
  }

  return normalizeNonNegativeNumber(setting?.value, DEFAULT_TASK_UNLOCK_DELAY_HOURS);
}

export async function getReferralTaskUnlockReduction() {
  const setting = await getPlatformSetting(REFERRAL_TASK_UNLOCK_REDUCTION_KEY);
  if (!setting) {
    warnMissingSetting(REFERRAL_TASK_UNLOCK_REDUCTION_KEY, DEFAULT_REFERRAL_TASK_UNLOCK_REDUCTION);
  }

  return normalizeReductionFraction(setting?.value, DEFAULT_REFERRAL_TASK_UNLOCK_REDUCTION);
}

export async function getDailyTaskLimit() {
  const setting = await getPlatformSetting(DAILY_TASK_LIMIT_KEY);
  const limit = normalizePositiveInteger(setting?.value, DEFAULT_DAILY_TASK_LIMIT);
  return Math.min(limit, 100);
}

export async function getMinWithdrawalKsh() {
  const setting = await getFirstPlatformSetting([MIN_WITHDRAWAL_KSH_KEY, LEGACY_MIN_WITHDRAWAL_KSH_KEY]);
  if (!setting) {
    warnMissingSetting(MIN_WITHDRAWAL_KSH_KEY, FINANCIAL_LIMITS.MIN_WITHDRAWAL_KSH);
  }

  return normalizeIntegerWithFloor(setting?.value, FINANCIAL_LIMITS.MIN_WITHDRAWAL_KSH);
}

export async function getWithdrawalFeeKsh() {
  const setting = await getPlatformSetting(WITHDRAWAL_FEE_KSH_KEY);
  if (!setting) {
    warnMissingSetting(WITHDRAWAL_FEE_KSH_KEY, FINANCIAL_LIMITS.WITHDRAWAL_FEE_KSH);
  }

  return normalizeIntegerWithFloor(setting?.value, FINANCIAL_LIMITS.WITHDRAWAL_FEE_KSH);
}

export async function getMaxTaskPayoutKsh() {
  const setting = await getPlatformSetting(MAX_TASK_PAYOUT_KSH_KEY);
  if (!setting) {
    warnMissingSetting(MAX_TASK_PAYOUT_KSH_KEY, FINANCIAL_LIMITS.MAX_TASK_PAYOUT_KSH);
  }

  return normalizeIntegerWithFloor(setting?.value, FINANCIAL_LIMITS.MAX_TASK_PAYOUT_KSH);
}

export async function getMaxTaskBatchValueKsh() {
  const setting = await getPlatformSetting(MAX_TASK_BATCH_VALUE_KSH_KEY);
  if (!setting) {
    warnMissingSetting(MAX_TASK_BATCH_VALUE_KSH_KEY, FINANCIAL_LIMITS.MAX_TASK_BATCH_VALUE_KSH);
  }

  return normalizeIntegerWithFloor(setting?.value, FINANCIAL_LIMITS.MAX_TASK_BATCH_VALUE_KSH);
}

export async function upsertPlatformSetting({
  key,
  value,
  description,
  updatedBy,
}: {
  key: string;
  value: string;
  description?: string;
  updatedBy?: string | null;
}) {
  const admin = createAdminSupabaseClient();

  const { data, error } = await (admin.from("platform_settings" as never) as any)
    .upsert(
      {
        key,
        value,
        description: description ?? null,
        updated_by_admin_id: updatedBy ?? null,
      },
      { onConflict: "key" }
    )
    .select("key, value, description, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return data as PlatformSetting;
}
