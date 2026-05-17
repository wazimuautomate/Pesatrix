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

    const userId = user.id;
    console.log("[Activation] Starting activation flow for user:", userId);

    const { data: existingStatus } = await admin
      .from("account_status")
      .select("is_activated, state, status")
      .eq("user_id", userId)
      .maybeSingle();

    const isAlreadyActivated =
      existingStatus?.is_activated === true ||
      existingStatus?.state === "activated" ||
      existingStatus?.state === "active" ||
      existingStatus?.status === "activated" ||
      existingStatus?.status === "active";

    if (isAlreadyActivated) {
      console.log("[Activation] User already activated:", userId);
      return NextResponse.json({
        ok: true,
        alreadyActivated: true,
        message: "Account is already activated",
      });
    }

    const phone = normalizePesaPhone(parsed.data.phone);
    const activatedAt = new Date().toISOString();
    const mockReceipt = `MOCK-${Date.now()}`;
    const paymentId = randomUUID();

    console.log("[Activation] Writing activation for user:", userId);

    const { error: statusError } = await admin
      .from("account_status")
      .upsert(
        {
          user_id: userId,
          is_setup_complete: true,
          setup_completed_at: activatedAt,
          is_activated: true,
          activated_at: activatedAt,
          state: "activated",
          status: "active",
        },
        { onConflict: "user_id" }
      );

    if (statusError) {
      console.error("[Activation] Failed to update account_status:", statusError);
      throw statusError;
    }

    console.log("[Activation] account_status updated for user:", userId);

    const { data: existingPayment } = await admin
      .from("activation_payments")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .maybeSingle();

    if (existingPayment) {
      const { error: paymentUpdateError } = await admin
        .from("activation_payments")
        .update({
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
        .eq("id", existingPayment.id);

      if (paymentUpdateError) {
        console.warn("[Activation] activation_payments update failed:", paymentUpdateError);
      }
    } else {
      const { error: paymentInsertError } = await admin
        .from("activation_payments")
        .insert({
          id: paymentId,
          user_id: userId,
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
        console.warn("[Activation] activation_payments insert failed:", paymentInsertError);
      }
    }

    console.log("[Activation] activation_payments updated for user:", userId);

    const { error: walletError } = await admin.from("wallet_transactions").insert({
      user_id: userId,
      type: "activation_fee",
      direction: "debit",
      amount: MPESA_STK_AMOUNT,
      status: "available",
      bucket: "available",
      description: "Mock activation fee captured during development",
      reference_table: "activation_payments",
      reference_id: paymentId,
      available_at: activatedAt,
    });

    if (walletError) {
      console.warn("[Activation] wallet activation fee insert skipped", walletError);
    }

    await creditReferralChain(userId);

    console.log("[Activation] Success for user:", userId);

    return NextResponse.json({
      ok: true,
      paymentId,
      status: "paid",
      receipt: mockReceipt,
      customerMessage: "Mock activation completed successfully.",
    });
  } catch (err) {
    console.error("[Activation] Error:", err);

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Payment initiation failed" } },
      { status: 500 }
    );
  }
}
