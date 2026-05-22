import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET() {
  return NextResponse.json({ status: "ok" });
}

export async function POST(request: Request) {
  const admin = createAdminSupabaseClient();

  try {
    const body = await request.json();
    console.log("[M-Pesa B2C Callback Result] Received:", JSON.stringify(body));

    const resultObj = body?.Result;
    if (!resultObj) {
      console.warn("[M-Pesa B2C Callback Result] Missing Result object in callback payload");
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const resultCode = resultObj.ResultCode;
    const resultDesc = resultObj.ResultDesc || "";
    const conversationId = resultObj.ConversationID;
    const originatorId = resultObj.OriginatorConversationID;
    const transactionId = resultObj.TransactionID;
    const occasion = resultObj.Occasion; // withdrawalId is stored here

    if (!occasion) {
      console.warn("[M-Pesa B2C Callback Result] Missing Occasion (withdrawalId) in result payload:", resultObj);
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // Query withdrawal request to verify its existence and status
    const { data: requestRow, error: selectError } = await admin
      .from("withdrawal_requests")
      .select("id, user_id, amount, status")
      .eq("id", occasion)
      .maybeSingle();

    if (selectError) {
      console.error(`[M-Pesa B2C Callback Result] Failed to fetch withdrawal request ${occasion}:`, selectError);
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    if (!requestRow) {
      console.warn(`[M-Pesa B2C Callback Result] Withdrawal request ${occasion} not found. Skipping.`);
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    // Safe guard: only process requests that are in 'processing' state to prevent duplicate processing
    if (requestRow.status !== "processing") {
      console.log(`[M-Pesa B2C Callback Result] Withdrawal request ${occasion} is already in state "${requestRow.status}". Skipping.`);
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const now = new Date().toISOString();

    if (resultCode === 0) {
      // IF resultCode === 0 (SUCCESS):
      console.log(`[M-Pesa B2C Callback Result] Payment succeeded for withdrawal ${occasion}. M-Pesa Transaction ID: ${transactionId}`);
      
      const { error: updateError } = await admin
        .from("withdrawal_requests")
        .update({
          status: "sent",
          mpesa_txn_id: transactionId || null,
          processed_at: now,
        })
        .eq("id", occasion)
        .eq("status", "processing");

      if (updateError) {
        console.error(`[M-Pesa B2C Callback Result] Failed to update success status for withdrawal ${occasion}:`, updateError);
      }
    } else {
      // IF resultCode !== 0 (FAILURE):
      console.warn(`[M-Pesa B2C Callback Result] Payment failed for withdrawal ${occasion}. Code: ${resultCode}, Desc: ${resultDesc}`);

      // Update status to failed
      const { error: updateError } = await admin
        .from("withdrawal_requests")
        .update({
          status: "failed",
          failure_reason: resultDesc || `Failed with code ${resultCode}`,
          processed_at: now,
        })
        .eq("id", occasion)
        .eq("status", "processing");

      if (updateError) {
        console.error(`[M-Pesa B2C Callback Result] Failed to update failure status for withdrawal ${occasion}:`, updateError);
      }

      // Reverse the debit
      console.log(`[M-Pesa B2C Callback Result] Reversing KSh ${requestRow.amount} debit for user ${requestRow.user_id}`);
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
          reference_id: occasion,
          description: "Withdrawal failed — funds restored",
        });

      if (insertTxError) {
        console.error(`[M-Pesa B2C Callback Result] CRITICAL: Failed to reverse wallet debit for user ${requestRow.user_id}, withdrawal ${occasion}:`, insertTxError);
      }
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    console.error("[POST /api/mpesa/b2c/result] Callback exception:", error);
    // Always return HTTP 200 to Safaricom even if an exception occurs
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
  }
}
