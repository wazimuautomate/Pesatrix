import test from "node:test";
import assert from "node:assert/strict";

const {
  DEFAULT_REFERRAL_REWARD_KSH,
} = await import("./referral-program-utils" + ".ts");

test("default referral reward is fixed at KSh 100", () => {
  assert.equal(DEFAULT_REFERRAL_REWARD_KSH, 100);
});
