import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog, requireAdmin } from "@/app/api/admin/_lib";
import { validateTaskFinancials } from "@/lib/financial-limits";
import { getMaxTaskBatchValueKsh, getMaxTaskPayoutKsh } from "@/lib/platform-settings";
import { taskInsertSchema } from "@/lib/task-types";
import { normalizeTaskDatetimes } from "@/lib/datetime";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const updateTaskSchema = taskInsertSchema.partial();

export async function GET(request: Request, { params }: RouteContext) {
  const { error } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });
  if (error) return error;

  const { id } = await params;
  const admin = createAdminSupabaseClient();
  const { data: task } = await admin
    .from("tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({ task });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { error, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const admin = createAdminSupabaseClient();

  const { data: before } = await admin
    .from("tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!before) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const body = normalizeTaskDatetimes(await request.json());
  const parsed = updateTaskSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message } },
      { status: 422 }
    );
  }

  const [maxTaskPayoutKsh, maxTaskBatchValueKsh] = await Promise.all([
    getMaxTaskPayoutKsh(),
    getMaxTaskBatchValueKsh(),
  ]);
  const financialError = validateTaskFinancials({
    payoutKsh: parsed.data.payout_ksh ?? Number(before.payout_ksh ?? 0),
    totalSlots: parsed.data.total_slots ?? Number(before.total_slots ?? 0),
    maxTaskPayoutKsh,
    maxTaskBatchValueKsh,
  });
  if (financialError) {
    return NextResponse.json({ error: financialError }, { status: 422 });
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) update.title = parsed.data.title;
  if (parsed.data.category !== undefined) update.category = parsed.data.category;
  if (parsed.data.description !== undefined) update.description = parsed.data.description;
  if (parsed.data.instructions !== undefined) update.instructions = parsed.data.instructions;
  if (parsed.data.payout_ksh !== undefined) update.payout_ksh = parsed.data.payout_ksh;
  if (parsed.data.total_slots !== undefined) {
    update.total_slots = parsed.data.total_slots;
    const slotDiff = parsed.data.total_slots - (before.slots_remaining as number);
    update.slots_remaining = Math.max(0, (before.slots_remaining as number) + slotDiff);
  }
  if (parsed.data.difficulty !== undefined) update.difficulty = parsed.data.difficulty;
  if ((parsed.data as Record<string, unknown>).status !== undefined) update.status = (parsed.data as Record<string, unknown>).status;
  if (parsed.data.publish_at !== undefined) update.publish_at = parsed.data.publish_at;
  if (parsed.data.expires_at !== undefined) update.expires_at = parsed.data.expires_at;
  if (parsed.data.ai_grading_enabled !== undefined) update.ai_grading_enabled = parsed.data.ai_grading_enabled;
  if (parsed.data.ai_rubric !== undefined) update.ai_rubric = parsed.data.ai_rubric;
  if (parsed.data.requires_screenshot !== undefined) update.requires_screenshot = parsed.data.requires_screenshot;
  if (parsed.data.requires_url !== undefined) update.requires_url = parsed.data.requires_url;
  if (parsed.data.min_word_count !== undefined) update.min_word_count = parsed.data.min_word_count;
  if (parsed.data.task_data !== undefined) update.task_data = parsed.data.task_data;

  const { data: task, error: updateError } = await admin
    .from("tasks")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (updateError || !task) {
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }

  await auditLog({
    adminId: userId,
    action: "task_update",
    entityType: "tasks",
    entityId: id,
    before,
    after: task,
    reason: "Updated task",
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ task });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { error, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const admin = createAdminSupabaseClient();

  const { data: before } = await admin
    .from("tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!before) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const { error: deleteError } = await admin
    .from("tasks")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }

  await auditLog({
    adminId: userId,
    action: "task_delete",
    entityType: "tasks",
    entityId: id,
    before,
    reason: "Deleted task",
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ ok: true });
}
