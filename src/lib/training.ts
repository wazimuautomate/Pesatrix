import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  getActivationFeeKsh,
  getReferralTaskUnlockReduction,
  getTaskUnlockDelayHours,
  getTrainingCompletionRewardKsh,
  getTrainingDayUnlockMinutes,
} from "@/lib/platform-settings";
import {
  type TrainingProgramStatus,
  type TrainingStageId,
  getStageForDay,
  getTrainingDay,
  getTrainingStage,
  TRAINING_DAYS,
} from "@/lib/training-program";

type AccountStatusRow = {
  state?: string | null;
  status?: string | null;
  is_activated?: boolean | null;
  is_setup_complete?: boolean | null;
  setup_completed_at?: string | null;
};

export type TrainingProgressRow = {
  user_id: string;
  status: TrainingProgramStatus;
  current_day: number;
  current_stage: TrainingStageId;
  stage_attempt: number;
  completed_days: number[];
  failed_stage_attempts: Record<string, number>;
  next_day_unlock_at: string | null;
  last_completed_at: string | null;
  completed_at: string | null;
  reward_transaction_id: string | null;
  task_unlock_at: string | null;
  task_unlock_accelerated: boolean;
};

export type TrainingProgramSnapshot = {
  onboardingComplete: boolean;
  activated: boolean;
  trainingCompleted: boolean;
  canStartTasks: boolean;
  gateReason: "onboarding" | "activation" | "training" | "tasks_locked" | null;
  gateMessage: string | null;
  training: TrainingProgressRow;
  taskUnlockAt: string | null;
  tasksLocked: boolean;
};

type TrainingProgressDbRow = Partial<TrainingProgressRow> & {
  completed_days?: unknown;
  failed_stage_attempts?: unknown;
  task_unlock_at?: string | null;
  task_unlock_accelerated?: boolean;
};

type StageTestResult = {
  stageId: TrainingStageId;
  passed: boolean;
  score: number;
  totalQuestions: number;
  passMark: number;
};

type DayPracticeResult = {
  day: number;
  passed: boolean;
  score: number;
  totalQuestions: number;
  passMark: number;
};

type QuestionGradeResult = {
  questionId: string;
  selectedOptionId: string;
  correctOptionId: string;
  isCorrect: boolean;
  explanation: string;
};

type PostgrestLikeError = {
  code?: string;
  message?: string;
  hint?: string | null;
};

export class TrainingProgressError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function isActivated(status: AccountStatusRow | null) {
  if (!status) return false;

  return Boolean(
    status.is_activated ||
      status.state === "activated" ||
      status.status === "activated" ||
      status.status === "active"
  );
}

function isOnboardingComplete(status: AccountStatusRow | null) {
  if (!status) return false;

  return status.is_setup_complete === true;
}

function normalizeCompletedDays(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isInteger(entry) && entry >= 1 && entry <= 7)
    .sort((left, right) => left - right);
}

function normalizeFailedStageAttempts(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, raw]) => {
      const count = Number(raw);
      return Number.isFinite(count) && count > 0 ? [[key, Math.floor(count)]] : [];
    })
  ) as Record<string, number>;
}

function uniqueSortedDays(days: number[]) {
  return Array.from(new Set(days)).sort((left, right) => left - right);
}

