import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { creditReferralChain } from "@/lib/referral";
import {
  MPESA_STK_AMOUNT,
  parseStkCallbackMetadata,
  phonesMatch,
} from "@/lib/mpesa";

/**
 * Daraja callback webhook — must be publicly reachable (no auth middleware).
 * Validates and marks activation as paid, then marks account as activated.
 * Idempotent: safe to call multiple times with the same CheckoutRequestID.
 */
export async function POST(request: Request) {
  const acceptedResponse = NextResponse.json({ ok: true });

  try {
    const raw = await request.json();

    const callback = raw?.Body?.stkCallback;
    if (!callback) {
      return acceptedResponse;
    }

    const {
      CheckoutRequestID,
      ResultCode,
      CallbackMetadata,
    } = callback;

    if (!CheckoutRequestID) {
      return acceptedResponse;
    }

    const admin = createAdminSupabaseClient();

    const { data: payment, error: paymentError } = await admin
      .from("activation_payments")
      .select("id, user_id, amount, phone, status, mpesa_receipt")
      .eq("checkout_request_id", CheckoutRequestID)
      .maybeSingle();

    if (paymentError || !payment) {
      return acceptedResponse;
    }

    const store = async (
      status: "pending" | "paid" | "failed" | "reversed",
      extras?: Record<string, unknown>
    ) => {
      const { error } = await admin
        .from("activation_payments")
        .update({
          status,
          callback_raw: raw,
          paid_at: status === "paid" ? new Date().toISOString() : null,
          ...extras,
        })
        .eq("id", payment.id);

      if (error) {
        throw error;
      }
    };

    if (payment.status === "paid") {
      await store("paid", { mpesa_receipt: payment.mpesa_receipt });
      return acceptedResponse;
    }

    if (payment.status !== "pending") {
      await store(payment.status, { mpesa_receipt: payment.mpesa_receipt });
      return acceptedResponse;
    }

    if (ResultCode !== 0) {
      await store("failed");
      return acceptedResponse;
    }

    const metadata = parseStkCallbackMetadata(CallbackMetadata?.Item);

    if (metadata.amount !== MPESA_STK_AMOUNT) {
      await store("failed");
      return acceptedResponse;
    }

    if (!metadata.mpesaReceipt) {
      await store("failed");
      return acceptedResponse;
    }

    if (!phonesMatch(payment.phone, metadata.phoneNumber)) {
      await store("failed", {
        callback_validation_error: "PHONE_MISMATCH",
      });
      return acceptedResponse;
    }

    const { data: duplicateReceipt, error: duplicateReceiptError } = await admin
      .from("activation_payments")
      .select("id")
      .eq("mpesa_receipt", metadata.mpesaReceipt)
      .neq("id", payment.id)
      .maybeSingle();

    if (duplicateReceiptError) {
      throw duplicateReceiptError;
    }

    if (duplicateReceipt) {
      await store("failed");
      return acceptedResponse;
    }

    await store("paid", { mpesa_receipt: metadata.mpesaReceipt });

    const activatedAt = new Date().toISOString();
    const activationPayload = {
      user_id: payment.user_id,
      activated_at: activatedAt,
      is_activated: true,
      state: "activated",
      status: "active",
    };

    let activationError: Error | null = null;

    const { error: specUpsertError } = await admin
      .from("account_status")
      .upsert(activationPayload, { onConflict: "user_id" });

    if (specUpsertError) {
      const { error: legacyUpdateError } = await admin
        .from("account_status")
        .update({
          activated_at: activatedAt,
          is_activated: true,
          state: "activated",
          status: "active",
        })
        .eq("user_id", payment.user_id);

      activationError = legacyUpdateError ?? specUpsertError;
    }

    if (activationError) {
      throw activationError;
    }

    await creditReferralChain(payment.user_id);

    return acceptedResponse;
  } catch (err) {
    console.error("[Daraja Callback Error]", err);
    return acceptedResponse;
  }
}
