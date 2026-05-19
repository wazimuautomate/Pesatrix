import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { KENYAN_PHONE_REGEX } from "@/lib/mpesa";
import {
  getWalletSummaryForUser,
  MAX_WITHDRAWAL_AMOUNT,
} from "@/lib/wallet";
import { getWithdrawalProcessingDays } from "@/lib/platform-settings";
import {
  buildWithdrawalWebhookPayload,
  getMinWithdrawalAmount,
  getWithdrawalContactForUser,
  isAllowedWithdrawalPhone,
  normalizeWithdrawalStoragePhone,
  sendWithdrawalWebhook,
} from "@/lib/withdrawals";
import { z } from "zod";

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const admin = createAdminSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
    }

    const minWithdrawal = await getMinWithdrawalAmount();
    const body = await request.json();

    const amount = body.amount;
    if (amount < minWithdrawal) {
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

    const parsed = z
      .object({
        amount: z.number().int().min(minWithdrawal).max(MAX_WITHDRAWAL_AMOUNT),
        phone: z.string().regex(KENYAN_PHONE_REGEX, "Invalid M-Pesa number"),
      })
      .safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0].message } },
        { status: 422 }
      );
    }

    const { amount: validAmount, phone } = parsed.data;

    const [walletSummary, contact, processingDays] = await Promise.all([
      getWalletSummaryForUser(user.id),
      getWithdrawalContactForUser(user.id),
      getWithdrawalProcessingDays(),
    ]);

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

    if (validAmount > walletSummary.available) {
      return NextResponse.json(
        {
          error: {
            code: "INSUFFICIENT_FUNDS",
            message: `Available balance is KSh ${walletSummary.available}`,
          },
        },
        { status: 422 }
      );
    }

    const normalizedPhone = normalizeWithdrawalStoragePhone(phone);
    const { data: withdrawal, error } = await admin.rpc("create_withdrawal_request", {
      p_amount: validAmount,
      p_description: `Withdrawal to ${normalizedPhone}`,
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
              code: "INSUFFICIENT_FUNDS",
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
        amount: validAmount,
        createdAt: created.created_at,
        contact,
        phone: normalizedPhone,
      }),
      created.id
    );

    return NextResponse.json({
      withdrawalId: created.id,
      status: created.status,
      message:
        "Withdrawal request submitted successfully. It will be processed within the configured processing timeframe.",
      processingDays,
    });
  } catch (err) {
    console.error("[Withdrawal Error]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Withdrawal failed" } },
      { status: 500 }
    );
  }
}
