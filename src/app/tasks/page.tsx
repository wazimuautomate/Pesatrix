import { redirect } from "next/navigation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getTrainingProgramSnapshotForUser } from "@/lib/training";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { TaskListClient } from "@/components/tasks/task-list-client";
import { PageTransition } from "@/components/ui/PageTransition";

export const metadata = {
  title: "Available Tasks",
};

export default async function TasksPage() {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, snapshot, adminRole] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    getTrainingProgramSnapshotForUser(user.id),
    (admin.from("admin_users" as never) as any).select("user_id").eq("user_id", user.id).maybeSingle(),
  ]);

  if (!snapshot.canStartTasks && snapshot.gateReason === "onboarding") {
    redirect("/dashboard/onboarding");
  }

  return (
    <DashboardShell
      user={{ full_name: profile?.full_name ?? "Pesatrix User", phone: "" }}
    >
      <PageTransition className="mx-auto w-full max-w-5xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-navy">Available Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Complete tasks to earn KSh. Each task can only be done once.
          </p>
        </div>
        <TaskListClient isAdmin={Boolean(adminRole?.user_id)} />
      </PageTransition>
    </DashboardShell>
  );
}
