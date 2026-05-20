import { FINANCIAL_LIMITS, MIN_TASK_PAYOUT_KSH } from "@/lib/constants";

export type TaskFinancialViolation =
  | {
      code: "PAYOUT_TOO_LOW";
      message: string;
    }
  | {
      code: "PAYOUT_TOO_HIGH";
      message: string;
    }
  | {
      code: "BATCH_VALUE_TOO_HIGH";
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
  const maxTaskPayoutKsh = input.maxTaskPayoutKsh ?? FINANCIAL_LIMITS.MAX_TASK_PAYOUT_KSH;
  const maxTaskBatchValueKsh = input.maxTaskBatchValueKsh ?? FINANCIAL_LIMITS.MAX_TASK_BATCH_VALUE_KSH;

  if (input.payoutKsh < minTaskPayoutKsh) {
    return {
      code: "PAYOUT_TOO_LOW",
      message: `Minimum task payout is KSh ${minTaskPayoutKsh}`,
    } satisfies TaskFinancialViolation;
  }

  if (input.payoutKsh > maxTaskPayoutKsh) {
    return {
      code: "PAYOUT_TOO_HIGH",
      message: `Maximum task payout is KSh ${maxTaskPayoutKsh}`,
    } satisfies TaskFinancialViolation;
  }

  if (getTaskBatchValue(input.payoutKsh, input.totalSlots) > maxTaskBatchValueKsh) {
    return {
      code: "BATCH_VALUE_TOO_HIGH",
      message: `Total task batch value cannot exceed KSh ${maxTaskBatchValueKsh}`,
    } satisfies TaskFinancialViolation;
  }

  return null;
}
