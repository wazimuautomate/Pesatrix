import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { TaskSubmissionForm } from "@/components/tasks/task-submission-form";
import { getTrainingProgramSnapshotForUser } from "@/lib/training";

export const metadata = {
  title: "Task Detail",
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

export default async function TaskDetailPage({ params }: RouteContext) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = createAdminSupabaseClient();
  const [{ data: profile }, { data: task }, access] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    admin.from("tasks").select("*").eq("id", id).maybeSingle(),
    getTrainingProgramSnapshotForUser(user.id),
  ]);

  if (!access.canStartTasks) {
    if (access.gateReason === "onboarding") {
      redirect("/onboarding");
    }

    redirect("/tasks");
  }

  const publishAt = task?.publish_at ? new Date(task.publish_at as string).getTime() : null;
  const isVisible =
    task?.status === "active"
      ? publishAt === null || publishAt <= Date.now()
      : task?.status === "scheduled" && publishAt !== null && publishAt <= Date.now();

  if (!task || task.slots_remaining <= 0 || !isVisible) {
    redirect("/tasks");
  }

  const { data: existingSubmission } = await admin
    .from("task_submissions")
    .select("*")
    .eq("task_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <DashboardShell
      user={{ full_name: profile?.full_name ?? "Pesatrix User", phone: "" }}
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <TaskSubmissionForm
          task={task}
          existingSubmission={existingSubmission}
        />
      </div>
    </DashboardShell>
  );
}
