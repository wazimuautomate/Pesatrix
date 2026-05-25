import { NextResponse } from "next/server";
import { z } from "zod";

import { auditLog, requireAdmin } from "@/app/api/admin/_lib";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const timerOverrideSchema = z.object({
  task_unlock_at: z.string().datetime().nullable().optional(),
  next_day_unlock_at: z.string().datetime().nullable().optional(),
  reason: z.string().trim().min(10, "Reason must be at least 10 characters"),
});

export async function PATCH(request: Request, { params }: RouteContext) {
  const { error, adminUser, userId: adminAuthId, requestMeta } = await requireAdmin({ request });
  if (error) return error;
  if (!adminAuthId || !adminUser || !["admin", "super_admin"].includes(adminUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = timerOverrideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid timer override" } },
      { status: 422 }
    );
  }

  const hasTaskUnlock = Object.prototype.hasOwnProperty.call(body, "task_unlock_at");
  const hasNextDayUnlock = Object.prototype.hasOwnProperty.call(body, "next_day_unlock_at");
  if (!hasTaskUnlock && !hasNextDayUnlock) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Provide task_unlock_at or next_day_unlock_at" } },
      { status: 422 }
    );
  }

  const { id } = await params;
  const admin = createAdminSupabaseClient();
  const { data: before, error: fetchError } = await (admin.from("training_progress" as never) as any)
    .select("*")
    .eq("user_id", id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: "Failed to load training progress" }, { status: 500 });
  }

  if (!before) {
    return NextResponse.json({ error: "Training progress not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = {};
  if (hasTaskUnlock) update.task_unlock_at = parsed.data.task_unlock_at ?? null;
  if (hasNextDayUnlock) update.next_day_unlock_at = parsed.data.next_day_unlock_at ?? null;
  if (hasTaskUnlock) update.task_unlock_accelerated = true;

  const { data: training, error: updateError } = await (admin.from("training_progress" as never) as any)
    .update(update)
    .eq("user_id", id)
    .select("*")
    .single();

  if (updateError || !training) {
    return NextResponse.json({ error: "Failed to update training timers" }, { status: 500 });
  }

  await auditLog({
    adminId: adminAuthId,
    action: "training_timer_override",
    entityType: "training_progress",
    entityId: id,
    before: {
      task_unlock_at: before.task_unlock_at ?? null,
      next_day_unlock_at: before.next_day_unlock_at ?? null,
    },
    after: {
      task_unlock_at: training.task_unlock_at ?? null,
      next_day_unlock_at: training.next_day_unlock_at ?? null,
    },
    reason: parsed.data.reason,
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ training_progress: training });
}
