import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SYSTEM_ADMIN_ID } from "@/lib/fraud/riskScorer";
import {
  extractIP,
  validateSafaricomIP,
  type B2CTimeoutPayload,
} from "@/lib/mpesa";

const acceptedResponse = NextResponse.json({
  ResultCode: 0,
  ResultDesc: "Accepted",
});

const timeoutCallbackSchema = z
  .object({
    ConversationID: z.string().optional(),
  })
  .passthrough();

export async function POST(request: Request) {
  const ip = extractIP(request);
  if (!validateSafaricomIP(ip)) {
    console.error("[B2C Timeout] Callback from non-Safaricom IP:", ip);
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const admin = createAdminSupabaseClient();

  try {
    const parsedBody = timeoutCallbackSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
      return acceptedResponse;
    }
    const raw = parsedBody.data as B2CTimeoutPayload | null;
    const conversationId = raw?.ConversationID;

    if (!conversationId) {
      return acceptedResponse;
    }

    const { data: withdrawal, error: fetchError } = await (admin.from("withdrawal_requests" as never) as any)
      .select("id, status")
      .eq("b2c_conversation_id", conversationId)
      .maybeSingle();

    if (fetchError || !withdrawal) {
      console.warn("[B2C Timeout] Unknown conversation ID", conversationId);
      return acceptedResponse;
    }

    await (admin.from("withdrawal_requests" as never) as any)
      .update({
        status: "held",
        b2c_raw_callback: raw,
        b2c_result_desc: "Safaricom queue timeout",
        last_reconciled_at: new Date().toISOString(),
      })
      .eq("id", withdrawal.id)
      .neq("status", "sent");

    if (SYSTEM_ADMIN_ID) {
      await (admin.from("audit_log" as never) as any).insert({
        admin_id: SYSTEM_ADMIN_ID,
        action: "b2c_timeout",
        entity_type: "withdrawal_requests",
        entity_id: withdrawal.id,
        after_json: {
          conversation_id: conversationId,
        },
        reason: "Safaricom queue timeout - manual review required",
      });
    }

    return acceptedResponse;
  } catch (error) {
    console.error("[B2C Timeout] Error", error);
    return acceptedResponse;
  }
}
