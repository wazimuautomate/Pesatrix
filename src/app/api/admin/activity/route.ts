import { NextResponse } from "next/server";

import { requireAdmin } from "../_lib";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 50;

export async function GET(request: Request) {
  const { error } = await requireAdmin({ request, allowedRoles: ["admin"] });
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");
  const eventType = searchParams.get("event_type");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const offset = (page - 1) * PAGE_SIZE;
  const admin = createAdminSupabaseClient();

  let query = (admin.from("user_activity_logs" as never) as any)
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (userId) query = query.eq("user_id", userId);
  if (eventType) query = query.eq("event_type", eventType);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error: fetchError, count } = await query;
  if (fetchError) {
    return NextResponse.json({ error: "Failed to fetch activity logs" }, { status: 500 });
  }

  const userIds = [...new Set((data ?? []).map((row: any) => row.user_id).filter(Boolean))];
  const { data: profiles } = userIds.length
    ? await (admin.from("profiles" as never) as any)
        .select("id, full_name, phone")
        .in("id", userIds)
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((row: any) => [row.id, row]));

  return NextResponse.json({
    logs: (data ?? []).map((log: any) => ({ ...log, user: profileById.get(log.user_id) ?? null })),
    page,
    pageSize: PAGE_SIZE,
    total: count ?? 0,
    totalPages: Math.ceil((count ?? 0) / PAGE_SIZE),
  });
}
