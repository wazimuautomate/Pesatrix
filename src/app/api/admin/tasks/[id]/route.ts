import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { validateTaskFinancials } from "@/lib/financial-limits";
import { getMaxTaskBatchValueKsh, getMaxTaskPayoutKsh } from "@/lib/platform-settings";
import { auditLog, requireAdmin } from "../../_lib";
import { normalizeTaskDatetimes } from "@/lib/datetime";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const updateTaskSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  category: z.enum(["survey", "data_labeling", "social_engagement", "verification", "content_creation", "watch_respond"]).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  instructions: z.string().trim().min(10).optional(),
  payout_ksh: z.number().int().min(10, "Minimum task payout is KSh 10").optional(),
  total_slots: z.number().int().min(1).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  publish_at: z.string().datetime().nullable().optional(),
  expires_at: z.string().datetime().nullable().optional(),
  ai_grading_enabled: z.boolean().optional(),
  ai_rubric: z.string().trim().max(2000).optional().nullable(),
  requires_screenshot: z.boolean().optional(),
  requires_url: z.boolean().optional(),
  min_word_count: z.number().int().min(0).optional(),
  task_data: z.record(z.unknown()).optional(),
});

export async function GET(_request: Request, { params }: RouteContext) {
  const { error: authError } = await requireAdmin({
    request: _request,
    allowedRoles: ["admin"],
  });
  if (authError) return authError;

  const { id } = await params;
  const admin = createAdminSupabaseClient();
  const { data: task, error: fetchError } = await admin
    .from("tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({ task });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { error: authError, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });
  if (authError) return authError;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const admin = createAdminSupabaseClient();

  const { data: before } = await admin
    .from("tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!before) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const parsed = updateTaskSchema.safeParse(normalizeTaskDatetimes(await request.json()));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message } },
      { status: 422 }
    );
  }

  const update: Record<string, unknown> = {};
  const data = parsed.data;
  const [maxTaskPayoutKsh, maxTaskBatchValueKsh] = await Promise.all([
    getMaxTaskPayoutKsh(),
    getMaxTaskBatchValueKsh(),
  ]);
  const financialError = validateTaskFinancials({
    payoutKsh: data.payout_ksh ?? Number(before.payout_ksh ?? 0),
    totalSlots: data.total_slots ?? Number(before.total_slots ?? 0),
    maxTaskPayoutKsh,
    maxTaskBatchValueKsh,
  });
  if (financialError) {
    return NextResponse.json({ error: financialError }, { status: 422 });
  }

  if (data.title !== undefined) update.title = data.title;
  if (data.category !== undefined) update.category = data.category;
  if (data.description !== undefined) update.description = data.description;
  if (data.instructions !== undefined) update.instructions = data.instructions;
  if (data.payout_ksh !== undefined) update.payout_ksh = data.payout_ksh;
  if (data.difficulty !== undefined) update.difficulty = data.difficulty;
  if (data.publish_at !== undefined) update.publish_at = data.publish_at;
  if (data.expires_at !== undefined) update.expires_at = data.expires_at;
  if (data.ai_grading_enabled !== undefined) update.ai_grading_enabled = data.ai_grading_enabled;
  if (data.ai_rubric !== undefined) update.ai_rubric = data.ai_rubric;
  if (data.requires_screenshot !== undefined) update.requires_screenshot = data.requires_screenshot;
  if (data.requires_url !== undefined) update.requires_url = data.requires_url;
  if (data.min_word_count !== undefined) update.min_word_count = data.min_word_count;
  if (data.task_data !== undefined) update.task_data = data.task_data;

  if (data.total_slots !== undefined) {
    const oldTotal = before.total_slots as number;
    const oldRemaining = before.slots_remaining as number;
    const taken = oldTotal - oldRemaining;
    const newTotal = data.total_slots;
    update.total_slots = newTotal;
    update.slots_remaining = Math.max(0, newTotal - taken);
  }

  const { data: task, error: updateError } = await admin
    .from("tasks")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (updateError || !task) {
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }

  await auditLog({
    adminId: userId,
    action: "task_update",
    entityType: "tasks",
    entityId: id,
    before,
    after: task,
    reason: "Updated by admin",
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ task });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { error: authError, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
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

  if ((task as { status: string }).status !== "draft") {
    return NextResponse.json(
      { error: "Only draft tasks can be deleted" },
      { status: 400 }
    );
  }

  const { data: submissions } = await admin
    .from("task_submissions")
    .select("id")
    .eq("task_id", id)
    .limit(1);

  if (submissions && submissions.length > 0) {
    return NextResponse.json(
      { error: "Task has submissions — archive instead" },
      { status: 409 }
    );
  }

  const { error: deleteError } = await admin
    .from("tasks")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }

  await auditLog({
    adminId: userId,
    action: "task_delete",
    entityType: "tasks",
    entityId: id,
    before: task,
    reason: "Deleted by admin",
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ ok: true });
}
