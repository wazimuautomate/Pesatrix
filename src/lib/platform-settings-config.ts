export type PlatformSettingCategory = "general" | "tasks" | "training" | "referral" | "withdrawals";

export type PlatformSettingDefinition = {
  key: string;
  value: string;
  description: string;
  category: PlatformSettingCategory;
  type?: "boolean" | "number" | "text";
  min?: number;
  max?: number;
  step?: string;
};

export const REQUIRED_PLATFORM_SETTINGS: PlatformSettingDefinition[] = [
  { key: "activation_fee_ksh", value: "500", description: "One-time M-Pesa activation fee charged before an account can access live earning features.", category: "general", type: "number", min: 1 },
  { key: "allow_new_registrations", value: "true", description: "Controls whether new user registrations are allowed.", category: "general", type: "boolean" },
  { key: "fraud_ai_mode", value: "manual", description: "Controls fraud AI scanning mode: auto, manual, or disabled.", category: "general", type: "text" },
  { key: "admin_sms_phone", value: "", description: "Admin phone number for SMS notifications (format: 07XXXXXXXX).", category: "general", type: "text" },

  { key: "daily_task_limit", value: "2", description: "Maximum number of tasks a user can submit per day.", category: "tasks", type: "number", min: 1, max: 100 },
  { key: "high_task_payout_threshold", value: "100", description: "Min payout KSh for a task to require community size gate.", category: "tasks", type: "number", min: 0 },
  { key: "high_task_referral_requirement", value: "5", description: "Activated referrals needed to access high-payout tasks.", category: "tasks", type: "number", min: 0 },
  { key: "max_task_batch_value_ksh", value: "500", description: "Maximum total payout value per task (payout x slots).", category: "tasks", type: "number", min: 0 },
  { key: "max_task_payout_ksh", value: "100", description: "Maximum payout per task slot in KSh.", category: "tasks", type: "number", min: 0 },

  { key: "task_unlock_delay_hours", value: "24", description: "Hours after training completion before task access is granted.", category: "training", type: "number", min: 0, step: "0.0001" },
  { key: "training_completion_reward_ksh", value: "50", description: "KSh reward credited when user completes 7-day training.", category: "training", type: "number", min: 0 },
  { key: "training_day_unlock_minutes", value: "1440", description: "Minutes users must wait before the next training step unlocks.", category: "training", type: "number", min: 0 },
  { key: "referral_task_unlock_reduction", value: "0.5", description: "Fraction of remaining timer reduced when referral activates during wait period.", category: "training", type: "number", min: 0, max: 100, step: "0.01" },

  { key: "referral_level_1_reward_ksh", value: "200", description: "KSh rewarded to referrer when a level-1 referee activates.", category: "referral", type: "number", min: 0 },

  { key: "min_withdrawal_amount_ksh", value: "50", description: "Minimum KSh available balance required to request withdrawal.", category: "withdrawals", type: "number", min: 0 },
  { key: "min_withdrawal_ksh", value: "200", description: "Minimum withdrawal amount in KSh.", category: "withdrawals", type: "number", min: 1 },
  { key: "withdrawal_fee_ksh", value: "50", description: "Flat fee deducted per withdrawal in KSh.", category: "withdrawals", type: "number", min: 0 },
  { key: "withdrawal_hold_days", value: "1", description: "Days a withdrawal is held before being processed.", category: "withdrawals", type: "number", min: 0, step: "any" },
  { key: "withdrawal_max_daily_amount", value: "200", description: "Max KSh a user can withdraw total per day.", category: "withdrawals", type: "number", min: 0 },
  { key: "withdrawal_max_daily_count", value: "2", description: "Max number of withdrawal requests per user per day.", category: "withdrawals", type: "number", min: 0 },
  { key: "withdrawal_max_single_amount", value: "1000", description: "Max KSh a user can withdraw in a single request.", category: "withdrawals", type: "number", min: 0 },
  { key: "withdrawal_min_amount", value: "200", description: "Minimum withdrawal amount in KSh. Must be set by admin before withdrawals are enabled.", category: "withdrawals", type: "number", min: 0 },
  { key: "withdrawal_n8n_webhook_url", value: "", description: "Optional n8n webhook URL triggered after a withdrawal request is created.", category: "withdrawals", type: "text" },
  { key: "withdrawal_processing_days", value: "1", description: "Days admin has to process a withdrawal after it is requested.", category: "withdrawals", type: "number", min: 0, step: "any" },
  { key: "withdrawals_enabled", value: "false", description: "Enable or disable all platform withdrawals (true/false).", category: "withdrawals", type: "boolean" },
];

export const PLATFORM_SETTING_CATEGORY_LABELS: Record<PlatformSettingCategory | "other", string> = {
  general: "General",
  tasks: "Tasks",
  training: "Training",
  referral: "Referral",
  withdrawals: "Withdrawals",
  other: "Other",
};

export function getPlatformSettingDefinition(key: string) {
  return REQUIRED_PLATFORM_SETTINGS.find((setting) => setting.key === key) ?? null;
}
