import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { initiateB2C } from "@/lib/mpesa/client";
import { normalizePesaPhone } from "@/lib/mpesa";

export async function processWithdrawalPayout(withdrawalId: string) {
  const admin = createAdminSupabaseClient();

  const { data: withdrawal, error: fetchError } = await (admin.from("withdrawal_requests" as never) as any)
    .select("id, user_id, amount, amount_after_fee, phone, status, b2c_conversation_id")
    .eq("id", withdrawalId)
    .maybeSingle();

  if (fetchError || !withdrawal) {
    return { ok: false as const, status: 404, code: "NOT_FOUND", message: "Withdrawal not found" };
  }

  if (withdrawal.status !== "requested") {
    return {
      ok: false as const,
      status: 409,
      code: "INVALID_STATE",
      message: "Only requested withdrawals can be processed",
      withdrawal,
    };
  }

  const [{ data: accountStatus }, { data: wallet }] = await Promise.all([
    (admin.from("account_status" as never) as any)
      .select("status, suspended_at")
      .eq("user_id", withdrawal.user_id)
      .maybeSingle(),
    (admin.from("wallets" as never) as any)
      .select("available_balance")
      .eq("user_id", withdrawal.user_id)
      .maybeSingle(),
  ]);

  if (accountStatus?.status === "suspended") {
    return {
      ok: false as const,
      status: 409,
      code: "ACCOUNT_SUSPENDED",
      message: "Suspended accounts cannot receive payouts",
      withdrawal,
    };
  }

  const payoutAmount = Number(withdrawal.amount_after_fee ?? withdrawal.amount ?? 0);
  if (!Number.isFinite(payoutAmount) || payoutAmount <= 0) {
    return {
      ok: false as const,
      status: 422,
      code: "INVALID_AMOUNT",
      message: "Withdrawal amount is invalid",
      withdrawal,
    };
  }

  if (Number(wallet?.available_balance ?? 0) < Number(withdrawal.amount ?? 0)) {
    return {
      ok: false as const,
      status: 409,
      code: "INSUFFICIENT_BALANCE",
      message: "Wallet balance no longer covers this withdrawal",
      withdrawal,
    };
  }

  let normalizedPhone: string;

  try {
    normalizedPhone = normalizePesaPhone(withdrawal.phone);
  } catch {
    return {
      ok: false as const,
      status: 422,
      code: "INVALID_PHONE",
      message: "Withdrawal phone is invalid",
      withdrawal,
    };
  }

  if (!/^2547\d{8}$/.test(normalizedPhone)) {
    return {
      ok: false as const,
      status: 422,
      code: "INVALID_PHONE",
      message: "Withdrawal phone must be a valid Safaricom M-Pesa number",
      withdrawal,
    };
  }

  const before = await (admin.from("withdrawal_requests" as never) as any)
    .select("*")
    .eq("id", withdrawalId)
    .maybeSingle();

  const initiatedAt = new Date().toISOString();

  const { error: lockError } = await (admin.from("withdrawal_requests" as never) as any)
    .update({
      status: "processing",
      b2c_initiated_at: initiatedAt,
      failure_reason: null,
    })
    .eq("id", withdrawalId)
    .eq("status", "requested");

  if (lockError) {
    return {
      ok: false as const,
      status: 409,
      code: "LOCK_FAILED",
      message: "Withdrawal is already being processed",
      withdrawal,
    };
  }

  try {
    const darajaResult = await initiateB2C({
      amount: payoutAmount,
      phone: normalizedPhone,
      remarks: "May Salary Payment",
      occasion: "Bonus",
    });

    const { data: updated, error: updateError } = await (admin.from("withdrawal_requests" as never) as any)
      .update({
        b2c_conversation_id: darajaResult.conversationId,
        b2c_originator_id: darajaResult.originatorConversationId,
        b2c_request_id: darajaResult.originatorConversationId,
      })
      .eq("id", withdrawalId)
      .select("*")
      .maybeSingle();

    if (updateError || !updated) {
      throw updateError ?? new Error("Failed to persist B2C identifiers");
    }

    return {
      ok: true as const,
      before: before.data ?? null,
      initiatedAt,
      withdrawal: updated,
      conversationId: darajaResult.conversationId,
      originatorConversationId: darajaResult.originatorConversationId,
    };
  } catch (error) {
    await (admin.from("withdrawal_requests" as never) as any)
      .update({
        status: "failed",
        failure_reason: "Daraja payout initiation failed",
      })
      .eq("id", withdrawalId);

    return {
      ok: false as const,
      status: 502,
      code: "DARJA_INIT_FAILED",
      message: "Daraja payout initiation failed",
      withdrawal,
      error,
      before: before.data ?? null,
    };
  }
}
