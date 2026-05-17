import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function createVaultSecret(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  name: string,
  secret: string,
  description?: string
) {
  const { data, error } = await admin.rpc("create_ai_provider_secret", {
      secret,
      name,
      description: description ?? null,
    });

  if (error) {
    return { data: null, error };
  }

  return { data, error: null };
}

export async function getVaultSecret(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  name: string
) {
  const { data, error } = await admin.rpc("get_ai_provider_secret", {
    secret_name: name,
  });

  if (error || !data) {
    return { data: null, error };
  }

  return { data: String(data), error: null };
}
