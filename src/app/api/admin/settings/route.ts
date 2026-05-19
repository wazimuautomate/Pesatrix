import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireAdmin, auditLog } from "../_lib";
import {
  DAILY_TASK_LIMIT_KEY,
  REFERRAL_ACTIVATION_RULE_KEY,
  REFERRAL_LEVEL_1_REWARD_KEY,
  REFERRAL_LEVEL_2_REWARD_KEY,
  REFERRAL_LEVEL_3_REWARD_KEY,
  REFERRAL_MAX_LEVELS_KEY,
  TRAINING_REWARD_SETTING_KEY,
  WITHDRAWAL_HOLD_DAYS_KEY,
  WITHDRAWAL_PROCESSING_DAYS_KEY,
} from "@/lib/platform-setting-keys";

export async function GET(request: Request) {
  const { error, adminUser, userId: adminAuthId, requestMeta } = await requireAdmin({});
  if (error) return error;

  const admin = createAdminSupabaseClient();

  const { data, error: fetchError } = await (admin.from("platform_settings" as never) as any)
    .select("key, value, description, updated_by_admin_id, updated_at")
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
    TRAINING_REWARD_SETTING_KEY,
    "task_unlock_delay_hours",
    "min_withdrawal_amount_ksh",
    "referral_task_unlock_reduction",
    "training_day_unlock_minutes",
    DAILY_TASK_LIMIT_KEY,
    WITHDRAWAL_HOLD_DAYS_KEY,
    WITHDRAWAL_PROCESSING_DAYS_KEY,
    REFERRAL_MAX_LEVELS_KEY,
    REFERRAL_LEVEL_1_REWARD_KEY,
    REFERRAL_LEVEL_2_REWARD_KEY,
    REFERRAL_LEVEL_3_REWARD_KEY,
  ];

  if (key === REFERRAL_ACTIVATION_RULE_KEY) {
    if (value !== "activation_paid") {
      return NextResponse.json(
        { error: "Referral activation rule must be activation_paid" },
        { status: 422 }
      );
    }
  }

  if (key === REFERRAL_MAX_LEVELS_KEY) {
    const numValue = Number(value);
    if (!Number.isInteger(numValue) || numValue < 1 || numValue > 3) {
      return NextResponse.json(
        { error: "Referral max levels must be a whole number between 1 and 3" },
        { status: 422 }
      );
    }
  }

  if ([REFERRAL_LEVEL_1_REWARD_KEY, REFERRAL_LEVEL_2_REWARD_KEY, REFERRAL_LEVEL_3_REWARD_KEY].includes(key)) {
    const numValue = Number(value);
    if (!Number.isInteger(numValue) || numValue < 0 || numValue > 100000) {
      return NextResponse.json(
        { error: "Referral reward must be a whole number between 0 and 100000" },
        { status: 422 }
      );
    }
  }

  if (key === WITHDRAWAL_HOLD_DAYS_KEY) {
    const numValue = Number(value);
    if (!Number.isInteger(numValue) || numValue < 0 || numValue > 30) {
      return NextResponse.json(
        { error: "Withdrawal hold period must be a whole number between 0 and 30" },
        { status: 422 }
      );
    }
  }

  if (key === WITHDRAWAL_PROCESSING_DAYS_KEY) {
    const numValue = Number(value);
    if (!Number.isInteger(numValue) || numValue < 1 || numValue > 14) {
      return NextResponse.json(
        { error: "Withdrawal processing time must be a whole number between 1 and 14" },
        { status: 422 }
      );
    }
  }

  if (key === TRAINING_REWARD_SETTING_KEY) {
    const numValue = Number(value);
    if (!Number.isInteger(numValue) || numValue < 0 || numValue > 10000) {
      return NextResponse.json(
        { error: "Training completion reward must be a whole number between 0 and 10000" },
        { status: 422 }
      );
    }
  }

  if (key === DAILY_TASK_LIMIT_KEY) {
    const numValue = Number(value);
    if (!Number.isInteger(numValue) || numValue < 1 || numValue > 100) {
      return NextResponse.json(
        { error: "Daily task limit must be a whole number between 1 and 100" },
        { status: 422 }
      );
    }
  }

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
        updated_by_admin_id: adminAuthId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    )
    .select("key, value, description, updated_by_admin_id, updated_at")
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

export async function POST(request: Request) {
  return PATCH(request);
}
