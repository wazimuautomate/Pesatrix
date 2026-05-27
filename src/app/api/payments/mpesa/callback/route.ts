import { NextResponse } from "next/server";
import { z } from "zod";

import { syncAccountActivationFromPaidPayments } from "@/lib/activation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { creditDirectReferralBonus } from "@/lib/referral";
import { assignStarterTasks } from "@/lib/tasks/starterAssignment";
import { SYSTEM_ADMIN_ID } from "@/lib/fraud/riskScorer";
import {
  extractIP,
  parseStkCallbackMetadata,
  phonesMatch,
  validateSafaricomIP,
  type StkCallbackPayload,
} from "@/lib/mpesa";

const acceptedResponse = NextResponse.json({
  ResultCode: 0,
  ResultDesc: "Accepted",
});

const stkCallbackSchema = z.object({
  Body: z
    .object({
      stkCallback: z
        .object({
          CheckoutRequestID: z.string().optional(),
          ResultCode: z.number().optional(),
        })
        .passthrough()
        .optional(),
    })
    .passthrough()
    .optional(),
});

async function writeAuditLog(paymentId: string, action: string, reason: string, after?: Record<string, unknown>) {
  if (!SYSTEM_ADMIN_ID) {
    return;
  }

  const admin = createAdminSupabaseClient();
  await (admin.from("audit_log" as never) as any).insert({
    admin_id: SYSTEM_ADMIN_ID,
    action,
    entity_type: "activation_payments",
    entity_id: paymentId,
    after_json: after ?? null,
    reason,
  });
}

export async function POST(request: Request) {
  const ip = extractIP(request);
  if (!validateSafaricomIP(ip)) {
    console.error("[Daraja Callback] Callback from non-Safaricom IP:", ip);
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const admin = createAdminSupabaseClient();

  try {
    const parsed = stkCallbackSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return acceptedResponse;
    }
    const raw = parsed.data as StkCallbackPayload | null;
    const stk = raw?.Body?.stkCallback;
    const checkoutRequestId = stk?.CheckoutRequestID;

    if (!stk || !checkoutRequestId) {
      return acceptedResponse;
    }

    const { data: payment, error: paymentError } = await admin
      .from("activation_payments")
      .select("id, user_id, amount, phone, status, mpesa_receipt")
      .eq("checkout_request_id", checkoutRequestId)
      .maybeSingle();

    if (paymentError || !payment) {
      console.warn("[Daraja Callback] Unknown checkout request ID", checkoutRequestId);
      return acceptedResponse;
    }

    if (payment.status === "paid") {
      return acceptedResponse;
    }

    if (payment.status !== "pending") {
      return acceptedResponse;
    }

    const completedAt = new Date().toISOString();
    const resultCode = Number(stk.ResultCode ?? -1);

    if (resultCode !== 0) {
      await admin
        .from("activation_payments")
        .update({
          status: "failed",
          callback_raw: raw,
          safaricom_ip: ip,
          stk_completed_at: completedAt,
        })
        .eq("id", payment.id)
        .eq("status", "pending");

      return acceptedResponse;
    }

    const metadata = parseStkCallbackMetadata(stk.CallbackMetadata?.Item);

    if (metadata.amount !== payment.amount) {
      await admin
        .from("activation_payments")
        .update({
          status: "failed",
          callback_validation_error: "amount_mismatch",
          callback_raw: raw,
          safaricom_ip: ip,
          stk_completed_at: completedAt,
        })
        .eq("id", payment.id)
        .eq("status", "pending");

      await writeAuditLog(
        payment.id,
        "activation_amount_mismatch",
        `Expected ${payment.amount}, got ${metadata.amount ?? "unknown"}`,
        { checkout_request_id: checkoutRequestId }
      );

      return acceptedResponse;
    }

    if (!metadata.mpesaReceipt) {
      await admin
        .from("activation_payments")
        .update({
          status: "failed",
          callback_validation_error: "missing_receipt",
          callback_raw: raw,
          safaricom_ip: ip,
          stk_completed_at: completedAt,
        })
        .eq("id", payment.id)
        .eq("status", "pending");

      return acceptedResponse;
    }

    if (!phonesMatch(payment.phone, metadata.phoneNumber)) {
      await admin
        .from("activation_payments")
        .update({
          status: "failed",
          callback_validation_error: "phone_mismatch",
          callback_raw: raw,
          safaricom_ip: ip,
          stk_completed_at: completedAt,
        })
        .eq("id", payment.id)
        .eq("status", "pending");

      return acceptedResponse;
    }

    const { data: duplicateReceipt, error: duplicateError } = await admin
      .from("activation_payments")
      .select("id")
      .eq("mpesa_receipt", metadata.mpesaReceipt)
      .neq("id", payment.id)
      .maybeSingle();

    if (duplicateError) {
      throw duplicateError;
    }

    if (duplicateReceipt) {
      await admin
        .from("activation_payments")
        .update({
          status: "failed",
          callback_validation_error: "duplicate_receipt",
          callback_raw: raw,
          safaricom_ip: ip,
          stk_completed_at: completedAt,
        })
        .eq("id", payment.id)
        .eq("status", "pending");

      await writeAuditLog(
        payment.id,
        "activation_duplicate_receipt",
        `Duplicate M-Pesa receipt detected: ${metadata.mpesaReceipt}`,
        { duplicate_payment_id: duplicateReceipt.id }
      );

      return acceptedResponse;
    }

    const paidAt = new Date().toISOString();

    const { data: paidPayment, error: paymentUpdateError } = await admin
      .from("activation_payments")
      .update({
        status: "paid",
        mpesa_receipt: metadata.mpesaReceipt,
        paid_at: paidAt,
        callback_raw: raw,
        safaricom_ip: ip,
        stk_completed_at: completedAt,
      })
      .eq("id", payment.id)
      .eq("status", "pending")
      .select("id, user_id, status")
      .maybeSingle();

    if (paymentUpdateError) {
      throw paymentUpdateError;
    }

    if (!paidPayment || paidPayment.status !== "paid") {
      return acceptedResponse;
    }

    await syncAccountActivationFromPaidPayments(admin, payment.user_id);

    try {
      await assignStarterTasks(payment.user_id);
    } catch (starterError) {
      console.error("[Daraja Callback] Starter task assignment post-processing failed", starterError);
    }

    try {
      await creditDirectReferralBonus(payment.user_id);
    } catch (referralError) {
      console.error("[Daraja Callback] Referral bonus post-processing failed", referralError);
    }

    return acceptedResponse;
  } catch (error) {
    console.error("[Daraja Callback] Error", error);
    return acceptedResponse;
  }
}
