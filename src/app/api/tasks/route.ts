import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: trainingProgress, error: trainingError } = await supabase
    .from("training_progress")
    .select("status, task_unlock_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (trainingError) {
    return NextResponse.json({ error: "Failed to check training status" }, { status: 500 });
  }

  if (!trainingProgress || trainingProgress.status !== "completed") {
    return NextResponse.json(
      {
        error: {
          code: "TRAINING_INCOMPLETE",
          message: "Complete the 7-day training to access tasks.",
        },
      },
      { status: 403 }
    );
  }

  if (trainingProgress.task_unlock_at) {
    const unlockDate = new Date(trainingProgress.task_unlock_at);
    const now = new Date();
    if (unlockDate > now) {
      return NextResponse.json(
        {
          error: {
            code: "TASKS_LOCKED",
            message: "Tasks unlock soon.",
            unlockAt: trainingProgress.task_unlock_at,
          },
        },
        { status: 403 }
      );
    }
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const difficulty = searchParams.get("difficulty");
  const sort = searchParams.get("sort") || "newest";
  const search = searchParams.get("search");

  let query = supabase
    .from("tasks")
    .select(
      "id, title, category, instructions, payout_ksh, slots_remaining, difficulty, status, expires_at, requires_screenshot, requires_url, min_word_count, created_at"
    )
    .eq("status", "active")
    .gt("slots_remaining", 0)
    .or("expires_at.is.null,expires_at.gt.now()");

  if (category) {
    const categories = category.split(",");
    query = query.in("category", categories);
  }

  if (difficulty) {
    const difficulties = difficulty.split(",");
    query = query.in("difficulty", difficulties);
  }

  if (search) {
    query = query.ilike("title", `%${search}%`);
  }

  switch (sort) {
    case "payout_high":
      query = query.order("payout_ksh", { ascending: false });
      break;
    case "expiry_soon":
      query = query.order("expires_at", { ascending: true, nullsFirst: false });
      break;
    case "newest":
    default:
      query = query.order("created_at", { ascending: false });
      break;
  }

  const { data: tasks, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }

  const { data: submissions } = await supabase
    .from("task_submissions")
    .select("task_id")
    .eq("user_id", user.id);

  const submittedTaskIds = (submissions ?? []).map((s: { task_id: string }) => s.task_id);

  const formattedTasks = (tasks ?? []).map((task: Record<string, unknown>) => ({
    id: task.id as string,
    title: task.title as string,
    category: task.category as string,
    instructions: task.instructions as string,
    payoutKsh: task.payout_ksh as number,
    slotsRemaining: task.slots_remaining as number,
    difficulty: task.difficulty as string,
    status: task.status as string,
    expiresAt: task.expires_at as string | null,
    requiresScreenshot: task.requires_screenshot as boolean,
    requiresUrl: task.requires_url as boolean,
    minWordCount: task.min_word_count as number,
    createdAt: task.created_at as string,
  }));

  return NextResponse.json({
    tasks: formattedTasks,
    submittedTaskIds,
    total: formattedTasks.length,
  });
}
