import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminPageShell, MetricCard } from "@/components/admin/admin-native";
import { TrainingSettingsForm } from "@/components/admin/training-settings-form";
import { PlatformSettingsForm } from "@/components/admin/platform-settings-form";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireWazimAdmin } from "@/lib/wazim-admin";

async function getPlatformSettings() {
  const admin = createAdminSupabaseClient();

  const { data, error } = await (admin.from("platform_settings" as never) as any)
    .select("key, value, description, updated_by, updated_at")
    .order("key", { ascending: true });

  if (error) {
    console.error("Failed to fetch platform settings:", error);
    return [];
  }

  return data ?? [];
}

export default async function AdminSettingsPage() {
  const adminSession = await requireWazimAdmin();
  const settings = await getPlatformSettings();

  const numericSettings = settings.filter((s: { key: string; value: string }) => {
    const num = Number(s.value);
    return Number.isFinite(num);
  });

  const trainingRewardSetting = settings.find((s: { key: string }) => s.key === "training_completion_reward_ksh");
  const taskUnlockSetting = settings.find((s: { key: string }) => s.key === "task_unlock_delay_hours");

  const environmentSettings = [
    { label: "Supabase URL", configured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) },
    { label: "Service role key", configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY) },
    { label: "M-Pesa shortcode", configured: Boolean(process.env.MPESA_SHORTCODE) },
    { label: "CPX app id", configured: Boolean(process.env.CPX_APP_ID) },
    { label: "CPX secure hash", configured: Boolean(process.env.CPX_SECURE_HASH) },
  ];

  return (
    <AdminPageShell
      admin={adminSession}
      title="Settings"
      description="Control operational settings that affect user training, activation, payments, and provider integrations."
    >
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Training reward"
          value={`KSh ${trainingRewardSetting?.value ?? "100"}`}
          detail="Configurable below"
          tone="amber"
        />
        <MetricCard
          label="Task unlock delay"
          value={`${taskUnlockSetting?.value ?? "24"} hours`}
          detail="After training completion"
        />
        <MetricCard
          label="Admin role"
          value={adminSession.role}
          detail={adminSession.email ?? "Signed in admin"}
          tone="teal"
        />
      </section>

      <PlatformSettingsForm initialSettings={settings} />

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