function dropStageDays(days: number[], stageId: TrainingStageId) {
  const stage = getTrainingStage(stageId);
  return days.filter((day) => !stage.days.includes(day));
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function formatReductionPercentage(reduction: number) {
  const percentage = Math.max(0, Math.min(100, reduction * 100));
  return Number.isInteger(percentage) ? String(percentage) : percentage.toFixed(2).replace(/\.?0+$/, "");
}

function validDate(value: string | null | undefined) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function evaluateTrainingDay(day: number, answers: Record<string, string>): DayPracticeResult {
  const trainingDay = getTrainingDay(day);
  const score = trainingDay.practice.questions.filter(
    (question) => answers[question.id] === question.correctOptionId
  ).length;

  return {
    day,
    passed: score >= trainingDay.practice.passMark,
    score,
    totalQuestions: trainingDay.practice.questions.length,
    passMark: trainingDay.practice.passMark,
  };
}

export async function gradeTrainingQuestion(
  userId: string,
  questionSet: "lesson" | "stage_test",
  questionId: string,
  selectedOptionId: string
): Promise<QuestionGradeResult> {
  const { accountStatus, trainingProgress } = await loadTrainingContext(userId);

  if (!isActivated(accountStatus)) {
    throw new TrainingProgressError(
      403,
      "ACTIVATION_REQUIRED",
      "Activate your account first to continue training."
    );
  }

  if (trainingProgress.completed_at || trainingProgress.status === "completed") {
    throw new TrainingProgressError(
      409,
      "TRAINING_ALREADY_COMPLETED",
      "Training has already been completed."
    );
  }

  const questions =
    questionSet === "stage_test"
      ? trainingProgress.status === "awaiting_test"
        ? getTrainingStage(trainingProgress.current_stage).test.questions
        : []
      : getTrainingDay(trainingProgress.current_day).practice.questions;

  const question = questions.find((entry) => entry.id === questionId);

  if (!question) {
    throw new TrainingProgressError(
      404,
      "QUESTION_NOT_AVAILABLE",
      "This training question is not available for the current step."
    );
  }

  if (!question.options.some((option) => option.id === selectedOptionId)) {
    throw new TrainingProgressError(
      422,
      "INVALID_OPTION",
      "Choose one of the available answers for this question."
    );
  }

  return {
    questionId,
    selectedOptionId,
    correctOptionId: question.correctOptionId,
    isCorrect: selectedOptionId === question.correctOptionId,
    explanation: question.explanation,
  };
}

export function normalizeTrainingProgress(
  userId: string,
  row: TrainingProgressDbRow | null | undefined
): TrainingProgressRow {
  return {
    user_id: userId,
    status:
      row?.status && ["not_started", "in_progress", "awaiting_test", "completed"].includes(row.status)
        ? (row.status as TrainingProgramStatus)
        : "not_started",
    current_day: Number(row?.current_day ?? 1) >= 1 ? Number(row?.current_day ?? 1) : 1,
    current_stage: (Number(row?.current_stage ?? 1) as TrainingStageId) || 1,
    stage_attempt: Math.max(1, Number(row?.stage_attempt ?? 1)),
    completed_days: normalizeCompletedDays(row?.completed_days),
    failed_stage_attempts: normalizeFailedStageAttempts(row?.failed_stage_attempts),
    next_day_unlock_at: row?.next_day_unlock_at ?? null,
    last_completed_at: row?.last_completed_at ?? null,
    completed_at: row?.completed_at ?? null,
    reward_transaction_id: row?.reward_transaction_id ?? null,
    task_unlock_at: row?.task_unlock_at ?? null,
    task_unlock_accelerated: row?.task_unlock_accelerated ?? false,
  };
}

function buildGateMessage(activated: boolean, trainingCompleted: boolean, activationFeeKsh: number) {
  if (!activated && !trainingCompleted) {
    return "Activate your account and complete the 7-day training before you can start live tasks.";
  }

  if (!activated) {
    return `Activate your account with the KSh ${activationFeeKsh.toLocaleString("en-KE")} fee before you can start live tasks.`;
  }

  if (!trainingCompleted) {
    return "Finish the full 7-day training and pass every stage test before you can start live tasks.";
  }

  return null;
}

function buildTasksLockedGateMessage(unlockAt: string, accelerated: boolean, reduction: number): string {
  const unlockDate = new Date(unlockAt);
  const timeStr = unlockDate.toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
  });

  if (accelerated) {
    return `Your personalized tasks are being prepared and will be ready at ${timeStr}. Your referral reward has already shortened the wait.`;
  }

  return `Your personalized tasks are being prepared and will be ready at ${timeStr}. Refer a friend who activates to shorten the remaining wait by ${formatReductionPercentage(reduction)}%.`;
}

