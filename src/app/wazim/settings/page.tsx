import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminPageShell, MetricCard } from "@/components/admin/admin-native";
import { AiProviderManager } from "@/components/admin/ai-provider-manager";
import { AiHealthPanel } from "@/components/admin/ai-health-panel";
import { TrainingSettingsForm } from "@/components/admin/training-settings-form";
import { PlatformSettingsForm } from "@/components/admin/platform-settings-form";
import { TaskLimitsSettingsForm } from "@/components/admin/task-limits-settings-form";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  DEFAULT_DAILY_TASK_LIMIT,
  DAILY_TASK_LIMIT_KEY,
  REFERRAL_LEVEL_1_REWARD_KEY,
  DEFAULT_REFERRAL_REWARD_KSH,
  DEFAULT_TRAINING_REWARD_KSH,
  DEFAULT_WITHDRAWAL_HOLD_DAYS,
  ACTIVATION_FEE_KSH_KEY,
  WITHDRAWAL_HOLD_DAYS_KEY,
} from "@/lib/platform-settings";
import { getEnvironmentReadiness } from "@/lib/environment-readiness";
import { requireWazimAdmin } from "@/lib/wazim-admin";

async function getPlatformSettings() {
  const admin = createAdminSupabaseClient();

  const { data, error } = await (admin.from("platform_settings" as never) as any)
    .select("key, value, description, updated_by_admin_id, updated_at")
    .order("key", { ascending: true });

  if (error) {
    console.error("Failed to fetch platform settings:", error);
    return [];
  }

  return data ?? [];
}

async function getAiProviderConfigs() {
  const admin = createAdminSupabaseClient();

  const { data, error } = await admin
    .from("ai_provider_configs")
    .select("id, provider, model_id, display_name, api_key_secret_name, is_active, is_grading_model, base_url, max_tokens, temperature, created_by, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch AI provider configs:", error);
    return [];
  }

  return data ?? [];
}

async function getStuckAiReviewCount() {
  const admin = createAdminSupabaseClient();
  const { count, error } = await admin
    .from("task_submissions")
    .select("id", { count: "exact", head: true })
    .eq("status", "ai_reviewing");

  if (error) {
    console.error("Failed to count stuck AI submissions:", error);
    return 0;
  }

  return count ?? 0;
}

export default async function AdminSettingsPage() {
  const adminSession = await requireWazimAdmin();
  const settings = await getPlatformSettings();
  const aiProviders = await getAiProviderConfigs();
  const stuckAiReviewCount = await getStuckAiReviewCount();

  const trainingRewardSetting = settings.find((s: { key: string }) => s.key === "training_completion_reward_ksh");
  const activationFeeSetting = settings.find((s: { key: string }) => s.key === ACTIVATION_FEE_KSH_KEY);
  const holdSetting = settings.find((s: { key: string }) => s.key === WITHDRAWAL_HOLD_DAYS_KEY);
  const dailyTaskLimitSetting = settings.find((s: { key: string }) => s.key === DAILY_TASK_LIMIT_KEY);
  const referralLevel1Setting = settings.find((s: { key: string }) => s.key === REFERRAL_LEVEL_1_REWARD_KEY);
  const environmentSettings = getEnvironmentReadiness();
  const dailyTaskLimit = Number.isInteger(Number(dailyTaskLimitSetting?.value))
    ? Number(dailyTaskLimitSetting?.value)
    : DEFAULT_DAILY_TASK_LIMIT;
  const referralReward = referralLevel1Setting?.value ?? DEFAULT_REFERRAL_REWARD_KSH;

  return (
    <AdminPageShell
      admin={adminSession}
      title="Settings"
      description=""
    >
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Training reward"
          value={`KSh ${trainingRewardSetting?.value ?? DEFAULT_TRAINING_REWARD_KSH}`}
          detail="Configurable below"
          tone="amber"
        />
        <MetricCard
          label="Activation fee"
          value={activationFeeSetting?.value ? `KSh ${activationFeeSetting.value}` : "Not configured"}
          detail="Charged on account activation"
          tone="amber"
        />
        <MetricCard
          label="Withdrawal hold"
          value={`${holdSetting?.value ?? DEFAULT_WITHDRAWAL_HOLD_DAYS} days`}
          detail="Before funds are withdrawable"
        />
        <MetricCard
          label="Referral payouts"
          value={`KSh ${referralReward}`}
          detail="Per direct activation"
          tone="amber"
        />
        <MetricCard
          label="Admin role"
          value={adminSession.role}
          detail={adminSession.email ?? "Signed in admin"}
          tone="teal"
        />
      </section>

      <PlatformSettingsForm initialSettings={settings} />

      <AiHealthPanel initialStuckCount={stuckAiReviewCount} />

      <AiProviderManager initialProviders={aiProviders} />

      <Card className="mt-6 border border-outline-variant/40 shadow-sm">
        <CardHeader><CardTitle className="text-lg text-navy">Task Limits</CardTitle></CardHeader>
        <CardContent>
          <TaskLimitsSettingsForm initialDailyLimit={dailyTaskLimit} />
        </CardContent>
      </Card>

      <Card className="mt-6 border border-outline-variant/40 shadow-sm">
        <CardHeader><CardTitle className="text-lg text-navy">Training Time Limit</CardTitle></CardHeader>
        <CardContent>
          <TrainingSettingsForm initialMinutes={1} />
        </CardContent>
      </Card>

      <Card className="mt-6 border border-outline-variant/40 shadow-sm">
        <CardHeader><CardTitle className="text-lg text-navy">Environment Readiness</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {environmentSettings.map((setting) => (
            <div key={setting.label} className="flex items-center justify-between rounded-lg border border-outline-variant/40 bg-white p-4">
              <span className="font-medium text-navy">{setting.label}</span>
              <Badge variant={setting.configured ? "success" : "warning"}>
                {setting.configured ? "Configured" : "Missing"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </AdminPageShell>
  );
}
