import { NextResponse } from "next/server";
import { z } from "zod";

import { auditLog, getRequestMeta, requireAdmin } from "@/app/api/admin/_lib";
import { processWithdrawalPayout } from "@/lib/mpesa/payouts";

const schema = z.object({
  withdrawalId: z.string().uuid("Invalid withdrawal id"),
  reason: z.string().trim().min(3).max(200).optional(),
});

export async function POST(request: Request) {
  const { error, userId, adminUser } = await requireAdmin({
    request,
  });

  if (error) return error;
  if (!userId || !adminUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid request" }, { status: 422 });
  }

  const result = await processWithdrawalPayout(parsed.data.withdrawalId);

  if (!result.ok) {
    return NextResponse.json({ error: result.message, code: result.code }, { status: result.status });
  }

  await auditLog({
    adminId: userId,
    action: "b2c_initiated",
    entityType: "withdrawal_requests",
    entityId: parsed.data.withdrawalId,
    before: result.before,
    after: {
      status: "processing",
      b2c_conversation_id: result.conversationId,
      b2c_originator_id: result.originatorConversationId,
      b2c_initiated_at: result.initiatedAt,
    },
    reason: parsed.data.reason ?? `B2C initiated via admin API by ${adminUser.role}`,
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
