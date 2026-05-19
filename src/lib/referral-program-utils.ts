export const DEFAULT_REFERRAL_MAX_LEVELS = 3;
export const DEFAULT_REFERRAL_ACTIVATION_RULE = "activation_paid";
export const DEFAULT_REFERRAL_LEVEL_REWARDS = {
  1: 100,
  2: 50,
  3: 25,
} as const;

export type ReferralActivationRule = typeof DEFAULT_REFERRAL_ACTIVATION_RULE;

export type ReferralProgramSettingsShape = {
  activationRule: ReferralActivationRule;
  maxLevels: 1 | 2 | 3;
  rewards: Record<1 | 2 | 3, number>;
};

export function getReferralRewardForLevel(
  settings: ReferralProgramSettingsShape,
  level: number
) {
  if (level < 1 || level > settings.maxLevels) {
    return 0;
  }

  return settings.rewards[level as 1 | 2 | 3] ?? 0;
}