function isMissingTrainingProgressRelation(error: PostgrestLikeError | null | undefined) {
  if (!error) {
    return false;
  }

  return (
    error.code === "PGRST205" &&
    `${error.message ?? ""} ${error.hint ?? ""}`.toLowerCase().includes("training_progress")
  );
}

async function loadTrainingContext(userId: string) {
  const admin = createAdminSupabaseClient();

  const [{ data: statusRow, error: statusError }, { data: trainingRow, error: trainingError }, { data: activationPayment }] =
    await Promise.all([
      admin
        .from("account_status")
        .select("state, status, is_activated, is_setup_complete, setup_completed_at")
        .eq("user_id", userId)
        .maybeSingle(),
      admin.from("training_progress").select("*").eq("user_id", userId).maybeSingle(),
      (admin.from("activation_payments" as never) as any)
        .select("id, status")
        .eq("user_id", userId)
        .eq("status", "paid")
        .maybeSingle(),
    ]);

  if (statusError) {
    throw statusError;
  }

  if (trainingError) {
    if (isMissingTrainingProgressRelation(trainingError)) {
      return {
        accountStatus: (statusRow ?? null) as AccountStatusRow | null,
        trainingProgress: normalizeTrainingProgress(userId, null),
        hasPaidActivation: Boolean(activationPayment?.status === "paid"),
      };
    }

    throw trainingError;
  }

  return {
    accountStatus: (statusRow ?? null) as AccountStatusRow | null,
    trainingProgress: normalizeTrainingProgress(userId, trainingRow as TrainingProgressDbRow | null),
    hasPaidActivation: Boolean(activationPayment?.status === "paid"),
  };
}

