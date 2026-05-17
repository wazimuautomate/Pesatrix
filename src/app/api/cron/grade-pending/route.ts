import { NextResponse } from "next/server";
import { gradeSubmission } from "@/lib/ai/grading";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const cronSecret = request.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createAdminSupabaseClient();
  const { data: stuck, error } = await supabaseAdmin
    .from("task_submissions")
    .select("id")
    .eq("status", "ai_reviewing")
    .is("ai_reviewed_at", null)
    .lt("submitted_at", new Date(Date.now() - 2 * 60 * 1000).toISOString())
    .limit(20);

  if (error) {
    console.error("[Cron Grade Pending] Failed to fetch stuck submissions:", error);
    return NextResponse.json({ error: "Failed to fetch pending submissions" }, { status: 500 });
  }

  for (const submission of stuck || []) {
    await gradeSubmission(submission.id);
  }

  return NextResponse.json({ processed: stuck?.length || 0 });
}
