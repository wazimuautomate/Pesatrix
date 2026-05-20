import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireAdmin, auditLog } from "../../../_lib";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { error, adminUser, userId: adminAuthId, requestMeta } = await requireAdmin({
    allowedRoles: ["admin"],
  });
  if (error) return error;

  const { userId } = await params;
  const admin = createAdminSupabaseClient();

  const { data: training } = await (admin.from("training_progress" as never) as any)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!training) {
    return NextResponse.json({ error: "Training progress not found" }, { status: 404 });
  }

  if (training.status !== "in_progress") {
    return NextResponse.json({ error: "User is not currently in progress" }, { status: 409 });
  }

  const now = new Date();
  const unlockAt = training.next_day_unlock_at ? new Date(training.next_day_unlock_at) : null;
  if (!unlockAt || unlockAt <= now) {
    return NextResponse.json({ error: "User is not currently time-locked" }, { status: 409 });
  }

  const beforeJson = {
    next_day_unlock_at: training.next_day_unlock_at,
    current_day: training.current_day,
    status: training.status,
  };

  const { error: updateError } = await (admin.from("training_progress" as never) as any)
    .update({ next_day_unlock_at: null })
    .eq("user_id", userId);

  if (updateError) {
    return NextResponse.json({ error: "Failed to unlock day" }, { status: 500 });
  }

  await auditLog({
    adminId: adminAuthId!,
    action: "training_day_unlocked",
    entityType: "training_progress",
    entityId: userId,
    before: beforeJson,
    after: { next_day_unlock_at: null },
    reason: "Admin manual unlock",
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ ok: true });
}
