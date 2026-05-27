import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const cronSecret = request.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("task_assignments")
    .update({ status: "available" })
    .eq("status", "locked")
    .lte("unlocks_at", new Date().toISOString())
    .select("id");

  if (error) {
    console.error("[GET /api/cron/release-tasks] Failed to release locked tasks:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to release tasks" } },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    releasedCount: data?.length ?? 0,
    ran: new Date().toISOString()
  });
}
