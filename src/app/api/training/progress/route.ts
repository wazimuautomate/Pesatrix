import { NextResponse } from "next/server";
import { z } from "zod";
import { internalErrorResponse, unauthorizedResponse, validationErrorResponse } from "@/lib/api";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  TrainingProgressError,
  completeTrainingDay,
  gradeTrainingQuestion,
  getTrainingProgramSnapshotForUser,
  submitTrainingStageTest,
} from "@/lib/training";
import { buildTrainingView } from "@/lib/training-view";
import { getTrainingCompletionRewardKsh } from "@/lib/platform-settings";

const requestSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("complete_day"),
    answers: z.record(z.string(), z.string()),
  }),
  z.object({
    action: z.literal("submit_stage_test"),
    answers: z.record(z.string(), z.string()),
  }),
  z.object({
    action: z.literal("grade_question"),
    questionSet: z.enum(["lesson", "stage_test"]),
    questionId: z.string(),
    selectedOptionId: z.string(),
  }),
]);

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

    const [snapshot, rewardAmount] = await Promise.all([
      getTrainingProgramSnapshotForUser(user.id),
      getTrainingCompletionRewardKsh(),
    ]);
    return NextResponse.json({ snapshot, view: buildTrainingView(snapshot, rewardAmount) });
  } catch (error) {
    console.error("[GET /api/training/progress]", error);

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to load training progress" } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedResponse();
    }

    const parsed = requestSchema.safeParse(await request.json());

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.errors[0].message);
    }

    if (parsed.data.action === "complete_day") {
      const { snapshot, result } = await completeTrainingDay(user.id, parsed.data.answers);
      const rewardAmount = await getTrainingCompletionRewardKsh();
      return NextResponse.json({ snapshot, view: buildTrainingView(snapshot, rewardAmount), result });
    }

    if (parsed.data.action === "grade_question") {
      const grade = await gradeTrainingQuestion(
        user.id,
        parsed.data.questionSet,
        parsed.data.questionId,
        parsed.data.selectedOptionId
      );

      return NextResponse.json({ grade });
    }

    const result = await submitTrainingStageTest(user.id, parsed.data.answers);
    const rewardAmount = await getTrainingCompletionRewardKsh();
    return NextResponse.json({
      ...result,
      view: buildTrainingView(result.snapshot, rewardAmount),
    });
  } catch (error) {
    if (error instanceof TrainingProgressError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message } },
        { status: error.statusCode }
      );
    }

    console.error("[POST /api/training/progress] error:", error);
    return internalErrorResponse("Failed to update training progress");
  }
}
