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
    .from("wallet_transactions" as never)
    .select("id, user_id, type, amount, status, description, reference_table, reference_id, created_at, available_at" as never)
    .in("type" as never, ["activation_fee", "deposit"] as never)
    .order("created_at" as never, { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    if (statusFilter === "paid") {
      query = query.eq("status" as never, "available" as never);
    } else if (statusFilter === "pending") {
      query = query.in("status" as never, ["pending", "locked"] as never);
    } else {
      query = query.eq("status" as never, statusFilter as never);
    }
  }

  const { data: txns, error: txnsError } = await query;

  if (txnsError) {
    console.error("[GET /api/admin/payments] wallet transactions fetch failed", txnsError);
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 }
    );
  }

  const txnRows = (txns ?? []) as Array<{
    id: string;
    user_id: string;
    type: string;
    amount: number;
    status: string;
    description: string | null;
    reference_table: string | null;
    reference_id: string | null;
    created_at: string;
    available_at: string | null;
  }>;

  const actPaymentIds = [...new Set(txnRows.filter((t) => t.reference_table === "activation_payments" && t.reference_id).map((t) => t.reference_id).filter(Boolean))];

  const { data: actPayments, error: actPaymentsError } = actPaymentIds.length
    ? await supabase
        .from("activation_payments")
        .select("id, phone, mpesa_receipt, paid_at")
        .in("id", actPaymentIds)
    : { data: [], error: null };

  if (actPaymentsError) {
    console.error("[GET /api/admin/payments] activation payments bulk fetch failed", actPaymentsError);
  }

  const actPaymentsMap = new Map(((actPayments ?? []) as Array<{ id: string; phone: string; mpesa_receipt: string | null; paid_at: string | null }>).map((p) => [p.id, p]));

  const profileIds = [...new Set(txnRows.map((t) => t.user_id).filter(Boolean))];
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

  const paymentsWithProfiles = txnRows.map((t) => {
    const actPayment = t.reference_table === "activation_payments" && t.reference_id ? actPaymentsMap.get(t.reference_id) : null;
    const profile = profilesById.get(t.user_id) ?? { full_name: null, phone: null };

    let status: "pending" | "paid" | "failed" | "reversed" = "pending";
    if (t.status === "available") {
      status = "paid";
    } else if (t.status === "reversed") {
      status = "reversed";
    } else if (t.status === "pending" || t.status === "locked") {
      status = "pending";
    }

    return {
      id: t.id,
      user_id: t.user_id,
      amount: Number(t.amount ?? 0),
      phone: actPayment?.phone || profile.phone || "-",
      mpesa_receipt: actPayment?.mpesa_receipt || (t.type === "deposit" ? t.description : null),
      status,
      paid_at: t.available_at || actPayment?.paid_at || t.created_at,
      created_at: t.created_at,
      profiles: {
        full_name: profile.full_name,
        phone: profile.phone || actPayment?.phone || null,
      },
    };
  });

  const resolvedPayments = searchFilter
    ? paymentsWithProfiles.filter((payment) => {
        const haystack = [
          payment.mpesa_receipt,
          payment.phone,
          payment.profiles.full_name,
          payment.profiles.phone,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(searchFilter);
      })
    : paymentsWithProfiles;

  const { data: withdrawals, error: withError } = await supabase
    .from("withdrawal_requests" as never)
    .select("amount, amount_after_fee" as never)
    .eq("status" as never, "sent" as never);

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
    .from("wallet_transactions" as never)
    .select("status, amount, type, created_at, available_at" as never)
    .in("type" as never, ["activation_fee", "deposit"] as never);

  if (statsError) {
    console.error("[GET /api/admin/payments] payment stats fetch failed", statsError);
    return NextResponse.json(
      { error: "Failed to fetch payment totals" },
      { status: 500 }
    );
  }

  const allStats = (allStatsRaw || []) as Array<{ status: string; amount: number; type: string; created_at: string; available_at: string | null }>;
  const paidPayments = allStats.filter((t) => t.status === "available");
  
  const paidCount = paidPayments.length;
  const pendingCount = allStats.filter((t) => t.status === "pending" || t.status === "locked").length;
  
  // Fetch failed count from activation_payments (failed payments don't record wallet transactions)
  const { count: failedCountRaw, error: failedCountError } = await supabase
    .from("activation_payments" as never)
    .select("id" as never, { count: "exact" as never, head: true as never } as any)
    .eq("status" as never, "failed" as never);

  const failedCount = failedCountError ? 0 : (failedCountRaw ?? 0);
  
  const totalRevenue = paidPayments
    .filter((t) => t.type === "activation_fee")
    .reduce((sum, t) => sum + Number(t.amount ?? 0), 0);

  const netBalance = totalRevenue - totalWithdrawn;

  const activationPaidPayments = paidPayments
    .filter((t) => t.type === "activation_fee")
    .map((t) => ({
      amount: t.amount,
      paid_at: t.available_at || t.created_at,
    }));

  const revenueTrend = buildRevenueTrend(activationPaidPayments, trendPeriod);

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
