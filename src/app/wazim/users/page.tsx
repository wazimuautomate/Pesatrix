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
      description=""
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
    (admin.from("account_status" as never) as any)
      .select("user_id", { count: "exact", head: true })
      .eq("is_activated", true),
    (admin.from("account_status" as never) as any)
      .select("user_id", { count: "exact", head: true })
      .eq("status", "suspended"),
    (admin.from("account_status" as never) as any)
      .select("user_id", { count: "exact", head: true })
      .eq("status", "banned"),
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
    .select("id, full_name, phone, email, county, referral_code, referred_by, created_at, deleted_at", { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (search) {
    query = query.or(`full_name.ilike.*${search}*,phone.ilike.*${search}*,email.ilike.*${search}*`);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("[wazim/users] profile fetch failed", error);
    return { data: [], count: 0 };
  }

  const profileRows = data ?? [];
  const userIds = profileRows.map((user: any) => user.id).filter(Boolean);
  const { data: statuses, error: statusError } = userIds.length
    ? await (admin.from("account_status" as never) as any)
        .select("user_id, status, is_activated, activated_at, is_setup_complete")
        .in("user_id", userIds)
    : { data: [], error: null };

  if (statusError) {
    console.error("[wazim/users] account status fetch failed", statusError);
  }

  const statusByUserId = new Map<string, any>((statuses ?? []).map((status: any) => [status.user_id, status]));
  const [{ data: wallets }, { data: referrals }] = userIds.length
    ? await Promise.all([
        (admin.from("wallets" as never) as any)
          .select("user_id, available_balance, pending_balance")
          .in("user_id", userIds),
        (admin.from("referrals" as never) as any)
          .select("referrer_id, referee_id")
          .in("referrer_id", userIds),
      ])
    : [{ data: [] }, { data: [] }];

  const walletByUserId = new Map<string, any>((wallets ?? []).map((wallet: any) => [wallet.user_id, wallet]));
  const refereeIds = [...new Set((referrals ?? []).map((row: any) => row.referee_id).filter(Boolean))];
  const { data: activatedReferees } = refereeIds.length
    ? await (admin.from("account_status" as never) as any)
        .select("user_id")
        .in("user_id", refereeIds)
        .eq("is_activated", true)
    : { data: [] };
  const activatedRefereeIds = new Set((activatedReferees ?? []).map((row: any) => row.user_id));
  const activatedReferralCountByUserId = new Map<string, number>();
  for (const referral of referrals ?? []) {
    if (activatedRefereeIds.has(referral.referee_id)) {
      activatedReferralCountByUserId.set(
        referral.referrer_id,
        (activatedReferralCountByUserId.get(referral.referrer_id) ?? 0) + 1
      );
    }
  }

  const normalized = profileRows.map((u: any) => {
    const status = statusByUserId.get(u.id);
    const wallet = walletByUserId.get(u.id);
    return {
      id: u.id,
      full_name: u.full_name,
      phone: u.phone,
      email: u.email,
      county: u.county,
      referral_code: u.referral_code,
      referred_by: u.referred_by,
      created_at: u.created_at,
      deleted_at: u.deleted_at,
      status: status?.status ?? "registered",
      is_activated: status?.is_activated ?? false,
      activated_at: status?.activated_at ?? null,
      is_setup_complete: status?.is_setup_complete ?? false,
      available_balance: Number(wallet?.available_balance ?? 0),
      pending_balance: Number(wallet?.pending_balance ?? 0),
      activated_referrals_count: activatedReferralCountByUserId.get(u.id) ?? 0,
    };
  });

  return { data: normalized, count };
}
