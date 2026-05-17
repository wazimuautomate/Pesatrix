import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { DAILY_TASK_LIMIT_KEY } from "@/lib/platform-setting-keys";

export const TRAINING_UNLOCK_SETTING_KEY = "training_day_unlock_minutes";
export const DEFAULT_TRAINING_UNLOCK_MINUTES = 1;

export const TRAINING_REWARD_SETTING_KEY = "training_completion_reward_ksh";
export const DEFAULT_TRAINING_REWARD_KSH = 100;

export const TASK_UNLOCK_DELAY_HOURS_KEY = "task_unlock_delay_hours";
export const DEFAULT_TASK_UNLOCK_DELAY_HOURS = 24;

export const REFERRAL_TASK_UNLOCK_REDUCTION_KEY = "referral_task_unlock_reduction";
export const DEFAULT_REFERRAL_TASK_UNLOCK_REDUCTION = 0.5;

export const DEFAULT_DAILY_TASK_LIMIT = 3;
export { DAILY_TASK_LIMIT_KEY };

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
  return normalizeNonNegativeNumber(setting?.value, DEFAULT_TRAINING_REWARD_KSH);
}

export async function getTaskUnlockDelayHours() {
  const setting = await getPlatformSetting(TASK_UNLOCK_DELAY_HOURS_KEY);
  return normalizePositiveInteger(setting?.value, DEFAULT_TASK_UNLOCK_DELAY_HOURS);
}

export async function getReferralTaskUnlockReduction() {
  const setting = await getPlatformSetting(REFERRAL_TASK_UNLOCK_REDUCTION_KEY);
  return normalizeNonNegativeNumber(setting?.value, DEFAULT_REFERRAL_TASK_UNLOCK_REDUCTION);
}

export async function getDailyTaskLimit() {
  const setting = await getPlatformSetting(DAILY_TASK_LIMIT_KEY);
  const limit = normalizePositiveInteger(setting?.value, DEFAULT_DAILY_TASK_LIMIT);
  return Math.min(limit, 100);
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
