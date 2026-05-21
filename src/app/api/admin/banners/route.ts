import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog, requireAdmin } from "@/app/api/admin/_lib";

export async function GET(request: Request) {
  const { error, userId } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });
  if (error) return error;

  const admin = createAdminSupabaseClient();
  const { data: banners, error: fetchError } = await admin
    .from("banners")
    .select("*")
    .order("created_at", { ascending: false });

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 400 });
  }

  return NextResponse.json({ items: banners ?? [] });
}

export async function POST(request: Request) {
  const { error, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { title, message, type, target, target_user_id, is_dismissible, expires_at } = body;

  if (!title || !message) {
    return NextResponse.json({ error: "Title and message are required" }, { status: 422 });
  }

  const admin = createAdminSupabaseClient();
  const { data: banner, error: insertError } = await admin
    .from("banners")
    .insert({
      title,
      message,
      type: type ?? "info",
      target: target ?? "all",
      target_user_id: target_user_id ?? null,
      is_dismissible: is_dismissible ?? true,
      expires_at: expires_at ? new Date(expires_at).toISOString() : null,
      created_by: userId,
    })
    .select("*")
    .single();

  if (insertError || !banner) {
    console.error("Banner insert error:", insertError);
    return NextResponse.json({ error: "Failed to create banner" }, { status: 500 });
  }

  await auditLog({
    adminId: userId,
    action: "banner_create",
    entityType: "banners",
    entityId: banner.id,
    after: banner,
    reason: "Created new banner",
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ banner }, { status: 201 });
}
