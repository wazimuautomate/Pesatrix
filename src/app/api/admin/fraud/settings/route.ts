import { NextResponse } from "next/server";
import { z } from "zod";

import { auditLog, requireAdmin } from "@/app/api/admin/_lib";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const FRAUD_AI_MODE_KEY = "fraud_ai_mode";
const FRAUD_AI_LAST_CRON_RUN_KEY = "fraud_ai_last_cron_run";

const schema = z.object({
  mode: z.enum(["auto", "manual", "disabled"]),
});

type FraudSettingRow = {
  key: string;
  value: string;
  updated_at: string;
};

export async function GET(request: Request) {
  const { error } = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "fraud"],
  });
  if (error) return error;

  const admin = createAdminSupabaseClient();
  const { data, error: fetchError } = await (admin.from("platform_settings" as never) as any)
    .select("key, value, updated_at")
    .in("key", [FRAUD_AI_MODE_KEY, FRAUD_AI_LAST_CRON_RUN_KEY]);

  if (fetchError) {
    return NextResponse.json({ error: "Failed to fetch fraud AI settings" }, { status: 500 });
  }

  const rows = (data ?? []) as FraudSettingRow[];
  const settings = new Map<string, FraudSettingRow>(
    rows.map((row) => [row.key, row])
  );
  const mode = normalizeMode(settings.get(FRAUD_AI_MODE_KEY)?.value);

  return NextResponse.json({
    mode,
    lastCronRun: settings.get(FRAUD_AI_LAST_CRON_RUN_KEY)?.value ?? null,
    updatedAt: settings.get(FRAUD_AI_MODE_KEY)?.updated_at ?? null,
  });
}

export async function POST(request: Request) {
  const { error, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "fraud"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Mode must be auto, manual, or disabled" }, { status: 422 });
  }

  const admin = createAdminSupabaseClient();
  const { data: existing } = await (admin.from("platform_settings" as never) as any)
    .select("key, value")
    .eq("key", FRAUD_AI_MODE_KEY)
    .maybeSingle();

  const { data, error: updateError } = await (admin.from("platform_settings" as never) as any)
    .upsert(
      {
        key: FRAUD_AI_MODE_KEY,
        value: parsed.data.mode,
        updated_by_admin_id: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    )
    .select("key, value, updated_at")
    .single();

  if (updateError) {
    return NextResponse.json({ error: "Failed to update fraud AI mode" }, { status: 500 });
  }

  await auditLog({
    adminId: userId,
    action: "fraud_ai_mode_update",
    entityType: "platform_settings",
    entityId: FRAUD_AI_MODE_KEY,
    before: { value: existing?.value ?? null },
    after: { value: parsed.data.mode },
    reason: `Set fraud AI mode to ${parsed.data.mode}`,
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({
    mode: normalizeMode(data.value),
    updatedAt: data.updated_at,
  });
}

function normalizeMode(value: unknown) {
  return value === "auto" || value === "manual" || value === "disabled" ? value : "manual";
}
