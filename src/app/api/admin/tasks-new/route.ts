import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog, requireAdmin } from "@/app/api/admin/_lib";
import { taskInsertSchema } from "@/lib/task-types";
import { normalizeTaskDatetimes } from "@/lib/datetime";

export async function GET(request: Request) {
  const { error, userId } = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "admin", "support"],
  });
  if (error) return error;

  const admin = createAdminSupabaseClient();
  const { data: tasks, error: fetchError } = await admin
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (fetchError) {
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }

  return NextResponse.json({ tasks: tasks ?? [] });
}

export async function POST(request: Request) {
  const { error, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "admin"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = normalizeTaskDatetimes(await request.json());

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

  const status = publish_at ? "scheduled" : "draft";

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
