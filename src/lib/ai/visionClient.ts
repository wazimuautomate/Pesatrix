import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { TASK_SCREENSHOT_BUCKET, parseTaskScreenshotUrl } from "@/lib/task-screenshots";

const FALLBACK_NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const VISION_MODEL_TIMEOUT_MS = 30000;
const VISION_MODEL_MAX_TOKENS = 1024;

type VisionModelConfig = {
  modelId: string;
  provider: "nvidia" | "openrouter";
  supportsVision: boolean;
  baseUrl: string;
  apiKeyName: "NVIDIA_API_KEY" | "OPENROUTER_API_KEY";
};

const VISION_MODELS: VisionModelConfig[] = [
  {
    modelId: "google/paligemma-3b-pt-224",
    provider: "nvidia",
    supportsVision: true,
    baseUrl: FALLBACK_NVIDIA_BASE_URL,
    apiKeyName: "NVIDIA_API_KEY",
  },
  {
    modelId: "qwen/qwen2.5-vl-72b-instruct:free",
    provider: "openrouter",
    supportsVision: true,
    baseUrl: OPENROUTER_BASE_URL,
    apiKeyName: "OPENROUTER_API_KEY",
  },
  {
    modelId: "meta-llama/llama-3.2-11b-vision-instruct:free",
    provider: "openrouter",
    supportsVision: true,
    baseUrl: OPENROUTER_BASE_URL,
    apiKeyName: "OPENROUTER_API_KEY",
  },
];

export async function analyzeImageWithVision(screenshotUrl: string, prompt: string): Promise<string> {
  const admin = createAdminSupabaseClient();
  const image = await fetchImageAsBase64(admin, screenshotUrl);

  if (!image) {
    throw new Error("Screenshot could not be loaded for vision review.");
  }

  const errors: string[] = [];

  for (const modelConfig of VISION_MODELS) {
    const apiKey = process.env[modelConfig.apiKeyName] ?? null;
    if (!apiKey) {
      errors.push(`${modelConfig.modelId}: missing ${modelConfig.apiKeyName}`);
      continue;
    }

    try {
      const result = await callVisionModel(apiKey, modelConfig, image, prompt);
      if (result) return result;
      errors.push(`${modelConfig.modelId}: empty response`);
    } catch (error) {
      errors.push(`${modelConfig.modelId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`All vision models failed. ${errors.join("; ")}`);
}

async function callVisionModel(
  apiKey: string,
  modelConfig: VisionModelConfig,
  image: { base64: string; mediaType: string },
  prompt: string
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VISION_MODEL_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };

    if (modelConfig.provider === "openrouter") {
      headers["HTTP-Referer"] = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://pesatrix.com";
      headers["X-Title"] = "Pesatrix";
    }

    const response = await fetch(`${modelConfig.baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: modelConfig.modelId,
        messages: [
          {
            role: "user",
            content: modelConfig.supportsVision
              ? [
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${image.mediaType};base64,${image.base64}`,
                    },
                  },
                  { type: "text", text: prompt },
                ]
              : prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: VISION_MODEL_MAX_TOKENS,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`API error ${response.status}: ${errorText.slice(0, 200)}`);
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    return typeof content === "string" && content.trim() ? content : null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchImageAsBase64(
  supabaseAdmin: ReturnType<typeof createAdminSupabaseClient>,
  screenshotUrl: string
) {
  const parsed = parseTaskScreenshotUrl(screenshotUrl);
  if (!parsed) return null;

  const { data, error } = await supabaseAdmin.storage
    .from(TASK_SCREENSHOT_BUCKET)
    .download(parsed.path);

  if (error || !data) {
    console.error("[Vision] Screenshot download failed:", error);
    return null;
  }

  const bytes = Buffer.from(await data.arrayBuffer());
  return {
    base64: bytes.toString("base64"),
    mediaType: parsed.mediaType,
  };
}
