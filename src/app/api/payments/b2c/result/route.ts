import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SYSTEM_ADMIN_ID } from "@/lib/fraud/riskScorer";
import {
  extractIP,
  parseB2CResultPayload,
  validateSafaricomIP,
  type B2CResultPayload,
} from "@/lib/mpesa";

const acceptedResponse = NextResponse.json({
  ResultCode: 0,
  ResultDesc: "Accepted",
});

const resultCallbackSchema = z.object({
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
  const ip = extractIP(request);
  if (!validateSafaricomIP(ip)) {
    console.error("[B2C Result] Callback from non-Safaricom IP:", ip);
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const admin = createAdminSupabaseClient();

  try {
    const parsedBody = resultCallbackSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
      return acceptedResponse;
    }
    const raw = parsedBody.data as B2CResultPayload | null;
    const result = raw?.Result;
    const conversationId = result?.ConversationID;

    if (!result || !conversationId) {
      return acceptedResponse;
    }

    const { data: withdrawal, error: fetchError } = await (admin.from("withdrawal_requests" as never) as any)
      .select("id, user_id, amount, status, b2c_conversation_id")
      .eq("b2c_conversation_id", conversationId)
      .maybeSingle();

    if (fetchError || !withdrawal) {
      console.warn("[B2C Result] Unknown conversation ID", conversationId);
      return acceptedResponse;
    }

    if (withdrawal.status === "sent" || withdrawal.status === "failed") {
      return acceptedResponse;
    }

    const resultCode = Number(result.ResultCode ?? -1);
    const resultDesc = typeof result.ResultDesc === "string" ? result.ResultDesc : "Unknown result";
    const parsed = parseB2CResultPayload(raw);
    const processedAt = new Date().toISOString();

    if (resultCode !== 0) {
      await (admin.from("withdrawal_requests" as never) as any)
        .update({
          status: "failed",
          b2c_result_code: String(resultCode),
          b2c_result_desc: resultDesc,
          b2c_raw_callback: raw,
          processed_at: processedAt,
          last_reconciled_at: processedAt,
          failure_reason: resultDesc,
        })
        .eq("id", withdrawal.id);

      await (admin.from("wallet_transactions" as never) as any)
        .update({ status: "reversed", bucket: "locked" })
        .eq("reference_table", "withdrawal_requests")
        .eq("reference_id", withdrawal.id)
        .eq("type", "withdrawal")
        .eq("direction", "debit");

      if (SYSTEM_ADMIN_ID) {
        await (admin.from("audit_log" as never) as any).insert({
          admin_id: SYSTEM_ADMIN_ID,
          action: "withdrawal_failed",
          entity_type: "withdrawal_requests",
          entity_id: withdrawal.id,
          after_json: {
            result_code: resultCode,
            result_desc: resultDesc,
          },
          reason: "B2C payout failed",
        });
      }

      return acceptedResponse;
    }

    await (admin.from("withdrawal_requests" as never) as any)
      .update({
        status: "sent",
        mpesa_txn_id: parsed.receipt ?? null,
        b2c_result_code: "0",
        b2c_result_desc: resultDesc,
        b2c_raw_callback: raw,
        processed_at: processedAt,
        last_reconciled_at: processedAt,
        failure_reason: null,
      })
      .eq("id", withdrawal.id);

    await (admin.from("wallet_transactions" as never) as any)
      .update({ status: "available", bucket: "available" })
      .eq("reference_table", "withdrawal_requests")
      .eq("reference_id", withdrawal.id)
      .eq("type", "withdrawal")
      .eq("direction", "debit");

    if (SYSTEM_ADMIN_ID) {
      await (admin.from("audit_log" as never) as any).insert({
        admin_id: SYSTEM_ADMIN_ID,
        action: "withdrawal_completed",
        entity_type: "withdrawal_requests",
        entity_id: withdrawal.id,
        after_json: {
          receipt: parsed.receipt ?? null,
          amount: parsed.amount ?? null,
        },
        reason: "B2C success",
      });
    }

    return acceptedResponse;
  } catch (error) {
    console.error("[B2C Result] Error", error);
    return acceptedResponse;
  }
}
