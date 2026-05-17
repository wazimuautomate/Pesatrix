type JsonRecord = Record<string, unknown>;

export const ONBOARDING_VERSION = "2026-04-29";
export const TRAINING_REWARD_AMOUNT = 50;
export const ACTIVATION_REQUIRED_MESSAGE =
  "Activate your account and finish the 7-day training before starting provider tasks.";

export type TrainingStageId = "beginner" | "intermediate" | "advanced";

export type TrainingLesson = {
  id: string;
  title: string;
  focus: string;
  durationMinutes: number;
  summary: string;
  skills: string[];
};

export type TrainingStageBlueprint = {
  id: TrainingStageId;
  title: string;
  startDay: number;
  endDay: number;
  description: string;
  passingScore: number;
  lessons: TrainingLesson[];
  assessment: {
    title: string;
    questions: Array<{
      id: string;
      prompt: string;
      options: string[];
      answer: number;
    }>;
  };
};

export type TrainingProgress = {
  startedAt: string | null;
  stage: TrainingStageId;
  currentDay: number;
  completedLessonIds: string[];
  stageFailures: Record<TrainingStageId, number>;
  stagePassedAt: Partial<Record<TrainingStageId, string>>;
  stageUnlockedAt: Partial<Record<TrainingStageId, string>>;
  lastAssessmentScore: number | null;
  completedAt: string | null;
  certificateId: string | null;
  rewardedTransactionId: string | null;
};

export type OnboardingProgress = {
  completed: boolean;
  completedAt: string | null;
  version: string | null;
};

export type RewardEngineState = {
  dailyStreak: number;
  streakLastDate: string | null;
  lastOutcomeAt: string | null;
  consecutiveSmallWins: number;
};

export type AccountMetadata = {
  onboarding?: Partial<OnboardingProgress>;
  training?: Partial<TrainingProgress>;
  rewards?: Partial<RewardEngineState>;
};

