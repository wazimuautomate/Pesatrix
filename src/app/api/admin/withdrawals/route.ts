import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireAdmin } from "../_lib";

export async function GET(request: Request) {
  const { error } = await requireAdmin({
    allowedRoles: ["super_admin", "finance"],
  });
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const admin = createAdminSupabaseClient();

  let query = (admin.from("withdrawal_requests" as never) as any)
    .select(
      "id, user_id, amount, phone, status, mpesa_txn_id, failure_reason, b2c_conversation_id, b2c_originator_id, created_at, processed_at, profiles(full_name, email)"
    )
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data: withdrawals, error: fetchError } = await query;

  if (fetchError) {
    return NextResponse.json({ error: "Failed to fetch withdrawals" }, { status: 500 });
  }

  const [{ data: counts }, { data: summary }] = await Promise.all([
    (admin.from("withdrawal_requests" as never) as any)
      .select("status, amount")
      .in("status", ["requested", "processing", "sent", "failed", "held"]),
    (admin.from("wallets" as never) as any)
      .select("user_id, available_balance")
      .limit(1000),
  ]);

  const statusCounts: Record<string, { count: number; total: number }> = {
    requested: { count: 0, total: 0 },
    processing: { count: 0, total: 0 },
    sent: { count: 0, total: 0 },
    failed: { count: 0, total: 0 },
    held: { count: 0, total: 0 },
  };

  for (const row of counts ?? []) {
    if (statusCounts[row.status]) {
      statusCounts[row.status].count += 1;
      statusCounts[row.status].total += Number(row.amount ?? 0);
    }
  }

  return NextResponse.json({
    withdrawals: withdrawals ?? [],
    counts: statusCounts,
  });
}
