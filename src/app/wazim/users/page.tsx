import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AdminPageShell } from "@/components/admin/admin-native";
import { UserDirectoryClient } from "@/components/admin/user-directory-client";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireWazimAdmin } from "@/lib/wazim-admin";

type PageProps = {
  searchParams: Promise<{ q?: string; page?: string }>;
};

const PAGE_SIZE = 50;

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const adminSession = await requireWazimAdmin();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

  const admin = createAdminSupabaseClient();

  const [statsResult, usersResult] = await Promise.all([
    getStats(admin),
    getUsers(admin, q, page, PAGE_SIZE),
  ]);

  const users = usersResult.data ?? [];
  const total = statsResult.total ?? 0;

  return (
    <AdminPageShell
      admin={adminSession}
      title="Users"
      description="Search users, inspect activation status, manage accounts, and enforce platform policies."
      actions={
        <Button asChild variant="outline">
          <Link href="/wazim/users/suspended">Suspended users</Link>
        </Button>
      }
    >
      <UserDirectoryClient
        initialUsers={users}
        initialStats={{
          total: statsResult.total,
          activated: statsResult.activated,
          suspended: statsResult.suspended,
          banned: statsResult.banned,
        }}
        initialPage={page}
        initialSearch={q}
        currentAdminId={adminSession.userId}
      />
    </AdminPageShell>
  );
}

async function getStats(admin: any) {
  const [{ count: total }, { count: activatedCount }, { count: suspendedCount }, { count: bannedCount }] = await Promise.all([
    (admin.from("profiles" as never) as any).select("*", { count: "exact", head: true }).is("deleted_at", null),
    (admin.from("profiles" as never) as any)
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("account_status.is_activated", true),
    (admin.from("profiles" as never) as any)
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("account_status.status", "suspended"),
    (admin.from("profiles" as never) as any)
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("account_status.status", "banned"),
  ]);

  return {
    total: total ?? 0,
    activated: activatedCount ?? 0,
    suspended: suspendedCount ?? 0,
    banned: bannedCount ?? 0,
  };
}

async function getUsers(admin: any, search: string, page: number, limit: number) {
  let query = (admin.from("profiles" as never) as any)
    .select(
      `id, full_name, phone, email, county, referral_code, referred_by, created_at, deleted_at,
       account_status!inner(id, status, is_activated, activated_at, is_setup_complete)`
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    return { data: [], count: 0 };
  }

  const normalized = (data ?? []).map((u: any) => ({
    id: u.id,
    full_name: u.full_name,
    phone: u.phone,
    email: u.email,
    county: u.county,
    referral_code: u.referral_code,
    referred_by: u.referred_by,
    created_at: u.created_at,
    deleted_at: u.deleted_at,
    status: u.account_status?.[0]?.status ?? "registered",
    is_activated: u.account_status?.[0]?.is_activated ?? false,
    activated_at: u.account_status?.[0]?.activated_at ?? null,
    is_setup_complete: u.account_status?.[0]?.is_setup_complete ?? false,
  }));

  return { data: normalized, count };
}
