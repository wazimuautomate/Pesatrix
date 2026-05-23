import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getTrainingProgramSnapshotForUser } from "@/lib/training";
import { sanitizeTaskForClient } from "@/lib/task-data";
import { evaluateTaskAccess, getTaskAccessContext, isTaskLive } from "@/lib/task-distribution";
import { countActivatedReferrals, getHighTaskGateSettings } from "@/lib/wallet/withdrawalLimits";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await getTrainingProgramSnapshotForUser(user.id);

  const admin = createAdminSupabaseClient();
  const [taskResult, taskAccess, highTaskGate, activatedReferralCount] = await Promise.all([
    admin
      .from("tasks")
      .select("*")
      .eq("id", id)
      .in("status", ["active", "scheduled"])
      .gt("slots_remaining", 0)
      .or("expires_at.is.null,expires_at.gt.now()")
      .maybeSingle(),
    getTaskAccessContext(admin, user.id),
    getHighTaskGateSettings(admin),
    countActivatedReferrals(user.id, admin),
  ]);

  const task = taskResult.data;
  if (taskResult.error || !task || !isTaskLive(task)) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const taskEligibility = evaluateTaskAccess(task, taskAccess);
  const communityLocked =
    Number(task.payout_ksh ?? 0) >= highTaskGate.payoutThreshold &&
    activatedReferralCount < highTaskGate.referralRequirement;
  const canStartTask = access.canStartTasks && taskEligibility.canAccess && !communityLocked;
  const blockedReason = communityLocked
    ? "community_size"
    : access.canStartTasks
      ? taskEligibility.reason
      : access.gateReason;
  const blockedMessage = communityLocked
    ? "This task is filling up fast. Users with larger communities get priority access. Grow your community to unlock."
    : access.canStartTasks
      ? taskEligibility.message
      : access.gateMessage;

  const { data: existingSubmission } = await admin
    .from("task_submissions")
    .select("id, status")
    .eq("task_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingSubmission) {
    return NextResponse.json({
      task: sanitizeTaskForClient(task),
      existingSubmission,
      canStartTask,
      blockedReason,
      blockedMessage,
    });
  }

  return NextResponse.json({
    task: sanitizeTaskForClient(task),
    canStartTask,
    blockedReason,
    blockedMessage,
  });
}
