import assert from "node:assert/strict";
import test from "node:test";

const { computeWalletSummary } = await import("../src/lib/wallet-math.ts");
const {
  isAllowedWithdrawalPhone,
  normalizeWithdrawalStoragePhone,
} = await import("../src/lib/withdrawal-utils.ts");

test("computeWalletSummary subtracts only finalized withdrawal debits from available balance", () => {
  const summary = computeWalletSummary([
    {
      amount: 1200,
      bucket: "available",
      direction: "credit",
      status: "available",
      type: "task_earning",
    },
    {
      amount: 300,
      bucket: "available",
      direction: "debit",
      status: "locked",
      type: "withdrawal",
    },
    {
      amount: 100,
      bucket: "available",
      direction: "debit",
      status: "available",
      type: "withdrawal",
    },
    {
      amount: 150,
      bucket: "pending",
      direction: "credit",
      status: "pending",
      type: "task_earning",
    },
  ]);

  assert.equal(summary.available, 1100);
  assert.equal(summary.pending, 150);
});

test("computeWalletSummary ignores non-finalized debits until payout success", () => {
  const summary = computeWalletSummary([
    {
      amount: 200,
      bucket: "available",
      direction: "credit",
      status: "locked",
    },
    {
      amount: 75,
      bucket: "available",
      direction: "debit",
      status: "locked",
    },
  ]);

  assert.equal(summary.available, 200);
});

test("normalizeWithdrawalStoragePhone forces +254 format for stored withdrawal numbers", () => {
  assert.equal(normalizeWithdrawalStoragePhone("0712345678"), "+254712345678");
  assert.equal(normalizeWithdrawalStoragePhone("254712345678"), "+254712345678");
  assert.equal(normalizeWithdrawalStoragePhone("0111327204"), "+254111327204");
  assert.equal(normalizeWithdrawalStoragePhone("254111327204"), "+254111327204");
  assert.throws(() => normalizeWithdrawalStoragePhone("0611327204"));
});

test("isAllowedWithdrawalPhone matches the saved account phone only", () => {
  assert.equal(isAllowedWithdrawalPhone("0712345678", "+254712345678"), true);
  assert.equal(isAllowedWithdrawalPhone("+254712345678", "+254712345678"), true);
  assert.equal(isAllowedWithdrawalPhone("0111327204", "+254111327204"), true);
  assert.equal(isAllowedWithdrawalPhone("0799999999", "+254712345678"), false);
});
