import { createHash, randomBytes, randomInt } from "node:crypto";

export const FREE_DAILY_SPIN_LIMIT = 2;
export const PAID_SPIN_COST = 40;
export const FREE_AD_UNLOCK_SECONDS = 12;

export type RewardSpinType = "free" | "paid";
export type RewardOutcomeKey = "miss" | "small" | "medium" | "double" | "jackpot";

export type RewardSpinHistory = {
  spin_type: RewardSpinType;
  payout_amount: number;
  created_at: string;
};

export type RewardSegment = {
  key: RewardOutcomeKey;
  label: string;
  payoutAmount: number;
  multiplier: number;
  accent: string;
  detail: string;
};

export type SelectedRewardOutcome = RewardSegment & {
  segmentIndex: number;
  spinType: RewardSpinType;
  spinCost: number;
  netAmount: number;
  nearMiss: boolean;
  entropyDigest: string;
};

const FREE_SEGMENTS: RewardSegment[] = [
  {
    key: "small",
    label: "KSh 8",
    payoutAmount: 8,
    multiplier: 0,
    accent: "from-sky-500 to-blue-600",
    detail: "Quick starter win",
  },
  {
    key: "small",
    label: "KSh 12",
    payoutAmount: 12,
    multiplier: 0,
    accent: "from-cyan-500 to-sky-600",
    detail: "Ad-funded pocket reward",
  },
  {
    key: "medium",
    label: "KSh 18",
    payoutAmount: 18,
    multiplier: 0,
    accent: "from-emerald-500 to-teal-600",
    detail: "Good daily bump",
  },
  {
    key: "medium",
    label: "KSh 25",
    payoutAmount: 25,
    multiplier: 0,
    accent: "from-amber-400 to-orange-500",
    detail: "Steady wallet boost",
  },
  {
    key: "double",
    label: "KSh 35",
    payoutAmount: 35,
    multiplier: 0,
    accent: "from-fuchsia-500 to-violet-600",
    detail: "Rare free-spin hit",
  },
  {
    key: "jackpot",
    label: "KSh 60",
    payoutAmount: 60,
    multiplier: 0,
    accent: "from-yellow-400 to-amber-500",
    detail: "Top free prize",
  },
  {
    key: "small",
    label: "KSh 10",
    payoutAmount: 10,
    multiplier: 0,
    accent: "from-indigo-500 to-blue-700",
    detail: "Reliable micro-win",
  },
  {
    key: "miss",
    label: "Try Again",
    payoutAmount: 0,
    multiplier: 0,
    accent: "from-slate-500 to-slate-700",
    detail: "No credit this time",
  },
];

const PAID_SEGMENTS: RewardSegment[] = [
  {
    key: "miss",
    label: "x0",
    payoutAmount: 0,
    multiplier: 0,
    accent: "from-slate-500 to-slate-700",
    detail: "Spin cost is consumed",
  },
  {
    key: "small",
    label: "x0.5",
    payoutAmount: 20,
    multiplier: 0.5,
    accent: "from-sky-500 to-blue-600",
    detail: "Partial recovery",
  },
  {
    key: "medium",
    label: "x1",
    payoutAmount: 40,
    multiplier: 1,
    accent: "from-emerald-500 to-teal-600",
    detail: "Break-even hit",
  },
  {
    key: "double",
    label: "x2",
    payoutAmount: 80,
    multiplier: 2,
    accent: "from-fuchsia-500 to-violet-600",
    detail: "Strong paid spin win",
  },
  {
    key: "jackpot",
    label: "x4",
    payoutAmount: 160,
    multiplier: 4,
    accent: "from-yellow-400 to-amber-500",
    detail: "Very rare premium win",
  },
  {
    key: "medium",
    label: "x1",
    payoutAmount: 40,
    multiplier: 1,
    accent: "from-emerald-500 to-teal-600",
    detail: "Break-even hit",
  },
  {
    key: "small",
    label: "x0.5",
    payoutAmount: 20,
    multiplier: 0.5,
    accent: "from-cyan-500 to-sky-600",
    detail: "Soft landing",
  },
  {
    key: "miss",
    label: "x0",
    payoutAmount: 0,
    multiplier: 0,
    accent: "from-slate-500 to-slate-700",
    detail: "No payout",
  },
];

type WeightedPick = {
  index: number;
  weight: number;
};

function utcDateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
}

function countPositiveStreak(spins: RewardSpinHistory[]) {
  let streak = 0;

  for (const spin of spins) {
    if (spin.payout_amount > 0) {
      streak += 1;
      continue;
    }

    break;
  }

  return streak;
}

export function computeDailySpinStreak(spins: Pick<RewardSpinHistory, "created_at">[]) {
  if (spins.length === 0) return 0;

  const uniqueDays = Array.from(
    new Set(
      spins
        .map((spin) => utcDateKey(spin.created_at))
        .sort()
        .reverse()
    )
  );

  let streak = 0;
  const cursor = new Date();

  while (true) {
    const key = utcDateKey(cursor);
    if (!uniqueDays.includes(key)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}

function weightedIndex(picks: WeightedPick[]) {
  const total = picks.reduce((sum, pick) => sum + Math.max(0, pick.weight), 0);
  const threshold = randomInt(0, Math.max(total, 1));
  let running = 0;

  for (const pick of picks) {
    running += Math.max(0, pick.weight);
    if (threshold < running) {
      return pick.index;
    }
  }

  return picks[picks.length - 1]?.index ?? 0;
}

function createEntropyDigest() {
  const bytes = randomBytes(32);
  return createHash("sha256").update(bytes).digest("hex");
}

function buildWeights(spinType: RewardSpinType, positiveStreak: number): WeightedPick[] {
  if (spinType === "free") {
    const base = [24, 20, 16, 12, 8, 4, 12, 4];
    if (positiveStreak >= 2) {
      return base.map((weight, index) => ({
        index,
        weight: index === 7 ? weight + 12 : index === 5 ? weight - 2 : weight,
      }));
    }
    return base.map((weight, index) => ({ index, weight }));
  }

  const base = [30, 20, 27, 18, 5, 18, 15, 22];
  if (positiveStreak >= 2) {
    return base.map((weight, index) => ({
      index,
      weight:
        index === 0 || index === 7
          ? weight + 10
          : index === 4
            ? Math.max(1, weight - 3)
            : index === 3
              ? Math.max(6, weight - 4)
              : weight,
    }));
  }
  return base.map((weight, index) => ({ index, weight }));
}

export function getRewardSegments(spinType: RewardSpinType) {
  return spinType === "free" ? FREE_SEGMENTS : PAID_SEGMENTS;
}

export function selectRewardOutcome(args: {
  spinType: RewardSpinType;
  recentSpins: RewardSpinHistory[];
}) {
  const { spinType, recentSpins } = args;
  const positiveStreak = countPositiveStreak(recentSpins);
  const segments = getRewardSegments(spinType);
  const winnerIndex = weightedIndex(buildWeights(spinType, positiveStreak));
  const nearMiss =
    spinType === "paid" &&
    segments[winnerIndex]?.key !== "jackpot" &&
    randomInt(0, 100) < 34;
  const winner = segments[winnerIndex] ?? segments[0];
  const spinCost = spinType === "paid" ? PAID_SPIN_COST : 0;

  return {
    ...winner,
    segmentIndex: winnerIndex,
    spinType,
    spinCost,
    netAmount: winner.payoutAmount - spinCost,
    nearMiss,
    entropyDigest: createEntropyDigest(),
  } satisfies SelectedRewardOutcome;
}
