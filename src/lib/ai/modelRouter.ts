import "server-only";

import { getVaultSecret } from "@/lib/ai/provider-secrets";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type AiProvider = "nvidia" | "openrouter" | "groq" | "gemini" | "ollama";

export type AiProviderConfig = {
  id?: string;
  provider: AiProvider;
  model_id: string;
  display_name?: string | null;
  api_key_secret_name?: string | null;
  base_url: string;
  max_tokens?: number | null;
  temperature?: number | null;
  is_active?: boolean | null;
};

export type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export const DEFAULT_BASE_URLS: Record<AiProvider, string> = {
  nvidia: "https://integrate.api.nvidia.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  groq: "https://api.groq.com/openai/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta",
  ollama: "http://localhost:11434/v1",
};

export const DEFAULT_TEXT_MODELS: Record<Exclude<AiProvider, "ollama">, string[]> = {
  nvidia: ["minimaxai/minimax-m2.7"],
  openrouter: [
    "deepseek/deepseek-v4-flash:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "minimax/minimax-m2.5:free",
  ],
  groq: ["openai/gpt-oss-120b", "qwen/qwen3-32b"],
  gemini: ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"],
};

export const DEFAULT_VISION_MODELS: Array<Pick<AiProviderConfig, "provider" | "model_id" | "base_url">> = [
  { provider: "nvidia", model_id: "mistralai/mistral-large-3-675b-instruct-2512", base_url: DEFAULT_BASE_URLS.nvidia },
  { provider: "nvidia", model_id: "google/paligemma-3b-pt-224", base_url: DEFAULT_BASE_URLS.nvidia },
];

export type AiRouterResult = {
  ok: boolean;
  content: string;
  provider?: AiProvider;
  model?: string;
  latencyMs: number;
  errors: Array<{ provider: AiProvider; model: string; error: string }>;
};

const PROVIDER_ENV_KEYS: Record<AiProvider, string> = {
  nvidia: "NVIDIA_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  groq: "GROQ_API_KEY",
  gemini: "GEMINI_API_KEY",
  ollama: "OLLAMA_API_KEY",
};

const TEXT_TIMEOUT_MS = 18000;

