import { FINANCIAL_LIMITS, MIN_TASK_PAYOUT_KSH } from "@/lib/constants";
import {
  getRemainingTaskBatchBudget,
  getTaskBatchValue,
  validateTaskFinancials,
} from "@/lib/financial-limits";

type TaskFinancialHintProps = {
  payoutValue: number | string;
  totalSlotsValue: number | string;
};

export function TaskFinancialHint({ payoutValue, totalSlotsValue }: TaskFinancialHintProps) {
  const payoutKsh = Number(payoutValue || 0);
  const totalSlots = Number(totalSlotsValue || 0);
  const batchValue = getTaskBatchValue(payoutKsh, totalSlots);
  const remainingBudget = getRemainingTaskBatchBudget(
    payoutKsh,
    totalSlots,
    FINANCIAL_LIMITS.MAX_TASK_BATCH_VALUE_KSH
  );
  const financialError =
    payoutKsh > 0 && totalSlots > 0
      ? validateTaskFinancials({
          payoutKsh,
          totalSlots,
        })
      : null;

  return (
    <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium text-navy">Task budget</span>
        <span className={remainingBudget < 0 ? "font-semibold text-destructive" : "text-muted-foreground"}>
          Batch value: KSh {Number.isFinite(batchValue) ? batchValue.toLocaleString("en-KE") : 0} /{" "}
          {FINANCIAL_LIMITS.MAX_TASK_BATCH_VALUE_KSH.toLocaleString("en-KE")}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Min payout KSh {MIN_TASK_PAYOUT_KSH} | Max payout KSh {FINANCIAL_LIMITS.MAX_TASK_PAYOUT_KSH} | Remaining budget:{" "}
        KSh {Number.isFinite(remainingBudget) ? Math.max(remainingBudget, 0).toLocaleString("en-KE") : 0}
      </p>
      {financialError ? (
        <p className="mt-2 text-xs font-medium text-destructive">{financialError.message}</p>
      ) : null}
    </div>
  );
}
