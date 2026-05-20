import { NextResponse } from "next/server";

import { auditLog, getRequestMeta, requireAdmin } from "../../../_lib";
import { processWithdrawalPayout } from "@/lib/mpesa/payouts";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const { error, userId, adminUser } = await requireAdmin({
    request,
    allowedRoles: ["finance", "super_admin"],
  });

  if (error) return error;
  if (!userId || !adminUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const result = await processWithdrawalPayout(id);

  if (!result.ok) {
    if (result.before) {
      await auditLog({
        adminId: userId,
        action: "b2c_initiation_failed",
        entityType: "withdrawal_requests",
        entityId: id,
        before: result.before,
        after: { status: "failed" },
        reason: result.message,
        ip: getRequestMeta(request).ip ?? undefined,
        userAgent: getRequestMeta(request).userAgent ?? undefined,
      });
    }

    return NextResponse.json({ error: result.message, code: result.code }, { status: result.status });
  }

  await auditLog({
    adminId: userId,
    action: "b2c_initiated",
    entityType: "withdrawal_requests",
    entityId: id,
    before: result.before,
    after: {
      status: "processing",
      b2c_conversation_id: result.conversationId,
      b2c_originator_id: result.originatorConversationId,
      b2c_initiated_at: result.initiatedAt,
    },
    reason: `B2C initiated by ${adminUser.role}`,
    ip: getRequestMeta(request).ip ?? undefined,
    userAgent: getRequestMeta(request).userAgent ?? undefined,
  });

  return NextResponse.json({
    ok: true,
    status: "processing",
    conversationId: result.conversationId,
    originatorConversationId: result.originatorConversationId,
  });
}
