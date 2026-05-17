import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog, requireAdmin } from "@/app/api/admin/_lib";
import { taskInsertSchema } from "@/lib/task-types";

export async function GET(request: Request) {
  const { error, userId } = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "admin", "support"],
  });
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get("status");
  const categoryFilter = searchParams.get("category");
  const search = searchParams.get("search");

  const admin = createAdminSupabaseClient();
  let query = admin.from("tasks").select("*");

  if (statusFilter) query = query.eq("status", statusFilter);
  if (categoryFilter) query = query.eq("category", categoryFilter);
  if (search) query = query.ilike("title", `%${search}%`);

  const { data: tasks, error: fetchError } = await query.order("created_at", { ascending: false });

  if (fetchError) {
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }

  const { data: countsData } = await admin
    .from("tasks")
    .select("status");

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

  return NextResponse.json({ tasks: tasks ?? [], counts });
}

export async function POST(request: Request) {
  const { error, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "admin"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();

  const parsed = taskInsertSchema.safeParse(body);
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
    task_data,
  } = parsed.data;

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
      task_data,
    })
    .select("*")
    .single();

  if (insertError || !task) {
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }

  await auditLog({
    adminId: userId,
    action: "task_create",
    entityType: "tasks",
    entityId: task.id,
    after: task,
    reason: "Created new task",
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ task }, { status: 201 });
}
