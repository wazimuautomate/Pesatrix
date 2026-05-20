import { NextResponse } from "next/server";

import { requireAdmin } from "@/app/api/admin/_lib";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { error } = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "fraud"],
  });
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter") ?? "all";
  const admin = createAdminSupabaseClient();

  const { data: adminUsers } = await (admin.from("admin_users" as never) as any)
    .select("user_id");
  const adminUserIds = new Set((adminUsers ?? []).map((row: { user_id: string }) => row.user_id));

  const { data, error: fetchError } = await (admin.from("user_verification" as never) as any)
    .select(
      `user_id, risk_score, flags, phone_verified, kyc_status, ai_fraud_score, ai_fraud_reasoning, ai_fraud_scanned_at, updated_at,
       profiles(full_name, email, phone, created_at),
       account_status(status, suspension_reason, suspended_at)`
    )
    .order("risk_score", { ascending: false })
    .limit(200);

  if (fetchError) {
    console.error("[GET /api/admin/fraud/users]", fetchError);
    return NextResponse.json({ error: "Failed to fetch fraud users" }, { status: 500 });
  }

  const rows = (data ?? [])
    .filter((row: { user_id: string }) => !adminUserIds.has(row.user_id))
    .map(normalizeFraudUser)
    .filter((row: FraudUserRow) => matchesFilter(row, filter));

  const userIds = rows.map((row: FraudUserRow) => row.userId);
  const [devicesResult, submissionsResult, withdrawalsResult] = userIds.length
    ? await Promise.all([
        (admin.from("device_sessions" as never) as any)
          .select("user_id, ip_address, ip_country, ip_is_vpn, ip_is_datacenter, created_at")
          .in("user_id", userIds)
          .order("created_at", { ascending: false }),
        (admin.from("task_submissions" as never) as any)
          .select("id, user_id, status, ai_score, ai_reasoning, submitted_at")
          .in("user_id", userIds)
          .order("submitted_at", { ascending: false })
          .limit(500),
        (admin.from("withdrawal_requests" as never) as any)
          .select("user_id, id, amount, status, created_at")
          .in("user_id", userIds)
          .eq("status", "held"),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const devicesByUser = groupByUser(devicesResult.data ?? [], 5);
  const submissionsByUser = groupByUser(submissionsResult.data ?? [], 8);
  const heldWithdrawalsByUser = groupByUser(withdrawalsResult.data ?? [], 10);

  return NextResponse.json({
    users: rows.map((row: FraudUserRow) => ({
      ...row,
      devices: devicesByUser.get(row.userId) ?? [],
      submissions: submissionsByUser.get(row.userId) ?? [],
      heldWithdrawals: heldWithdrawalsByUser.get(row.userId) ?? [],
    })),
  });
}

type FraudUserRow = ReturnType<typeof normalizeFraudUser>;

function normalizeFraudUser(row: any) {
  const profile = firstRelation(row.profiles);
  const account = firstRelation(row.account_status);

  return {
    userId: String(row.user_id),
    name: profile?.full_name ?? profile?.email ?? "Unnamed user",
    email: profile?.email ?? null,
    phone: profile?.phone ?? null,
    createdAt: profile?.created_at ?? null,
    riskScore: Number(row.risk_score ?? 0),
    aiScore: row.ai_fraud_score === null || row.ai_fraud_score === undefined ? null : Number(row.ai_fraud_score),
    aiReasoning: row.ai_fraud_reasoning ?? null,
    aiScannedAt: row.ai_fraud_scanned_at ?? null,
    flags: isPlainObject(row.flags) ? row.flags : {},
    phoneVerified: row.phone_verified === true,
    kycStatus: row.kyc_status ?? "unknown",
    status: account?.status ?? "active",
    suspensionReason: account?.suspension_reason ?? null,
    suspendedAt: account?.suspended_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function matchesFilter(row: FraudUserRow, filter: string) {
  if (filter === "pending") return isFlagged(row) && !row.aiScannedAt && row.status !== "suspended";
  if (filter === "auto_suspended") {
    return row.status === "suspended" && String(row.suspensionReason ?? "").toLowerCase().includes("auto");
  }
  if (filter === "cleared") return row.aiScannedAt !== null && row.riskScore === 0 && (row.aiScore ?? 0) < 40;
  return isFlagged(row);
}

function isFlagged(row: FraudUserRow) {
  return row.riskScore >= 40 || (row.aiScore ?? 0) >= 40 || row.status === "suspended" || Object.keys(row.flags).length > 0;
}

function groupByUser(rows: any[], limit: number) {
  const map = new Map<string, any[]>();
  for (const row of rows) {
    const key = String(row.user_id);
    const current = map.get(key) ?? [];
    if (current.length < limit) {
      current.push(row);
      map.set(key, current);
    }
  }
  return map;
}

function firstRelation(value: unknown): any | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value && typeof value === "object" ? value : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
