import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Admin/service-role Supabase client.
 * NEVER expose this to the browser. Server-side only.
 * Used for: admin operations, bypassing RLS, cron jobs, M-Pesa callbacks.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export function createAdminSupabaseClient() {
  return createAdminClient() as any;
}
