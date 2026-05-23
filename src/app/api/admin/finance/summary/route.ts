import { NextResponse } from "next/server";

import { requireAdmin } from "../../_lib";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { error } = await requireAdmin({ request, allowedRoles: ["finance", "super_admin"] });
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") ?? "30d";
  const since = period === "7d"
    ? daysAgo(7)
    : period === "30d"
      ? daysAgo(30)
      : null;

  const admin = createAdminSupabaseClient();
  const activationQuery = (admin.from("activation_payments" as never) as any)
    .select("id, user_id, amount, status, paid_at, created_at")
    .eq("status", "paid");
  const withdrawalQuery = (admin.from("withdrawal_requests" as never) as any)
    .select("id, user_id, amount, status, mpesa_txn_id, b2c_request_id, created_at, processed_at")
    .order("created_at", { ascending: false });
  const bonusQuery = (admin.from("wallet_transactions" as never) as any)
    .select("id, user_id, amount, status, type, created_at")
    .eq("type", "referral_bonus");

  if (since) {
    activationQuery.gte("paid_at", since);
    withdrawalQuery.gte("created_at", since);
    bonusQuery.gte("created_at", since);
  }

  const [activationsResult, withdrawalsResult, referralBonusesResult] = await Promise.all([
    activationQuery,
    withdrawalQuery,
    bonusQuery,
  ]);

  if (activationsResult.error || withdrawalsResult.error || referralBonusesResult.error) {
    return NextResponse.json({ error: "Failed to compute finance summary" }, { status: 500 });
  }

  const activations = activationsResult.data ?? [];
  const withdrawals = withdrawalsResult.data ?? [];
  const referralBonuses = referralBonusesResult.data ?? [];
  const sentWithdrawals = withdrawals.filter((row: any) => row.status === "sent");
  const pendingWithdrawals = withdrawals.filter((row: any) => ["requested", "processing"].includes(row.status));
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const weekStart = daysAgo(7);

  const topByUser = new Map<string, number>();
  for (const withdrawal of sentWithdrawals) {
    topByUser.set(withdrawal.user_id, (topByUser.get(withdrawal.user_id) ?? 0) + Number(withdrawal.amount ?? 0));
  }
  const topUserIds = [...topByUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([userId]) => userId);

  const { data: topProfiles } = topUserIds.length
    ? await (admin.from("profiles" as never) as any)
        .select("id, full_name, phone")
        .in("id", topUserIds)
    : { data: [] };
  const { data: topStatuses } = topUserIds.length
    ? await (admin.from("account_status" as never) as any)
        .select("user_id, activated_at")
        .in("user_id", topUserIds)
    : { data: [] };
  const { data: topReferrals } = topUserIds.length
    ? await (admin.from("referrals" as never) as any)
        .select("referrer_id")
        .in("referrer_id", topUserIds)
    : { data: [] };
  const profileById = new Map<string, any>((topProfiles ?? []).map((row: any) => [row.id, row]));
  const statusById = new Map<string, any>((topStatuses ?? []).map((row: any) => [row.user_id, row]));
  const referralCounts = new Map<string, number>();
  for (const referral of topReferrals ?? []) {
    referralCounts.set(referral.referrer_id, (referralCounts.get(referral.referrer_id) ?? 0) + 1);
  }

  const dailyBreakdown = buildDailyBreakdown(activations, sentWithdrawals);
  const recentWithdrawals = withdrawals.slice(0, 20);
  const recentUserIds = [...new Set(recentWithdrawals.map((row: any) => row.user_id).filter(Boolean))];
  const { data: recentProfiles } = recentUserIds.length
    ? await (admin.from("profiles" as never) as any)
        .select("id, full_name, phone")
        .in("id", recentUserIds)
    : { data: [] };
  const recentProfileById = new Map<string, any>((recentProfiles ?? []).map((row: any) => [row.id, row]));

  const totalActivationRevenue = sum(activations);
  const totalWithdrawn = sum(sentWithdrawals);
  const totalPendingWithdrawals = sum(pendingWithdrawals);
  const netPosition = totalActivationRevenue - totalWithdrawn;

  return NextResponse.json({
    inflow: {
      totalActivations: activations.length,
      totalActivationRevenue,
      activationsToday: activations.filter((row: any) => new Date(row.paid_at ?? row.created_at) >= todayStart).length,
      activationsThisWeek: activations.filter((row: any) => new Date(row.paid_at ?? row.created_at) >= new Date(weekStart)).length,
    },
    outflow: {
      totalWithdrawn,
      totalPendingWithdrawals,
      totalReferralBonusesPaid: sum(referralBonuses.filter((row: any) => row.status === "available")),
      totalReferralBonusesPending: sum(referralBonuses.filter((row: any) => row.status === "pending")),
    },
    netPosition,
    riskFlag: netPosition < totalPendingWithdrawals,
    dailyBreakdown,
    topWithdrawers: topUserIds.map((userId) => {
      const profile = profileById.get(userId);
      return {
        userId,
        name: profile?.full_name ?? "Unknown user",
        phone: profile?.phone ?? null,
        totalWithdrawn: topByUser.get(userId) ?? 0,
        activatedAt: statusById.get(userId)?.activated_at ?? null,
        referralsMade: referralCounts.get(userId) ?? 0,
      };
    }),
    recentWithdrawals: recentWithdrawals.map((withdrawal: any) => ({
      ...withdrawal,
      user: recentProfileById.get(withdrawal.user_id) ?? null,
    })),
  });
}

function daysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

function sum(rows: any[]) {
  return rows.reduce((total, row) => total + Number(row.amount ?? 0), 0);
}

function dayKey(value: unknown) {
  const date = value ? new Date(String(value)) : new Date();
  return date.toISOString().slice(0, 10);
}

function buildDailyBreakdown(activations: any[], withdrawals: any[]) {
  const rows = new Map<string, any>();
  for (let i = 29; i >= 0; i -= 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - i);
    const key = date.toISOString().slice(0, 10);
    rows.set(key, { date: key, activations: 0, activationRevenue: 0, withdrawalsSent: 0, withdrawalAmount: 0 });
  }

  for (const activation of activations) {
    const key = dayKey(activation.paid_at ?? activation.created_at);
    const row = rows.get(key);
    if (row) {
      row.activations += 1;
      row.activationRevenue += Number(activation.amount ?? 0);
    }
  }

  for (const withdrawal of withdrawals) {
    const key = dayKey(withdrawal.processed_at ?? withdrawal.created_at);
    const row = rows.get(key);
    if (row) {
      row.withdrawalsSent += 1;
      row.withdrawalAmount += Number(withdrawal.amount ?? 0);
    }
  }

  return [...rows.values()];
}
