import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireAdmin } from "../_lib";

const PAGE_SIZE = 50;

export async function GET(request: Request) {
  const { error: authError } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

  const admin = createAdminSupabaseClient();

  let query = (admin.from("profiles" as never) as any)
    .select("id, full_name, phone, email, county, created_at, referral_code, referred_by, deleted_at", { count: "exact" })
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (search) {
    query = query.or(`full_name.ilike.*${search}*,phone.ilike.*${search}*,email.ilike.*${search}*`);
  }

  const { data: users, error, count } = await query;

  if (error) {
    console.error("[GET /api/admin/users] profile fetch failed", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }

  const userRows = users ?? [];
  const userIds = userRows.map((user: any) => user.id).filter(Boolean);
  const { data: statuses, error: statusError } = userIds.length
    ? await (admin.from("account_status" as never) as any)
        .select("user_id, status, is_activated, activated_at, is_setup_complete, suspended_at, suspension_reason")
        .in("user_id", userIds)
    : { data: [], error: null };

  if (statusError) {
    console.error("[GET /api/admin/users] account status fetch failed", statusError);
    return NextResponse.json({ error: "Failed to fetch user statuses" }, { status: 500 });
  }

  const statusByUserId = new Map<string, any>((statuses ?? []).map((status: any) => [status.user_id, status]));

  const normalizedUsers = userRows.map((u: any) => {
    const status = statusByUserId.get(u.id);
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
      suspended_at: status?.suspended_at ?? null,
      suspension_reason: status?.suspension_reason ?? null,
    };
  });

  return NextResponse.json({
    users: normalizedUsers,
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil((count ?? 0) / PAGE_SIZE),
  });
}
