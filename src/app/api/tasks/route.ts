import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [{ data: accountStatus }, { data: trainingProgress, error: trainingError }] = await Promise.all([
    (supabase.from("account_status" as never) as any)
      .select("is_activated")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("training_progress")
      .select("status, task_unlock_at")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const isActivated = Boolean((accountStatus as { is_activated?: boolean } | null)?.is_activated);

  if (!isActivated) {
    return NextResponse.json({
      tasks: [],
      submittedTaskIds: [],
      total: 0,
      isActivated: false,
      trainingStatus: trainingProgress?.status ?? null,
      taskUnlockAt: trainingProgress?.task_unlock_at ?? null,
    });
  }

  if (trainingError) {
    return NextResponse.json({ error: "Failed to check training status" }, { status: 500 });
  }

  const trainingComplete = trainingProgress?.status === "completed";
  const taskUnlockAt = trainingProgress?.task_unlock_at ?? null;
  const tasksLocked = Boolean(taskUnlockAt && new Date(taskUnlockAt) > new Date());

  if (!trainingComplete || tasksLocked) {
    return NextResponse.json({
      tasks: [],
      submittedTaskIds: [],
      total: 0,
      isActivated: true,
      trainingStatus: trainingProgress?.status ?? null,
      taskUnlockAt,
      tasksLocked,
    });
  }

  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, category, description, instructions, payout_ksh, slots_remaining, difficulty, expires_at, task_data, requires_screenshot, requires_url, min_word_count")
    .eq("status", "active")
    .gt("slots_remaining", 0)
    .or("publish_at.is.null,publish_at.lte.now()")
    .or("expires_at.is.null,expires_at.gt.now()")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }

  const { data: submissions } = await supabase
    .from("task_submissions")
    .select("task_id")
    .eq("user_id", user.id);

  const submittedTaskIds = (submissions ?? []).map((s: { task_id: string }) => s.task_id);

  const formattedTasks = (data ?? []).map((task: Record<string, unknown>) => ({
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
    trainingStatus: trainingProgress?.status ?? null,
    taskUnlockAt,
    tasksLocked: false,
  });
}
