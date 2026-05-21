import { MIN_TASK_PAYOUT_KSH } from "@/lib/constants";
import { getTaskBatchValue, validateTaskFinancials } from "@/lib/financial-limits";

type TaskFinancialHintProps = {
  payoutValue: number | string;
  totalSlotsValue: number | string;
};

export function TaskFinancialHint({ payoutValue, totalSlotsValue }: TaskFinancialHintProps) {
  const payoutKsh = Number(payoutValue || 0);
  const totalSlots = Number(totalSlotsValue || 0);
  const batchValue = getTaskBatchValue(payoutKsh, totalSlots);
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
        <span className="text-muted-foreground">
          Batch value: KSh {Number.isFinite(batchValue) ? batchValue.toLocaleString("en-KE") : 0}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Min payout KSh {MIN_TASK_PAYOUT_KSH}. Admin-configured max payout and batch values are not enforced.
      </p>
      {financialError ? (
        <p className="mt-2 text-xs font-medium text-destructive">{financialError.message}</p>
      ) : null}
    </div>
  );
}
