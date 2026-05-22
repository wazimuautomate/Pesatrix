import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const b2cCallbackSchema = z.object({
  Result: z
    .object({
      ConversationID: z.string().optional(),
      ResultCode: z.number().optional(),
      ResultDesc: z.string().optional(),
    })
    .passthrough()
    .optional(),
});

export async function POST(request: Request) {
  const acceptedResponse = NextResponse.json({ ok: true });

  try {
    const parsed = b2cCallbackSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return acceptedResponse;
    }
    const raw = parsed.data;

    const result = raw?.Result;
    if (!result) {
      return acceptedResponse;
    }

    const {
      ConversationID,
      OriginatorConversationID,
      ResultCode,
      ResultDesc,
      ResultParameters,
    } = result;

    if (!ConversationID) {
      return acceptedResponse;
    }

    const admin = createAdminSupabaseClient();

    const { data: withdrawal, error: fetchError } = await (admin.from("withdrawal_requests" as never) as any)
      .select("id, user_id, amount, status, mpesa_txn_id")
      .eq("b2c_conversation_id", ConversationID)
      .maybeSingle();

    if (fetchError || !withdrawal) {
      console.warn("[B2C Callback] No withdrawal found for ConversationID:", ConversationID);
      return acceptedResponse;
    }

    if (withdrawal.status === "sent") {
      return acceptedResponse;
    }

    const now = new Date().toISOString();

    if (ResultCode === 0) {
      let transactionId: string | undefined;

      const resultParameters = (ResultParameters as { ResultParameter?: Array<{ Key?: string; Value?: unknown }> } | undefined)
        ?.ResultParameter;

      if (Array.isArray(resultParameters)) {
        for (const param of resultParameters) {
          if (param?.Key === "TransactionID" || param?.Key === "TransactionReceipt") {
            transactionId = String(param.Value);
            break;
          }
        }
      }

      await (admin.from("withdrawal_requests" as never) as any)
        .update({
          status: "sent",
          mpesa_txn_id: transactionId ?? null,
          b2c_result_code: "0",
          b2c_result_desc: ResultDesc ?? "Success",
          b2c_raw_callback: raw,
          processed_at: now,
          last_reconciled_at: now,
          failure_reason: null,
        })
        .eq("id", withdrawal.id);

      await (admin.from("wallet_transactions" as never) as any)
        .update({ status: "available", bucket: "available" })
        .eq("reference_table", "withdrawal_requests")
        .eq("reference_id", withdrawal.id)
        .eq("type", "withdrawal")
        .eq("direction", "debit");

    } else {
      const failureReason = ResultDesc ?? "B2C failed with ResultCode: " + ResultCode;

      await (admin.from("withdrawal_requests" as never) as any)
        .update({
          status: "failed",
          failure_reason: failureReason,
          b2c_result_code: String(ResultCode),
          b2c_result_desc: ResultDesc ?? failureReason,
          b2c_raw_callback: raw,
          processed_at: now,
          last_reconciled_at: now,
        })
        .eq("id", withdrawal.id);

      await (admin.from("wallet_transactions" as never) as any)
        .update({ status: "reversed", bucket: "locked" })
        .eq("reference_table", "withdrawal_requests")
        .eq("reference_id", withdrawal.id)
        .eq("type", "withdrawal")
        .eq("direction", "debit");

    }

    return acceptedResponse;
  } catch (err) {
    console.error("[B2C Callback Error]", err);
    return acceptedResponse;
  }
}
