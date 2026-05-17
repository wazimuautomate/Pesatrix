import { NextResponse } from "next/server";
import { requireAdmin } from "../_lib";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { error, adminUser } = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "finance", "admin", "support"],
  });

  if (error) return error;

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");
  const searchFilter = url.searchParams.get("search")?.toLowerCase();

  const supabase = createAdminSupabaseClient();

  // 1. Fetch payments with optional server-side search
  let query = supabase
    .from("activation_payments")
    .select(`
      *,
      profiles:user_id (full_name, phone)
    `)
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  if (searchFilter) {
    query = query.or(
      `mpesa_receipt.ilike.%${searchFilter}%,phone.ilike.%${searchFilter}%`
    );
  }

  const { data: payments, error: paymentsError } = await query;

  if (paymentsError) {
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    );
  }

  // For profile-based search (full_name), filter client-side since Supabase
  // nested select doesn't support or() across relations
  const resolvedPayments = searchFilter
    ? (payments || []).filter((p: Record<string, unknown>) => {
        if (!searchFilter) return true;
        const matchProfileName =
          p.profiles &&
          !Array.isArray(p.profiles) &&
          (p.profiles as Record<string, unknown>).full_name?.toString().toLowerCase().includes(searchFilter);
        const matchProfilePhone =
          p.profiles &&
          !Array.isArray(p.profiles) &&
          (p.profiles as Record<string, unknown>).phone?.toString().toLowerCase().includes(searchFilter);
        return matchProfileName || matchProfilePhone;
      })
    : payments || [];

  // 2. Fetch withdrawal requests for total sent
  const { data: withdrawals, error: withError } = await supabase
    .from("withdrawal_requests")
    .select("amount")
    .eq("status", "sent");

  const totalWithdrawn =
    (withdrawals as Array<{ amount: number | string }> || []).reduce((sum: number, w: { amount: number | string }) => sum + Number(w.amount || 0), 0);

  // 3. To get accurate global stats (unfiltered), we fetch a minimal aggregate of ALL payments
  const { data: allStatsRaw } = await supabase
    .from("activation_payments")
    .select("status, amount, paid_at");

  const allStats = allStatsRaw || [];
  const paidCount = allStats.filter((p: Record<string, unknown>) => p.status === "paid").length;
  const pendingCount = allStats.filter((p: Record<string, unknown>) => p.status === "pending").length;
  const failedCount = allStats.filter((p: Record<string, unknown>) => p.status === "failed").length;
  
  // Total Revenue (Paid Activations * 500)
  // Assuming each paid activation is 500 KES as per specs, or use sum of amounts
  // We'll use count * 500
  const totalRevenue = paidCount * 500;
  const netBalance = totalRevenue - totalWithdrawn;

  // 4. Daily revenue for the last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const dailyRevenueMap: Record<string, { count: number; amount: number }> = {};
  
  // Initialize last 30 days to 0
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    dailyRevenueMap[dateStr] = { count: 0, amount: 0 };
  }

  allStats.forEach((p: Record<string, unknown>) => {
    if (p.status === "paid" && p.paid_at) {
      const pDateStr = new Date(p.paid_at as string).toISOString().split("T")[0];
      if (dailyRevenueMap[pDateStr]) {
        dailyRevenueMap[pDateStr].count += 1;
        dailyRevenueMap[pDateStr].amount += 500; // Using 500 KSH
      }
    }
  });

  const dailyRevenue = Object.entries(dailyRevenueMap)
    .map(([date, stats]) => ({
      date,
      ...stats,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    payments: resolvedPayments,
    summary: {
      total_paid_count: paidCount,
      total_revenue_ksh: totalRevenue,
      total_withdrawn_ksh: totalWithdrawn,
      net_ksh: netBalance,
      pending_count: pendingCount,
      failed_count: failedCount,
    },
    daily_revenue: dailyRevenue,
  });
}
