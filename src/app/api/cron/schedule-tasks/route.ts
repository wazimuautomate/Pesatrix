import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");

  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();

  const { data: publishedResult, error: publishError } = await admin.rpc(
    "publish_scheduled_tasks"
  );

  const { data: expiredResult, error: expireError } = await admin.rpc(
    "expire_active_tasks"
  );

  const results = {
    published: publishedResult ?? 0,
    expired: expiredResult ?? 0,
    publishError: publishError?.message ?? null,
    expireError: expireError?.message ?? null,
  };

  return NextResponse.json(results);
}
