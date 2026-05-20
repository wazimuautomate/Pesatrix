import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog, requireAdmin } from "../../../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const schema = z.object({
  action: z.enum(["suspended", "banned", "active"]),
  reason: z.string().trim().min(5, "Reason must be at least 5 characters"),
});

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const { error, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });
  if (error) return error;
  if (!userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Invalid request" }, { status: 422 });
  }

  const admin = createAdminSupabaseClient();

  const { data: before } = await (admin.from("account_status" as never) as any)
    .select("user_id, status, is_activated, is_setup_complete, suspended_at, suspension_reason")
    .eq("user_id", id)
    .maybeSingle();

  if (!before) {
    return NextResponse.json({ error: "User account status not found" }, { status: 404 });
  }

  const { action } = parsed.data;
  const updatePayload: Record<string, unknown> = {
    status: action,
    state: action === "active" ? "activated" : action,
  };

  if (action === "active") {
    updatePayload.suspended_at = null;
    updatePayload.suspension_reason = null;
  } else {
    updatePayload.suspended_at = new Date().toISOString();
    updatePayload.suspension_reason = parsed.data.reason;
  }

  const { data: updated, error: updateError } = await (admin.from("account_status" as never) as any)
    .update(updatePayload)
    .eq("user_id", id)
    .select("user_id, status, is_activated, is_setup_complete, suspended_at, suspension_reason")
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: "Failed to update account status" }, { status: 500 });
  }

  const auditAction = action === "banned" ? "user_ban" : action === "active" ? "user_reactivate" : "user_suspend";

  await auditLog({
    adminId: userId,
    action: auditAction,
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
