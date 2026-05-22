import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET() {
  return NextResponse.json({ status: "ok" });
}

export async function POST(request: Request) {
  const admin = createAdminSupabaseClient();

  try {
    const body = await request.json();
    console.log("[M-Pesa B2C Callback Timeout] Received:", JSON.stringify(body));

    const resultObj = body?.Result;
    const originatorId = resultObj?.OriginatorConversationID;

    if (!originatorId) {
      console.warn("[M-Pesa B2C Callback Timeout] Missing OriginatorConversationID in callback payload");
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // Find withdrawal: SELECT * FROM withdrawal_requests WHERE b2c_originator_id = originatorConversationId
    const { data: requestRow, error: selectError } = await admin
      .from("withdrawal_requests")
      .select("id, user_id, amount, status")
      .eq("b2c_originator_id", originatorId)
      .maybeSingle();

    if (selectError) {
      console.error(`[M-Pesa B2C Callback Timeout] Failed to fetch withdrawal request for originator ID ${originatorId}:`, selectError);
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    if (!requestRow) {
      console.warn(`[M-Pesa B2C Callback Timeout] No withdrawal request found for originator ID ${originatorId}. Skipping.`);
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // Check status: only process requests in 'processing' status to avoid duplicate reversals
    if (requestRow.status !== "processing") {
      console.log(`[M-Pesa B2C Callback Timeout] Withdrawal request ${requestRow.id} is already in state "${requestRow.status}". Skipping.`);
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const now = new Date().toISOString();

    console.warn(`[M-Pesa B2C Callback Timeout] Withdrawal request ${requestRow.id} timed out in Daraja queue. Initiating rollback.`);

    // 1. UPDATE status = 'failed', failure_reason = 'M-Pesa timeout — request expired in queue'
    const { error: updateError } = await admin
      .from("withdrawal_requests")
      .update({
        status: "failed",
        failure_reason: "M-Pesa timeout — request expired in queue",
        processed_at: now,
      })
      .eq("id", requestRow.id)
      .eq("status", "processing");

    if (updateError) {
      console.error(`[M-Pesa B2C Callback Timeout] Failed to update status to failed for withdrawal ${requestRow.id}:`, updateError);
    }

    // 2. Reverse the wallet debit
    console.log(`[M-Pesa B2C Callback Timeout] Reversing KSh ${requestRow.amount} debit for user ${requestRow.user_id}`);
    const { error: insertTxError } = await admin
      .from("wallet_transactions")
      .insert({
        user_id: requestRow.user_id,
        type: "reversal",
        direction: "credit",
        amount: requestRow.amount,
        status: "available",
        bucket: "available",
        reference_table: "withdrawal_requests",
        reference_id: requestRow.id,
        description: "Withdrawal failed — funds restored (Timeout)",
      });

    if (insertTxError) {
      console.error(`[M-Pesa B2C Callback Timeout] CRITICAL: Failed to reverse wallet debit for user ${requestRow.user_id}, withdrawal ${requestRow.id}:`, insertTxError);
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("[POST /api/mpesa/b2c/timeout] Callback exception:", error);
    // Always return HTTP 200 to Safaricom even if an exception occurs
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}
