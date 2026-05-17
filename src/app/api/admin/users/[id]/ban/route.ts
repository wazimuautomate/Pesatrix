import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog, requireAdmin } from "../../../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const schema = z.object({
  reason: z.string().trim().min(5, "Reason must be at least 5 characters").max(500),
});

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const { error, userId, adminUser, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "admin", "fraud"],
  });
  if (error) return error;
  if (!userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (userId === id) {
    return NextResponse.json({ error: "You cannot ban yourself" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid request" }, { status: 422 });
  }

  const admin = createAdminSupabaseClient();

  const { data: targetAdmin } = await (admin.from("admin_users" as never) as any)
    .select("role")
    .eq("user_id", id)
    .maybeSingle();

  if (targetAdmin?.role === "super_admin") {
    return NextResponse.json({ error: "Cannot ban a super_admin account" }, { status: 403 });
  }

  const { data: before } = await (admin.from("account_status" as never) as any)
    .select("user_id, status, is_activated, is_setup_complete, suspended_at, suspension_reason")
    .eq("user_id", id)
    .maybeSingle();

  if (!before) {
    return NextResponse.json({ error: "User account status not found" }, { status: 404 });
  }

  const updatePayload: Record<string, unknown> = {
    status: "banned",
    state: "banned",
    suspended_at: new Date().toISOString(),
    suspension_reason: parsed.data.reason,
  };

  const { data: updated, error: updateError } = await (admin.from("account_status" as never) as any)
    .update(updatePayload)
    .eq("user_id", id)
    .select("user_id, status, is_activated, is_setup_complete, suspended_at, suspension_reason")
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: "Failed to ban user" }, { status: 500 });
  }

  await auditLog({
    adminId: userId,
    action: "user_ban",
    entityType: "account_status",
    entityId: id,
    before,
    after: updated,
    reason: parsed.data.reason,
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ ok: true, newStatus: updated.status });
}
