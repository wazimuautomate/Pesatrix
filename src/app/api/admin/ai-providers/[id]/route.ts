import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog, requireAdmin } from "@/app/api/admin/_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const updateProviderSchema = z.object({
  provider: z.enum(["nvidia", "openrouter", "groq", "ollama"]).optional(),
  displayName: z.string().trim().min(1).max(120).optional(),
  modelId: z.string().trim().min(1).max(200).optional(),
  apiKey: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
  maxTokens: z.coerce.number().int().min(1).max(200000).optional(),
  temperature: z.coerce.number().min(0).max(2).optional(),
  isActive: z.boolean().optional(),
  isGradingModel: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: RouteContext) {
  const authResult = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "admin"],
  });
  if (authResult.error) return authResult.error;
  if (!authResult.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json();
  const parsed = updateProviderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Validation error" },
      { status: 422 }
    );
  }

  const admin = createAdminSupabaseClient();

  const { data: before } = await admin
    .from("ai_provider_configs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!before) {
    return NextResponse.json({ error: "AI provider not found" }, { status: 404 });
  }

  if (parsed.data.isActive === true) {
    const { error: deactivateError } = await admin
      .from("ai_provider_configs")
      .update({ is_active: false })
      .neq("id", id);

    if (deactivateError) {
      return NextResponse.json({ error: "Failed to deactivate current provider" }, { status: 500 });
    }
  }

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.apiKey) {
    const providerName = parsed.data.provider ?? before.provider ?? "provider";
    const secretName = `ai_provider_${providerName}_${Date.now()}`;
    const secretError = await createVaultSecret(admin, secretName, parsed.data.apiKey);
    if (secretError) {
      console.error("[PATCH /api/admin/ai-providers/:id] Vault write failed:", secretError);
      return NextResponse.json({ error: "Failed to store provider secret" }, { status: 500 });
    }
    update.api_key_secret_name = secretName;
  }

  if (parsed.data.provider !== undefined) update.provider = parsed.data.provider;
  if (parsed.data.displayName !== undefined) update.display_name = parsed.data.displayName;
  if (parsed.data.modelId !== undefined) update.model_id = parsed.data.modelId;
  if (parsed.data.baseUrl !== undefined) update.base_url = parsed.data.baseUrl;
  if (parsed.data.maxTokens !== undefined) update.max_tokens = parsed.data.maxTokens;
  if (parsed.data.temperature !== undefined) update.temperature = parsed.data.temperature;
  if (parsed.data.isActive !== undefined) update.is_active = parsed.data.isActive;
  if (parsed.data.isGradingModel !== undefined) update.is_grading_model = parsed.data.isGradingModel;

  const { data, error } = await admin
    .from("ai_provider_configs")
    .update(update)
    .eq("id", id)
    .select("id, provider, model_id, display_name, api_key_secret_name, is_active, is_grading_model, base_url, max_tokens, temperature, created_by, created_at, updated_at")
    .single();

  if (error) {
    console.error("[PATCH /api/admin/ai-providers/:id]", error);
    return NextResponse.json({ error: "Failed to update AI provider" }, { status: 500 });
  }

  await auditLog({
    adminId: authResult.userId,
    action: "ai_provider_updated",
    entityType: "ai_provider_configs",
    entityId: id,
    before,
    after: data,
    reason: parsed.data.isActive ? "Activated AI provider" : "Updated AI provider",
    ip: authResult.requestMeta?.ip ?? undefined,
    userAgent: authResult.requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ provider: data });
}

async function createVaultSecret(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  name: string,
  secret: string
) {
  const { error: rpcError } = await admin.rpc("vault.create_secret", {
    secret,
    name,
  });

  if (!rpcError) {
    return null;
  }

  const { error: insertError } = await admin
    .from("vault.secrets")
    .insert({ secret, name });

  return insertError ?? rpcError;
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const authResult = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "admin"],
  });
  if (authResult.error) return authResult.error;
  if (!authResult.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const admin = createAdminSupabaseClient();

  const { data: provider } = await admin
    .from("ai_provider_configs")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!provider) {
    return NextResponse.json({ error: "AI provider not found" }, { status: 404 });
  }

  if (provider.is_active) {
    return NextResponse.json(
      { error: "Select a new active provider before deleting the current active provider." },
      { status: 409 }
    );
  }

  const { error } = await admin
    .from("ai_provider_configs")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[DELETE /api/admin/ai-providers/:id]", error);
    return NextResponse.json({ error: "Failed to delete AI provider" }, { status: 500 });
  }

  await auditLog({
    adminId: authResult.userId,
    action: "ai_provider_deleted",
    entityType: "ai_provider_configs",
    entityId: id,
    before: provider,
    reason: "Deleted AI provider",
    ip: authResult.requestMeta?.ip ?? undefined,
    userAgent: authResult.requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ ok: true });
}