export const TRAINING_PROGRAM: TrainingStageBlueprint[] = [
  {
    id: "beginner",
    title: "Beginner Foundation",
    startDay: 1,
    endDay: 2,
    description:
      "Learn the quality rules, survey etiquette, and basic fraud-prevention habits required before touching live work.",
    passingScore: 2,
    lessons: [
      {
        id: "beginner-survey-basics",
        title: "Survey Basics",
        focus: "Surveys",
        durationMinutes: 18,
        summary:
          "Covers honest responses, disqualification handling, and how rushed answers trigger provider bans.",
        skills: ["Read eligibility carefully", "Avoid duplicate devices", "Exit cleanly on disqualification"],
      },
      {
        id: "beginner-ad-safety",
        title: "Ad and Offer Safety",
        focus: "Ads",
        durationMinutes: 14,
        summary:
          "Explains valid ad engagement, IP hygiene, and why repeated fake clicks destroy account trust.",
        skills: ["Respect cooldowns", "Use one account", "Never spoof location"],
      },
    ],
    assessment: {
      title: "Beginner Quality Check",
      questions: [
        {
          id: "beginner-q1",
          prompt: "What should you do if a survey disqualifies you after screening?",
          options: [
            "Retry with different answers immediately",
            "Exit honestly and move to another task",
            "Refresh the page until it accepts you",
          ],
          answer: 1,
        },
        {
          id: "beginner-q2",
          prompt: "Which action is safest for ad-based tasks?",
          options: [
            "One account, real engagement, normal timing",
            "Multiple accounts on the same device",
            "VPN hopping to unlock more offers",
          ],
          answer: 0,
        },
      ],
    },
  },
  {
    id: "intermediate",
    title: "Intermediate Accuracy",
    startDay: 3,
    endDay: 4,
    description:
      "Focuses on transcription consistency, moderation judgment, and keeping provider-quality scores stable.",
    passingScore: 2,
    lessons: [
      {
        id: "intermediate-transcription",
        title: "Transcription Precision",
        focus: "Transcription",
        durationMinutes: 22,
        summary:
          "Covers timestamps, speaker tags, punctuation discipline, and how low-confidence text should be handled.",
        skills: ["Mark unclear audio", "Keep timestamps consistent", "Avoid invented words"],
      },
      {
        id: "intermediate-games-ads",
        title: "Games and Engagement Tracking",
        focus: "Games",
        durationMinutes: 16,
        summary:
          "Explains genuine install events, retention milestones, and why fake device farms are detected.",
        skills: ["Use a real device", "Complete required milestones", "Track installs honestly"],
      },
    ],
    assessment: {
      title: "Intermediate Accuracy Check",
      questions: [
        {
          id: "intermediate-q1",
          prompt: "How should unclear audio be handled in transcription tasks?",
          options: [
            "Guess the missing words so the text looks complete",
            "Mark the unclear section according to task rules",
            "Delete the entire line without explanation",
          ],
          answer: 1,
        },
        {
          id: "intermediate-q2",
          prompt: "What keeps game-offer providers satisfied?",
          options: [
            "Using emulators to speed up installs",
            "Meeting milestones with real user behavior",
            "Repeated reinstalls from the same device",
          ],
          answer: 1,
        },
      ],
    },
  },
  {
    id: "advanced",
    title: "Advanced Provider Discipline",
    startDay: 5,
    endDay: 7,
    description:
      "The final stage trains judgment across mixed task types and enforces the quality mindset required for high approval rates.",
    passingScore: 3,
    lessons: [
      {
        id: "advanced-quality-escalation",
        title: "Provider Quality Escalation",
        focus: "Surveys and moderation",
        durationMinutes: 24,
        summary:
          "Shows how repeated low-quality work gets escalated and why consistent truthfulness protects the whole platform.",
        skills: ["Watch rejection patterns", "Stop on suspicious tasks", "Escalate provider issues early"],
      },
      {
        id: "advanced-multi-surface",
        title: "Cross-Task Decision Making",
        focus: "All supported work",
        durationMinutes: 20,
        summary:
          "Combines surveys, ads, games, and transcription into one discipline model for long-term approval health.",
        skills: ["Pick suitable tasks", "Manage fatigue", "Preserve task quality under pressure"],
      },
      {
        id: "advanced-certification",
        title: "Certification Readiness",
        focus: "Certification",
        durationMinutes: 18,
        summary:
          "Prepares the learner for final certification with stronger pass criteria and no same-day shortcut.",
        skills: ["Review all stages", "Respect provider SLAs", "Protect your account reputation"],
      },
    ],
    assessment: {
      title: "Advanced Certification Exam",
      questions: [
        {
          id: "advanced-q1",
          prompt: "What is the best response to a sudden wave of task rejections?",
          options: [
            "Increase speed to recover the lost earnings",
            "Pause, inspect the rejection pattern, then continue carefully",
            "Open multiple new accounts to keep earning",
          ],
          answer: 1,
        },
        {
          id: "advanced-q2",
          prompt: "Why is enforced slow training useful for Pesatrix?",
          options: [
            "It reduces provider quality issues and lowers ban risk",
            "It keeps users away from the dashboard",
            "It removes the need for quality checks later",
          ],
          answer: 0,
        },
        {
          id: "advanced-q3",
          prompt: "When should a worker abandon a suspicious task flow?",
          options: [
            "Only after the provider permanently bans the account",
            "As soon as the task requires dishonest or unsafe behavior",
            "Never, because payouts matter more than compliance",
          ],
          answer: 1,
        },
      ],
    },
  },
];

const DEFAULT_TRAINING_STAGE: Record<number, TrainingStageId> = {
  1: "beginner",
  2: "beginner",
  3: "intermediate",
  4: "intermediate",
  5: "advanced",
  6: "advanced",
  7: "advanced",
};

export function safeJsonRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

export function parseAccountMetadata(value: unknown): AccountMetadata {
  return safeJsonRecord(value) as AccountMetadata;
}

export function getDefaultOnboardingProgress(): OnboardingProgress {
  return {
    completed: false,
    completedAt: null,
    version: null,
  };
}

export function getDefaultRewardEngineState(): RewardEngineState {
  return {
    dailyStreak: 0,
    streakLastDate: null,
    lastOutcomeAt: null,
    consecutiveSmallWins: 0,
  };
}

