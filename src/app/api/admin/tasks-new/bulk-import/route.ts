import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog, requireAdmin } from "@/app/api/admin/_lib";
import { bulkImportSchema } from "@/lib/task-types";
import { normalizeTaskDatetimes } from "@/lib/datetime";

export async function POST(request: Request) {
  const { error, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "admin"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const normalizedBody = Array.isArray(body)
    ? body.map((task) =>
        typeof task === "object" && task !== null && !Array.isArray(task)
          ? normalizeTaskDatetimes(task as Record<string, unknown>)
          : task
      )
    : body;
  const parsed = bulkImportSchema.safeParse(normalizedBody);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.errors.map((e) => e.message).join(", ") } },
      { status: 422 }
    );
  }

  const admin = createAdminSupabaseClient();
  const tasksToInsert = parsed.data.map((task) => ({
    title: task.title,
    category: task.category,
    description: task.description ?? null,
    instructions: task.instructions,
    payout_ksh: task.payout_ksh,
    total_slots: task.total_slots,
    slots_remaining: task.total_slots,
    difficulty: task.difficulty,
    status: task.publish_at ? "scheduled" : "draft",
    publish_at: task.publish_at ?? null,
    expires_at: task.expires_at ?? null,
    created_by: userId,
    ai_grading_enabled: task.ai_grading_enabled,
    ai_rubric: task.ai_rubric ?? null,
    requires_screenshot: task.requires_screenshot,
    requires_url: task.requires_url,
    min_word_count: task.min_word_count,
    task_data: task.task_data,
  }));

  const { data: tasks, error: insertError } = await admin
    .from("tasks")
    .insert(tasksToInsert)
    .select("*");

  if (insertError) {
    return NextResponse.json(
      { error: "Failed to import tasks", details: insertError.message },
      { status: 500 }
    );
  }

  await auditLog({
    adminId: userId,
    action: "task_bulk_import",
    entityType: "tasks",
    entityId: tasks?.[0]?.id ?? "unknown",
    after: { count: tasks?.length ?? 0 },
    reason: `Bulk imported ${tasks?.length ?? 0} tasks`,
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ tasks: tasks ?? [], count: tasks?.length ?? 0 });
}
