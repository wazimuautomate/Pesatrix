import { createAdminSupabaseClient } from "../supabase/admin";
import { SYSTEM_ADMIN_ID } from "../fraud/riskScorer";

export async function finalizeWithdrawal(
  withdrawalId: string,
  outcome: "success" | "failure",
  meta: { transactionId?: string; resultCode?: number; rawPayload: object; resultDesc: string },
  customAdminClient?: any
) {
  const admin = customAdminClient || createAdminSupabaseClient();
  const nowIso = new Date().toISOString();

  // 1. Fetch the withdrawal_requests row by id using service role client.
  const { data: withdrawal, error: fetchError } = await admin
    .from("withdrawal_requests")
    .select("id, user_id, amount, amount_after_fee, status")
    .eq("id", withdrawalId)
    .maybeSingle();

  if (fetchError) {
    console.error(`[Finalize Withdrawal] Error fetching withdrawal request ${withdrawalId}:`, fetchError);
    throw fetchError;
  }

  if (!withdrawal) {
    console.warn(`[Finalize Withdrawal] Withdrawal request not found: ${withdrawalId}`);
    return;
  }

  // If already in terminal state (sent/failed), return early.
  if (withdrawal.status === "sent" || withdrawal.status === "failed") {
    console.log(`[Finalize Withdrawal] Withdrawal request ${withdrawalId} is already in terminal state: ${withdrawal.status}`);
    return;
  }

  // Fetch the locked debit transaction first to verify it exists
  const { data: existingDebit, error: debitFetchError } = await admin
    .from("wallet_transactions")
    .select("id, status")
    .eq("reference_table", "withdrawal_requests")
    .eq("reference_id", withdrawalId)
    .eq("direction", "debit")
    .eq("type", "withdrawal")
    .maybeSingle();

  if (debitFetchError) {
    console.error(`[Finalize Withdrawal] Error fetching wallet transactions for withdrawal ${withdrawalId}:`, debitFetchError);
    throw debitFetchError;
  }

  if (!existingDebit) {
    console.error(`[Finalize Withdrawal] CRITICAL INCONSISTENCY: wallet_transactions debit row is missing for withdrawal ${withdrawalId}`);
    // Do NOT mark withdrawal request as sent or failed, just return or throw to alert Vercel logs.
    return;
  }

  if (outcome === "success") {
    // 2. IF outcome === 'success':
    // a. Update the corresponding wallet_transactions row FIRST (to support retriable safe failure ordering)
    if (existingDebit.status === "locked") {
      const { error: walletError } = await admin
        .from("wallet_transactions")
        .update({
          status: "available", // marks the debit as finalized
          bucket: "available",
          updated_at: nowIso
        })
        .eq("id", existingDebit.id);

      if (walletError) {
        console.error(`[Finalize Withdrawal] Error finalizing debit wallet transaction ${existingDebit.id}:`, walletError);
        throw walletError;
      }
    }

    // b. Update withdrawal_requests SET status = 'sent'
    const { error: withdrawalUpdateError } = await admin
      .from("withdrawal_requests")
      .update({
        status: "sent",
        mpesa_txn_id: meta.transactionId ?? null,
        b2c_result_code: "0",
        b2c_result_desc: meta.resultDesc,
        b2c_raw_callback: meta.rawPayload as any,
        processed_at: nowIso,
        last_reconciled_at: nowIso,
        failure_reason: null
      })
      .eq("id", withdrawalId)
      .in("status", ["processing", "held"]);

    if (withdrawalUpdateError) {
      console.error(`[Finalize Withdrawal] Error updating withdrawal request status to sent for ${withdrawalId}:`, withdrawalUpdateError);
      throw withdrawalUpdateError;
    }

  } else {
    // 3. IF outcome === 'failure':
    // a. REVERSE the locked debit FIRST
    if (existingDebit.status === "locked") {
      const { error: walletError } = await admin
        .from("wallet_transactions")
        .update({
          status: "reversed",
          bucket: "locked",
          updated_at: nowIso
        })
        .eq("id", existingDebit.id);

      if (walletError) {
        console.error(`[Finalize Withdrawal] Error reversing debit wallet transaction ${existingDebit.id}:`, walletError);
        throw walletError;
      }
    }

    // Check if reversal row already exists to make it idempotent and prevent double-reversal
    const { data: existingReversal, error: reversalFetchError } = await admin
      .from("wallet_transactions")
      .select("id")
      .eq("reference_table", "withdrawal_requests")
      .eq("reference_id", withdrawalId)
      .eq("type", "reversal")
      .maybeSingle();

    if (reversalFetchError) {
      console.error(`[Finalize Withdrawal] Error checking for existing reversal row for withdrawal ${withdrawalId}:`, reversalFetchError);
      throw reversalFetchError;
    }

    if (!existingReversal) {
      // Then INSERT a new wallet_transactions credit reversal row
      const reversalAmount = withdrawal.amount_after_fee ?? withdrawal.amount ?? 0;
      const { error: insertError } = await admin
        .from("wallet_transactions")
        .insert({
          user_id: withdrawal.user_id,
          type: "reversal",
          direction: "credit",
          amount: reversalAmount,
          status: "available",
          bucket: "available",
          reference_table: "withdrawal_requests",
          reference_id: withdrawalId,
          description: `Withdrawal reversal: ${meta.resultDesc}`,
          available_at: nowIso
        });

      if (insertError) {
        console.error(`[Finalize Withdrawal] Error inserting wallet reversal transaction for ${withdrawalId}:`, insertError);
        throw insertError;
      }
    }

    // b. Update withdrawal_requests SET status = 'failed'
    const { error: withdrawalUpdateError } = await admin
      .from("withdrawal_requests")
      .update({
        status: "failed",
        failure_reason: meta.resultDesc,
        b2c_result_code: meta.resultCode ? String(meta.resultCode) : null,
        b2c_result_desc: meta.resultDesc,
        b2c_raw_callback: meta.rawPayload as any,
        processed_at: nowIso,
        last_reconciled_at: nowIso
      })
      .eq("id", withdrawalId)
      .in("status", ["processing", "held"]);

    if (withdrawalUpdateError) {
      console.error(`[Finalize Withdrawal] Error updating withdrawal request status to failed for ${withdrawalId}:`, withdrawalUpdateError);
      throw withdrawalUpdateError;
    }
  }

  // 4. Log to audit_log:
  let adminId = SYSTEM_ADMIN_ID;

  if (!adminId) {
    const { data: firstAdmin, error: firstAdminError } = await admin
      .from("admin_users")
      .select("user_id")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (!firstAdminError && firstAdmin) {
      adminId = firstAdmin.user_id;
    }
  }

  if (adminId) {
    const { error: auditError } = await admin
      .from("audit_log")
      .insert({
        admin_id: adminId,
        action: "b2c_callback_processed",
        entity_type: "withdrawal_requests",
        entity_id: withdrawalId,
        after_json: {
          outcome,
          resultCode: meta.resultCode ?? 0,
          transactionId: meta.transactionId ?? null
        } as any,
        reason: meta.resultDesc
      });

    if (auditError) {
      console.error(`[Finalize Withdrawal] Warning: Failed to insert audit log for withdrawal ${withdrawalId}:`, auditError);
    }
  } else {
    console.warn(`[Finalize Withdrawal] Warning: Skipping audit log insertion because no active admin ID was found`);
  }
}