async function findExistingTrainingRewardTransaction(userId: string) {
  const admin = createAdminSupabaseClient();

  const { data, error } = await (admin.from("wallet_transactions" as never) as any)
    .select("id")
    .eq("user_id", userId)
    .eq("type", "task_earning")
    .eq("direction", "credit")
    .eq("reference_table", "training_progress")
    .eq("reference_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.id ? String(data.id) : null;
}

export async function getTrainingProgramSnapshotForUser(
  userId: string
): Promise<TrainingProgramSnapshot> {
  const { accountStatus, trainingProgress, hasPaidActivation } = await loadTrainingContext(userId);
  const onboardingComplete = isOnboardingComplete(accountStatus);
  const activated = isActivated(accountStatus) || hasPaidActivation;
  const trainingCompleted = Boolean(trainingProgress.completed_at || trainingProgress.status === "completed");
  const [activationFeeKsh, configuredTaskUnlockDelayHours, referralTaskUnlockReduction] = await Promise.all([
    getActivationFeeKsh(),
    getTaskUnlockDelayHours(),
    getReferralTaskUnlockReduction(),
  ]);
  const completedAt = validDate(trainingProgress.completed_at);
  const configuredTaskUnlockAt = trainingCompleted && completedAt
    ? addHours(completedAt, configuredTaskUnlockDelayHours)
    : null;
  const storedTaskUnlockAt = validDate(trainingProgress.task_unlock_at);
  const effectiveTaskUnlockAt =
    trainingProgress.task_unlock_accelerated && storedTaskUnlockAt && configuredTaskUnlockAt
      ? storedTaskUnlockAt.getTime() < configuredTaskUnlockAt.getTime()
        ? storedTaskUnlockAt
        : configuredTaskUnlockAt
      : configuredTaskUnlockAt ?? storedTaskUnlockAt;
  const effectiveTaskUnlockAtIso = effectiveTaskUnlockAt?.toISOString() ?? null;

  const now = new Date();
  const isTaskUnlockInFuture = Boolean(effectiveTaskUnlockAt && effectiveTaskUnlockAt > now);
  const tasksLocked = trainingCompleted && isTaskUnlockInFuture;

  let gateReason: TrainingProgramSnapshot["gateReason"] = null;
  let gateMessage: string | null = null;

  if (!onboardingComplete) {
    gateReason = "onboarding";
    gateMessage = buildGateMessage(activated, trainingCompleted, activationFeeKsh);
  } else if (!activated) {
    gateReason = "activation";
    gateMessage = buildGateMessage(activated, trainingCompleted, activationFeeKsh);
  } else if (!trainingCompleted) {
    gateReason = "training";
    gateMessage = buildGateMessage(activated, trainingCompleted, activationFeeKsh);
  } else if (tasksLocked) {
    gateReason = "tasks_locked";
    gateMessage = buildTasksLockedGateMessage(
      effectiveTaskUnlockAtIso!,
      trainingProgress.task_unlock_accelerated,
      referralTaskUnlockReduction
    );
  }

  return {
    onboardingComplete,
    activated,
    trainingCompleted,
    canStartTasks: onboardingComplete && activated && trainingCompleted && !tasksLocked,
    gateReason,
    gateMessage,
    training: trainingCompleted
      ? { ...trainingProgress, status: "completed", task_unlock_at: effectiveTaskUnlockAtIso }
      : trainingProgress,
    taskUnlockAt: effectiveTaskUnlockAtIso,
    tasksLocked,
  };
}

export async function accelerateTaskUnlockForReferral(userId: string): Promise<boolean> {
  const admin = createAdminSupabaseClient();
  const snapshot = await getTrainingProgramSnapshotForUser(userId);

  if (!snapshot.trainingCompleted || !snapshot.tasksLocked || !snapshot.taskUnlockAt) {
    return false;
  }

  if (snapshot.training.task_unlock_accelerated) {
    return false;
  }

  const reduction = await getReferralTaskUnlockReduction();
  if (reduction <= 0) {
    return false;
  }

  const now = new Date();
  const currentUnlockAt = validDate(snapshot.taskUnlockAt);
  if (!currentUnlockAt || currentUnlockAt.getTime() <= now.getTime()) {
    return false;
  }

  const remainingMs = currentUnlockAt.getTime() - now.getTime();
  const reducedRemainingMs = Math.max(0, Math.ceil(remainingMs * (1 - reduction)));
  const newUnlockAt = new Date(now.getTime() + reducedRemainingMs).toISOString();

  const { error } = await admin
    .from("training_progress")
    .update({
      task_unlock_at: newUnlockAt,
      task_unlock_accelerated: true,
    })
    .eq("user_id", userId)
    .eq("status", "completed");

  if (error) {
    throw error;
  }

  return true;
}

export async function ensureTrainingReward(userId: string, createdByAdminId?: string | null) {
  const admin = createAdminSupabaseClient();

  const { data: training } = await (admin.from("training_progress" as never) as any)
    .select("reward_transaction_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (training?.reward_transaction_id) {
    return training.reward_transaction_id;
  }

  const existingRewardTransactionId = await findExistingTrainingRewardTransaction(userId);
  if (existingRewardTransactionId) {
    await (admin.from("training_progress" as never) as any)
      .update({ reward_transaction_id: existingRewardTransactionId })
      .eq("user_id", userId);

    return existingRewardTransactionId;
  }

  const rewardAmount = await getTrainingCompletionRewardKsh();
  const now = new Date();

  const { data: rewardRow, error: rewardError } = await (admin.from("wallet_transactions" as never) as any)
    .insert({
      user_id: userId,
      type: "task_earning",
      direction: "credit",
      amount: rewardAmount,
      status: "available",
      bucket: "available",
      description: "Training completion reward",
      reference_table: "training_progress",
      reference_id: userId,
      available_at: now.toISOString(),
      created_by_admin_id: createdByAdminId ?? null,
    })
    .select("id")
    .single();

  if (rewardError) {
    throw rewardError;
  }

  await (admin.from("training_progress" as never) as any)
    .update({ reward_transaction_id: rewardRow.id })
    .eq("user_id", userId);

  return rewardRow.id as string;
}

export async function completeTrainingDay(userId: string, answers: Record<string, string> = {}) {
  const admin = createAdminSupabaseClient();
  const { accountStatus, trainingProgress } = await loadTrainingContext(userId);

  if (!isActivated(accountStatus)) {
    throw new TrainingProgressError(
      403,
      "ACTIVATION_REQUIRED",
      "Activate your account first to begin the 7-day training program."
    );
  }

  if (trainingProgress.completed_at || trainingProgress.status === "completed") {
    throw new TrainingProgressError(
      409,
      "TRAINING_ALREADY_COMPLETED",
      "Training has already been completed and cannot be repeated."
    );
  }

  const now = new Date();
  const unlockMinutes = await getTrainingDayUnlockMinutes();
  const unlockAt = trainingProgress.next_day_unlock_at
    ? new Date(trainingProgress.next_day_unlock_at)
    : null;

  if (unlockAt && unlockAt.getTime() > now.getTime()) {
    throw new TrainingProgressError(
      409,
      "DAY_LOCKED",
      "The next training day has not unlocked yet. Return when the timer reaches zero."
    );
  }

  const currentDay = trainingProgress.current_day;
  const practiceResult = evaluateTrainingDay(currentDay, answers);

  if (!practiceResult.passed) {
    throw new TrainingProgressError(
      422,
      "DAY_PRACTICE_FAILED",
      `Score ${practiceResult.score}/${practiceResult.totalQuestions}. Review the lesson and try again.`
    );
  }

  const completedDays = uniqueSortedDays([...trainingProgress.completed_days, currentDay]);
  const isFinalDay = currentDay >= TRAINING_DAYS.length;
  const rewardTransactionId = isFinalDay
    ? await ensureTrainingReward(userId)
    : trainingProgress.reward_transaction_id;

  let taskUnlockAt: string | null = null;
  if (isFinalDay) {
    const unlockDelayHours = await getTaskUnlockDelayHours();
    if (unlockDelayHours <= 0) {
      taskUnlockAt = now.toISOString();
    } else {
      const unlockAtDate = new Date(now.getTime() + unlockDelayHours * 60 * 60 * 1000);
      taskUnlockAt = unlockAtDate.toISOString();
    }
  }

  const payload = {
    user_id: userId,
    status: isFinalDay ? "completed" : "in_progress",
    current_day: isFinalDay ? TRAINING_DAYS.length : currentDay + 1,
    current_stage: getStageForDay(isFinalDay ? TRAINING_DAYS.length : currentDay + 1).id,
    stage_attempt: trainingProgress.stage_attempt,
    completed_days: completedDays,
    failed_stage_attempts: trainingProgress.failed_stage_attempts,
    last_completed_at: now.toISOString(),
    next_day_unlock_at: isFinalDay ? null : addMinutes(now, unlockMinutes).toISOString(),
    completed_at: isFinalDay ? now.toISOString() : null,
    reward_transaction_id: rewardTransactionId,
    task_unlock_at: isFinalDay ? taskUnlockAt : null,
    task_unlock_accelerated: false,
  };

  const { error } = await admin.from("training_progress").upsert(payload, {
    onConflict: "user_id",
  });

  if (error) {
    throw error;
  }

  return {
    snapshot: await getTrainingProgramSnapshotForUser(userId),
    result: practiceResult,
  };
}

export async function submitTrainingStageTest(
  userId: string,
  answers: Record<string, string>
): Promise<{ snapshot: TrainingProgramSnapshot; result: StageTestResult }> {
  const admin = createAdminSupabaseClient();
  const { accountStatus, trainingProgress } = await loadTrainingContext(userId);

  if (!isActivated(accountStatus)) {
    throw new TrainingProgressError(
      403,
      "ACTIVATION_REQUIRED",
      "Activate your account first to continue training."
    );
  }

  if (trainingProgress.completed_at || trainingProgress.status === "completed") {
    throw new TrainingProgressError(
      409,
      "TRAINING_ALREADY_COMPLETED",
      "Training has already been completed and cannot be repeated."
    );
  }

  if (trainingProgress.status !== "awaiting_test") {
    throw new TrainingProgressError(
      409,
      "TEST_NOT_READY",
      "Complete the required stage lessons before attempting the test."
    );
  }

  const stage = getTrainingStage(trainingProgress.current_stage);
  const score = stage.test.questions.filter(
    (question) => answers[question.id] === question.correctOptionId
  ).length;
  const passed = score >= stage.test.passMark;
  const now = new Date();
  const unlockMinutes = await getTrainingDayUnlockMinutes();

  if (passed) {
    if (stage.id === 3) {
      const rewardTransactionId = await ensureTrainingReward(userId);

      let taskUnlockAt: string;
      const unlockDelayHours = await getTaskUnlockDelayHours();
      if (unlockDelayHours <= 0) {
        taskUnlockAt = now.toISOString();
      } else {
        const unlockAtDate = new Date(now.getTime() + unlockDelayHours * 60 * 60 * 1000);
        taskUnlockAt = unlockAtDate.toISOString();
      }

      const { error } = await admin.from("training_progress").upsert(
        {
          user_id: userId,
          status: "completed",
          current_day: 7,
          current_stage: 3,
          stage_attempt: trainingProgress.stage_attempt,
          completed_days: uniqueSortedDays(trainingProgress.completed_days),
          failed_stage_attempts: trainingProgress.failed_stage_attempts,
          next_day_unlock_at: null,
          last_completed_at: now.toISOString(),
          completed_at: now.toISOString(),
          reward_transaction_id: rewardTransactionId,
          task_unlock_at: taskUnlockAt,
          task_unlock_accelerated: false,
        },
        { onConflict: "user_id" }
      );

      if (error) {
        throw error;
      }
    } else {
      const nextDay = stage.days[stage.days.length - 1] + 1;
      const { error } = await admin.from("training_progress").upsert(
        {
          user_id: userId,
          status: "in_progress",
          current_day: nextDay,
          current_stage: getStageForDay(nextDay).id,
          stage_attempt: 1,
          completed_days: uniqueSortedDays(trainingProgress.completed_days),
          failed_stage_attempts: trainingProgress.failed_stage_attempts,
          next_day_unlock_at: addMinutes(now, unlockMinutes).toISOString(),
          last_completed_at: now.toISOString(),
          completed_at: null,
          reward_transaction_id: trainingProgress.reward_transaction_id,
        },
        { onConflict: "user_id" }
      );

      if (error) {
        throw error;
      }
    }
  } else {
    const failKey = String(stage.id);
    const nextFailedAttempts = {
      ...trainingProgress.failed_stage_attempts,
      [failKey]: (trainingProgress.failed_stage_attempts[failKey] ?? 0) + 1,
    };

    const { error } = await admin.from("training_progress").upsert(
      {
        user_id: userId,
        status: "in_progress",
        current_day: stage.days[0],
        current_stage: stage.id,
        stage_attempt: trainingProgress.stage_attempt + 1,
        completed_days: dropStageDays(trainingProgress.completed_days, stage.id),
        failed_stage_attempts: nextFailedAttempts,
        next_day_unlock_at: addMinutes(now, unlockMinutes).toISOString(),
        last_completed_at: null,
        completed_at: null,
        reward_transaction_id: trainingProgress.reward_transaction_id,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      throw error;
    }
  }

  return {
    snapshot: await getTrainingProgramSnapshotForUser(userId),
    result: {
      stageId: stage.id,
      passed,
      score,
      totalQuestions: stage.test.questions.length,
      passMark: stage.test.passMark,
    },
  };
}
