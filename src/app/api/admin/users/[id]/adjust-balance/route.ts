import { NextResponse } from "next/server";
import { z } from "zod";

import { auditLog, requireAdmin } from "../../../_lib";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const schema = z.object({
  direction: z.enum(["credit", "debit"]),
  amount: z.number().int().positive().max(100000),
  reason: z.string().trim().min(10, "Reason must be at least 10 characters").max(500),
});

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const { error, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["finance", "super_admin"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid adjustment" } },
      { status: 422 }
    );
  }

  const { direction, amount, reason } = parsed.data;
  const admin = createAdminSupabaseClient();

  const { data: walletBefore, error: walletError } = await (admin.from("wallets" as never) as any)
    .select("available_balance, pending_balance, total_earned")
    .eq("user_id", id)
    .maybeSingle();

  if (walletError) {
    return NextResponse.json({ error: "Failed to load wallet" }, { status: 500 });
  }

  const availableBefore = Number(walletBefore?.available_balance ?? 0);
  if (direction === "debit" && availableBefore < amount) {
    return NextResponse.json(
      { error: { code: "INSUFFICIENT_BALANCE", message: "Insufficient available balance" } },
      { status: 422 }
    );
  }

  const { data: transaction, error: transactionError } = await (admin.from("wallet_transactions" as never) as any)
    .insert({
      user_id: id,
      type: "admin_adjustment",
      direction,
      amount,
      status: "available",
      bucket: "available",
      description: `Admin adjustment: ${reason}`,
      created_by_admin_id: userId,
    })
    .select("*")
    .single();

  if (transactionError || !transaction) {
    return NextResponse.json({ error: "Failed to create adjustment" }, { status: 500 });
  }

  const { data: walletAfter } = await (admin.from("wallets" as never) as any)
    .select("available_balance, pending_balance, total_earned")
    .eq("user_id", id)
    .maybeSingle();

  await auditLog({
    adminId: userId,
    action: "balance_adjustment",
    entityType: "wallet_transactions",
    entityId: transaction.id,
    before: { balance: walletBefore ?? { available_balance: 0, pending_balance: 0, total_earned: 0 } },
    after: { balance: walletAfter ?? null, transaction },
    reason,
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({
    wallet: walletAfter ?? { available_balance: availableBefore, pending_balance: 0, total_earned: 0 },
    transaction,
  });
}
