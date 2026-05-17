import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getTrainingProgramSnapshotForUser } from "@/lib/training";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    const snapshot = await getTrainingProgramSnapshotForUser(user.id);

    return NextResponse.json({
      trainingCompleted: snapshot.trainingCompleted,
      taskUnlockAt: snapshot.taskUnlockAt,
      isUnlocked: !snapshot.tasksLocked,
      accelerated: snapshot.training.task_unlock_accelerated ?? false,
    });
  } catch (error) {
    console.error("[GET /api/training/unlock-status]", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to load unlock status" } },
      { status: 500 }
    );
  }
}