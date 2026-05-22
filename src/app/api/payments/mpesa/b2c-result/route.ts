import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { finalizeWithdrawal } from "@/lib/wallet/finalizeWithdrawal";

export async function POST(request: Request) {
  const acceptedResponse = new Response("OK", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });

  try {
    const body = await request.json().catch(() => null);
    if (!body || !body.Result) {
      console.warn("[B2C Result] Invalid or empty request body received.");
      return acceptedResponse;
    }

    const result = body.Result;
    const resultCode = Number(result.ResultCode ?? -1);
    const resultDesc = typeof result.ResultDesc === "string" ? result.ResultDesc : "No description";
    const conversationId = result.ConversationID;
    const originatorId = result.OriginatorConversationID;
    const rawPayload = body;

    if (!conversationId) {
      console.warn("[B2C Result] Callback missing ConversationID.");
      return acceptedResponse;
    }

    const admin = createAdminSupabaseClient();

    // 3. Using service role Supabase client:
    // Look up withdrawal_requests WHERE b2c_conversation_id = conversationId
    const { data: withdrawal, error: fetchError } = await admin
      .from("withdrawal_requests")
      .select("id, status")
      .eq("b2c_conversation_id", conversationId)
      .maybeSingle();

    if (fetchError) {
      console.error(`[B2C Result] Error querying withdrawal_requests:`, fetchError);
      return acceptedResponse;
    }

    if (!withdrawal) {
      // Safaricom sometimes fires callbacks for test transactions. Return 200, log to console, do not throw.
      console.warn(`[B2C Result] No withdrawal found for b2c_conversation_id: ${conversationId}`);
      return acceptedResponse;
    }

    // If already status='sent' or 'failed': return 200 immediately (duplicate callback)
    if (withdrawal.status === "sent" || withdrawal.status === "failed") {
      console.log(`[B2C Result] Withdrawal ${withdrawal.id} is already in terminal state: ${withdrawal.status}`);
      return acceptedResponse;
    }

    if (resultCode === 0) {
      // SUCCESS path
      const outerTxId = result.TransactionID;
      const resultParams = result.ResultParameters?.ResultParameter ?? [];
      const receiptParam = resultParams.find((p: any) => p?.Key === "TransactionReceipt")?.Value;
      const transactionId = receiptParam ? String(receiptParam) : outerTxId;

      if (outerTxId && receiptParam && outerTxId !== receiptParam) {
        console.warn(`[B2C Result] TransactionID mismatch: outer=${outerTxId}, parameters=${receiptParam}`);
      }

      await finalizeWithdrawal(withdrawal.id, "success", {
        transactionId,
        rawPayload,
        resultDesc,
      });
    } else {
      // FAILURE path
      await finalizeWithdrawal(withdrawal.id, "failure", {
        resultCode,
        rawPayload,
        resultDesc,
      });
    }

    return acceptedResponse;
  } catch (err) {
    console.error("[B2C Result Error]", err);
    return acceptedResponse;
  }
}
