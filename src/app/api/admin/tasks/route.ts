import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog, requireAdmin } from "@/app/api/admin/_lib";
import { validateTaskFinancials } from "@/lib/financial-limits";
import { getMaxTaskBatchValueKsh, getMaxTaskPayoutKsh } from "@/lib/platform-settings";
import { draftTaskInsertSchema, taskInsertSchema } from "@/lib/task-types";
import { normalizeTaskDatetimes } from "@/lib/datetime";
import { syncTaskAssignments } from "@/lib/task-distribution";

export async function GET(request: Request) {

export async function GET(request: Request) {
  const { error, userId } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status")?.trim() ?? "";
  const categoryFilter = searchParams.get("category")?.trim() ?? "";
  const search = searchParams.get("search")?.trim() ?? "";
  const isStarterParam = searchParams.get("is_starter");

  const admin = createAdminSupabaseClient();
  let selectFields = "*";
  if (isStarterParam === "true") {
    selectFields = "*, task_assignments(status)";
  }
  let query = admin.from("tasks").select(selectFields);

  if (categoryFilter) query = query.eq("category", categoryFilter);
  if (statusFilter) query = query.eq("status", statusFilter);
  if (search) query = query.ilike("title", `%${search}%`);
  if (isStarterParam === "true") {
    query = query.eq("is_starter", true);
  } else if (isStarterParam === "false") {
    query = query.eq("is_starter", false);
  }

  const { data: rawTasks, error: fetchError } = await query.order("created_at", { ascending: false });

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message, items: [] }, { status: 400 });
  }

  const tasks = (rawTasks ?? []).map((task: any) => {
    if (isStarterParam === "true") {
      const assignments = task.task_assignments ?? [];
      const assignedCount = assignments.length;
      const completedCount = assignments.filter((a: any) => a.status === "completed").length;
      const cleanTask = { ...task };
      delete cleanTask.task_assignments;
      return {
        ...cleanTask,
        assigned_count: assignedCount,
        completed_count: completedCount,
      };
    }
    return task;
  });

  let countsQuery = admin.from("tasks").select("status");
  if (isStarterParam === "true") {
    countsQuery = countsQuery.eq("is_starter", true);
  } else if (isStarterParam === "false") {
    countsQuery = countsQuery.eq("is_starter", false);
  }
  const { data: countsData } = await countsQuery;

  const counts = {
    total: (tasks ?? []).length,
    draft: 0,
    active: 0,
    paused: 0,
    completed: 0,
    scheduled: 0,
  };

  if (countsData) {
    for (const row of countsData as { status: string }[]) {
      if (row.status in counts) {
        (counts as Record<string, number>)[row.status]++;
      }
    }
  }

  return NextResponse.json({
    items: tasks ?? [],
    tasks: tasks ?? [],
    total: tasks?.length ?? 0,
    counts,
  });
}

export async function POST(request: Request) {
  const { error, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = normalizeTaskDatetimes(await request.json());

  const isDraftSave = !body.publish_at;
  const parsed = (isDraftSave ? draftTaskInsertSchema : taskInsertSchema).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message } },
      { status: 422 }
    );
  }

  const {
    title,
    category,
    description,
    instructions,
    payout_ksh,
    total_slots,
    difficulty,
    publish_at,
    expires_at,
    ai_grading_enabled,
    ai_rubric,
    requires_screenshot,
    requires_url,
    min_word_count,
    visibility_mode,
    min_referrals_required,
    assigned_user_ids,
    task_data,
    is_starter,
    starter_day,
  } = parsed.data;

  const [maxTaskPayoutKsh, maxTaskBatchValueKsh] = await Promise.all([
    getMaxTaskPayoutKsh(),
    getMaxTaskBatchValueKsh(),
  ]);
  const financialError = validateTaskFinancials({
    payoutKsh: payout_ksh,
    totalSlots: total_slots,
    maxTaskPayoutKsh,
    maxTaskBatchValueKsh,
  });
  if (financialError) {
    return NextResponse.json({ error: financialError }, { status: 422 });
  }

  let status: string = "draft";
  if (publish_at) {
    const publishDate = new Date(publish_at);
    if (publishDate <= new Date()) {
      status = "active";
    } else {
      status = "scheduled";
    }
  }

  const admin = createAdminSupabaseClient();

  const { data: existing } = await admin
    .from("tasks")
    .select("id")
    .eq("title", title)
    .eq("category", category)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: "A task with this title and category already exists" },
      { status: 409 }
    );
  }

  const { data: task, error: insertError } = await admin
    .from("tasks")
    .insert({
      title,
      category,
      description: description ?? null,
      instructions,
      payout_ksh,
      total_slots,
      slots_remaining: total_slots,
      difficulty,
      status,
      publish_at: publish_at ?? null,
      expires_at: expires_at ?? null,
      created_by: userId,
      ai_grading_enabled,
      ai_rubric: ai_rubric ?? null,
      requires_screenshot,
      requires_url,
      min_word_count,
      visibility_mode,
      min_referrals_required,
      task_data: task_data ?? {},
      is_starter: is_starter ?? false,
      starter_day: starter_day ?? null,
    })
    .select("*")
    .single();

  if (insertError || !task) {
      { error: "Failed to create task" },
      { status: 500 }
    );
  }

  try {
    await syncTaskAssignments({
      admin,
      taskId: task.id,
      assignedBy: userId,
      assignedUserIds: assigned_user_ids,
    });
  } catch (assignmentError) {
    console.error("[POST /api/admin/tasks] assignment sync error:", assignmentError);
    await admin.from("tasks").delete().eq("id", task.id);
    return NextResponse.json(
      { error: "Task was created but assignments failed to save. Nothing was persisted." },
      { status: 500 }
    );
  }

  await auditLog({
    adminId: userId,
    action: "task_create",
    entityType: "tasks",
    entityId: task.id,
    after: {
      ...task,
      assigned_user_ids,
    },
    reason: "Created new task",
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ task }, { status: 201 });
}
