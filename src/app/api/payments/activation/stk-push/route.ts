import { NextResponse } from "next/server";
import { z } from "zod";

import { internalErrorResponse, rateLimitedResponse, unauthorizedResponse, validationErrorResponse } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  KENYAN_PHONE_REGEX,
  MPESA_STK_AMOUNT,
  initiateStkPush,
  normalizePesaPhone,
} from "@/lib/mpesa";

const ACTIVATION_AMOUNT = MPESA_STK_AMOUNT;

const schema = z.object({
  phone: z.string().trim().regex(KENYAN_PHONE_REGEX, "Invalid Kenyan phone number"),
});

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedResponse("Not authenticated");
    }

    const parsed = schema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return validationErrorResponse(parsed.error.errors[0]?.message ?? "Invalid request");
    }

    const paymentLimit = await checkRateLimit(`activation_stk_push:user:${user.id}`, 3, 10 * 60);
    if (!paymentLimit.allowed) {
      return rateLimitedResponse("Too many activation attempts. Please try again later.");
    }

    const admin = createAdminSupabaseClient();

    const { data: currentStatus, error: statusError } = await admin
      .from("account_status")
      .select("is_activated")
      .eq("user_id", user.id)
      .maybeSingle();

    if (statusError) {
      throw statusError;
    }

    if (currentStatus?.is_activated) {
      return NextResponse.json(
        {
          error: { code: "ALREADY_ACTIVATED", message: "Account is already activated" },
          alreadyActivated: true,
        },
        { status: 409 }
      );
    }

    const phone = normalizePesaPhone(parsed.data.phone);
    if (!/^254[71]\d{8}$/.test(phone)) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid Kenyan phone number" } },
        { status: 422 }
      );
    }

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: pendingPayment, error: pendingError } = await admin
      .from("activation_payments")
      .select("id, created_at")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .gte("created_at", tenMinutesAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingError) {
      throw pendingError;
    }

    if (pendingPayment) {
      return NextResponse.json(
        {
          error: {
            code: "PENDING_PAYMENT_EXISTS",
            message: "An activation payment is already pending. Wait a few minutes before trying again.",
          },
        },
        { status: 409 }
      );
    }

    const initiatedAt = new Date().toISOString();
    const { data: payment, error: insertError } = await admin
      .from("activation_payments")
      .insert({
        user_id: user.id,
        amount: ACTIVATION_AMOUNT,
        phone,
        status: "pending",
        stk_initiated_at: initiatedAt,
      })
      .select("id")
      .single();

    if (insertError || !payment) {
      throw insertError ?? new Error("Failed to create activation payment");
    }

    try {
      const stk = await initiateStkPush({
        phone,
        amount: ACTIVATION_AMOUNT,
        accountRef: "Pesatrix",
        description: "Pesatrix activation",
      });

      const { error: updateError } = await admin
        .from("activation_payments")
        .update({
          checkout_request_id: stk.checkoutRequestId,
          merchant_request_id: stk.merchantRequestId,
        })
        .eq("id", payment.id);

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({
        paymentId: payment.id,
        status: "pending",
        message: "Check your phone for M-Pesa prompt",
      });
    } catch (error) {
      await admin
        .from("activation_payments")
        .update({
          status: "failed",
          callback_validation_error: "stk_initiation_failed",
          stk_completed_at: new Date().toISOString(),
        })
        .eq("id", payment.id);

      console.error("[POST /api/payments/activation/stk-push] STK initiation failed:", error);
      return NextResponse.json(
        { error: { code: "STK_UNAVAILABLE", message: "Could not start M-Pesa payment right now" } },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("[POST /api/payments/activation/stk-push] error:", error);
    return internalErrorResponse("Payment initiation failed");
  }
}
