"use client";

import { useState, useEffect } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PlatformSetting = {
  key: string;
  value: string;
  description: string | null;
  updated_by: string | null;
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
        method: "PATCH",
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

  const settingDefinitions = [
    {
      key: "training_completion_reward_ksh",
      label: "Training Completion Reward",
      description: "KSh reward credited to wallet when user completes 7-day training",
      type: "number",
    },
    {
      key: "task_unlock_delay_hours",
      label: "Task Unlock Delay",
      description: "Hours after training completion before user gets access to tasks",
      type: "number",
    },
    {
      key: "min_withdrawal_amount_ksh",
      label: "Minimum Withdrawal Amount",
      description: "Minimum KSh amount a user must have in available balance to withdraw",
      type: "number",
    },
    {
      key: "referral_task_unlock_reduction",
      label: "Referral Task Unlock Reduction",
      description: "Fraction by which task unlock timer is reduced when user refers a friend who activates during waiting period",
      type: "number",
      step: "0.1",
    },
    {
      key: "training_day_unlock_minutes",
      label: "Training Day Unlock Minutes",
      description: "Minutes after completing a training day before next day becomes available",
      type: "number",
    },
  ];

  const existingSettings = initialSettings.filter((s) =>
    settingDefinitions.some((def) => def.key === s.key)
  );

  if (existingSettings.length === 0) {
    return (
      <Card className="border border-outline-variant/40 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-navy">Platform Settings</CardTitle>
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
        <CardTitle className="text-lg text-navy">Platform Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
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