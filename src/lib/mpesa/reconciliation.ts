import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SYSTEM_ADMIN_ID } from "@/lib/fraud/riskScorer";

export async function reconcileStuckTransactions() {
  const admin = createAdminSupabaseClient();
  const thresholdIso = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const reconciledAt = new Date().toISOString();

  const [
    { data: stuckActivations, error: activationError },
    { data: stuckWithdrawals, error: withdrawalError },
  ] = await Promise.all([
    (admin.from("activation_payments" as never) as any)
      .select("id, user_id, checkout_request_id, created_at, status")
      .eq("status", "pending")
      .lt("created_at", thresholdIso),
    (admin.from("withdrawal_requests" as never) as any)
      .select("id, user_id, b2c_conversation_id, b2c_initiated_at, status")
      .eq("status", "processing")
      .lt("b2c_initiated_at", thresholdIso),
  ]);

  if (activationError) {
    throw activationError;
  }

  if (withdrawalError) {
    throw withdrawalError;
  }

  for (const payment of stuckActivations ?? []) {
    await (admin.from("activation_payments" as never) as any)
      .update({
        status: "failed",
        callback_validation_error: "reconciliation_timeout",
        stk_completed_at: reconciledAt,
      })
      .eq("id", payment.id)
      .eq("status", "pending");

    await (admin.from("audit_log" as never) as any).insert({
      admin_id: SYSTEM_ADMIN_ID,
      action: "activation_reconciliation_timeout",
      entity_type: "activation_payments",
      entity_id: payment.id,
      after_json: {
        checkout_request_id: payment.checkout_request_id,
        reconciled_at: reconciledAt,
      },
      reason: "Activation payment stuck in pending state for more than 30 minutes",
    });
  }

  for (const withdrawal of stuckWithdrawals ?? []) {
    await (admin.from("withdrawal_requests" as never) as any)
      .update({
        status: "held",
        last_reconciled_at: reconciledAt,
      })
      .eq("id", withdrawal.id)
      .eq("status", "processing");

    await (admin.from("audit_log" as never) as any).insert({
      admin_id: SYSTEM_ADMIN_ID,
      action: "b2c_reconciliation_hold",
      entity_type: "withdrawal_requests",
      entity_id: withdrawal.id,
      after_json: {
        b2c_conversation_id: withdrawal.b2c_conversation_id,
        reconciled_at: reconciledAt,
      },
      reason: "Withdrawal stuck in processing state for more than 30 minutes",
    });
  }

  return {
    stuckActivations: stuckActivations?.length ?? 0,
    stuckWithdrawals: stuckWithdrawals?.length ?? 0,
  };
}
