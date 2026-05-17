import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireAdmin, auditLog } from "../../_lib";
import { z } from "zod";

const schema = z.object({
  userId: z.string().uuid(),
  direction: z.enum(["credit", "debit"]),
  amount: z.number().int().positive().max(100000),
  reason: z.string().min(5, "Reason must be at least 5 characters"),
});

export async function POST(request: Request) {
  const { error, adminUser, userId } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0].message } },
      { status: 422 }
    );
  }

  const { userId: targetUserId, direction, amount, reason } = parsed.data;

  const admin = createAdminSupabaseClient();

  const { data: txn, error: txnErr } = await admin
    .from("wallet_transactions")
    .insert({
      user_id: targetUserId,
      type: "admin_adjustment",
      direction,
      amount,
      status: "available",
      bucket: "available",
      description: `Admin adjustment: ${reason}`,
      created_by_admin_id: userId,
    })
    .select("id")
    .single();

  if (txnErr || !txn) {
    return NextResponse.json({ error: "Failed to create transaction" }, { status: 500 });
  }

  await auditLog({
    adminId: userId!,
    action: "wallet_adjustment",
    entityType: "wallet_transactions",
    entityId: txn.id,
    after: { user: targetUserId, direction, amount },
    reason,
  });

  return NextResponse.json({ ok: true, transactionId: txn.id });
}
