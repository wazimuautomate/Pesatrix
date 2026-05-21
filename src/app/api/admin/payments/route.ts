import { NextResponse } from "next/server";
import { requireAdmin } from "../_lib";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type ActivationPaymentRow = {
  id: string;
  user_id: string;
  amount: number | string;
  phone: string;
  status: string;
  checkout_request_id: string | null;
  merchant_request_id: string | null;
  mpesa_receipt: string | null;
  callback_validation_error: string | null;
  paid_at: string | null;
  created_at: string;
  stk_initiated_at: string | null;
  stk_completed_at: string | null;
  safaricom_ip: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

type TrendPeriod = "day" | "week" | "month";

export async function GET(request: Request) {
  const { error, adminUser } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });

  if (error) return error;

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");
  const searchFilter = url.searchParams.get("search")?.toLowerCase();
  const trendPeriod = normalizeTrendPeriod(url.searchParams.get("trend"));

  const supabase = createAdminSupabaseClient();

  let query = supabase
    .from("activation_payments")
    .select("id, user_id, amount, phone, status, checkout_request_id, merchant_request_id, mpesa_receipt, callback_validation_error, paid_at, created_at, stk_initiated_at, stk_completed_at, safaricom_ip")
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data: payments, error: paymentsError } = await query;

  if (paymentsError) {
    console.error("[GET /api/admin/payments] activation payment fetch failed", paymentsError);
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    );
  }

  const paymentRows = (payments ?? []) as ActivationPaymentRow[];
  const profileIds = [...new Set(paymentRows.map((payment) => payment.user_id).filter(Boolean))];
  const { data: profiles, error: profilesError } = profileIds.length
    ? await (supabase.from("profiles" as never) as any)
        .select("id, full_name, phone")
        .in("id", profileIds)
    : { data: [], error: null };

  if (profilesError) {
    console.error("[GET /api/admin/payments] profile fetch failed", profilesError);
    return NextResponse.json(
      { error: "Failed to fetch payment profiles" },
      { status: 500 }
    );
  }

  const profilesById = new Map(
    ((profiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile])
  );

  const paymentsWithProfiles = paymentRows.map((payment) => ({
    ...payment,
    amount: Number(payment.amount ?? 0),
    profiles: profilesById.get(payment.user_id) ?? {
      full_name: null,
      phone: null,
    },
  }));

  const resolvedPayments = searchFilter
    ? paymentsWithProfiles.filter((payment) => {
        const haystack = [
          payment.mpesa_receipt,
          payment.phone,
          payment.profiles.full_name,
          payment.profiles.phone,
          payment.checkout_request_id,
          payment.merchant_request_id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(searchFilter);
      })
    : paymentsWithProfiles;

  const { data: withdrawals, error: withError } = await supabase
    .from("withdrawal_requests" as never)
    .select("amount, amount_after_fee")
    .eq("status", "sent");

  if (withError) {
    console.error("[GET /api/admin/payments] withdrawal fetch failed", withError);
    return NextResponse.json(
      { error: "Failed to fetch withdrawal totals" },
      { status: 500 }
    );
  }

  const totalWithdrawn =
    ((withdrawals ?? []) as Array<{ amount: number | string; amount_after_fee?: number | string | null }>).reduce(
      (sum, withdrawal) => sum + Number(withdrawal.amount_after_fee ?? withdrawal.amount ?? 0),
      0
    );

  const { data: allStatsRaw, error: statsError } = await supabase
    .from("activation_payments")
    .select("status, amount, paid_at");

  if (statsError) {
    console.error("[GET /api/admin/payments] payment stats fetch failed", statsError);
    return NextResponse.json(
      { error: "Failed to fetch payment totals" },
      { status: 500 }
    );
  }

  const allStats = (allStatsRaw || []) as Array<{ status: string; amount: number | string; paid_at: string | null }>;
  const paidPayments = allStats.filter((payment) => payment.status === "paid");
  const paidCount = paidPayments.length;
  const pendingCount = allStats.filter((payment) => payment.status === "pending").length;
  const failedCount = allStats.filter((payment) => payment.status === "failed").length;
  
  const totalRevenue = paidPayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const netBalance = totalRevenue - totalWithdrawn;

  const revenueTrend = buildRevenueTrend(paidPayments, trendPeriod);

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
    revenue_trend: revenueTrend,
    daily_revenue: revenueTrend,
    trend_period: trendPeriod,
  });
}

function normalizeTrendPeriod(value: string | null): TrendPeriod {
  return value === "week" || value === "month" ? value : "day";
}

function buildRevenueTrend(
  paidPayments: Array<{ amount: number | string; paid_at: string | null }>,
  period: TrendPeriod
) {
  const bucketCount = period === "day" ? 30 : 12;
  const buckets = new Map<string, { label: string; count: number; amount: number }>();

  for (let offset = bucketCount - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    if (period === "day") {
      date.setDate(date.getDate() - offset);
    } else if (period === "week") {
      date.setDate(date.getDate() - offset * 7);
    } else {
      date.setMonth(date.getMonth() - offset);
    }

    const key = getTrendKey(date, period);
    buckets.set(key, {
      label: getTrendLabel(date, period),
      count: 0,
      amount: 0,
    });
  }

  for (const payment of paidPayments) {
    if (!payment.paid_at) continue;

    const paidAt = new Date(payment.paid_at);
    if (Number.isNaN(paidAt.getTime())) continue;

    const key = getTrendKey(paidAt, period);
    const bucket = buckets.get(key);
    if (!bucket) continue;

    bucket.count += 1;
    bucket.amount += Number(payment.amount ?? 0);
  }

  return Array.from(buckets.entries()).map(([date, stats]) => ({
    date,
    ...stats,
  }));
}

function getTrendKey(date: Date, period: TrendPeriod) {
  if (period === "day") {
    return date.toISOString().split("T")[0];
  }

  if (period === "week") {
    const weekStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
    return weekStart.toISOString().split("T")[0];
  }

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getTrendLabel(date: Date, period: TrendPeriod) {
  if (period === "day") {
    return date.toLocaleDateString("en-KE", { day: "numeric", month: "short" });
  }

  if (period === "week") {
    return `Week of ${date.toLocaleDateString("en-KE", { day: "numeric", month: "short" })}`;
  }

  return date.toLocaleDateString("en-KE", { month: "short", year: "2-digit" });
}
