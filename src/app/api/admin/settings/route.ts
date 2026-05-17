import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireAdmin, auditLog, getRequestMeta } from "../_lib";

export async function GET(request: Request) {
  const { error, adminUser, userId: adminAuthId, requestMeta } = await requireAdmin({});
  if (error) return error;

  const admin = createAdminSupabaseClient();

  const { data, error: fetchError } = await (admin.from("platform_settings" as never) as any)
    .select("key, value, description, updated_by, updated_at")
    .order("key", { ascending: true });

  if (fetchError) {
    console.error("[GET /api/admin/settings]", fetchError);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }

  return NextResponse.json({ settings: data });
}

export async function PATCH(request: Request) {
  const { error, adminUser, userId: adminAuthId, requestMeta } = await requireAdmin({});
  if (error) return error;

  const body = await request.json();
  const { key, value } = body;

  if (!key || typeof key !== "string") {
    return NextResponse.json({ error: "Setting key is required" }, { status: 422 });
  }

  if (value === undefined) {
    return NextResponse.json({ error: "Setting value is required" }, { status: 422 });
  }

  const numericSettings = [
    "training_completion_reward_ksh",
    "task_unlock_delay_hours",
    "min_withdrawal_amount_ksh",
    "referral_task_unlock_reduction",
    "training_day_unlock_minutes",
  ];

  if (numericSettings.includes(key)) {
    const numValue = Number(value);
    if (!Number.isFinite(numValue) || numValue < 0) {
      return NextResponse.json(
        { error: `${key} must be a positive number` },
        { status: 422 }
      );
    }
  }

  const admin = createAdminSupabaseClient();

  const { data: existing } = await (admin.from("platform_settings" as never) as any)
    .select("key, value")
    .eq("key", key)
    .maybeSingle();

  const beforeValue = existing?.value;

  const { data, error: updateError } = await (admin.from("platform_settings" as never) as any)
    .upsert(
      {
        key,
        value: String(value),
        updated_by: adminAuthId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    )
    .select("key, value, description, updated_by, updated_at")
    .single();

  if (updateError) {
    console.error("[PATCH /api/admin/settings]", updateError);
    return NextResponse.json({ error: "Failed to update setting" }, { status: 500 });
  }

  await auditLog({
    adminId: adminAuthId!,
    action: "setting_update",
    entityType: "platform_settings",
    entityId: key,
    before: { value: beforeValue },
    after: { value: String(value) },
    reason: `Updated setting ${key}`,
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ setting: data });
}