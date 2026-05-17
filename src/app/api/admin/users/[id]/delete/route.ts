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
    allowedRoles: ["super_admin", "admin"],
  });
  if (error) return error;
  if (!userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (userId === id) {
    return NextResponse.json({ error: "You cannot delete yourself" }, { status: 400 });
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
    return NextResponse.json({ error: "Cannot delete a super_admin account" }, { status: 403 });
  }

  const { data: beforeProfile } = await (admin.from("profiles" as never) as any)
    .select("id, full_name, phone, email, county, created_at, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (!beforeProfile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: beforeStatus } = await (admin.from("account_status" as never) as any)
    .select("user_id, status, is_activated, is_setup_complete")
    .eq("user_id", id)
    .maybeSingle();

  const deletedAt = new Date().toISOString();

  const { error: profileError } = await (admin.from("profiles" as never) as any)
    .update({ deleted_at: deletedAt })
    .eq("id", id);

  if (profileError) {
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }

  const { data: updatedStatus, error: statusError } = await (admin.from("account_status" as never) as any)
    .update({ status: "banned", state: "banned", suspended_at: deletedAt, suspension_reason: parsed.data.reason })
    .eq("user_id", id)
    .select("user_id, status, is_activated, is_setup_complete")
    .single();

  if (statusError) {
    return NextResponse.json({ error: "Failed to update account status" }, { status: 500 });
  }

  await auditLog({
    adminId: userId,
    action: "user_soft_delete",
    entityType: "profiles",
    entityId: id,
    before: { profile: beforeProfile, status: beforeStatus },
    after: { profile: { ...beforeProfile, deleted_at: deletedAt }, status: updatedStatus },
    reason: parsed.data.reason,
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ ok: true, method: "soft_delete" });
}
