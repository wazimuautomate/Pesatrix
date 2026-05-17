import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { creditReferralChain } from "@/lib/referral";
import { KENYAN_PHONE_REGEX, normalizePesaPhone, MPESA_STK_AMOUNT } from "@/lib/mpesa";
import { z } from "zod";

const schema = z.object({
  phone: z.string().regex(KENYAN_PHONE_REGEX, "Invalid Kenyan phone number"),
});

export async function POST(request: Request) {
  const admin = createAdminSupabaseClient();

  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0].message } },
        { status: 422 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }

    const { data: status } = await supabase
      .from("account_status")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (
      status?.is_activated ||
      status?.state === "activated" ||
      status?.state === "active" ||
      status?.status === "activated" ||
      status?.status === "active"
    ) {
      return NextResponse.json(
        { error: { code: "ALREADY_ACTIVATED", message: "Account is already activated" } },
        { status: 422 }
      );
    }

    const phone = normalizePesaPhone(parsed.data.phone);
    const activatedAt = new Date().toISOString();
    const mockReceipt = `MOCK-${Date.now()}`;
    const paymentId = randomUUID();

    const { error: paymentInsertError } = await admin
      .from("activation_payments")
      .insert({
        id: paymentId,
        user_id: user.id,
        amount: MPESA_STK_AMOUNT,
        phone,
        status: "paid",
        mpesa_receipt: mockReceipt,
        paid_at: activatedAt,
        merchant_request_id: `mock-merchant-${Date.now()}`,
        checkout_request_id: `mock-checkout-${Date.now()}`,
        callback_raw: {
          mocked: true,
          reason: "Development activation bypass",
        },
      })
      .select("id")
      .maybeSingle();

    if (paymentInsertError) {
      console.warn("[Mock Activation] activation_payments insert skipped", paymentInsertError);
    }

    const { error: statusError } = await admin
      .from("account_status")
      .upsert(
        {
          user_id: user.id,
          is_setup_complete: true,
          setup_completed_at: activatedAt,
          is_activated: true,
          activated_at: activatedAt,
          state: "activated",
          status: "activated",
        },
        { onConflict: "user_id" }
      );

    if (statusError) {
      throw statusError;
    }

    const { error: walletError } = await admin.from("wallet_transactions").insert({
      user_id: user.id,
      type: "activation_fee",
      direction: "debit",
      amount: MPESA_STK_AMOUNT,
      status: "available",
      bucket: "available",
      description: "Mock activation fee captured during development",
      reference_table: "activation_payments",
      reference_id: paymentInsertError ? null : paymentId,
      available_at: activatedAt,
    });

    if (walletError) {
      console.warn("[Mock Activation] wallet activation fee insert skipped", walletError);
    }

    await creditReferralChain(user.id);

    return NextResponse.json({
      paymentId,
      status: "paid",
      receipt: mockReceipt,
      customerMessage: "Mock activation completed successfully.",
    });
  } catch (err) {
    console.error("[STK Push Error]", err);

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Payment initiation failed" } },
      { status: 500 }
    );
  }
}
