import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getMinWithdrawalKsh, getWithdrawalProcessingDays } from "@/lib/platform-settings";
import { WITHDRAWALS_ENABLED_KEY } from "@/lib/platform-setting-keys";
import {
  buildWithdrawalWebhookPayload,
  getWithdrawalContactForUser,
  getWithdrawalFeeAmount,
  isAllowedWithdrawalPhone,
  normalizeWithdrawalStoragePhone,
  sendWithdrawalWebhook,
} from "@/lib/withdrawals";

function withdrawalError(code: string, message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

export async function POST(request: Request) {
  const admin = createAdminSupabaseClient();

  try {
    const body = await request.json();
    const { amount, phone: rawPhone } = body;

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return withdrawalError("UNAUTHORIZED", "Unauthorized", 401);
    }

    if (typeof amount !== "number" || Number.isNaN(amount) || amount <= 0) {
      return withdrawalError("VALIDATION_ERROR", "Invalid amount value", 422);
    }

    const { data: enabledSetting } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", WITHDRAWALS_ENABLED_KEY)
      .maybeSingle();

    if (enabledSetting?.value === "false") {
      return withdrawalError(
        "WITHDRAWALS_DISABLED",
        "Due to high traffic on our servers, withdrawal has been disabled. Try again later.",
        503
      );
    }

    // This is intentionally not an activation or verification gate. Users do
    // not need phone/email verification or an exact "active" status label to
    // request payout of available wallet funds.
    const { data: accountStatus, error: statusError } = await admin
      .from("account_status")
      .select("status, state")
      .eq("user_id", user.id)
      .maybeSingle();

    if (statusError) {
      return withdrawalError("ACCOUNT_NOT_ELIGIBLE", "Account not eligible for withdrawal", 403);
    }

    if (
      accountStatus?.status === "banned" ||
      accountStatus?.state === "banned" ||
      accountStatus?.status === "suspended" ||
      accountStatus?.state === "suspended"
    ) {
      return withdrawalError("ACCOUNT_SUSPENDED", "This account is suspended or banned and cannot request withdrawals", 403);
    }

    const { data: verification, error: verificationError } = await admin
      .from("user_verification")
      .select("risk_score")
      .eq("user_id", user.id)
      .maybeSingle();

    if (verificationError) {
      return withdrawalError("ACCOUNT_NOT_ELIGIBLE", "Failed to verify account risk status", 403);
    }

    const riskScore = verification?.risk_score ? Number(verification.risk_score) : 0;
    if (riskScore >= 70) {
      return withdrawalError(
        "HIGH_RISK_ACCOUNT",
        "Your withdrawal request cannot be processed due to elevated account risk indicators. Please contact support.",
        403
      );
    }

    const [minAmount, withdrawalFee, withdrawalProcessingDays, contact] = await Promise.all([
      getMinWithdrawalKsh(),
      getWithdrawalFeeAmount(),
      getWithdrawalProcessingDays(),
      getWithdrawalContactForUser(user.id),
    ]);

    if (minAmount === null) {
      return withdrawalError(
        "CONFIGURATION_ERROR",
        "Withdrawals are currently unavailable. Please contact support.",
        503
      );
    }

    if (amount < minAmount) {
      return withdrawalError("BELOW_MINIMUM", `Minimum withdrawal amount is KSh ${minAmount}`, 422, {
        minimum: minAmount,
      });
    }

    const amountToReceive = amount - withdrawalFee;
    if (amountToReceive <= 0) {
      return withdrawalError(
        "FEE_EXCEEDS_AMOUNT",
        "Withdrawal amount must be greater than the processing fee",
        422
      );
    }

    const { data: pendingRequests, error: pendingError } = await admin
      .from("withdrawal_requests")
      .select("id")
      .eq("user_id", user.id)
      .in("status", ["requested", "processing", "held"]);

    if (pendingError || (pendingRequests && pendingRequests.length > 0)) {
      return withdrawalError(
        "ACTIVE_WITHDRAWAL_EXISTS",
        "You have a pending withdrawal. Wait for it to complete before requesting another.",
        409
      );
    }

    let phone: string;
    try {
      phone = normalizeWithdrawalStoragePhone(String(rawPhone || ""));
    } catch {
      return withdrawalError(
        "INVALID_PHONE",
        "Invalid M-Pesa phone number format. Use 07XXXXXXXX, 01XXXXXXXX, 2547XXXXXXXX, or 2541XXXXXXXX",
        422
      );
    }

    if (contact.phone && !isAllowedWithdrawalPhone(phone, contact.phone)) {
      return withdrawalError("PHONE_MISMATCH", "Withdrawals must use the M-Pesa number on your account", 422);
    }

    const { data: withdrawalRows, error: withdrawalCreateError } = await admin.rpc("create_withdrawal_request", {
      p_user_id: user.id,
      p_amount: amount,
      p_phone: phone,
      p_description: `Withdrawal to ${phone}`,
      p_fee_ksh: withdrawalFee,
      p_amount_after_fee: amountToReceive,
    });

    if (withdrawalCreateError) {
      const errorMessage = String(withdrawalCreateError.message ?? "");

      if (errorMessage.includes("ACTIVE_WITHDRAWAL_EXISTS") || withdrawalCreateError.code === "23505") {
        return withdrawalError(
          "ACTIVE_WITHDRAWAL_EXISTS",
          "You have a pending withdrawal. Wait for it to complete before requesting another.",
          409
        );
      }

      if (errorMessage.includes("INSUFFICIENT_FUNDS")) {
        return withdrawalError("INSUFFICIENT_BALANCE", "Insufficient available balance", 422);
      }

      if (errorMessage.includes("INVALID_PHONE")) {
        return withdrawalError(
          "INVALID_PHONE",
          "Invalid M-Pesa phone number format. Use 07XXXXXXXX, 01XXXXXXXX, 2547XXXXXXXX, or 2541XXXXXXXX",
          422
        );
      }

      if (errorMessage.includes("FEE_EXCEEDS_AMOUNT")) {
        return withdrawalError(
          "FEE_EXCEEDS_AMOUNT",
          "Withdrawal amount must be greater than the processing fee",
          422
        );
      }

      throw new Error(withdrawalCreateError.message || "Failed to create withdrawal request");
    }

    const withdrawalRow = Array.isArray(withdrawalRows) ? withdrawalRows[0] : withdrawalRows;
    if (!withdrawalRow?.id) {
      throw new Error("Failed to create withdrawal request");
    }

    const createdAt = withdrawalRow.created_at ?? new Date().toISOString();
    sendWithdrawalWebhook(
      buildWithdrawalWebhookPayload({
        amountToReceive,
        createdAt,
        contact,
        feeKsh: withdrawalFee,
        phone,
        requestedAmount: amount,
      }),
      withdrawalRow.id
    ).catch((error) => {
      console.error("[POST /api/wallet/withdraw] Withdrawal webhook failed", {
        withdrawalId: withdrawalRow.id,
        error,
      });
    });

    return NextResponse.json({
      withdrawalId: withdrawalRow.id,
      status: withdrawalRow.status ?? "requested",
      amountRequested: amount,
      fee: withdrawalFee,
      amountToReceive,
      processingDays: withdrawalProcessingDays,
      message: `Withdrawal request received. Processing typically takes ${withdrawalProcessingDays} days.`,
    });
  } catch (error) {
    console.error("[POST /api/wallet/withdraw] Unexpected failure:", error);
    return withdrawalError(
      "INTERNAL_SERVER_ERROR",
      "An unexpected error occurred during processing. Please try again.",
      500
    );
  }
}
