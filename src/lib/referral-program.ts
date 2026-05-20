import { getPlatformSetting } from "./platform-settings";
import {
  DEFAULT_REFERRAL_ACTIVATION_RULE,
  DEFAULT_REFERRAL_REWARD_KSH,
  type ReferralActivationRule,
} from "./referral-program-utils";

export const REFERRAL_ACTIVATION_RULE_KEY = "referral_activation_rule";
export const REFERRAL_LEVEL_1_REWARD_KEY = "referral_level_1_reward_ksh";

export type ReferralProgramSettings = {
  activationRule: ReferralActivationRule;
  rewardAmount: number;
};

function normalizeActivationRule(value: unknown): ReferralActivationRule {
  return value === DEFAULT_REFERRAL_ACTIVATION_RULE
    ? DEFAULT_REFERRAL_ACTIVATION_RULE
    : DEFAULT_REFERRAL_ACTIVATION_RULE;
}

export async function getReferralProgramSettings(): Promise<ReferralProgramSettings> {
  const [activationRuleSetting] = await Promise.all([
    getPlatformSetting(REFERRAL_ACTIVATION_RULE_KEY),
  ]);

  return {
    activationRule: normalizeActivationRule(activationRuleSetting?.value),
    rewardAmount: DEFAULT_REFERRAL_REWARD_KSH,
  };
}
