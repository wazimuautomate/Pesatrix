import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { creditDirectReferralBonus } from "@/lib/referral";
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

    const { data: currentStatus } = await admin
      .from("account_status")
      .select("is_activated")
      .eq("user_id", userId)
      .maybeSingle();

    if (currentStatus?.is_activated === true) {
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

    console.log("[Activation] Writing activation for user:", userId);

    const { data: existingPayment } = await admin
      .from("activation_payments")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let paymentId: string | null = null;

    if (existingPayment) {
      const { data: paidPayment, error: paymentUpdateError } = await admin
        .from("activation_payments")
        .update({
          status: "paid",
          mpesa_receipt: mockReceipt,
          paid_at: activatedAt,
          merchant_request_id: `MOCK-MID-${Date.now()}`,
          checkout_request_id: `MOCK-CID-${Date.now()}`,
          callback_raw: {
            mock: true,
            timestamp: Date.now(),
          },
        })
        .eq("id", existingPayment.id)
        .select("id")
        .single();

      if (paymentUpdateError) {
        console.error("[Activation] Payment record failed:", paymentUpdateError);
        return NextResponse.json(
          { error: "Payment record failed", detail: paymentUpdateError.message },
          { status: 500 }
        );
      }

      paymentId = paidPayment.id;
    } else {
      const { data: paidPayment, error: paymentInsertError } = await admin
        .from("activation_payments")
        .insert({
          user_id: userId,
          amount: MPESA_STK_AMOUNT,
          phone,
          status: "paid",
          mpesa_receipt: mockReceipt,
          paid_at: activatedAt,
          merchant_request_id: `MOCK-MID-${Date.now()}`,
          checkout_request_id: `MOCK-CID-${Date.now()}`,
          callback_raw: {
            mock: true,
            timestamp: Date.now(),
          },
        })
        .select("id")
        .single();

      if (paymentInsertError) {
        console.error("[Activation] Payment record failed:", paymentInsertError);
        return NextResponse.json(
          { error: "Payment record failed", detail: paymentInsertError.message },
          { status: 500 }
        );
      }

      paymentId = paidPayment.id;
    }

    console.log("[Activation] activation_payments updated for user:", userId);

    const activationPatch = {
      is_activated: true,
      activated_at: activatedAt,
      status: "active",
      state: "activated",
    };

    const { data: updatedStatus, error: statusError } = await admin
      .from("account_status")
      .update(activationPatch)
      .eq("user_id", userId)
      .select("user_id")
      .maybeSingle();

    if (statusError) {
      console.error("[Activation] Status update failed:", statusError);
      return NextResponse.json(
        { error: "Status update failed", detail: statusError.message },
        { status: 500 }
      );
    }

    if (!updatedStatus) {
      const { error: statusInsertError } = await admin
        .from("account_status")
        .insert({
          user_id: userId,
          is_setup_complete: false,
          ...activationPatch,
        });

      if (statusInsertError) {
        console.error("[Activation] Status update failed:", statusInsertError);
        return NextResponse.json(
          { error: "Status update failed", detail: statusInsertError.message },
          { status: 500 }
        );
      }
    }

    console.log("[Activation] account_status updated for user:", userId);

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

    await creditDirectReferralBonus(userId);

    console.log("[Activation] Successfully activated user:", userId);

    return NextResponse.json({
      ok: true,
      activated: true,
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