export function getDefaultTrainingProgress(): TrainingProgress {
  return {
    startedAt: null,
    stage: "beginner",
    currentDay: 1,
    completedLessonIds: [],
    stageFailures: {
      beginner: 0,
      intermediate: 0,
      advanced: 0,
    },
    stagePassedAt: {},
    stageUnlockedAt: {},
    lastAssessmentScore: null,
    completedAt: null,
    certificateId: null,
    rewardedTransactionId: null,
  };
}

export function getCurrentTrainingDay(startedAt: string | null, now = new Date()) {
  if (!startedAt) {
    return 1;
  }

  const started = new Date(startedAt);
  const elapsed = Math.floor((now.getTime() - started.getTime()) / 86400000) + 1;
  return Math.max(1, Math.min(7, elapsed));
}

export function getStageForDay(day: number): TrainingStageId {
  return DEFAULT_TRAINING_STAGE[Math.max(1, Math.min(7, day))] ?? "advanced";
}

export function getTrainingStage(stageId: TrainingStageId) {
  return TRAINING_PROGRAM.find((stage) => stage.id === stageId) ?? TRAINING_PROGRAM[0];
}

export function getAccountProgressSnapshot(metadataValue: unknown, now = new Date()) {
  const metadata = parseAccountMetadata(metadataValue);
  const onboarding = {
    ...getDefaultOnboardingProgress(),
    ...safeJsonRecord(metadata.onboarding),
  } as OnboardingProgress;
  const rewards = {
    ...getDefaultRewardEngineState(),
    ...safeJsonRecord(metadata.rewards),
  } as RewardEngineState;
  const training = {
    ...getDefaultTrainingProgress(),
    ...safeJsonRecord(metadata.training),
  } as TrainingProgress;

  training.currentDay = getCurrentTrainingDay(training.startedAt, now);

  if (training.completedAt) {
    training.stage = "advanced";
    training.currentDay = 7;
  } else {
    training.stage = getStageForDay(training.currentDay);
  }

  return {
    onboarding,
    training,
    rewards,
    metadata,
  };
}

export function isTrainingComplete(metadataValue: unknown) {
  return Boolean(getAccountProgressSnapshot(metadataValue).training.completedAt);
}

export function canAccessProviderTasks(args: {
  activated: boolean;
  metadataValue: unknown;
}) {
  return args.activated && isTrainingComplete(args.metadataValue);
}

export function buildTrainingCertificateId(userId: string, completedAt: string) {
  const suffix = userId.replace(/-/g, "").slice(0, 8).toUpperCase();
  const date = completedAt.slice(0, 10).replace(/-/g, "");
  return `PXA-${date}-${suffix}`;
}

export function buildOnboardingMetadataPatch() {
  return {
    onboarding: {
      completed: true,
      completedAt: new Date().toISOString(),
      version: ONBOARDING_VERSION,
    },
  };
}

export function mergeAccountMetadata(
  currentValue: unknown,
  patch: Partial<AccountMetadata>
) {
  const current = parseAccountMetadata(currentValue);
  const next: AccountMetadata = {
    ...current,
  };

  if (patch.onboarding) {
    next.onboarding = {
      ...safeJsonRecord(current.onboarding),
      ...patch.onboarding,
    };
  }

  if (patch.training) {
    next.training = {
      ...safeJsonRecord(current.training),
      ...patch.training,
    };
  }

  if (patch.rewards) {
    next.rewards = {
      ...safeJsonRecord(current.rewards),
      ...patch.rewards,
    };
  }

  return next;
}

export function resolveAccountFlags(accountStatus: {
  state?: string | null;
  status?: string | null;
  is_activated?: boolean | null;
  is_setup_complete?: boolean | null;
} | null) {
  const state = accountStatus?.state ?? accountStatus?.status ?? "registered";
  const setupComplete =
    accountStatus?.is_setup_complete === true ||
    state === "setup_complete" ||
    state === "activated" ||
    state === "active";
  const activated =
    accountStatus?.is_activated === true ||
    state === "activated" ||
    state === "active";

  return {
    state,
    setupComplete,
    activated,
  };
}
