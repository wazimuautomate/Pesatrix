import { MIN_TASK_PAYOUT_KSH } from "@/lib/constants";

export type TaskFinancialViolation =
  | {
      code: "PAYOUT_TOO_LOW";
      message: string;
    };

export function calculateWithdrawalNetAmount(amount: number, feeKsh: number) {
  return amount - feeKsh;
}

export function getTaskBatchValue(payoutKsh: number, totalSlots: number) {
  return payoutKsh * totalSlots;
}

export function getRemainingTaskBatchBudget(payoutKsh: number, totalSlots: number, maxBatchValueKsh: number) {
  return maxBatchValueKsh - getTaskBatchValue(payoutKsh, totalSlots);
}

export function validateTaskFinancials(input: {
  payoutKsh: number;
  totalSlots: number;
  minTaskPayoutKsh?: number;
  maxTaskPayoutKsh?: number;
  maxTaskBatchValueKsh?: number;
}) {
  const minTaskPayoutKsh = input.minTaskPayoutKsh ?? MIN_TASK_PAYOUT_KSH;

  if (input.payoutKsh < minTaskPayoutKsh) {
    return {
      code: "PAYOUT_TOO_LOW",
      message: `Minimum task payout is KSh ${minTaskPayoutKsh}`,
    } satisfies TaskFinancialViolation;
  }

  return null;
}
