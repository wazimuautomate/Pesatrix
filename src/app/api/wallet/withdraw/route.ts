import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getMpesaAccessToken, generateSecurityCredential } from "@/lib/mpesa";
import { getMinWithdrawalKsh } from "@/lib/platform-settings";
import { WITHDRAWALS_ENABLED_KEY } from "@/lib/platform-setting-keys";

export async function POST(request: Request) {
  let withdrawalId: string | null = null;
  const admin = createAdminSupabaseClient();

  try {
    // Parse the body
    const body = await request.json();
    const { amount, phone: rawPhone } = body;

    // STEP 1 — Auth check:
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Unauthorized" } }, { status: 401 });
    }

    if (typeof amount !== "number" || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid amount value" } }, { status: 422 });
    }

    // EXTRA STEP — Admin withdrawals disabled check (due to high traffic setting)
    const { data: enabledSetting } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", WITHDRAWALS_ENABLED_KEY)
      .maybeSingle();

    if (enabledSetting && enabledSetting.value === "false") {
      return NextResponse.json(
        {
          error: {
            code: "WITHDRAWALS_DISABLED",
            message: "Due to high traffic on our servers, withdrawal has been disabled. Try again later.",
          },
        },
        { status: 503 }
      );
    }

    // STEP 2 — Account status check:
    const { data: accountStatus, error: statusError } = await admin
      .from("account_status")
      .select("is_activated, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (statusError || !accountStatus || !accountStatus.is_activated || accountStatus.status !== "active") {
      return NextResponse.json(
        { error: { code: "ACCOUNT_NOT_ELIGIBLE", message: "Account not eligible for withdrawal" } },
        { status: 403 }
      );
    }

    // STEP 3 — Verification check:
    const { data: userVerification, error: verificationError } = await admin
      .from("user_verification")
      .select("phone_verified, email_verified")
      .eq("user_id", user.id)
      .maybeSingle();

    if (
      verificationError ||
      !userVerification ||
      !userVerification.phone_verified ||
      !userVerification.email_verified
    ) {
      return NextResponse.json(
        { error: { code: "UNVERIFIED", message: "Verify phone and email before withdrawing" } },
        { status: 403 }
      );
    }

    // STEP 4 — Minimum amount check (NO FALLBACK):
    const minAmount = await getMinWithdrawalKsh();

    if (minAmount === null) {
      return NextResponse.json(
        { error: { code: "CONFIGURATION_ERROR", message: "Withdrawals are currently unavailable. Please contact support." } },
        { status: 503 }
      );
    }

    if (amount < minAmount) {
      return NextResponse.json(
        { error: { code: "BELOW_MINIMUM", message: `Minimum withdrawal amount is KSh ${minAmount}`, minimum: minAmount } },
        { status: 422 }
      );
    }

    // STEP 5 — Duplicate withdrawal lock check:
    const { data: pendingRequests, error: pendingError } = await admin
      .from("withdrawal_requests")
      .select("id")
      .eq("user_id", user.id)
      .in("status", ["requested", "processing"]);

    if (pendingError || (pendingRequests && pendingRequests.length > 0)) {
      return NextResponse.json(
        {
          error: {
            code: "ACTIVE_WITHDRAWAL_EXISTS",
            message: "You have a pending withdrawal. Wait for it to complete before requesting another.",
          },
        },
        { status: 409 }
      );
    }

    // STEP 6 — Balance check:
    const { data: wallet, error: walletError } = await admin
      .from("wallets")
      .select("available_balance")
      .eq("user_id", user.id)
      .maybeSingle();

    if (walletError || !wallet || wallet.available_balance < amount) {
      return NextResponse.json(
        { error: { code: "INSUFFICIENT_BALANCE", message: "Insufficient available balance" } },
        { status: 422 }
      );
    }

    // STEP 7 — Phone format validation:
    let phone = String(rawPhone || "").trim();
    if (/^0[17]\d{8}$/.test(phone)) {
      phone = "254" + phone.slice(1);
    }

    if (!/^2547\d{8}$/.test(phone) && !/^2541\d{8}$/.test(phone)) {
      return NextResponse.json(
        { error: { code: "INVALID_PHONE", message: "Invalid phone number format. Use 254XXXXXXXXX" } },
        { status: 422 }
      );
    }

    // STEP 8 — Create withdrawal_requests row (status = 'requested'):
    const { data: withdrawalRow, error: insertWError } = await admin
      .from("withdrawal_requests")
      .insert({
        user_id: user.id,
        amount: amount,
        phone: phone,
        status: "requested",
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertWError || !withdrawalRow) {
      // Check for DB constraint unique index error explicitly
      if (insertWError?.message?.includes("withdrawal_requests_one_active_per_user") || insertWError?.code === "23505") {
        return NextResponse.json(
          {
            error: {
              code: "ACTIVE_WITHDRAWAL_EXISTS",
              message: "You have a pending withdrawal. Wait for it to complete before requesting another.",
            },
          },
          { status: 409 }
        );
      }
      throw new Error(insertWError?.message || "Failed to create withdrawal request");
    }

    withdrawalId = withdrawalRow.id;

    // STEP 9 — Debit wallet immediately (locks the funds):
    const { error: insertTxError } = await admin
      .from("wallet_transactions")
      .insert({
        user_id: user.id,
        type: "withdrawal",
        direction: "debit",
        amount: amount,
        status: "available", // deducted from available immediately
        bucket: "available",
        reference_table: "withdrawal_requests",
        reference_id: withdrawalId,
        description: "Withdrawal request",
      });

    if (insertTxError) {
      throw new Error(`Failed to insert wallet transaction: ${insertTxError.message}`);
    }

    // STEP 10 — Update withdrawal status to 'processing':
    const { error: updateWError } = await admin
      .from("withdrawal_requests")
      .update({ status: "processing" })
      .eq("id", withdrawalId);

    if (updateWError) {
      throw new Error(`Failed to update withdrawal status to processing: ${updateWError.message}`);
    }

    // STEP 11 — Call Daraja B2C:
    const accessToken = await getMpesaAccessToken();
    const securityCredential = generateSecurityCredential();
    const env = process.env.DARAJA_ENV === "production" ? "api" : "sandbox";

    const payload = {
      InitiatorName: process.env.MPESA_INITIATOR_NAME || process.env.DARAJA_INITIATOR_NAME,
      SecurityCredential: securityCredential,
      CommandID: "BusinessPayment",
      Amount: amount.toString(),
      PartyA: process.env.DARAJA_SHORTCODE,
      PartyB: phone,
      Remarks: `Pesatrix withdrawal ${withdrawalId}`,
      QueueTimeOutURL: `${process.env.NEXT_PUBLIC_APP_URL}/api/mpesa/b2c/timeout`,
      ResultURL: `${process.env.NEXT_PUBLIC_APP_URL}/api/mpesa/b2c/result`,
      Occasion: withdrawalId, // store withdrawalId here for callback lookup
    };

    let b2cRes: Response;
    try {
      b2cRes = await fetch(`https://${env}.safaricom.co.ke/mpesa/b2c/v3/paymentrequest`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
    } catch (fetchErr) {
      throw new Error(`Daraja API network transport failed: ${fetchErr instanceof Error ? fetchErr.message : String(fetchErr)}`);
    }

    const b2cData = await b2cRes.json().catch(() => ({}));

    // STEP 12 — Store B2C conversation IDs:
    if (b2cData?.ConversationID || b2cData?.OriginatorConversationID) {
      await admin
        .from("withdrawal_requests")
        .update({
          b2c_conversation_id: b2cData.ConversationID || null,
          b2c_originator_id: b2cData.OriginatorConversationID || null,
        })
        .eq("id", withdrawalId);
    }

    // STEP 13 — Handle B2C call failure:
    if (!b2cRes.ok || b2cData?.ResponseCode !== "0") {
      const errorDesc = b2cData?.ResponseDescription || `HTTP error ${b2cRes.status}`;
      
      console.warn(`[M-Pesa B2C] Daraja call rejected: ${errorDesc}`, b2cData);

      await admin
        .from("withdrawal_requests")
        .update({ status: "failed", failure_reason: errorDesc })
        .eq("id", withdrawalId);

      // REVERSE the wallet debit: INSERT wallet_transactions with direction='credit', type='reversal', status='available'
      await admin
        .from("wallet_transactions")
        .insert({
          user_id: user.id,
          type: "reversal",
          direction: "credit",
          amount: amount,
          status: "available",
          bucket: "available",
          reference_table: "withdrawal_requests",
          reference_id: withdrawalId,
          description: "Withdrawal failed — funds restored",
        });

      return NextResponse.json(
        { error: { code: "B2C_REJECTED", message: "Payment processing failed. Your balance has been restored. Please try again." } },
        { status: 502 }
      );
    }

    // STEP 14 — Return success:
    return NextResponse.json({
      withdrawalId,
      status: "processing",
      message: "Withdrawal initiated. You will receive M-Pesa confirmation shortly.",
    });

  } catch (error) {
    console.error("[POST /api/wallet/withdraw] Unexpected failure:", error);

    // If unexpected error occurs after Step 9 (wallet already debited):
    if (withdrawalId) {
      try {
        const supabase = await createServerSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Attempt reversal
          const { data: requestRow } = await admin
            .from("withdrawal_requests")
            .select("amount, status")
            .eq("id", withdrawalId)
            .single();

          if (requestRow && requestRow.status !== "failed" && requestRow.status !== "sent") {
            await admin
              .from("withdrawal_requests")
              .update({ status: "failed", failure_reason: error instanceof Error ? error.message : "System exception" })
              .eq("id", withdrawalId);

            await admin
              .from("wallet_transactions")
              .insert({
                user_id: user.id,
                type: "reversal",
                direction: "credit",
                amount: requestRow.amount,
                status: "available",
                bucket: "available",
                reference_table: "withdrawal_requests",
                reference_id: withdrawalId,
                description: "Withdrawal system exception — funds restored",
              });
            console.log(`[M-Pesa B2C] Auto-reversed transaction for withdrawal ${withdrawalId} due to internal error.`);
          }
        }
      } catch (revError) {
        console.error(`[M-Pesa B2C] CRITICAL: Failed to automatically reverse withdrawal ${withdrawalId}:`, revError);
      }
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred during processing. Please try again." } },
      { status: 500 }
    );
  }
}
