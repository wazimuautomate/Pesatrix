import { getPlatformSetting } from "./platform-settings";
import {
  DEFAULT_REFERRAL_ACTIVATION_RULE,
  DEFAULT_REFERRAL_LEVEL_REWARDS,
  DEFAULT_REFERRAL_MAX_LEVELS,
  getReferralRewardForLevel,
  type ReferralActivationRule,
} from "./referral-program-utils";

export const REFERRAL_MAX_LEVELS_KEY = "referral_max_levels";
export const REFERRAL_ACTIVATION_RULE_KEY = "referral_activation_rule";
export const REFERRAL_LEVEL_1_REWARD_KEY = "referral_level_1_reward_ksh";
export const REFERRAL_LEVEL_2_REWARD_KEY = "referral_level_2_reward_ksh";
export const REFERRAL_LEVEL_3_REWARD_KEY = "referral_level_3_reward_ksh";

export type ReferralProgramSettings = {
  activationRule: ReferralActivationRule;
  maxLevels: 1 | 2 | 3;
  rewards: Record<1 | 2 | 3, number>;
  levels: Array<{ level: 1 | 2 | 3; amount: number }>;
};

function normalizeReward(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 100000) {
    return fallback;
  }
  return parsed;
}

function normalizeMaxLevels(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3) {
    return DEFAULT_REFERRAL_MAX_LEVELS as 1 | 2 | 3;
  }
  return parsed as 1 | 2 | 3;
}

function normalizeActivationRule(value: unknown): ReferralActivationRule {
  return value === DEFAULT_REFERRAL_ACTIVATION_RULE
    ? DEFAULT_REFERRAL_ACTIVATION_RULE
    : DEFAULT_REFERRAL_ACTIVATION_RULE;
}

export async function getReferralProgramSettings(): Promise<ReferralProgramSettings> {
  const [maxLevelsSetting, activationRuleSetting, level1Setting, level2Setting, level3Setting] = await Promise.all([
    getPlatformSetting(REFERRAL_MAX_LEVELS_KEY),
    getPlatformSetting(REFERRAL_ACTIVATION_RULE_KEY),
    getPlatformSetting(REFERRAL_LEVEL_1_REWARD_KEY),
    getPlatformSetting(REFERRAL_LEVEL_2_REWARD_KEY),
    getPlatformSetting(REFERRAL_LEVEL_3_REWARD_KEY),
  ]);

  const maxLevels = normalizeMaxLevels(maxLevelsSetting?.value);
  const rewards: Record<1 | 2 | 3, number> = {
    1: normalizeReward(level1Setting?.value, DEFAULT_REFERRAL_LEVEL_REWARDS[1]),
    2: normalizeReward(level2Setting?.value, DEFAULT_REFERRAL_LEVEL_REWARDS[2]),
    3: normalizeReward(level3Setting?.value, DEFAULT_REFERRAL_LEVEL_REWARDS[3]),
  };

  return {
    activationRule: normalizeActivationRule(activationRuleSetting?.value),
    maxLevels,
    rewards,
    levels: ([1, 2, 3] as const)
      .filter((level) => level <= maxLevels)
      .map((level) => ({ level, amount: rewards[level] })),
  };
}

export { getReferralRewardForLevel };
