import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { TaskSubmissionForm } from "@/components/tasks/task-submission-form";

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

  const [{ data: profile }, { data: task }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("tasks").select("*").eq("id", id).maybeSingle(),
  ]);

  if (!task) {
    redirect("/tasks");
  }

  const { data: existingSubmission } = await supabase
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
