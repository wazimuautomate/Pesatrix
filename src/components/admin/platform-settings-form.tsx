"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Pencil, Save } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  PLATFORM_SETTING_CATEGORY_LABELS,
  REQUIRED_PLATFORM_SETTINGS,
  getPlatformSettingDefinition,
  type PlatformSettingDefinition,
} from "@/lib/platform-settings-config";

type PlatformSetting = {
  key: string;
  value: string;
  description: string | null;
  updated_by_admin_id: string | null;
  updated_at: string | null;
};

type SettingGroup = keyof typeof PLATFORM_SETTING_CATEGORY_LABELS;

const GROUP_ORDER: SettingGroup[] = ["general", "tasks", "training", "referral", "withdrawals", "other"];

export function PlatformSettingsForm({ initialSettings }: { initialSettings: PlatformSetting[] }) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);

  useEffect(() => {
    const map: Record<string, string> = {};
    for (const definition of REQUIRED_PLATFORM_SETTINGS) {
      map[definition.key] = definition.value;
    }
    initialSettings.forEach((setting) => {
      map[setting.key] = setting.value;
    });
    setSettings(map);
  }, [initialSettings]);

  const rowsByGroup = useMemo(() => {
    const existingByKey = new Map(initialSettings.map((setting) => [setting.key, setting]));
    const knownRows = REQUIRED_PLATFORM_SETTINGS.map((definition) => ({
      definition,
      existing: existingByKey.get(definition.key) ?? null,
    }));
    const otherRows = initialSettings
      .filter((setting) => !getPlatformSettingDefinition(setting.key))
      .map((setting) => ({
        definition: {
          key: setting.key,
          value: setting.value,
          description: setting.description ?? "Custom platform setting.",
          category: "other" as const,
          type: inferType(setting.value),
        },
        existing: setting,
      }));

    return [...knownRows, ...otherRows].reduce<Record<SettingGroup, Array<{ definition: PlatformSettingDefinition & { category: SettingGroup }; existing: PlatformSetting | null }>>>(
      (groups, row) => {
        const group = row.definition.category as SettingGroup;
        groups[group].push(row as { definition: PlatformSettingDefinition & { category: SettingGroup }; existing: PlatformSetting | null });
        return groups;
      },
      {
        general: [],
        tasks: [],
        training: [],
        referral: [],
        withdrawals: [],
        other: [],
      }
    );
  }, [initialSettings]);

  async function onSave(definition: PlatformSettingDefinition, overrideValue?: string) {
    const currentValue = overrideValue ?? settings[definition.key] ?? "";
    const validationError = validateSetting(definition, currentValue);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setLoading((prev) => ({ ...prev, [definition.key]: true }));
    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: definition.key, value: currentValue }),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error ?? `Failed to save ${definition.key}`);
        return;
      }

      toast.success(`Updated ${definition.key.replace(/_/g, " ")}`);
      setEditingKey(null);
    } catch {
      toast.error(`Unable to save ${definition.key}`);
    } finally {
      setLoading((prev) => ({ ...prev, [definition.key]: false }));
    }
  }

  async function onToggle(definition: PlatformSettingDefinition, checked: boolean) {
    const nextValue = checked ? "true" : "false";
    setSettings((prev) => ({ ...prev, [definition.key]: nextValue }));
    await onSave(definition, nextValue);
  }

  return (
    <div className="mt-6 space-y-5">
      {GROUP_ORDER.map((group) => {
        const rows = rowsByGroup[group];
        if (!rows.length) return null;

        return (
          <Card key={group} className="border border-outline-variant/40 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3 text-lg text-navy">
                {PLATFORM_SETTING_CATEGORY_LABELS[group]}
                <Badge variant="secondary">{rows.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-outline-variant/30">
              {rows.map(({ definition, existing }) => {
                const value = settings[definition.key] ?? existing?.value ?? definition.value;
                const isBoolean = definition.type === "boolean" || value === "true" || value === "false";
                const isEditing = editingKey === definition.key;
                const isLoading = loading[definition.key] ?? false;

                return (
                  <div key={definition.key} className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(220px,360px)] lg:items-start">
                    <div>
                      <Label className="font-semibold text-navy">{labelize(definition.key)}</Label>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{definition.key}</p>
                      <p className="mt-2 text-sm text-muted-foreground">{existing?.description ?? definition.description}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Last updated: {existing?.updated_at ? new Date(existing.updated_at).toLocaleString() : "Not seeded yet"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                      {isBoolean ? (
                        <div className="flex items-center gap-3 rounded-md border border-outline-variant/50 px-3 py-2">
                          {isLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                          <span className="text-sm font-medium text-muted-foreground">{value === "true" ? "Enabled" : "Disabled"}</span>
                          <Switch
                            checked={value === "true"}
                            disabled={isLoading}
                            onCheckedChange={(checked) => onToggle(definition, checked)}
                          />
                        </div>
                      ) : isEditing ? (
                        <>
                          <Input
                            type={definition.type === "number" ? "number" : "text"}
                            min={definition.min}
                            max={definition.max}
                            step={definition.step ?? (definition.type === "number" ? "1" : undefined)}
                            value={value}
                            onChange={(event) =>
                              setSettings((prev) => ({ ...prev, [definition.key]: event.target.value }))
                            }
                            className="w-full max-w-[260px]"
                            onKeyDown={(event) => {
                              if (event.key === "Enter") void onSave(definition);
                            }}
                          />
                          <Button size="sm" onClick={() => onSave(definition)} disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save
                          </Button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => setEditingKey(definition.key)}
                            className="max-w-[260px] truncate rounded-md border border-outline-variant/50 bg-white px-3 py-2 text-left font-mono text-sm text-navy hover:bg-muted/40"
                            title={value || "(empty)"}
                          >
                            {value || "(empty)"}
                          </button>
                          <Button size="icon" variant="outline" title="Edit value" onClick={() => setEditingKey(definition.key)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {existing ? <Check className="h-4 w-4 text-teal" /> : null}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function validateSetting(definition: PlatformSettingDefinition, value: string) {
  if (definition.type === "number") {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return `${definition.key} must be numeric`;
    if (definition.min !== undefined && numberValue < definition.min) return `${definition.key} must be at least ${definition.min}`;
    if (definition.max !== undefined && numberValue > definition.max) return `${definition.key} must be at most ${definition.max}`;
  }

  if (definition.type === "boolean" && value !== "true" && value !== "false") {
    return `${definition.key} must be true or false`;
  }

  if (definition.key === "withdrawal_n8n_webhook_url" && value.trim() && !/^https?:\/\/.+/i.test(value.trim())) {
    return "Withdrawal webhook URL must be a valid http or https URL";
  }

  if (definition.key === "admin_sms_phone" && value.trim() && !/^(?:\+?254|0)7\d{8}$/.test(value.trim())) {
    return "Admin SMS phone must use 07XXXXXXXX, 2547XXXXXXXX, or +2547XXXXXXXX";
  }

  return null;
}

function inferType(value: string): PlatformSettingDefinition["type"] {
  if (value === "true" || value === "false") return "boolean";
  if (value !== "" && Number.isFinite(Number(value))) return "number";
  return "text";
}

function labelize(key: string) {
  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
