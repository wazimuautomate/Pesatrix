import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { TaskDetailsPreview, TaskSubmissionForm } from "@/components/tasks/task-submission-form";
import { getTrainingProgramSnapshotForUser } from "@/lib/training";
import { sanitizeTaskForClient } from "@/lib/task-data";
import { canUserAccessTask, getTaskAccessContext, isTaskLive } from "@/lib/task-distribution";

export const metadata = {
  title: "Task Detail",
};

type RouteContext = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ view?: string }>;
};

export default async function TaskDetailPage({ params, searchParams }: RouteContext) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const previewOnly = resolvedSearchParams?.view === "details";
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const admin = createAdminSupabaseClient();
  const [{ data: profile }, { data: task }, access, taskAccess] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    admin.from("tasks").select("*").eq("id", id).maybeSingle(),
    getTrainingProgramSnapshotForUser(user.id),
    getTaskAccessContext(admin, user.id),
  ]);

  if (!access.canStartTasks) {
    if (access.gateReason === "onboarding") {
      redirect("/dashboard/onboarding");
    }

    redirect("/tasks");
  }

  if (!task || !isTaskLive(task) || !canUserAccessTask(task, taskAccess)) {
    redirect("/tasks");
  }

  const { data: existingSubmissions } = await admin
    .from("task_submissions")
    .select("*")
    .eq("task_id", id)
    .eq("user_id", user.id)
    .order("submitted_at", { ascending: false })
    .limit(3);

  const submissions = existingSubmissions ?? [];
  const latestSubmission = submissions[0] ?? null;
  const declineCount = submissions.filter((submission: Record<string, unknown>) => submission.status === "declined").length;
  const latestSubmittedAt = latestSubmission?.submitted_at
    ? new Date(latestSubmission.submitted_at as string).getTime()
    : 0;
  const socialRetryOpen =
    task?.category === "social_engagement" &&
    latestSubmission?.status === "declined" &&
    declineCount < 2 &&
    latestSubmittedAt > Date.now() - 24 * 60 * 60 * 1000 &&
    Number(task?.slots_remaining ?? 0) > 0;

  return (
    <DashboardShell
      user={{ full_name: profile?.full_name ?? "Pesatrix User", phone: "" }}
    >
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        {previewOnly ? (
          <TaskDetailsPreview task={sanitizeTaskForClient(task)} />
        ) : (
          <TaskSubmissionForm
            task={sanitizeTaskForClient(task)}
            existingSubmission={socialRetryOpen ? null : latestSubmission}
          />
        )}
      </div>
    </DashboardShell>
  );
}
