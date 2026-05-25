import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getTrainingProgramSnapshotForUser } from "@/lib/training";
import { getActivationFeeKsh, getDailyTaskLimit } from "@/lib/platform-settings";
import { sanitizeTaskDataForClient } from "@/lib/task-data";
import { evaluateTaskAccess, getTaskAccessContext, isTaskLive } from "@/lib/task-distribution";
import { countActivatedReferrals, getHighTaskGateSettings } from "@/lib/wallet/withdrawalLimits";

export async function GET() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await getTrainingProgramSnapshotForUser(user.id);
  const admin = createAdminSupabaseClient();
  const [dailyLimit, activationFeeKsh, highTaskGate, activatedReferralCount] = await Promise.all([
    getDailyTaskLimit(),
    getActivationFeeKsh(),
    getHighTaskGateSettings(admin),
    countActivatedReferrals(user.id, admin),
  ]);
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { count: todaySubmissionCount } = await admin
    .from("task_submissions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("submitted_at", todayStart.toISOString());

  const [taskResult, submissionsResult, taskAccess] = await Promise.all([
    admin
      .from("tasks")
      .select("id, title, category, description, instructions, payout_ksh, slots_remaining, difficulty, status, publish_at, expires_at, task_data, requires_screenshot, requires_url, min_word_count, visibility_mode, min_referrals_required")
      .in("status", ["active", "scheduled"])
      .gt("slots_remaining", 0)
      .or("expires_at.is.null,expires_at.gt.now()")
      .order("created_at", { ascending: false }),
    admin
      .from("task_submissions")
      .select("task_id")
      .eq("user_id", user.id),
    getTaskAccessContext(admin, user.id),
  ]);

  if (taskResult.error) {
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }

  const submittedTaskIds = (submissionsResult.data ?? []).map((s: { task_id: string }) => s.task_id);
  const visibleTasks = (taskResult.data ?? []).filter((task: Record<string, unknown>) => isTaskLive(task));

  const formattedTasks = visibleTasks.map((task: Record<string, unknown>) => {
    const taskEligibility = evaluateTaskAccess(task as { id: string }, taskAccess);
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

    return {
      id: task.id as string,
      title: task.title as string,
      category: task.category as string,
      description: task.description as string | null,
      instructions: task.instructions as string,
      payoutKsh: task.payout_ksh as number,
      slotsRemaining: task.slots_remaining as number,
      difficulty: task.difficulty as string,
      expiresAt: task.expires_at as string | null,
      taskData: sanitizeTaskDataForClient(task.task_data) as Record<string, unknown>,
      requiresScreenshot: task.requires_screenshot as boolean,
      requiresUrl: task.requires_url as boolean,
      minWordCount: task.min_word_count as number,
      canStartTask,
      blockedReason,
      blockedMessage,
      locked: communityLocked,
      lock_reason: communityLocked ? "community_size" : null,
    };
  });

  return NextResponse.json({
    tasks: formattedTasks,
    submittedTaskIds,
    dailySubmissionCount: todaySubmissionCount ?? 0,
    dailyTaskLimit: dailyLimit,
    total: formattedTasks.length,
    isActivated: access.activated,
    activationFeeKsh,
    trainingStatus: access.training.status,
    taskUnlockAt: access.taskUnlockAt,
    tasksLocked: access.tasksLocked,
    canStartTasks: access.canStartTasks,
    gateReason: access.gateReason,
    gateMessage: access.gateMessage,
  });
}
