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

  if (!["requested", "held"].includes(withdrawal.status)) {
    return {
      ok: false as const,
      status: 409,
      code: "INVALID_STATE",
      message: "Only requested or held withdrawals can be approved for payout",
      withdrawal,
    };
  }

  const [{ data: accountStatus }, { data: reservedDebit }, { data: verification }] = await Promise.all([
    (admin.from("account_status" as never) as any)
      .select("status, state")
      .eq("user_id", withdrawal.user_id)
      .maybeSingle(),
    (admin.from("wallet_transactions" as never) as any)
      .select("id, amount, status, bucket")
      .eq("reference_table", "withdrawal_requests")
      .eq("reference_id", withdrawalId)
      .eq("direction", "debit")
      .eq("type", "withdrawal")
      .maybeSingle(),
    (admin.from("user_verification" as never) as any)
      .select("risk_score")
      .eq("user_id", withdrawal.user_id)
      .maybeSingle(),
  ]);

  if (
    accountStatus?.status === "banned" ||
    accountStatus?.state === "banned" ||
    accountStatus?.status === "suspended" ||
    accountStatus?.state === "suspended"
  ) {
    return {
      ok: false as const,
      status: 409,
      code: "ACCOUNT_BANNED",
      message: "Banned or suspended accounts cannot receive payouts",
      withdrawal,
    };
  }

  const riskScore = verification?.risk_score ? Number(verification.risk_score) : 0;
  if (riskScore >= 70) {
    return {
      ok: false as const,
      status: 409,
      code: "HIGH_RISK_ACCOUNT",
      message: "High risk accounts (risk score >= 70) cannot receive payouts",
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

  if (
    !reservedDebit ||
    reservedDebit.status !== "locked" ||
    Number(reservedDebit.amount ?? 0) < Number(withdrawal.amount ?? 0)
  ) {
    return {
      ok: false as const,
      status: 409,
      code: "WITHDRAWAL_NOT_RESERVED",
      message: "Withdrawal funds are not reserved correctly",
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

  if (!/^254[17]\d{8}$/.test(normalizedPhone)) {
    return {
      ok: false as const,
      status: 422,
      code: "INVALID_PHONE",
      message: "Withdrawal phone must be a valid Kenyan M-Pesa number",
      withdrawal,
    };
  }

  const before = await (admin.from("withdrawal_requests" as never) as any)
    .select("*")
    .eq("id", withdrawalId)
    .maybeSingle();

  const initiatedAt = new Date().toISOString();

  const { data: lockedWithdrawal, error: lockError } = await (admin.from("withdrawal_requests" as never) as any)
    .update({
      status: "processing",
      b2c_initiated_at: initiatedAt,
      failure_reason: null,
    })
    .eq("id", withdrawalId)
    .in("status", ["requested", "held"])
    .select("id")
    .maybeSingle();

  if (lockError || !lockedWithdrawal) {
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
      remarks: `Withdrawal payout ${withdrawalId}`,
      occasion: withdrawalId,
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
        processed_at: new Date().toISOString(),
      })
      .eq("id", withdrawalId);

    await (admin.from("wallet_transactions" as never) as any)
      .update({ status: "reversed", bucket: "locked" })
      .eq("reference_table", "withdrawal_requests")
      .eq("reference_id", withdrawalId)
      .eq("direction", "debit");

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
