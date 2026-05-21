import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog, requireAdmin } from "@/app/api/admin/_lib";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  const body = await request.json();
  if (body.target_user_id === "") {
    body.target_user_id = null;
  }
  const admin = createAdminSupabaseClient();

  const { data: banner, error: updateError } = await admin
    .from("banners")
    .update(body)
    .eq("id", id)
    .select("*")
    .single();

  if (updateError || !banner) {
    return NextResponse.json({ error: "Failed to update banner" }, { status: 500 });
  }

  await auditLog({
    adminId: userId,
    action: "banner_update",
    entityType: "banners",
    entityId: banner.id,
    after: banner,
    reason: "Updated banner details",
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ banner });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  const admin = createAdminSupabaseClient();

  const { data: oldBanner, error: fetchError } = await admin
    .from("banners")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !oldBanner) {
    return NextResponse.json({ error: "Banner not found" }, { status: 404 });
  }

  const { error: deleteError } = await admin
    .from("banners")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete banner" }, { status: 500 });
  }

  await auditLog({
    adminId: userId,
    action: "banner_delete",
    entityType: "banners",
    entityId: id,
    before: oldBanner,
    reason: "Deleted banner",
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ success: true });
}
