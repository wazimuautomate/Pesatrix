import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog, requireAdmin } from "@/app/api/admin/_lib";

const bulkActionSchema = z.object({
  action: z.enum(["delete", "publish", "draft"]),
  taskIds: z.array(z.string().uuid()).min(1, "No tasks selected"),
});

export async function POST(request: Request) {
  const { error, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = bulkActionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid request" } },
      { status: 422 }
    );
  }
  const { action, taskIds } = parsed.data;

  const admin = createAdminSupabaseClient();

  if (action === "delete") {
    const { error: deleteError } = await admin
      .from("tasks")
      .delete()
      .eq("status", "draft")
      .in("id", taskIds);

    if (deleteError) {
      console.error("[POST /api/admin/tasks/bulk] delete error:", deleteError);
      return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete tasks" } }, { status: 500 });
    }

    await auditLog({
      adminId: userId,
      action: "task_bulk_delete",
      entityType: "tasks",
      entityId: taskIds[0],
      reason: `Bulk deleted ${taskIds.length} draft tasks (IDs: ${taskIds.slice(0, 3).join(", ")}${taskIds.length > 3 ? "..." : ""})`,
      ip: requestMeta?.ip ?? undefined,
      userAgent: requestMeta?.userAgent ?? undefined,
    });

    return NextResponse.json({ success: true, deleted: taskIds.length });
  }

  if (action === "publish") {
    const { error: updateError } = await admin
      .from("tasks")
      .update({ status: "active", publish_at: new Date().toISOString() })
      .in("id", taskIds)
      .in("status", ["draft", "paused"]);

    if (updateError) {
      console.error("[POST /api/admin/tasks/bulk] publish error:", updateError);
      return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Failed to publish tasks" } }, { status: 500 });
    }

    await auditLog({
      adminId: userId,
      action: "task_bulk_publish",
      entityType: "tasks",
      entityId: taskIds[0],
      reason: `Bulk published ${taskIds.length} tasks (IDs: ${taskIds.slice(0, 3).join(", ")}${taskIds.length > 3 ? "..." : ""})`,
      ip: requestMeta?.ip ?? undefined,
      userAgent: requestMeta?.userAgent ?? undefined,
    });

    return NextResponse.json({ success: true, published: taskIds.length });
  }

  if (action === "draft") {
    const { error: updateError } = await admin
      .from("tasks")
      .update({ status: "draft", publish_at: null })
      .in("id", taskIds)
      .in("status", ["active", "paused", "scheduled"]);

    if (updateError) {
      console.error("[POST /api/admin/tasks/bulk] draft error:", updateError);
      return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Failed to revert tasks to draft" } }, { status: 500 });
    }

    await auditLog({
      adminId: userId,
      action: "task_bulk_draft",
      entityType: "tasks",
      entityId: taskIds[0],
      reason: `Bulk reverted ${taskIds.length} tasks to draft (IDs: ${taskIds.slice(0, 3).join(", ")}${taskIds.length > 3 ? "..." : ""})`,
      ip: requestMeta?.ip ?? undefined,
      userAgent: requestMeta?.userAgent ?? undefined,
    });

    return NextResponse.json({ success: true, reverted: taskIds.length });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
