import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { KENYAN_PHONE_REGEX, normalizePesaPhone } from "@/lib/mpesa";
import {
  getWalletSummaryForUser,
  getWithdrawalVerification,
  MAX_WITHDRAWAL_AMOUNT,
} from "@/lib/wallet";
import { z } from "zod";

async function getMinWithdrawalAmountFromDb(supabase: ReturnType<typeof createAdminSupabaseClient>) {
  const { data } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "min_withdrawal_amount_ksh")
    .maybeSingle();
  return data?.value ? parseInt(data.value, 10) : 100;
}

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

    const minWithdrawal = await getMinWithdrawalAmountFromDb(admin);
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

    const verification = await getWithdrawalVerification(user.id);

    if (!verification.phoneVerified || !verification.emailVerified) {
      return NextResponse.json(
        {
          error: {
            code: "VERIFICATION_REQUIRED",
            message: "Phone and email must both be verified before withdrawing",
          },
        },
        { status: 422 }
      );
    }

    const { available } = await getWalletSummaryForUser(user.id);

    if (validAmount > available) {
      return NextResponse.json(
        { error: { code: "INSUFFICIENT_FUNDS", message: `Available balance is KSh ${available}` } },
        { status: 422 }
      );
    }

    const normalizedPhone = normalizePesaPhone(phone);

    const { data: withdrawal, error } = await admin
      .from("withdrawal_requests")
      .insert({
        user_id: user.id,
        amount: validAmount,
        phone: normalizedPhone,
        status: "requested",
      })
      .select("id")
      .single();

    if (error || !withdrawal) throw new Error("Failed to create withdrawal request");

    const { error: ledgerError } = await admin.from("wallet_transactions").insert({
      user_id: user.id,
      type: "withdrawal",
      direction: "debit",
      amount: validAmount,
      status: "locked",
      bucket: "available",
      description: `Withdrawal to ${normalizedPhone}`,
      reference_table: "withdrawal_requests",
      reference_id: withdrawal.id,
    });

    if (ledgerError) {
      throw ledgerError;
    }

    return NextResponse.json({ withdrawalId: withdrawal.id, status: "requested" });
  } catch (err) {
    console.error("[Withdrawal Error]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Withdrawal failed" } },
      { status: 500 }
    );
  }
}
