import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function assignStarterTasks(userId: string): Promise<void> {
  const admin = createAdminSupabaseClient();

  // 1. Fetch all tasks where is_starter = true, ordered by starter_day ASC
  const { data: starterTasks, error: tasksError } = await admin
    .from("tasks")
    .select("id, starter_day")
    .eq("is_starter", true)
    .order("starter_day", { ascending: true });

  if (tasksError) {
    console.error("[starterAssignment] Failed to fetch starter tasks", tasksError);
    throw tasksError;
  }

  if (!starterTasks || starterTasks.length === 0) {
    console.log("[starterAssignment] No starter tasks found in pool. Skipping assignment.");
    return;
  }

  // 5. If user already has assignments (idempotency check), skip
  const { data: existingAssignments, error: checkError } = await admin
    .from("task_assignments")
    .select("id")
    .eq("user_id", userId)
    .limit(1);

  if (checkError) {
    console.error("[starterAssignment] Failed to check existing assignments", checkError);
    throw checkError;
  }

  if (existingAssignments && existingAssignments.length > 0) {
    console.log(`[starterAssignment] User ${userId} already has task assignments. Skipping.`);
    return;
  }

  // 2. For each task, calculate unlocks_at:
  //    unlocks_at = now() + (starter_day - 1) days
  //    So day 1 tasks unlock immediately, day 2 unlock in 24h, etc.
  const now = new Date();
  
  const assignmentsToInsert = starterTasks.map((task) => {
    const starterDay = task.starter_day ? Number(task.starter_day) : 1;
    const unlockTime = new Date(now.getTime() + (starterDay - 1) * 24 * 60 * 60 * 1000);
    const status = starterDay === 1 ? "available" : "locked";

    return {
      user_id: userId,
      task_id: task.id,
      unlocks_at: unlockTime.toISOString(),
      status: status,
      assigned_at: now.toISOString(),
      created_at: now.toISOString(),
    };
  });

  // 3. Insert into task_assignments for this user
  const { error: insertError } = await admin
    .from("task_assignments")
    .insert(assignmentsToInsert);

  if (insertError) {
    console.error("[starterAssignment] Failed to insert task assignments", insertError);
    throw insertError;
  }

  console.log(`[starterAssignment] Assigned ${starterTasks.length} starter tasks to user ${userId}`);
}
