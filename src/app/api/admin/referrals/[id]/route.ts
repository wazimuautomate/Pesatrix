import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog, requireAdmin } from "../../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const updateReferralSchema = z.object({
  source: z.enum(["signup", "admin", "import"]).optional(),
  reason: z.string().trim().min(3).max(240).optional(),
});

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const { error, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = updateReferralSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid referral update" } },
      { status: 422 }
    );
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.source !== undefined) update.source = parsed.data.source;

  const admin = createAdminSupabaseClient();
  const { data: before } = await (admin.from("referrals" as never) as any)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!before) return NextResponse.json({ error: "Referral not found" }, { status: 404 });

  const { data: referral, error: updateError } = await (admin.from("referrals" as never) as any)
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (updateError || !referral) {
    return NextResponse.json({ error: "Failed to update referral" }, { status: 500 });
  }

  await auditLog({
    adminId: userId,
    action: "referral_update",
    entityType: "referrals",
    entityId: id,
    before,
    after: referral,
    reason: parsed.data.reason ?? "Updated by admin",
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ referral });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const { error, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminSupabaseClient();
  const { data: before } = await (admin.from("referrals" as never) as any)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!before) return NextResponse.json({ error: "Referral not found" }, { status: 404 });

  const { error: deleteError } = await (admin.from("referrals" as never) as any)
    .delete()
    .eq("id", id);
  if (deleteError) return NextResponse.json({ error: "Failed to delete referral" }, { status: 500 });

  await auditLog({
    adminId: userId,
    action: "referral_delete",
    entityType: "referrals",
    entityId: id,
    before,
    reason: "Deleted by admin",
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ ok: true });
}
