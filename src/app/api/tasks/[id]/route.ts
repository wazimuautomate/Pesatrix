import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getTrainingProgramSnapshotForUser } from "@/lib/training";
import { sanitizeTaskForClient } from "@/lib/task-data";
import { canUserAccessTask, getTaskAccessContext, isTaskLive } from "@/lib/task-distribution";

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

  if (!access.canStartTasks) {
    return NextResponse.json(
      { error: access.gateMessage ?? "Task access is locked" },
      { status: 403 }
    );
  }

  const admin = createAdminSupabaseClient();
  const [taskResult, taskAccess] = await Promise.all([
    admin
      .from("tasks")
      .select("*")
      .eq("id", id)
      .in("status", ["active", "scheduled"])
      .gt("slots_remaining", 0)
      .or("expires_at.is.null,expires_at.gt.now()")
      .maybeSingle(),
    getTaskAccessContext(admin, user.id),
  ]);

  const task = taskResult.data;
  if (taskResult.error || !task || !isTaskLive(task) || !canUserAccessTask(task, taskAccess)) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

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
    });
  }

  return NextResponse.json({ task: sanitizeTaskForClient(task) });
}
