import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getTrainingProgramSnapshotForUser } from "@/lib/training";
import { buildTrainingView } from "@/lib/training-view";
import { getTrainingCompletionRewardKsh } from "@/lib/platform-settings";
import { TrainingClient } from "./training-client";

export const metadata = {
  title: "Training",
};

export default async function DashboardTrainingPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [profileRow, snapshot, rewardAmount] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle(),
    getTrainingProgramSnapshotForUser(user!.id),
    getTrainingCompletionRewardKsh(),
  ]);

  return (
    <TrainingClient
      initialSnapshot={snapshot}
      initialView={buildTrainingView(snapshot, rewardAmount)}
      fullName={profileRow?.full_name ?? user?.email ?? "Pesatrix User"}
    />
  );
}
