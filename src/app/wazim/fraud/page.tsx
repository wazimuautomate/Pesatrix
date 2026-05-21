import { AdminPageShell } from "@/components/admin/admin-native";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { asArray, firstRelation, requireWazimAdmin } from "@/lib/wazim-admin";
import { FraudDashboardClient, type FraudDashboardUser, type FraudMode } from "./fraud-dashboard-client";

const FRAUD_AI_MODE_KEY = "fraud_ai_mode";
const FRAUD_AI_LAST_CRON_RUN_KEY = "fraud_ai_last_cron_run";

export default async function AdminFraudPage() {
  const adminSession = await requireWazimAdmin();

  const admin = createAdminSupabaseClient();
  const [settingsResult, adminUsersResult, verificationResult] = await Promise.all([
    (admin.from("platform_settings" as never) as any)
      .select("key, value, updated_at")
      .in("key", [FRAUD_AI_MODE_KEY, FRAUD_AI_LAST_CRON_RUN_KEY]),
    (admin.from("admin_users" as never) as any).select("user_id"),
    (admin.from("user_verification" as never) as any)
      .select(
        `user_id, risk_score, flags, phone_verified, kyc_status, ai_fraud_score, ai_fraud_reasoning, ai_fraud_scanned_at, updated_at,
         profiles(full_name, email, phone, created_at),
         account_status(status, suspension_reason, suspended_at)`
      )
      .order("risk_score", { ascending: false })
      .limit(200),
  ]);

  const adminUserIds = new Set(asArray<{ user_id: string }>(adminUsersResult.data).map((row) => row.user_id));
  const rows = asArray<any>(verificationResult.data).filter((row) => !adminUserIds.has(String(row.user_id)));
  const userIds = rows.map((row) => String(row.user_id));

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

  const settings = new Map(asArray<{ key: string; value: string }>(settingsResult.data).map((row) => [row.key, row.value]));
  const mode = normalizeMode(settings.get(FRAUD_AI_MODE_KEY));
  const devicesByUser = groupByUser(asArray(devicesResult.data), 5);
  const submissionsByUser = groupByUser(asArray(submissionsResult.data), 8);
  const heldWithdrawalsByUser = groupByUser(asArray(withdrawalsResult.data), 10);

  const users: FraudDashboardUser[] = rows.map((row) => {
    const profile = firstRelation<any>(row.profiles);
    const account = firstRelation<any>(row.account_status);
    const userId = String(row.user_id);

    return {
      userId,
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
      devices: devicesByUser.get(userId) ?? [],
      submissions: submissionsByUser.get(userId) ?? [],
      heldWithdrawals: heldWithdrawalsByUser.get(userId) ?? [],
    };
  });

  return (
    <AdminPageShell
      admin={adminSession}
      title="Fraud AI Scoring"
      description=""
    >
      <FraudDashboardClient
        initialMode={mode}
        initialLastCronRun={settings.get(FRAUD_AI_LAST_CRON_RUN_KEY) ?? null}
        initialUsers={users}
      />
    </AdminPageShell>
  );
}

function normalizeMode(value: unknown): FraudMode {
  return value === "auto" || value === "manual" || value === "disabled" ? value : "manual";
}

function groupByUser(rows: any[], limit: number) {
  const map = new Map<string, any[]>();
  for (const row of rows) {
    const userId = String(row.user_id);
    const current = map.get(userId) ?? [];
    if (current.length < limit) {
      current.push(row);
      map.set(userId, current);
    }
  }
  return map;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
