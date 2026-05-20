import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireAdmin, auditLog, getRequestMeta } from "../../../_lib";
import { z } from "zod";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const schema = z.object({
  mpesaTxnId: z.string().trim().optional(),
  reason: z.string().optional(),
});

export async function POST(request: Request, { params }: RouteContext) {
  const { error, userId, adminUser } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 422 }
    );
  }

  const admin = createAdminSupabaseClient();

  const { data: withdrawal, error: fetchError } = await (admin.from("withdrawal_requests" as never) as any)
    .select("id, user_id, amount, status, mpesa_txn_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !withdrawal) {
    return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
  }

  if (withdrawal.status === "sent") {
    return NextResponse.json({ error: "Withdrawal already marked as sent" }, { status: 409 });
  }

  if (!["requested", "processing", "held", "failed"].includes(withdrawal.status)) {
    return NextResponse.json({ error: "Cannot mark this withdrawal as sent" }, { status: 409 });
  }

  const { data: before } = await (admin.from("withdrawal_requests" as never) as any)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const now = new Date().toISOString();
  const generatedTxnId =
    parsed.data.mpesaTxnId?.trim() ||
    `MOCK-${withdrawal.id.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`;

  const { error: updateError } = await (admin.from("withdrawal_requests" as never) as any)
    .update({
      status: "sent",
      mpesa_txn_id: generatedTxnId,
      processed_at: now,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to update withdrawal" }, { status: 500 });
  }

  await (admin.from("wallet_transactions" as never) as any)
    .update({ status: "available", bucket: "available" })
    .eq("reference_table", "withdrawal_requests")
    .eq("reference_id", id)
    .eq("direction", "debit");

  await auditLog({
    adminId: userId,
    action: "withdrawal_mark_sent",
    entityType: "withdrawal_requests",
    entityId: id,
    before,
    after: { status: "sent", mpesa_txn_id: generatedTxnId, processed_at: now },
    reason: parsed.data.reason ?? "Withdrawal approved with mock payout completion",
    ip: getRequestMeta(request).ip ?? undefined,
    userAgent: getRequestMeta(request).userAgent ?? undefined,
  });

  return NextResponse.json({ ok: true, mpesaTxnId: generatedTxnId });
}
