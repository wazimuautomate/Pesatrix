import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog, requireAdmin } from "@/app/api/admin/_lib";
import { gradeSubmission } from "@/lib/ai/grading";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const authResult = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });
  if (authResult.error) return authResult.error;
  if (!authResult.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { userId, requestMeta } = authResult;
  const admin = createAdminSupabaseClient();

  const { data: submission, error: fetchError } = await admin
    .from("task_submissions")
    .select("id, status, ai_reviewed_at, tasks!task_submissions_task_id_fkey(ai_grading_enabled)")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const task = Array.isArray(submission.tasks) ? submission.tasks[0] : submission.tasks;
  if (!task?.ai_grading_enabled) {
    return NextResponse.json(
      { error: "AI grading is not enabled for this task" },
      { status: 400 }
    );
  }

  if (submission.ai_reviewed_at) {
    return NextResponse.json(
      { error: "Submission already has an AI review" },
      { status: 409 }
    );
  }

  if (submission.status === "approved" || submission.status === "declined") {
    return NextResponse.json(
      { error: `Cannot run AI review on a submission that is already ${submission.status}` },
      { status: 409 }
    );
  }

  await admin
    .from("task_submissions")
    .update({ status: "ai_reviewing" })
    .eq("id", id);

  await gradeSubmission(id);

  const { data: reviewed } = await admin
    .from("task_submissions")
    .select("status, ai_score, ai_reasoning, payout_credited")
    .eq("id", id)
    .maybeSingle();

  await auditLog({
    adminId: userId,
    action: "ai_review_triggered",
    entityType: "task_submissions",
    entityId: id,
    before: { status: submission.status },
    after: reviewed ?? null,
    reason: "Admin triggered AI review",
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ ok: true, review: reviewed });
}
