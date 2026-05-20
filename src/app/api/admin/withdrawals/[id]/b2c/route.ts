import { NextResponse } from "next/server";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { initiateB2C, normalizePesaPhone } from "@/lib/mpesa";
import { auditLog, getRequestMeta, requireAdmin } from "../../../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const { error, userId } = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "finance", "admin"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const admin = createAdminSupabaseClient();

  const { data: withdrawal, error: fetchError } = await (admin.from("withdrawal_requests" as never) as any)
    .select("id, user_id, amount, phone, status, b2c_conversation_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !withdrawal) {
    return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
  }

  if (!["requested", "held"].includes(withdrawal.status)) {
    return NextResponse.json(
      { error: "B2C can only be initiated for requested or held withdrawals" },
      { status: 409 }
    );
  }

  if (withdrawal.b2c_conversation_id) {
    return NextResponse.json(
      { error: "B2C already initiated for this withdrawal" },
      { status: 409 }
    );
  }

  const { data: accountStatus } = await (admin.from("account_status" as never) as any)
    .select("status")
    .eq("user_id", withdrawal.user_id)
    .maybeSingle();

  const phone = normalizePesaPhone(withdrawal.phone);

  try {
    const b2cResult = await initiateB2C(withdrawal.amount, phone, id);
    const { data: before } = await (admin.from("withdrawal_requests" as never) as any)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    await (admin.from("withdrawal_requests" as never) as any)
      .update({
        status: "processing",
        b2c_conversation_id: b2cResult.ConversationID,
        b2c_originator_id: b2cResult.OriginatorConversationID,
      })
      .eq("id", id);

    await (admin.from("wallet_transactions" as never) as any)
      .update({ status: "locked", bucket: "available" })
      .eq("reference_table", "withdrawal_requests")
      .eq("reference_id", id)
      .eq("direction", "debit");

    await auditLog({
      adminId: userId,
      action:
        accountStatus?.status === "suspended"
          ? "withdrawal_b2c_initiated_suspended_user"
          : "withdrawal_b2c_initiated",
      entityType: "withdrawal_requests",
      entityId: id,
      before,
      after: { status: "processing", b2c_conversation_id: b2cResult.ConversationID },
      reason:
        accountStatus?.status === "suspended"
          ? "WARNING: B2C initiated for suspended user"
          : "B2C payout initiated via Daraja API",
      ip: getRequestMeta(request).ip ?? undefined,
      userAgent: getRequestMeta(request).userAgent ?? undefined,
    });

    return NextResponse.json({
      ok: true,
      conversationId: b2cResult.ConversationID,
      originatorConversationId: b2cResult.OriginatorConversationID,
    });
  } catch (err: any) {
    console.error("[B2C Initiation Error]", err);
    return NextResponse.json(
      { error: err.message ?? "B2C initiation failed" },
      { status: 502 }
    );
  }
}
