import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number }> {
  const supabaseAdmin = createAdminSupabaseClient();
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { count, error: countError } = await supabaseAdmin
    .from("rate_limit_log")
    .select("*", { count: "exact", head: true })
    .eq("key", key)
    .gte("created_at", windowStart);

  if (countError) {
    throw countError;
  }

  const currentCount = count ?? 0;
  if (currentCount >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  const { error: insertError } = await supabaseAdmin.from("rate_limit_log").insert({
    key,
    created_at: new Date().toISOString(),
  });

  if (insertError) {
    throw insertError;
  }

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - currentCount - 1),
  };
}
