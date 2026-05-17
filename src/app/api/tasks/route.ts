import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getTrainingProgramSnapshotForUser } from "@/lib/training";

export async function GET() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await getTrainingProgramSnapshotForUser(user.id);

  if (!access.activated) {
    return NextResponse.json({
      tasks: [],
      submittedTaskIds: [],
      total: 0,
      isActivated: false,
      trainingStatus: access.training.status,
      taskUnlockAt: access.taskUnlockAt,
      tasksLocked: true,
    });
  }

  if (!access.trainingCompleted || access.tasksLocked) {
    return NextResponse.json({
      tasks: [],
      submittedTaskIds: [],
      total: 0,
      isActivated: true,
      trainingStatus: access.training.status,
      taskUnlockAt: access.taskUnlockAt,
      tasksLocked: !access.trainingCompleted || access.tasksLocked,
    });
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("tasks")
    .select("id, title, category, description, instructions, payout_ksh, slots_remaining, difficulty, status, publish_at, expires_at, task_data, requires_screenshot, requires_url, min_word_count")
    .in("status", ["active", "scheduled"])
    .gt("slots_remaining", 0)
    .or("expires_at.is.null,expires_at.gt.now()")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }

  const { data: submissions } = await admin
    .from("task_submissions")
    .select("task_id")
    .eq("user_id", user.id);

  const submittedTaskIds = (submissions ?? []).map((s: { task_id: string }) => s.task_id);
  const now = Date.now();
  const visibleTasks = (data ?? []).filter((task: Record<string, unknown>) => {
    if (task.status === "active") {
      return !task.publish_at || new Date(task.publish_at as string).getTime() <= now;
    }

    return task.status === "scheduled" && Boolean(task.publish_at) && new Date(task.publish_at as string).getTime() <= now;
  });

  const formattedTasks = visibleTasks.map((task: Record<string, unknown>) => ({
    id: task.id as string,
    title: task.title as string,
    category: task.category as string,
    description: task.description as string | null,
    instructions: task.instructions as string,
    payoutKsh: task.payout_ksh as number,
    slotsRemaining: task.slots_remaining as number,
    difficulty: task.difficulty as string,
    expiresAt: task.expires_at as string | null,
    taskData: task.task_data as Record<string, unknown>,
    requiresScreenshot: task.requires_screenshot as boolean,
    requiresUrl: task.requires_url as boolean,
    minWordCount: task.min_word_count as number,
  }));

  return NextResponse.json({
    tasks: formattedTasks,
    submittedTaskIds,
    total: formattedTasks.length,
    isActivated: true,
    trainingStatus: access.training.status,
    taskUnlockAt: access.taskUnlockAt,
    tasksLocked: false,
  });
}
