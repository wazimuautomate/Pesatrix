import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog, requireAdmin } from "../../../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const schema = z.object({
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
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? "Reason is required" }, { status: 422 });
  }

  const admin = createAdminSupabaseClient();
  const { data: before } = await admin
    .from("account_status")
    .select("user_id, status, is_activated, is_setup_complete")
    .eq("user_id", id)
    .single();

  if (!before) {
    return NextResponse.json({ error: "User account status not found" }, { status: 404 });
  }

  const restoredStatus =
    before.is_activated ? "active" : before.is_setup_complete ? "setup_complete" : "registered";
  const restoredState =
    before.is_activated ? "activated" : before.is_setup_complete ? "setup_complete" : "registered";

  const { data: updated, error: updateError } = await admin
    .from("account_status")
    .update({
      status: restoredStatus,
      state: restoredState,
      suspended_at: null,
      suspension_reason: null,
    })
    .eq("user_id", id)
    .select("user_id, status, is_activated, is_setup_complete, suspended_at, suspension_reason")
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: "Failed to restore account" }, { status: 500 });
  }

  await auditLog({
    adminId: userId,
    action: "user_unsuspend",
    entityType: "profiles",
    entityId: id,
    before,
    after: updated,
    reason: parsed.data.reason,
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ ok: true, status: updated.status });
}
