import { getAccountProgressSnapshot, resolveAccountFlags } from "@/lib/account-progress";
import type { TrainingProgramSnapshot } from "@/lib/training";

type WalletSummary = {
  pending: number;
  available: number;
  total: number;
};

type ProfileRow = {
  full_name: string | null;
  phone: string | null;
  email: string | null;
  county?: string | null;
  metadata?: unknown;
};

type AccountStatusRow = {
  is_setup_complete?: boolean | null;
  is_activated?: boolean | null;
  state?: string | null;
  status?: string | null;
};

type VerificationRow = {
  phone_verified?: boolean | null;
  email_verified?: boolean | null;
  kyc_status?: string | null;
};

type WalletTransactionRow = {
  amount: number;
  bucket: string | null;
  direction: string | null;
};

export function summarizeWallet(transactions: WalletTransactionRow[]): WalletSummary {
  const pending = transactions
    .filter((txn) => txn.bucket === "pending" && txn.direction === "credit")
    .reduce((sum, txn) => sum + txn.amount, 0);

  const availableRaw = transactions
    .filter((txn) => txn.bucket === "available")
    .reduce((sum, txn) => sum + (txn.direction === "debit" ? -txn.amount : txn.amount), 0);

  const available = Math.max(0, availableRaw);

  return {
    pending,
    available,
    total: pending + available,
  };
}

export function buildMeResponse(args: {
  authEmail: string | null;
  authMetadata?: Record<string, unknown> | null;
  emailConfirmed: boolean;
  profile: ProfileRow | null;
  accountStatus: AccountStatusRow | null;
  verification: VerificationRow | null;
  walletTransactions: WalletTransactionRow[];
  trainingSnapshot?: TrainingProgramSnapshot | null;
}) {
  const {
    authEmail,
    authMetadata,
    emailConfirmed,
    profile,
    accountStatus,
    verification,
    walletTransactions,
    trainingSnapshot,
  } = args;
  const { setupComplete, activated, state } = resolveAccountFlags(accountStatus);
  const progress = getAccountProgressSnapshot(profile?.metadata);
  const metadataFullName =
    typeof authMetadata?.full_name === "string" ? authMetadata.full_name : "";
  const metadataPhone =
    typeof authMetadata?.phone === "string" ? authMetadata.phone : "";
  const metadataCounty =
    typeof authMetadata?.county === "string" ? authMetadata.county : null;
  const onboardingComplete =
    trainingSnapshot?.onboardingComplete ?? (setupComplete || progress.onboarding.completed);

  return {
    profile: {
      fullName: profile?.full_name ?? metadataFullName,
      phone: profile?.phone ?? metadataPhone,
      email: profile?.email ?? authEmail,
      county: profile?.county ?? metadataCounty,
    },
    status: {
      setupComplete: onboardingComplete,
      activated: trainingSnapshot?.activated ?? activated,
      accountState: state,
      needsOnboarding: !onboardingComplete,
    },
    verification: {
      phoneVerified: verification?.phone_verified ?? false,
      emailVerified: verification?.email_verified ?? emailConfirmed,
      kycStatus: verification?.kyc_status ?? "not_started",
    },
    wallet: summarizeWallet(walletTransactions),
    onboarding: progress.onboarding,
    training: {
      ...(trainingSnapshot
        ? {
            status: trainingSnapshot.training.status,
            currentDay: trainingSnapshot.training.current_day,
            currentStage: trainingSnapshot.training.current_stage,
            completedDays: trainingSnapshot.training.completed_days,
            stageAttempt: trainingSnapshot.training.stage_attempt,
            failedStageAttempts: trainingSnapshot.training.failed_stage_attempts,
            nextDayUnlockAt: trainingSnapshot.training.next_day_unlock_at,
            completedAt: trainingSnapshot.training.completed_at,
            canStartTasks: trainingSnapshot.canStartTasks,
            gateReason: trainingSnapshot.gateReason,
            gateMessage: trainingSnapshot.gateMessage,
          }
        : {
            ...progress.training,
            currentStage: progress.training.stage,
          }),
    },
    rewards: progress.rewards,
  };
}
