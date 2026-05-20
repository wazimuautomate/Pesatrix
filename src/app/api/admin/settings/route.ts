import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireAdmin, auditLog } from "../_lib";
import {
  DAILY_TASK_LIMIT_KEY,
  LEGACY_MIN_WITHDRAWAL_KSH_KEY,
  MAX_TASK_BATCH_VALUE_KSH_KEY,
  MAX_TASK_PAYOUT_KSH_KEY,
  MIN_WITHDRAWAL_KSH_KEY,
  REFERRAL_ACTIVATION_RULE_KEY,
  REFERRAL_LEVEL_1_REWARD_KEY,
  TRAINING_REWARD_SETTING_KEY,
  WITHDRAWAL_FEE_KSH_KEY,
  WITHDRAWAL_HOLD_DAYS_KEY,
  WITHDRAWAL_N8N_WEBHOOK_URL_KEY,
  WITHDRAWAL_PROCESSING_DAYS_KEY,
} from "@/lib/platform-setting-keys";

const settingsUpdateSchema = z.object({
  key: z.string().trim().min(1, "Setting key is required"),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

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

  const parsed = settingsUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid setting" } },
      { status: 422 }
    );
  }
  const { key, value } = parsed.data;

  const numericSettings = [
    TRAINING_REWARD_SETTING_KEY,
    "task_unlock_delay_hours",
    LEGACY_MIN_WITHDRAWAL_KSH_KEY,
    MIN_WITHDRAWAL_KSH_KEY,
    WITHDRAWAL_FEE_KSH_KEY,
    MAX_TASK_PAYOUT_KSH_KEY,
    MAX_TASK_BATCH_VALUE_KSH_KEY,
    "referral_task_unlock_reduction",
    "training_day_unlock_minutes",
    DAILY_TASK_LIMIT_KEY,
    WITHDRAWAL_HOLD_DAYS_KEY,
    WITHDRAWAL_PROCESSING_DAYS_KEY,
    REFERRAL_LEVEL_1_REWARD_KEY,
  ];

  if (key === REFERRAL_ACTIVATION_RULE_KEY) {
    if (value !== "activation_paid") {
      return NextResponse.json(
        { error: "Referral activation rule must be activation_paid" },
        { status: 422 }
      );
    }
  }

  if (key === REFERRAL_LEVEL_1_REWARD_KEY) {
    const numValue = Number(value);
    if (numValue !== 100) {
      return NextResponse.json(
        { error: "Referral reward must be KSh 100" },
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

  if (key === MIN_WITHDRAWAL_KSH_KEY || key === LEGACY_MIN_WITHDRAWAL_KSH_KEY) {
    const numValue = Number(value);
    if (!Number.isInteger(numValue) || numValue < 200) {
      return NextResponse.json(
        { error: "Minimum withdrawal must be a whole number of at least KSh 200" },
        { status: 422 }
      );
    }
  }

  if (key === WITHDRAWAL_FEE_KSH_KEY) {
    const numValue = Number(value);
    if (!Number.isInteger(numValue) || numValue < 30) {
      return NextResponse.json(
        { error: "Withdrawal fee must be a whole number of at least KSh 30" },
        { status: 422 }
      );
    }
  }

  if (key === MAX_TASK_PAYOUT_KSH_KEY) {
    const numValue = Number(value);
    if (!Number.isInteger(numValue) || numValue < 120) {
      return NextResponse.json(
        { error: "Maximum task payout must be a whole number of at least KSh 120" },
        { status: 422 }
      );
    }
  }

  if (key === MAX_TASK_BATCH_VALUE_KSH_KEY) {
    const numValue = Number(value);
    if (!Number.isInteger(numValue) || numValue < 600) {
      return NextResponse.json(
        { error: "Maximum task batch value must be a whole number of at least KSh 600" },
        { status: 422 }
      );
    }
  }

  if (key === WITHDRAWAL_PROCESSING_DAYS_KEY) {
    const numValue = Number(value);
    if (!Number.isFinite(numValue) || numValue < 0) {
      return NextResponse.json(
        { error: "Withdrawal processing time must be a positive number" },
        { status: 422 }
      );
    }
  }

  if (key === "referral_task_unlock_reduction") {
    const numValue = Number(value);
    if (!Number.isFinite(numValue) || numValue < 0 || numValue > 100) {
      return NextResponse.json(
        { error: "Referral task unlock reduction must be between 0 and 100 (or 0 and 1 as a fraction)" },
        { status: 422 }
      );
    }
  }

  if (key === WITHDRAWAL_N8N_WEBHOOK_URL_KEY) {
    const trimmed = String(value).trim();
    if (
      trimmed.length > 0 &&
      !/^https?:\/\/.+/i.test(trimmed)
    ) {
      return NextResponse.json(
        { error: "Withdrawal webhook URL must be a valid http or https URL" },
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
