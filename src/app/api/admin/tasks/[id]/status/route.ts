import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog, requireAdmin } from "../../../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const statusTransitionSchema = z.object({
  status: z.enum(["active", "paused", "draft", "completed"]),
});

const LEGAL_TRANSITIONS: Record<string, string[]> = {
  draft: ["active"],
  active: ["paused", "completed"],
  paused: ["active"],
  scheduled: ["active"],
  completed: [],
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const { error: authError, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "admin"],
  });
  if (authError) return authError;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const admin = createAdminSupabaseClient();

  const { data: task } = await admin
    .from("tasks")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const currentStatus = (task as { status: string }).status;
  const parsed = statusTransitionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid status value" } },
      { status: 422 }
    );
  }

  const newStatus = parsed.data.status;
  const allowed = LEGAL_TRANSITIONS[currentStatus] ?? [];

  if (!allowed.includes(newStatus)) {
    return NextResponse.json(
      { error: `Cannot transition from "${currentStatus}" to "${newStatus}". Allowed: ${allowed.join(", ") || "none"}` },
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = { status: newStatus };
  if (newStatus === "active" && currentStatus === "scheduled") {
    update.publish_at = new Date().toISOString();
  }

  const { data: updatedTask, error: updateError } = await admin
    .from("tasks")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (updateError || !updatedTask) {
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }

  await auditLog({
    adminId: userId,
    action: "task_status_change",
    entityType: "tasks",
    entityId: id,
    before: { status: currentStatus },
    after: { status: newStatus },
    reason: `Status changed from ${currentStatus} to ${newStatus}`,
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ task: updatedTask });
}
