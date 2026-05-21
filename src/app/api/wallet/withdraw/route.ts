import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { hasPaidActivationPayment } from "@/lib/activation";
import { KENYAN_PHONE_REGEX } from "@/lib/mpesa";
import {
  getWalletSummaryForUser,
  MAX_WITHDRAWAL_AMOUNT,
} from "@/lib/wallet";
import { getMinWithdrawalKsh, getWithdrawalProcessingDays } from "@/lib/platform-settings";
import {
  buildWithdrawalWebhookPayload,
  getWithdrawalFeeAmount,
  getWithdrawalContactForUser,
  isAllowedWithdrawalPhone,
  normalizeWithdrawalStoragePhone,
  sendWithdrawalWebhook,
} from "@/lib/withdrawals";
import { internalErrorResponse, rateLimitedResponse, unauthorizedResponse, validationErrorResponse } from "@/lib/api";
import { calculateWithdrawalNetAmount } from "@/lib/financial-limits";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const admin = createAdminSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedResponse();
    }

    const parsed = z
      .object({
        amount: z.coerce.number().int().positive().max(MAX_WITHDRAWAL_AMOUNT),
        phone: z.string().regex(KENYAN_PHONE_REGEX, "Invalid M-Pesa number"),
      })
      .safeParse(await request.json());

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.errors[0].message);
    }

    const withdrawLimit = await checkRateLimit(`wallet_withdraw:user:${user.id}`, 3, 24 * 60 * 60);
    if (!withdrawLimit.allowed) {
      return rateLimitedResponse("Too many withdrawal requests. Please try again tomorrow.");
    }

    const { amount: validAmount, phone } = parsed.data;

    const [walletSummary, contact, processingDays, minWithdrawal, withdrawalFee, hasPaidActivation] = await Promise.all([
      getWalletSummaryForUser(user.id),
      getWithdrawalContactForUser(user.id),
      getWithdrawalProcessingDays(),
      getMinWithdrawalKsh(),
      getWithdrawalFeeAmount(),
      hasPaidActivationPayment(admin, user.id),
    ]);

    if (!hasPaidActivation) {
      return NextResponse.json(
        {
          error: {
            code: "ACCOUNT_NOT_ACTIVATED",
            message: "Activate your account before requesting a withdrawal.",
          },
        },
        { status: 403 }
      );
    }

    if (validAmount < minWithdrawal) {
      return NextResponse.json(
        {
          error: {
            code: "BELOW_MINIMUM",
            message: `Minimum withdrawal is KSh ${minWithdrawal}`,
            minimum: minWithdrawal,
          },
        },
        { status: 422 }
      );
    }

    if (!contact.phone) {
      return NextResponse.json(
        {
          error: {
            code: "PHONE_NOT_CONFIGURED",
            message: "Set a valid Safaricom M-Pesa phone number on your profile before withdrawing.",
          },
        },
        { status: 422 }
      );
    }

    if (!isAllowedWithdrawalPhone(phone, contact.phone)) {
      return NextResponse.json(
        {
          error: {
            code: "PHONE_MISMATCH",
            message: "Withdrawals can only be sent to the phone number saved on your account.",
          },
        },
        { status: 422 }
      );
    }

    if (validAmount > walletSummary.available || walletSummary.available - validAmount < 0) {
      return NextResponse.json(
        {
          error: {
            code: "INSUFFICIENT_BALANCE",
            message: `Available balance is KSh ${walletSummary.available}`,
          },
        },
        { status: 422 }
      );
    }

    const amountAfterFee = calculateWithdrawalNetAmount(validAmount, withdrawalFee);
    if (amountAfterFee <= 0) {
      return NextResponse.json(
        {
          error: {
            code: "FEE_EXCEEDS_AMOUNT",
            message: `Amount too small after KSh ${withdrawalFee} fee`,
          },
        },
        { status: 422 }
      );
    }

    const normalizedPhone = normalizeWithdrawalStoragePhone(phone);
    const { data: withdrawal, error } = await admin.rpc("create_withdrawal_request", {
      p_amount: validAmount,
      p_amount_after_fee: amountAfterFee,
      p_description: `Withdrawal to ${normalizedPhone}`,
      p_fee_ksh: withdrawalFee,
      p_phone: normalizedPhone,
      p_user_id: user.id,
    });

    if (error || !Array.isArray(withdrawal) || withdrawal.length === 0) {
      const message = error?.message ?? "Failed to create withdrawal request";
      if (message.includes("ACTIVE_WITHDRAWAL_EXISTS")) {
        return NextResponse.json(
          {
            error: {
              code: "ACTIVE_WITHDRAWAL_EXISTS",
              message: "You already have a withdrawal request being processed.",
            },
          },
          { status: 409 }
        );
      }

      if (message.includes("INSUFFICIENT_FUNDS")) {
        return NextResponse.json(
          {
            error: {
              code: "INSUFFICIENT_BALANCE",
              message: `Available balance is KSh ${walletSummary.available}`,
            },
          },
          { status: 422 }
        );
      }

      throw new Error(message);
    }

    const created = withdrawal[0];
    void sendWithdrawalWebhook(
      buildWithdrawalWebhookPayload({
        amountToReceive: amountAfterFee,
        createdAt: created.created_at,
        contact,
        feeKsh: withdrawalFee,
        phone: normalizedPhone,
        requestedAmount: validAmount,
      }),
      created.id
    );

    return NextResponse.json({
      withdrawalId: created.id,
      amountRequested: validAmount,
      fee: withdrawalFee,
      amountToReceive: amountAfterFee,
      processingDays,
    });
  } catch (error) {
    console.error("[POST /api/wallet/withdraw] error:", error);
    return internalErrorResponse("Withdrawal failed");
  }
}
