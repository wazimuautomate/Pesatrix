import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog, requireAdmin } from "../../_lib";
import { validateTaskFinancials } from "@/lib/financial-limits";
import { getMaxTaskBatchValueKsh, getMaxTaskPayoutKsh } from "@/lib/platform-settings";

const VALID_CATEGORIES = [
  "survey",
  "data_labeling",
  "social_engagement",
  "verification",
  "content_creation",
  "watch_respond",
] as const;

type ValidationError = {
  row: number;
  title: string;
  errors: string[];
};

const importTasksSchema = z.object({
  tasks: z.array(z.unknown()).min(1, "tasks must be a non-empty array"),
});

function parseTaskData(raw: unknown): { data: Record<string, unknown>; errors: string[] } {
  const errors: string[] = [];
  if (raw === null || raw === undefined) {
    errors.push("task_data is required");
    return { data: {}, errors };
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        errors.push("task_data must be a valid JSON object");
        return { data: {}, errors };
      }
      return { data: parsed as Record<string, unknown>, errors };
    } catch {
      errors.push("task_data must be a valid JSON object");
      return { data: {}, errors };
    }
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    errors.push("task_data must be a valid JSON object");
    return { data: {}, errors };
  }
  return { data: raw as Record<string, unknown>, errors };
}

function validateTaskRow(raw: unknown, rowIndex: number): { valid: true; data: Record<string, unknown> } | { valid: false; error: ValidationError } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { valid: false, error: { row: rowIndex + 1, title: "(no title)", errors: ["Row must be a JSON object"] } };
  }

  const obj = raw as Record<string, unknown>;
  const errors: string[] = [];

  const title = typeof obj.title === "string" ? obj.title.trim() : "";
  if (!title) errors.push("title is missing or empty");

  const category = typeof obj.category === "string" ? obj.category.trim() : "";
  if (!category) errors.push("category is missing or empty");
  else if (!VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
    errors.push(`category "${category}" is not valid`);
  }

  const instructions = typeof obj.instructions === "string" ? obj.instructions.trim() : "";
  if (!instructions) errors.push("instructions is missing or empty");

  const payoutRaw = obj.payout_ksh;
  const payout = typeof payoutRaw === "number" ? payoutRaw : Number(payoutRaw);
  if (isNaN(payout) || payout <= 0) errors.push("payout_ksh must be a number greater than 0");

  const slotsRaw = obj.total_slots;
  const slots = typeof slotsRaw === "number" ? slotsRaw : Number(slotsRaw);
  if (isNaN(slots) || !Number.isInteger(slots) || slots <= 0) errors.push("total_slots must be an integer greater than 0");

  const { data: taskData, errors: tdErrors } = parseTaskData(obj.task_data);
  errors.push(...tdErrors);

  let publishAt: string | null = null;
  if (obj.publish_at !== undefined && obj.publish_at !== null && obj.publish_at !== "") {
    const d = new Date(String(obj.publish_at));
    if (isNaN(d.getTime())) {
      errors.push("publish_at is not a valid date");
    } else {
      publishAt = d.toISOString();
    }
  }

  let expiresAt: string | null = null;
  if (obj.expires_at !== undefined && obj.expires_at !== null && obj.expires_at !== "") {
    const d = new Date(String(obj.expires_at));
    if (isNaN(d.getTime())) {
      errors.push("expires_at is not a valid date");
    } else {
      expiresAt = d.toISOString();
    }
  }

  if (errors.length > 0) {
    return { valid: false, error: { row: rowIndex + 1, title: title || "(no title)", errors } };
  }

  return {
    valid: true,
    data: {
      title,
      category,
      description: typeof obj.description === "string" ? obj.description.trim() || null : null,
      instructions,
      payout_ksh: payout,
      total_slots: slots,
      difficulty: (["easy", "medium", "hard"] as const).includes(obj.difficulty as "easy" | "medium" | "hard")
        ? (obj.difficulty as "easy" | "medium" | "hard")
        : "easy",
      publish_at: publishAt,
      expires_at: expiresAt,
      ai_grading_enabled: typeof obj.ai_grading_enabled === "boolean" ? obj.ai_grading_enabled : true,
      ai_rubric: typeof obj.ai_rubric === "string" ? obj.ai_rubric.trim() || null : null,
      requires_screenshot: Boolean(obj.requires_screenshot),
      requires_url: Boolean(obj.requires_url),
      min_word_count: typeof obj.min_word_count === "number" ? obj.min_word_count : 0,
      task_data: taskData,
    },
  };
}

export async function POST(request: Request) {
  const { error: authError, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });
  if (authError) return authError;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsedBody = importTasksSchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsedBody.error.errors[0]?.message ?? "Invalid import payload" } },
      { status: 422 }
    );
  }
  const rawTasks = parsedBody.data.tasks;

  const admin = createAdminSupabaseClient();
  const failed: ValidationError[] = [];
  const validRows: { data: Record<string, unknown>; originalIndex: number }[] = [];
  const [maxTaskPayoutKsh, maxTaskBatchValueKsh] = await Promise.all([
    getMaxTaskPayoutKsh(),
    getMaxTaskBatchValueKsh(),
  ]);

  for (let i = 0; i < rawTasks.length; i++) {
    const result = validateTaskRow(rawTasks[i], i);
    if (result.valid) {
      const financialError = validateTaskFinancials({
        payoutKsh: Number(result.data.payout_ksh ?? 0),
        totalSlots: Number(result.data.total_slots ?? 0),
        maxTaskPayoutKsh,
        maxTaskBatchValueKsh,
      });
      if (financialError) {
        failed.push({
          row: i + 1,
          title: String(result.data.title ?? "(no title)"),
          errors: [financialError.message],
        });
        continue;
      }

      validRows.push({ data: result.data, originalIndex: i });
    } else {
      failed.push(result.error);
    }
  }

  if (validRows.length > 0) {
    const titles = validRows.map((r) => r.data.title);
    const { data: existing } = await admin
      .from("tasks")
      .select("title, category")
      .in("title", titles);

    const existingSet = new Set(
      (existing ?? []).map((t: { title: string; category: string }) => `${t.title}|||${t.category}`)
    );

    const cleanRows: typeof validRows = [];
    for (const row of validRows) {
      const key = `${row.data.title}|||${row.data.category}`;
      if (existingSet.has(key)) {
        failed.push({
          row: row.originalIndex + 1,
          title: row.data.title as string,
          errors: ["Duplicate: a task with this title and category already exists"],
        });
      } else {
        cleanRows.push(row);
      }
    }

    const imported: Array<{ id: string }> = [];
    const BATCH_SIZE = 10;
    for (let batchStart = 0; batchStart < cleanRows.length; batchStart += BATCH_SIZE) {
      const batch = cleanRows.slice(batchStart, batchStart + BATCH_SIZE);
      const batchData = batch.map((r) => ({
        ...r.data,
        slots_remaining: r.data.total_slots,
        status: "draft",
        created_by: userId,
      }));

      const { data, error: insertError } = await admin
        .from("tasks")
        .insert(batchData)
        .select("*");

      if (insertError) {
        console.error("[POST /api/admin/tasks/import] insert error:", insertError);
        for (const r of batch) {
          failed.push({
            row: r.originalIndex + 1,
            title: r.data.title as string,
            errors: ["Insert error: failed to save task"],
          });
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

    return NextResponse.json({ saved: imported.length, failed });
  }

  return NextResponse.json({ saved: 0, failed });
}
