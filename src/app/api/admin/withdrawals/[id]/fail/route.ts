import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireAdmin, auditLog, getRequestMeta } from "../../../_lib";
import { z } from "zod";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const schema = z.object({
  reason: z.string().min(5, "Reason must be at least 5 characters"),
});

export async function POST(request: Request, { params }: RouteContext) {
  const { error, userId } = await requireAdmin({
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
    .select("id, user_id, amount, status, failure_reason")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !withdrawal) {
    return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
  }

  if (withdrawal.status === "failed") {
    return NextResponse.json(
      { error: "Withdrawal has already been declined" },
      { status: 409 }
    );
  }

  if (withdrawal.status === "sent") {
    return NextResponse.json(
      { error: "Cannot fail a withdrawal that has already been sent" },
      { status: 409 }
    );
  }

  const { data: before } = await (admin.from("withdrawal_requests" as never) as any)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  const now = new Date().toISOString();

  await (admin.from("withdrawal_requests" as never) as any)
    .update({
      status: "failed",
      failure_reason: parsed.data.reason,
      processed_at: now,
    })
    .eq("id", id);

  await (admin.from("wallet_transactions" as never) as any)
    .update({ status: "reversed" })
    .eq("reference_table", "withdrawal_requests")
    .eq("reference_id", id)
    .eq("direction", "debit");

  await (admin.from("wallet_transactions" as never) as any).insert({
    user_id: withdrawal.user_id,
    type: "reversal",
    direction: "credit",
    amount: withdrawal.amount,
    status: "available",
    bucket: "available",
    description: `Withdrawal reversal: ${parsed.data.reason}`,
    reference_table: "withdrawal_requests",
    reference_id: id,
  });

  await auditLog({
    adminId: userId,
    action: "withdrawal_fail",
    entityType: "withdrawal_requests",
    entityId: id,
    before,
    after: { status: "failed", failure_reason: parsed.data.reason, processed_at: now },
    reason: parsed.data.reason,
    ip: getRequestMeta(request).ip ?? undefined,
    userAgent: getRequestMeta(request).userAgent ?? undefined,
  });

  return NextResponse.json({ ok: true });
}
