"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Pencil, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Provider = "nvidia" | "openrouter" | "groq" | "gemini" | "ollama";

export type AiProviderConfig = {
  id: string;
  provider: Provider;
  model_id: string;
  display_name: string;
  api_key_secret_name: string;
  is_active: boolean;
  is_grading_model: boolean;
  base_url: string;
  max_tokens: number;
  temperature: number;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
};

type FormState = {
  provider: Provider;
  displayName: string;
  modelId: string;
  apiKey: string;
  baseUrl: string;
  maxTokens: number;
  temperature: number;
  isActive: boolean;
};

const DEFAULT_BASE_URLS: Record<Provider, string> = {
  nvidia: "https://integrate.api.nvidia.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  groq: "https://api.groq.com/openai/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  ollama: "http://localhost:11434/v1",
};

const MODEL_EXAMPLES: Record<Provider, string> = {
  nvidia: "Examples: minimaxai/minimax-m2.7, mistralai/mistral-large-3-675b-instruct-2512, google/paligemma-3b-pt-224",
  openrouter: "Examples: deepseek/deepseek-v4-flash:free, nvidia/nemotron-3-super-120b-a12b:free, minimax/minimax-m2.5:free",
  groq: "Examples: openai/gpt-oss-120b, qwen/qwen3-32b",
  gemini: "Examples: gemini-2.5-flash, gemini-2.5-flash-lite, gemini-2.0-flash",
  ollama: "Example: llama3.1 or a locally installed Ollama model",
};

const EMPTY_FORM: FormState = {
  provider: "nvidia",
  displayName: "",
  modelId: "",
  apiKey: "",
  baseUrl: DEFAULT_BASE_URLS.nvidia,
  maxTokens: 8192,
  temperature: 0.3,
  isActive: true,
};

