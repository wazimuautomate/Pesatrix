import "server-only";

import { redirect } from "next/navigation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type WazimAdminSession = {
  userId: string;
  email: string | null;
  role: "admin";
  adminUserId: string;
};

export async function requireWazimAdmin(): Promise<WazimAdminSession> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/wazim/login");
  }

  const admin = createAdminSupabaseClient();
  const { data: adminUser } = await (admin.from("admin_users" as never) as any)
    .select("id, user_id, role, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!adminUser) {
    redirect("/wazim/login?error=not_admin");
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    role: "admin",
    adminUserId: String(adminUser.id),
  };
}

export function money(value: unknown) {
  const amount = Number(value ?? 0);
  return `KSh ${amount.toLocaleString("en-KE")}`;
}

export function shortDate(value: unknown) {
  if (!value) return "Not set";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
  }).format(date);
}

export function percent(numerator: number, denominator: number) {
  if (!denominator) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export function asArray<T = Record<string, unknown>>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function firstRelation<T = Record<string, unknown>>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value && typeof value === "object" ? (value as T) : null;
}
