import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog, requireAdmin } from "@/app/api/admin/_lib";

export async function POST(request: Request) {
  const { error, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "admin"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const { action, taskIds } = body;

  if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
    return NextResponse.json({ error: "No tasks selected" }, { status: 400 });
  }

  if (!["delete", "publish", "draft"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();

  if (action === "delete") {
    const { error: deleteError } = await admin
      .from("tasks")
      .delete()
      .eq("status", "draft")
      .in("id", taskIds);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
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
      return NextResponse.json({ error: updateError.message }, { status: 500 });
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
      return NextResponse.json({ error: updateError.message }, { status: 500 });
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