export function AiProviderManager({
  initialProviders,
}: {
  initialProviders: AiProviderConfig[];
}) {
  const [providers, setProviders] = useState(initialProviders);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const activeProvider = useMemo(
    () => providers.find((provider) => provider.is_active),
    [providers]
  );

  function setProvider(provider: Provider) {
    setForm((current) => ({
      ...current,
      provider,
      baseUrl: DEFAULT_BASE_URLS[provider],
    }));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  async function refreshProviders() {
    const response = await fetch("/api/admin/ai-providers");
    const payload = await response.json();
    if (response.ok) {
      setProviders(payload.providers ?? []);
    }
  }

  async function saveProvider() {
    setSaving(true);
    try {
      const response = await fetch(
        editingId ? `/api/admin/ai-providers/${editingId}` : "/api/admin/ai-providers",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editingId ? providerUpdatePayload(form) : form),
        }
      );
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload.error ?? "Failed to save provider");
        return;
      }

      toast.success(editingId ? "Provider updated" : "Provider saved");
      resetForm();
      await refreshProviders();
    } catch {
      toast.error("Failed to save provider");
    } finally {
      setSaving(false);
    }
  }

  async function activateProvider(providerId: string) {
    setBusyId(providerId);
    try {
      const response = await fetch(`/api/admin/ai-providers/${providerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload.error ?? "Failed to activate provider");
        return;
      }

      toast.success("Active grading model updated");
      await refreshProviders();
    } catch {
      toast.error("Failed to activate provider");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteProvider(provider: AiProviderConfig) {
    if (provider.is_active) {
      toast.warning("Select a new active provider before deleting this one.");
      return;
    }

    if (!window.confirm(`Delete ${provider.display_name || provider.model_id}?`)) {
      return;
    }

    setBusyId(provider.id);
    try {
      const response = await fetch(`/api/admin/ai-providers/${provider.id}`, {
        method: "DELETE",
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload.error ?? "Failed to delete provider");
        return;
      }

      toast.success("Provider deleted");
      await refreshProviders();
    } catch {
      toast.error("Failed to delete provider");
    } finally {
      setBusyId(null);
    }
  }

  function editProvider(provider: AiProviderConfig) {
    setEditingId(provider.id);
    setForm({
      provider: provider.provider,
      displayName: provider.display_name,
      modelId: provider.model_id,
      apiKey: "",
      baseUrl: provider.base_url,
      maxTokens: provider.max_tokens ?? 8192,
      temperature: provider.temperature ?? 0.3,
      isActive: provider.is_active,
    });
  }

  return (
    <Card className="mt-6 border border-outline-variant/40 shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle className="text-lg text-navy">AI Grading Providers</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Active model: {activeProvider ? `${activeProvider.display_name} (${activeProvider.model_id})` : "None configured"}
            </p>
          </div>
          {activeProvider && (
            <Badge variant="success" className="w-fit gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Active grading model
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border border-outline-variant/40 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Display name</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No AI providers configured.
                  </TableCell>
                </TableRow>
              ) : (
                providers.map((provider) => (
                  <TableRow key={provider.id}>
                    <TableCell>
                      <Badge variant="secondary">{provider.provider}</Badge>
                    </TableCell>
                    <TableCell className="max-w-xs break-words font-mono text-xs">
                      {provider.model_id}
                    </TableCell>
                    <TableCell>{provider.display_name}</TableCell>
                    <TableCell>
                      <Switch
                        checked={provider.is_active}
                        disabled={busyId === provider.id}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            void activateProvider(provider.id);
                          } else {
                            toast.warning("Select another provider to replace the active model.");
                          }
                        }}
                        aria-label={`Set ${provider.display_name} active`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => editProvider(provider)}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={busyId === provider.id || provider.is_active}
                          title={provider.is_active ? "Select a new active provider before deleting this one." : undefined}
                          onClick={() => void deleteProvider(provider)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="grid gap-4 rounded-lg border border-outline-variant/40 bg-surface-container-low p-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={form.provider} onValueChange={(value) => setProvider(value as Provider)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nvidia">NVIDIA</SelectItem>
                <SelectItem value="openrouter">OpenRouter</SelectItem>
                <SelectItem value="groq">Groq</SelectItem>
                <SelectItem value="gemini">Gemini</SelectItem>
                <SelectItem value="ollama">Ollama</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Field
            label="Display name"
            value={form.displayName}
            onChange={(value) => setForm((current) => ({ ...current, displayName: value }))}
          />

          <Field
            label="Model ID"
            value={form.modelId}
            helper={MODEL_EXAMPLES[form.provider]}
            onChange={(value) => setForm((current) => ({ ...current, modelId: value }))}
          />

          <Field
            label={editingId ? "New API key" : "API key"}
            value={form.apiKey}
            type="password"
            helper={editingId ? "Leave blank to keep the existing vaulted secret." : "Stored in Supabase vault, never in provider config rows."}
            onChange={(value) => setForm((current) => ({ ...current, apiKey: value }))}
          />

          <Field
            label="Base URL"
            value={form.baseUrl}
            onChange={(value) => setForm((current) => ({ ...current, baseUrl: value }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Max tokens"
              value={String(form.maxTokens)}
              type="number"
              onChange={(value) => setForm((current) => ({ ...current, maxTokens: Number(value) }))}
            />
            <Field
              label="Temperature"
              value={String(form.temperature)}
              type="number"
              step="0.1"
              onChange={(value) => setForm((current) => ({ ...current, temperature: Number(value) }))}
            />
          </div>

          <label className="flex items-center gap-3 rounded-lg border border-outline-variant/40 bg-white p-3 text-sm font-medium text-navy">
            <Checkbox
              checked={form.isActive}
              onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked === true }))}
            />
            Set as active grading model
          </label>

          <div className="flex flex-wrap items-end gap-3">
            <Button type="button" onClick={() => void saveProvider()} disabled={saving || (!editingId && !form.apiKey)}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {editingId ? "Update provider" : "Save provider"}
            </Button>
            {editingId && (
              <Button type="button" variant="ghost" onClick={resetForm}>
                Cancel edit
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  helper,
  type = "text",
  step,
  onChange,
}: {
  label: string;
  value: string;
  helper?: string;
  type?: string;
  step?: string;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/\W+/g, "-");

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {helper && <p className="text-xs leading-5 text-muted-foreground">{helper}</p>}
    </div>
  );
}

function providerUpdatePayload(form: FormState) {
  const payload: Record<string, unknown> = {
    provider: form.provider,
    displayName: form.displayName,
    modelId: form.modelId,
    baseUrl: form.baseUrl,
    maxTokens: form.maxTokens,
    temperature: form.temperature,
    isActive: form.isActive,
  };

  if (form.apiKey) {
    payload.apiKey = form.apiKey;
  }

  return payload;
}
