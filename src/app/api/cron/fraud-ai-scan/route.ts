import { NextResponse } from "next/server";

import { runAIFraudScan } from "@/lib/fraud/aiScorer";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const FRAUD_AI_MODE_KEY = "fraud_ai_mode";
const FRAUD_AI_LAST_CRON_RUN_KEY = "fraud_ai_last_cron_run";

export async function GET(request: Request) {
  return runCron(request);
}

export async function POST(request: Request) {
  return runCron(request);
}

async function runCron(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;

  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();
  const { data: setting, error: settingError } = await (admin.from("platform_settings" as never) as any)
    .select("value")
    .eq("key", FRAUD_AI_MODE_KEY)
    .maybeSingle();

  if (settingError) {
    return NextResponse.json({ error: "Failed to read fraud AI mode" }, { status: 500 });
  }

  if (setting?.value !== "auto") {
    return NextResponse.json({ skipped: true, reason: "fraud_ai_mode is not auto" });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [deviceResult, submissionResult, adminUsersResult] = await Promise.all([
    (admin.from("device_sessions" as never) as any)
      .select("user_id")
      .gte("created_at", since)
      .limit(200),
    (admin.from("task_submissions" as never) as any)
      .select("user_id")
      .gte("submitted_at", since)
      .eq("status", "flagged")
      .limit(200),
    (admin.from("admin_users" as never) as any).select("user_id"),
  ]);

  if (deviceResult.error || submissionResult.error) {
    return NextResponse.json({ error: "Failed to fetch fraud scan candidates" }, { status: 500 });
  }

  const adminUserIds = new Set((adminUsersResult.data ?? []).map((row: { user_id: string }) => row.user_id));
  const userIds = Array.from(
    new Set([
      ...(deviceResult.data ?? []).map((row: { user_id: string }) => row.user_id),
      ...(submissionResult.data ?? []).map((row: { user_id: string }) => row.user_id),
    ])
  )
    .filter((userId) => userId && !adminUserIds.has(userId))
    .slice(0, 50);

  const results: Array<{ userId: string; ok: boolean; error?: string }> = [];

  for (const userId of userIds) {
    try {
      await runAIFraudScan(userId);
      results.push({ userId, ok: true });
    } catch (error) {
      console.error("[fraud-ai-cron] Failed to scan user", userId, error);
      results.push({
        userId,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown scan error",
      });
    }

    await delay(500);
  }

  const timestamp = new Date().toISOString();
  await (admin.from("platform_settings" as never) as any).upsert(
    {
      key: FRAUD_AI_LAST_CRON_RUN_KEY,
      value: timestamp,
      updated_at: timestamp,
    },
    { onConflict: "key" }
  );

  return NextResponse.json({
    scanned: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    timestamp,
    results,
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
