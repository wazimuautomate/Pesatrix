import { NextResponse } from "next/server";

import { auditLog, requireAdmin } from "@/app/api/admin/_lib";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { error, adminUser, userId: adminAuthId, requestMeta } = await requireAdmin({ request });
  if (error) return error;
  if (!adminAuthId || !adminUser || !["admin", "super_admin"].includes(adminUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminSupabaseClient();
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: stuck, error: fetchError } = await admin
    .from("task_submissions")
    .select("id")
    .eq("status", "ai_reviewing")
    .is("ai_reviewed_at", null)
    .lt("submitted_at", cutoff);

  if (fetchError) {
    return NextResponse.json({ error: "Failed to find stuck submissions" }, { status: 500 });
  }

  const ids = (stuck ?? []).map((row: { id: string }) => row.id);
  if (ids.length === 0) {
    return NextResponse.json({ count: 0 });
  }

  const { error: updateError } = await admin
    .from("task_submissions")
    .update({
      status: "flagged",
      ai_reasoning: "Flushed by admin - AI grading timed out",
      ai_score: null,
    })
    .in("id", ids);

  if (updateError) {
    return NextResponse.json({ error: "Failed to flush stuck submissions" }, { status: 500 });
  }

  await auditLog({
    adminId: adminAuthId,
    action: "ai_flush_stuck_submissions",
    entityType: "task_submissions",
    entityId: adminAuthId,
    before: { status: "ai_reviewing", count: ids.length },
    after: { status: "flagged", count: ids.length },
    reason: "Flushed stuck AI reviewing submissions older than 5 minutes",
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ count: ids.length });
}
