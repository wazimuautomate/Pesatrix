import { NextResponse } from "next/server";
import { requireAdmin } from "../_lib";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getAdminWithdrawals } from "@/lib/admin-withdrawals";

export async function GET(request: Request) {
  const { error } = await requireAdmin({
    allowedRoles: ["super_admin", "finance"],
  });
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const admin = createAdminSupabaseClient();

  let withdrawals;
  try {
    withdrawals = await getAdminWithdrawals({ status });
  } catch (fetchError) {
    console.error("[GET /api/admin/withdrawals] Failed to fetch withdrawals", fetchError);
    return NextResponse.json({ error: "Failed to fetch withdrawals" }, { status: 500 });
  }

  const { data: counts, error: countsError } = await (admin.from("withdrawal_requests" as never) as any)
    .select("status, amount")
    .in("status", ["requested", "processing", "sent", "failed", "held"]);

  if (countsError) {
    console.error("[GET /api/admin/withdrawals] Failed to fetch counts", countsError);
    return NextResponse.json({ error: "Failed to fetch withdrawals" }, { status: 500 });
  }

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
    withdrawals,
    counts: statusCounts,
  });
}
