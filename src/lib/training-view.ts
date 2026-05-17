import type { TrainingProgramSnapshot } from "@/lib/training";
import {
  TRAINING_DAYS,
  TRAINING_REWARD_AMOUNT,
  TRAINING_STAGES,
  type TrainingStageId,
} from "@/lib/training-program";

export type TrainingSafeQuestion = {
  id: string;
  prompt: string;
  options: { id: string; label: string }[];
};

export type TrainingSafeTest = {
  title: string;
  passMark: number;
  totalQuestions: number;
  questions: TrainingSafeQuestion[];
};

export type TrainingStepView = {
  day: number;
  focus: string;
  title: string;
  summary: string;
  state: "completed" | "current" | "locked";
};

export type TrainingViewData = {
  rewardAmount: number;
  totalDays: number;
  completedDays: number;
  progressValue: number;
  currentStage: {
    id: TrainingStageId;
    name: string;
    level: string;
    attempt: number;
  };
  currentLesson: {
    day: number;
    focus: string;
    title: string;
    summary: string;
    sections: {
      title: string;
      body: string[];
      bullets: string[];
    }[];
    practice: TrainingSafeTest;
    checkpoint: string;
  } | null;
  activeTest: TrainingSafeTest | null;
  steps: TrainingStepView[];
};

export function buildTrainingView(snapshot: TrainingProgramSnapshot): TrainingViewData {
  const completedDays = snapshot.training.completed_days.length;
  const stage = TRAINING_STAGES.find((item) => item.id === snapshot.training.current_stage) ?? TRAINING_STAGES[0];
  const currentDay = TRAINING_DAYS.find((day) => day.day === snapshot.training.current_day) ?? TRAINING_DAYS[0];
  const awaitingTest = false;
  const trainingCompleted = snapshot.trainingCompleted;

  return {
    rewardAmount: TRAINING_REWARD_AMOUNT,
    totalDays: TRAINING_DAYS.length,
    completedDays,
    progressValue: (completedDays / TRAINING_DAYS.length) * 100,
    currentStage: {
      id: stage.id,
      name: stage.name,
      level: stage.level,
      attempt: snapshot.training.stage_attempt,
    },
    currentLesson:
      awaitingTest || trainingCompleted
        ? null
        : {
            day: currentDay.day,
            focus: currentDay.focus,
            title: currentDay.title,
            summary: currentDay.summary,
            sections: currentDay.sections,
            practice: {
              title: currentDay.practice.title,
              passMark: currentDay.practice.passMark,
              totalQuestions: currentDay.practice.questions.length,
              questions: currentDay.practice.questions.map((question) => ({
                id: question.id,
                prompt: question.prompt,
                options: question.options,
              })),
            },
            checkpoint: currentDay.checkpoint,
          },
    activeTest: awaitingTest
      ? {
          title: stage.test.title,
          passMark: stage.test.passMark,
          totalQuestions: stage.test.questions.length,
              questions: stage.test.questions.map((question) => ({
                id: question.id,
                prompt: question.prompt,
                options: question.options,
              })),
        }
      : null,
    steps: TRAINING_DAYS.map((day) => {
      const completed = snapshot.training.completed_days.includes(day.day);
      return {
        day: day.day,
        focus: day.focus,
        title: day.title,
        summary: day.summary,
        state: completed
          ? "completed"
          : day.day === snapshot.training.current_day && !trainingCompleted
            ? "current"
            : "locked",
      };
    }),
  };
}
