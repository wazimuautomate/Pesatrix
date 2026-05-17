import { createServerSupabaseClient } from "@/lib/supabase/server";
import { TrainingLocked } from "./training-locked";

export default async function TrainingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return children;
  }

  let isCompleted = false;

  try {
    const { data: progressRow } = await supabase
      .from("training_progress")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle();

    isCompleted = progressRow?.status === "completed";
  } catch (error) {
    console.error("Failed to fetch training progress:", error);
  }

  if (isCompleted) {
    return <TrainingLocked />;
  }

  return children;
}