import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getTrainingProgramSnapshotForUser } from "@/lib/training";
import { buildTrainingView } from "@/lib/training-view";
import { TrainingClient } from "./training-client";

export const metadata = {
  title: "Training",
};

export default async function DashboardTrainingPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profileRow }, snapshot] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle(),
    getTrainingProgramSnapshotForUser(user!.id),
  ]);

  return (
    <TrainingClient
      initialSnapshot={snapshot}
      initialView={buildTrainingView(snapshot)}
      fullName={profileRow?.full_name ?? user?.email ?? "Pesatrix User"}
    />
  );
}
