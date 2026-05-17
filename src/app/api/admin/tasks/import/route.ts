import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog, requireAdmin } from "../../_lib";
import {
  watchRespondTaskDataSchema,
  questionSchema,
  QUESTION_TYPE_OPEN_TEXT,
  QUESTION_TYPE_MULTIPLE_CHOICE,
  QUESTION_TYPE_RATING,
  QUESTION_TYPE_YES_NO,
} from "@/lib/task-types";

const importTaskSchema = z.object({
  title: z.string().trim().min(3).max(200),
  category: z.enum(["survey", "data_labeling", "social_engagement", "verification", "content_creation", "watch_respond"]),
  description: z.string().trim().max(1000).optional().nullable(),
  instructions: z.string().trim().min(10),
  payout_ksh: z.number().int().min(20).max(50),
  total_slots: z.number().int().min(100).max(400),
  difficulty: z.enum(["easy", "medium", "hard"]).default("easy"),
  publish_at: z.string().datetime().nullable().default(null),
  expires_at: z.string().datetime().nullable().default(null),
  ai_grading_enabled: z.boolean().default(true),
  ai_rubric: z.string().trim().max(2000).optional().nullable(),
  requires_screenshot: z.boolean().default(false),
  requires_url: z.boolean().default(false),
  min_word_count: z.number().int().min(0).default(0),
  task_data: z.record(z.unknown()),
});

const importBodySchema = z.object({
  tasks: z.array(z.unknown()).min(1),
  publishAll: z.boolean().default(false),
});

function validateWatchRespondTaskData(taskData: unknown): string | null {
  const parsed = watchRespondTaskDataSchema.safeParse(taskData);
  if (!parsed.success) {
    return parsed.error.errors[0]?.message ?? "Invalid task_data";
  }

  const data = parsed.data;
  if (!data.video_url || typeof data.video_url !== "string" || data.video_url.trim() === "") {
    return "task_data.video_url must be a non-empty string";
  }

  if (data.video_duration_seconds) {
    if (data.min_watch_seconds >= data.video_duration_seconds) {
      return "task_data.min_watch_seconds must be less than video_duration_seconds";
    }

    const minRequired = Math.ceil(data.video_duration_seconds * 0.6);
    if (data.min_watch_seconds < minRequired) {
      return `task_data.min_watch_seconds must be >= 60% of video_duration_seconds (${minRequired}s)`;
    }
  }

  if (!data.questions || data.questions.length === 0) {
    return "task_data.questions must be a non-empty array";
  }

  for (let i = 0; i < data.questions.length; i++) {
    const q = data.questions[i] as Record<string, unknown>;
    if (!q.id || !q.text || !q.type) {
      return `Question at index ${i} must have id, text, and type`;
    }

    const validTypes = [QUESTION_TYPE_OPEN_TEXT, QUESTION_TYPE_MULTIPLE_CHOICE, QUESTION_TYPE_RATING, QUESTION_TYPE_YES_NO];
    if (!validTypes.includes(q.type as string)) {
      return `Question at index ${i} has invalid type "${q.type}". Must be one of: ${validTypes.join(", ")}`;
    }

    if (q.type === QUESTION_TYPE_MULTIPLE_CHOICE) {
      if (!q.options || !Array.isArray(q.options) || (q.options as unknown[]).length === 0) {
        return `Multiple choice question at index ${i} must have a non-empty options array`;
      }
    }

    if (q.type === QUESTION_TYPE_OPEN_TEXT) {
      if (q.min_words === undefined || q.min_words === null) {
        return `Open text question at index ${i} should have min_words`;
      }
    }

    if (q.type === QUESTION_TYPE_RATING) {
      if (q.scale === undefined || q.scale === null) {
        return `Rating question at index ${i} should have scale`;
      }
    }
  }

  return null;
}

export async function POST(request: Request) {
  const { error: authError, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "admin"],
  });
  if (authError) return authError;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const parsed = importBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Body must contain { tasks: [...], publishAll?: boolean }" } },
      { status: 422 }
    );
  }

  const { tasks: rawTasks, publishAll } = parsed.data;
  const admin = createAdminSupabaseClient();
  const failed: { index: number; reason: string }[] = [];
  const validTasks: { data: Record<string, unknown>; index: number }[] = [];

  for (let i = 0; i < rawTasks.length; i++) {
    const raw = rawTasks[i];
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      failed.push({ index: i, reason: "Task must be a JSON object" });
      continue;
    }

    const taskObj = raw as Record<string, unknown>;

    const parseResult = importTaskSchema.safeParse(taskObj);
    if (!parseResult.success) {
      failed.push({ index: i, reason: parseResult.error.errors[0]?.message ?? "Validation failed" });
      continue;
    }

    const task = parseResult.data;

    if (task.category === "watch_respond") {
      const validationError = validateWatchRespondTaskData(task.task_data);
      if (validationError) {
        failed.push({ index: i, reason: validationError });
        continue;
      }
    }

    let status = publishAll ? "active" : "draft";
    if (publishAll && task.publish_at) {
      const publishDate = new Date(task.publish_at);
      status = publishDate <= new Date() ? "active" : "scheduled";
    } else if (!publishAll && task.publish_at) {
      const publishDate = new Date(task.publish_at);
      status = publishDate <= new Date() ? "active" : "scheduled";
    }

    validTasks.push({
      index: i,
      data: {
        title: task.title,
        category: task.category,
        description: task.description ?? null,
        instructions: task.instructions,
        payout_ksh: task.payout_ksh,
        total_slots: task.total_slots,
        slots_remaining: task.total_slots,
        difficulty: task.difficulty,
        status,
        publish_at: task.publish_at ?? null,
        expires_at: task.expires_at ?? null,
        created_by: userId,
        ai_grading_enabled: task.ai_grading_enabled,
        ai_rubric: task.ai_rubric ?? null,
        requires_screenshot: task.requires_screenshot,
        requires_url: task.requires_url,
        min_word_count: task.min_word_count,
        task_data: task.task_data,
      },
    });
  }

  const imported: Array<{ id: string }> = [];

  const BATCH_SIZE = 10;
  for (let batchStart = 0; batchStart < validTasks.length; batchStart += BATCH_SIZE) {
    const batch = validTasks.slice(batchStart, batchStart + BATCH_SIZE);
    const batchData = batch.map((t) => t.data);

    const { data, error: insertError } = await admin
      .from("tasks")
      .insert(batchData)
      .select("*");

    if (insertError) {
      for (const t of batch) {
        failed.push({ index: t.index, reason: `Batch insert error: ${insertError.message}` });
      }
    } else if (data) {
      imported.push(...data);
    }
  }

  await auditLog({
    adminId: userId,
    action: "task_bulk_import",
    entityType: "tasks",
    entityId: imported[0]?.id ?? "unknown",
    after: { imported: imported.length, failed: failed.length },
    reason: `Bulk imported ${imported.length} tasks, ${failed.length} failed`,
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({
    imported: imported.length,
    failed,
    tasks: imported,
  });
}
