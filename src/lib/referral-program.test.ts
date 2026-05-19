import test from "node:test";
import assert from "node:assert/strict";

const {
  DEFAULT_REFERRAL_LEVEL_REWARDS,
  DEFAULT_REFERRAL_MAX_LEVELS,
  getReferralRewardForLevel,
} = await import("./referral-program-utils" + ".ts");

test("getReferralRewardForLevel returns configured amounts for supported levels", () => {
  const settings = {
    activationRule: "activation_paid" as const,
    maxLevels: DEFAULT_REFERRAL_MAX_LEVELS as 1 | 2 | 3,
    rewards: {
      1: DEFAULT_REFERRAL_LEVEL_REWARDS[1],
      2: DEFAULT_REFERRAL_LEVEL_REWARDS[2],
      3: DEFAULT_REFERRAL_LEVEL_REWARDS[3],
    },
    levels: [
      { level: 1 as const, amount: DEFAULT_REFERRAL_LEVEL_REWARDS[1] },
      { level: 2 as const, amount: DEFAULT_REFERRAL_LEVEL_REWARDS[2] },
      { level: 3 as const, amount: DEFAULT_REFERRAL_LEVEL_REWARDS[3] },
    ],
  };

  assert.equal(getReferralRewardForLevel(settings, 1), 100);
  assert.equal(getReferralRewardForLevel(settings, 2), 50);
  assert.equal(getReferralRewardForLevel(settings, 3), 25);
});

test("getReferralRewardForLevel returns zero outside the configured depth", () => {
  const settings = {
    activationRule: "activation_paid" as const,
    maxLevels: 2 as const,
    rewards: {
      1: 100,
      2: 50,
      3: 25,
    },
    levels: [
      { level: 1 as const, amount: 100 },
      { level: 2 as const, amount: 50 },
    ],
  };

  assert.equal(getReferralRewardForLevel(settings, 0), 0);
  assert.equal(getReferralRewardForLevel(settings, 3), 0);
});
