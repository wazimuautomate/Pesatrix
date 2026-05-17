import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog, requireAdmin } from "@/app/api/admin/_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const declineSchema = z.object({
  reason: z.string().trim().min(1, "Reason is required").max(2000),
});

export async function POST(request: Request, { params }: RouteContext) {
  const authResult = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "admin"],
  });
  if (authResult.error) return authResult.error;
  if (!authResult.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { userId, requestMeta } = authResult;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const parsed = declineSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Validation error" },
      { status: 422 }
    );
  }

  const admin = createAdminSupabaseClient();

  const { data: submission, error: fetchError } = await admin
    .from("task_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const sub = submission as Record<string, unknown>;

  if (sub.status === "declined") {
    return NextResponse.json(
      { error: "Submission is already declined" },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();

  const { error: updateError } = await admin
    .from("task_submissions")
    .update({
      status: "declined",
      admin_decision: "declined",
      admin_note: parsed.data.reason,
      admin_reviewed_by: userId,
      admin_reviewed_at: now,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update submission" },
      { status: 500 }
    );
  }

  await auditLog({
    adminId: userId,
    action: "submission_declined",
    entityType: "task_submissions",
    entityId: id,
    before: { status: sub.status },
    after: { status: "declined", admin_decision: "declined", admin_note: parsed.data.reason },
    reason: parsed.data.reason,
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ ok: true });
}
