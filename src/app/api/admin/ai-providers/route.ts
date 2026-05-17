import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog, requireAdmin } from "@/app/api/admin/_lib";
import { createVaultSecret } from "@/lib/ai/provider-secrets";

const providerSchema = z.object({
  provider: z.enum(["nvidia", "openrouter", "groq", "ollama"]),
  displayName: z.string().trim().min(1).max(120),
  modelId: z.string().trim().min(1).max(200),
  apiKey: z.string().min(1),
  baseUrl: z.string().url(),
  maxTokens: z.coerce.number().int().min(1).max(200000).default(8192),
  temperature: z.coerce.number().min(0).max(2).default(0.3),
  isActive: z.boolean().default(false),
});

export async function GET(request: Request) {
  const authResult = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "admin"],
  });
  if (authResult.error) return authResult.error;

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("ai_provider_configs")
    .select("id, provider, model_id, display_name, api_key_secret_name, is_active, is_grading_model, base_url, max_tokens, temperature, created_by, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[GET /api/admin/ai-providers]", error);
    return NextResponse.json({ error: "Failed to fetch AI providers" }, { status: 500 });
  }

  return NextResponse.json({ providers: data ?? [] });
}

export async function POST(request: Request) {
  const authResult = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "admin"],
  });
  if (authResult.error) return authResult.error;
  if (!authResult.userId || !authResult.adminUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = providerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Validation error" },
      { status: 422 }
    );
  }

  const {
    provider,
    displayName,
    modelId,
    apiKey,
    baseUrl,
    maxTokens,
    temperature,
    isActive,
  } = parsed.data;

  const admin = createAdminSupabaseClient();
  const secretName = `ai_provider_${provider}_${Date.now()}`;

  const { error: secretError } = await createVaultSecret(
    admin,
    secretName,
    apiKey,
    `AI provider key for ${displayName}`
  );
  if (secretError) {
    console.error("[POST /api/admin/ai-providers] Vault write failed:", secretError);
    return NextResponse.json({ error: "Failed to store provider secret" }, { status: 500 });
  }

  if (isActive) {
    const { error: deactivateError } = await admin
      .from("ai_provider_configs")
      .update({ is_active: false })
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (deactivateError) {
      return NextResponse.json({ error: "Failed to deactivate current provider" }, { status: 500 });
    }
  }

  const { data, error } = await admin
    .from("ai_provider_configs")
    .insert({
      provider,
      model_id: modelId,
      display_name: displayName,
      api_key_secret_name: secretName,
      is_active: isActive,
      is_grading_model: true,
      base_url: baseUrl,
      max_tokens: maxTokens,
      temperature,
      created_by: authResult.adminUser.id,
    })
    .select("id, provider, model_id, display_name, api_key_secret_name, is_active, is_grading_model, base_url, max_tokens, temperature, created_by, created_at, updated_at")
    .single();

  if (error) {
    console.error("[POST /api/admin/ai-providers]", error);
    return NextResponse.json({ error: "Failed to save AI provider" }, { status: 500 });
  }

  await auditLog({
    adminId: authResult.userId,
    action: "ai_provider_created",
    entityType: "ai_provider_configs",
    entityId: data.id,
    after: data,
    reason: isActive ? "Created and activated AI provider" : "Created AI provider",
    ip: authResult.requestMeta?.ip ?? undefined,
    userAgent: authResult.requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ provider: data }, { status: 201 });
}
