import { NextResponse } from "next/server";

import { requireAdmin } from "@/app/api/admin/_lib";
import { sendSMS } from "@/lib/sms/scopeClient";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const SMS_TEST_COOLDOWN_MS = 10000;
let lastSmsTestAt = 0;

export async function POST(request: Request) {
  const { error, adminUser } = await requireAdmin({ request });
  if (error) return error;
  if (!adminUser || !["admin", "super_admin"].includes(adminUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = Date.now();
  if (now - lastSmsTestAt < SMS_TEST_COOLDOWN_MS) {
    return NextResponse.json(
      {
        status: "error",
        phone: null,
        message_id: null,
        error: "SMS test cooldown active. Try again in a few seconds.",
      },
      { status: 429 }
    );
  }
  lastSmsTestAt = now;

  const admin = createAdminSupabaseClient();
  const { data: setting, error: settingError } = await admin
    .from("platform_settings")
    .select("value")
    .eq("key", "admin_sms_phone")
    .maybeSingle();

  if (settingError) {
    return NextResponse.json({ status: "error", phone: null, message_id: null, error: "Failed to load admin_sms_phone." });
  }

  const adminPhone = typeof setting?.value === "string" ? setting.value.trim() : "";
  if (!adminPhone) {
    return NextResponse.json({
      status: "error",
      phone: null,
      message_id: null,
      error: "Set admin_sms_phone in Platform Settings before testing SMS.",
    });
  }

  const result = await sendSMS(
    adminPhone,
    "[Pesatrix] SMS test: task review and withdrawal alerts are ready."
  );

  return NextResponse.json({
    status: result.success ? "ok" : "error",
    phone: adminPhone,
    message_id: result.messageId ?? null,
    error: result.success ? null : result.error ?? "SMS provider returned an error.",
  });
}