export async function callTextModelWithFallback({
  admin = createAdminSupabaseClient(),
  messages,
  maxTokens = 1200,
  temperature = 0.2,
}: {
  admin?: ReturnType<typeof createAdminSupabaseClient>;
  messages: AiMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<AiRouterResult> {
  const start = Date.now();
  const candidates = await getTextModelCandidates(admin);
  const errors: AiRouterResult["errors"] = [];

  for (const candidate of candidates) {
    const apiKey = await getProviderApiKey(admin, candidate);
    if (!apiKey && candidate.provider !== "ollama") {
      errors.push({ provider: candidate.provider, model: candidate.model_id, error: `Missing ${PROVIDER_ENV_KEYS[candidate.provider]}` });
      continue;
    }

    const modelStart = Date.now();
    try {
      const content = candidate.provider === "gemini"
        ? await callGeminiModel(candidate, apiKey ?? "", messages, maxTokens, temperature)
        : await callOpenAiCompatibleModel(candidate, apiKey ?? "", messages, maxTokens, temperature);

      if (content.trim()) {
        console.log(`[AI Router] provider=${candidate.provider} model=${candidate.model_id} elapsed=${Date.now() - modelStart}ms`);
        return {
          ok: true,
          content,
          provider: candidate.provider,
          model: candidate.model_id,
          latencyMs: Date.now() - start,
          errors,
        };
      }

      errors.push({ provider: candidate.provider, model: candidate.model_id, error: "Empty response" });
    } catch (error) {
      errors.push({
        provider: candidate.provider,
        model: candidate.model_id,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error("[AI Router] model failed:", candidate.provider, candidate.model_id, error instanceof Error ? error.message : error);
    }
  }

  return {
    ok: false,
    content: "",
    latencyMs: Date.now() - start,
    errors,
  };
}

async function getTextModelCandidates(admin: ReturnType<typeof createAdminSupabaseClient>): Promise<AiProviderConfig[]> {
  const configured = await getConfiguredProviderRows(admin);
  const configuredKeys = new Set(configured.map((item) => `${item.provider}:${item.model_id}`));
  const fallbackRows: AiProviderConfig[] = Object.entries(DEFAULT_TEXT_MODELS).flatMap(([provider, models]) =>
    models.map((model_id) => ({
      provider: provider as AiProvider,
      model_id,
      display_name: `${provider} ${model_id}`,
      api_key_secret_name: null,
      base_url: DEFAULT_BASE_URLS[provider as AiProvider],
      max_tokens: 1200,
      temperature: 0.2,
      is_active: false,
    }))
  );

  return [
    ...configured,
    ...fallbackRows.filter((row) => !configuredKeys.has(`${row.provider}:${row.model_id}`)),
  ];
}

async function getConfiguredProviderRows(admin: ReturnType<typeof createAdminSupabaseClient>): Promise<AiProviderConfig[]> {
  const { data, error } = await admin
    .from("ai_provider_configs")
    .select("id, provider, model_id, display_name, api_key_secret_name, is_active, is_grading_model, base_url, max_tokens, temperature, created_at")
    .eq("is_grading_model", true)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[AI Router] Failed to load configured providers:", error);
    return [];
  }

  return ((data ?? []) as Array<Record<string, unknown>>)
    .map(toProviderConfig)
    .filter((row): row is AiProviderConfig => Boolean(row));
}

function toProviderConfig(row: Record<string, unknown>): AiProviderConfig | null {
  if (!isSupportedProvider(row.provider) || typeof row.model_id !== "string") {
    return null;
  }

  return {
    id: typeof row.id === "string" ? row.id : undefined,
    provider: row.provider,
    model_id: row.model_id,
    display_name: typeof row.display_name === "string" ? row.display_name : null,
    api_key_secret_name: typeof row.api_key_secret_name === "string" ? row.api_key_secret_name : null,
    is_active: typeof row.is_active === "boolean" ? row.is_active : false,
    base_url: typeof row.base_url === "string" && row.base_url ? row.base_url : DEFAULT_BASE_URLS[row.provider],
    max_tokens: typeof row.max_tokens === "number" ? row.max_tokens : null,
    temperature: typeof row.temperature === "number" ? row.temperature : null,
  };
}

async function getProviderApiKey(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  providerConfig: AiProviderConfig
) {
  if (providerConfig.api_key_secret_name) {
    const { data: secret, error } = await getVaultSecret(admin, providerConfig.api_key_secret_name);
    if (error || !secret) {
      console.warn("[AI Router] Vault secret fetch failed:", providerConfig.api_key_secret_name, error);
      return null;
    }
    return secret;
  }

  return process.env[PROVIDER_ENV_KEYS[providerConfig.provider]] ?? null;
}

async function callOpenAiCompatibleModel(
  config: AiProviderConfig,
  apiKey: string,
  messages: AiMessage[],
  maxTokens: number,
  temperature: number
) {
  const response = await fetchWithTimeout(`${trimTrailingSlash(config.base_url)}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...(config.provider === "openrouter"
        ? {
            "HTTP-Referer": process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://pesatrix.com",
            "X-Title": "Pesatrix",
          }
        : {}),
    },
    body: JSON.stringify({
      model: config.model_id,
      messages,
      temperature: Number(config.temperature ?? temperature),
      max_tokens: Number(config.max_tokens ?? maxTokens),
      stream: false,
    }),
  }, TEXT_TIMEOUT_MS);

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`${config.provider} returned ${response.status}: ${text.slice(0, 300)}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content : "";
}

async function callGeminiModel(
  config: AiProviderConfig,
  apiKey: string,
  messages: AiMessage[],
  maxTokens: number,
  temperature: number
) {
  const prompt = messages.map((message) => `${message.role.toUpperCase()}:\n${message.content}`).join("\n\n");
  const response = await fetchWithTimeout(`${trimTrailingSlash(config.base_url)}/models/${encodeURIComponent(config.model_id)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: Number(config.temperature ?? temperature),
        maxOutputTokens: Number(config.max_tokens ?? maxTokens),
      },
    }),
  }, TEXT_TIMEOUT_MS);

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`gemini returned ${response.status}: ${text.slice(0, 300)}`);
  }

  const payload = await response.json();
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part) => typeof part.text === "string" ? part.text : "").join("").trim();
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function isSupportedProvider(value: unknown): value is AiProvider {
  return value === "nvidia" || value === "openrouter" || value === "groq" || value === "gemini" || value === "ollama";
}
