"use client";

import { useState, useEffect } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  MAX_TASK_BATCH_VALUE_KSH_KEY,
  MAX_TASK_PAYOUT_KSH_KEY,
  MIN_WITHDRAWAL_KSH_KEY,
  REFERRAL_ACTIVATION_RULE_KEY,
  REFERRAL_LEVEL_1_REWARD_KEY,
  TRAINING_REWARD_SETTING_KEY,
  WITHDRAWAL_FEE_KSH_KEY,
  WITHDRAWAL_HOLD_DAYS_KEY,
  WITHDRAWAL_N8N_WEBHOOK_URL_KEY,
  WITHDRAWAL_PROCESSING_DAYS_KEY,
} from "@/lib/platform-setting-keys";

type PlatformSetting = {
  key: string;
  value: string;
  description: string | null;
  updated_by_admin_id: string | null;
  updated_at: string | null;
};

export function PlatformSettingsForm({ initialSettings }: { initialSettings: PlatformSetting[] }) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const map: Record<string, string> = {};
    initialSettings.forEach((s) => {
      map[s.key] = s.value;
    });
    setSettings(map);
  }, [initialSettings]);

  async function onSave(key: string) {
    setLoading((prev) => ({ ...prev, [key]: true }));
    setSaving(true);

    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: settings[key] }),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error ?? `Failed to save ${key}`);
        return;
      }

      toast.success(`Updated ${key.replace(/_/g, " ")}`);
    } catch {
      toast.error(`Unable to save ${key}`);
    } finally {
      setLoading((prev) => ({ ...prev, [key]: false }));
      setSaving(false);
    }
  }

  function handleChange(key: string, value: string) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  const payoutSettingDefinitions = [
    {
      key: WITHDRAWAL_HOLD_DAYS_KEY,
      label: "Withdrawal hold period (days)",
      description: "Pending funds are held for this many days before becoming withdrawable.",
      type: "number",
      min: 0,
      max: 30,
      defaultValue: "7",
    },
    {
      key: MIN_WITHDRAWAL_KSH_KEY,
      label: "Minimum withdrawal (KSh)",
      description: "Smallest amount a user can request from the wallet.",
      type: "number",
      min: 200,
      defaultValue: "200",
    },
    {
      key: WITHDRAWAL_FEE_KSH_KEY,
      label: "Withdrawal processing fee (KSh)",
      description: "Flat amount deducted from every withdrawal request.",
      type: "number",
      min: 30,
      defaultValue: "30",
    },
    {
      key: WITHDRAWAL_PROCESSING_DAYS_KEY,
      label: "Withdrawal processing time (days)",
      description: "Expected admin payout processing time after a withdrawal is requested.",
      type: "number",
      min: 0,
      step: "any",
      defaultValue: "3",
    },
    {
      key: WITHDRAWAL_N8N_WEBHOOK_URL_KEY,
      label: "Withdrawal webhook URL",
      description: "Optional n8n webhook called after a withdrawal request is saved.",
      type: "text",
      defaultValue: "",
    },
    {
      key: TRAINING_REWARD_SETTING_KEY,
      label: "Training completion reward (KSh)",
      description: "KSh reward credited instantly when user completes training.",
      type: "number",
      min: 0,
      max: 10000,
      defaultValue: "50",
    },
    {
      key: REFERRAL_LEVEL_1_REWARD_KEY,
      label: "Referral reward (KSh)",
      description: "Bonus for a direct referral after the referred account activates.",
      type: "number",
      min: 100,
      max: 100,
      defaultValue: "100",
    },
    {
      key: MAX_TASK_PAYOUT_KSH_KEY,
      label: "Maximum task payout (KSh)",
      description: "Highest allowed payout per single task slot.",
      type: "number",
      min: 120,
      defaultValue: "120",
    },
    {
      key: MAX_TASK_BATCH_VALUE_KSH_KEY,
      label: "Maximum task batch value (KSh)",
      description: "Highest allowed total task value using payout multiplied by slots.",
      type: "number",
      min: 600,
      defaultValue: "600",
    },
  ];

  const settingDefinitions = [
    {
      key: "task_unlock_delay_hours",
      label: "Task Unlock Delay",
      description: "Hours after training completion before tasks open. Decimals are supported, so 0.0167 is about 1 minute.",
      type: "number",
      step: "0.0001",
    },
    {
      key: "referral_task_unlock_reduction",
      label: "Referral Task Unlock Reduction",
      description: "How much of the remaining wait is removed after a successful direct activation referral. Supports 0.5 or 50 for 50%.",
      type: "number",
      step: "0.01",
    },
    {
      key: "training_day_unlock_minutes",
      label: "Training Day Unlock Minutes",
      description: "Minutes after completing a training day before next day becomes available",
      type: "number",
    },
    {
      key: REFERRAL_ACTIVATION_RULE_KEY,
      label: "Referral activation rule",
      description: "Current supported rule: activation_paid. Bonuses unlock only after paid activation.",
      type: "text",
    },
  ];

  const existingSettings = initialSettings.filter((s) =>
    [...payoutSettingDefinitions, ...settingDefinitions].some((def) => def.key === s.key)
  );

  if (existingSettings.length === 0) {
    return (
      <Card className="border border-outline-variant/40 shadow-sm">
        <CardHeader>
        <CardTitle className="text-lg text-navy">Payout Settings</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">
            No settings found. Please run the database migration to seed default values.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-outline-variant/40 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg text-navy">Payout Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-3">
          {payoutSettingDefinitions.map((def) => {
            const existing = initialSettings.find((s) => s.key === def.key);
            const currentValue = settings[def.key] ?? existing?.value ?? def.defaultValue;
            const isLoading = loading[def.key] ?? false;
            const lastUpdated = existing?.updated_at
              ? new Date(existing.updated_at).toLocaleString()
              : null;

            return (
              <div key={def.key} className="space-y-2">
                <Label htmlFor={def.key} className="text-navy font-medium">
                  {def.label}
                </Label>
                <div className="flex gap-3">
                  <Input
                    id={def.key}
                    type={def.type}
                    min={def.min}
                    max={def.max}
                    step={def.step ?? 1}
                    value={currentValue}
                    onChange={(e) => handleChange(def.key, e.target.value)}
                    className="max-w-xs"
                  />
                  <Button
                    size="sm"
                    disabled={saving}
                    onClick={() => onSave(def.key)}
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{def.description}</p>
                {lastUpdated && (
                  <p className="text-xs text-muted-foreground">Last updated: {lastUpdated}</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-outline-variant/40 pt-6">
          <h3 className="text-sm font-semibold text-navy">Other Platform Settings</h3>
        </div>

        {settingDefinitions.map((def) => {
          const existing = initialSettings.find((s) => s.key === def.key);
          const currentValue = settings[def.key] ?? existing?.value ?? "";
          const isLoading = loading[def.key] ?? false;
          const lastUpdated = existing?.updated_at
            ? new Date(existing.updated_at).toLocaleString()
            : null;

          return (
            <div key={def.key} className="space-y-2">
              <Label htmlFor={def.key} className="text-navy font-medium">
                {def.label}
              </Label>
              <div className="flex gap-3">
                <Input
                  id={def.key}
                  type={def.type}
                  step={def.step}
                  value={currentValue}
                  onChange={(e) => handleChange(def.key, e.target.value)}
                  className="max-w-xs"
                />
                <Button
                  size="sm"
                  disabled={saving}
                  onClick={() => onSave(def.key)}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{def.description}</p>
              {lastUpdated && (
                <p className="text-xs text-muted-foreground">Last updated: {lastUpdated}</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
