import { NextResponse } from "next/server";

import { requireAdmin } from "../../_lib";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { error } = await requireAdmin({ request, allowedRoles: ["admin"] });
  if (error) return error;

  const admin = createAdminSupabaseClient();
  const [verificationResult, withdrawalsResult, approvedSubmissionsResult, auditResult, suspendedResult, settingResult] = await Promise.all([
    (admin.from("user_verification" as never) as any)
      .select("user_id, risk_score, flags")
      .gt("risk_score", 50)
      .order("risk_score", { ascending: false })
      .limit(100),
    (admin.from("withdrawal_requests" as never) as any)
      .select("user_id, amount, status, created_at")
      .in("status", ["sent", "requested", "processing", "held"])
      .gte("created_at", daysAgo(7)),
    (admin.from("task_submissions" as never) as any)
      .select("user_id")
      .eq("status", "approved"),
    (admin.from("audit_log" as never) as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
    (admin.from("account_status" as never) as any)
      .select("user_id, status, suspended_at, suspension_reason")
      .eq("status", "suspended"),
    (admin.from("platform_settings" as never) as any)
      .select("value")
      .eq("key", "withdrawal_max_daily_count")
      .maybeSingle(),
  ]);

  const withdrawals = withdrawalsResult.data ?? [];
  const approvedSubmitters = new Set((approvedSubmissionsResult.data ?? []).map((row: any) => row.user_id));
  const allUserIds = [
    ...(verificationResult.data ?? []).map((row: any) => row.user_id),
    ...withdrawals.map((row: any) => row.user_id),
    ...(suspendedResult.data ?? []).map((row: any) => row.user_id),
  ].filter(Boolean);
  const uniqueUserIds = [...new Set(allUserIds)];
  const { data: profiles } = uniqueUserIds.length
    ? await (admin.from("profiles" as never) as any).select("id, full_name, phone").in("id", uniqueUserIds)
    : { data: [] };
  const { data: referrals } = uniqueUserIds.length
    ? await (admin.from("referrals" as never) as any).select("referrer_id").in("referrer_id", uniqueUserIds)
    : { data: [] };
  const profileById = new Map<string, any>((profiles ?? []).map((row: any) => [row.id, row]));
  const referralCounts = new Map<string, number>();
  for (const referral of referrals ?? []) {
    referralCounts.set(referral.referrer_id, (referralCounts.get(referral.referrer_id) ?? 0) + 1);
  }

  const withdrawnByUser = new Map<string, number>();
  const countByUser = new Map<string, number>();
  for (const withdrawal of withdrawals) {
    withdrawnByUser.set(withdrawal.user_id, (withdrawnByUser.get(withdrawal.user_id) ?? 0) + Number(withdrawal.amount ?? 0));
    countByUser.set(withdrawal.user_id, (countByUser.get(withdrawal.user_id) ?? 0) + 1);
  }
  const maxDailyCount = Number(settingResult.data?.value ?? 2);

  return NextResponse.json({
    highRiskUsers: (verificationResult.data ?? []).map((row: any) => ({
      userId: row.user_id,
      name: profileById.get(row.user_id)?.full_name ?? "Unknown user",
      phone: profileById.get(row.user_id)?.phone ?? null,
      riskScore: Number(row.risk_score ?? 0),
      flags: row.flags ?? {},
      totalWithdrawn: withdrawnByUser.get(row.user_id) ?? 0,
      activatedReferrals: referralCounts.get(row.user_id) ?? 0,
    })),
    zeroTaskWithdrawers: [...withdrawnByUser.entries()]
      .filter(([userId, total]) => total > 0 && !approvedSubmitters.has(userId))
      .map(([userId, totalWithdrawn]) => ({
        userId,
        name: profileById.get(userId)?.full_name ?? "Unknown user",
        phone: profileById.get(userId)?.phone ?? null,
        totalWithdrawn,
        taskSubmissions: 0,
      })),
    highVelocityWithdrawers: [...countByUser.entries()]
      .filter(([, count]) => count > maxDailyCount)
      .map(([userId, count]) => ({
        userId,
        name: profileById.get(userId)?.full_name ?? "Unknown user",
        phone: profileById.get(userId)?.phone ?? null,
        withdrawalCount7d: count,
        totalAmount7d: withdrawnByUser.get(userId) ?? 0,
      })),
    recentAuditLog: auditResult.data ?? [],
    suspendedUsers: (suspendedResult.data ?? []).map((row: any) => ({
      ...row,
      profile: profileById.get(row.user_id) ?? null,
    })),
  });
}

function daysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}
