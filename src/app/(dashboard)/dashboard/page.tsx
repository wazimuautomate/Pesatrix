import { createServerSupabaseClient } from "@/lib/supabase/server";
import { BannerStrip } from "@/components/dashboard/BannerStrip";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { resolveAccountFlags } from "@/lib/account-progress";
import { getTrainingProgramSnapshotForUser } from "@/lib/training";
import { getActivationFeeKsh } from "@/lib/platform-settings";
import { getWalletSummaryForUser } from "@/lib/wallet";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardOverviewClient } from "@/components/dashboard/DashboardOverviewClient";
import { ReferralNudgeCard } from "@/components/dashboard/ReferralNudgeCard";
import { countActivatedReferrals } from "@/lib/wallet/withdrawalLimits";

type WalletSummaryTxn = {
  amount: number;
  bucket: string | null;
  type: string | null;
  direction: string | null;
};

type RecentTxn = {
  id: string;
  type: string | null;
  amount: number;
  direction: string | null;
  status: string | null;
  created_at: string;
};

type RewardSpinRow = {
  payout_amount: number | null;
};

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch wallet summary
  const { data: walletTxnRows } = await supabase
    .from("wallet_transactions")
    .select("amount, bucket, type, direction")
    .eq("user_id", user!.id);

  const walletTxns = (walletTxnRows ?? []) as WalletSummaryTxn[];

  const [walletSummary, activationFeeKsh] = await Promise.all([
    getWalletSummaryForUser(user!.id),
    getActivationFeeKsh(),
  ]);

  const pendingBalance = walletSummary.pending;
  const availableBalance = walletSummary.available;

  // Fetch real task submissions count for user
  const { count: taskSubmissionCount } = await supabase
    .from("task_submissions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user!.id);

  const taskCount = taskSubmissionCount ?? 0;

  // Fetch referral stats from profiles where referred_by is the user
  const { count: referralCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("referred_by", user!.id);

  const [{ data: rewardSpinRows }, activatedReferralCount] = await Promise.all([
    (supabase.from("reward_spins" as never) as any)
      .select("payout_amount")
      .eq("user_id", user!.id),
    countActivatedReferrals(user!.id, createAdminSupabaseClient()),
  ]);

  const [accountStatusResult, { data: profileRow }, trainingSnapshot] = await Promise.all([
    (supabase.from("account_status" as never) as any)
      .select("is_activated, is_setup_complete, status, state")
      .eq("user_id", user!.id)
      .maybeSingle(),
    (supabase.from("profiles" as never) as any)
      .select("metadata")
      .eq("id", user!.id)
      .maybeSingle(),
    getTrainingProgramSnapshotForUser(user!.id),
  ]);

  if (accountStatusResult.error) {
    console.error("[DashboardPage] Failed to read account_status:", accountStatusResult.error);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Manage your tasks, wallet, and referrals
          </p>
        </div>
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-4">
            <p className="font-medium text-foreground">Account status unavailable</p>
            <p className="mt-1 text-sm text-muted-foreground">
              We could not load your account state. Refresh the page or try again shortly.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  let accountStatusRow = accountStatusResult.data;

  if (!accountStatusRow) {
    const admin = createAdminSupabaseClient();
    const { data: adminStatus, error: adminStatusError } = await admin
      .from("account_status")
      .select("is_activated, is_setup_complete, status, state")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (adminStatusError) {
      console.error("[DashboardPage] Failed to read account_status with service role:", adminStatusError);
      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-navy">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Manage your tasks, wallet, and referrals
            </p>
          </div>
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-4">
              <p className="font-medium text-foreground">Account status unavailable</p>
              <p className="mt-1 text-sm text-muted-foreground">
                We could not load your account state. Refresh the page or try again shortly.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    accountStatusRow = adminStatus;
  }

  if (!accountStatusRow) {
    redirect("/dashboard/onboarding");
  }

  const accountStatus = resolveAccountFlags(accountStatusRow as any);
  const paidActivated = trainingSnapshot.activated;
  const canStartTasks = trainingSnapshot.canStartTasks;
  const rewardSpins = (rewardSpinRows ?? []) as RewardSpinRow[];
  const earningPathSteps = [
    {
      label: "Setup",
      complete: accountStatus.setupComplete,
      detail: accountStatus.setupComplete ? "Profile ready" : "Finish onboarding",
    },
    {
      label: "Activate",
      complete: paidActivated,
      detail: paidActivated ? "Account active" : "Pay activation",
    },
    {
      label: "Training",
      complete: trainingSnapshot.trainingCompleted,
      detail: trainingSnapshot.trainingCompleted
        ? "Certified"
        : `Day ${trainingSnapshot.training.current_day} of 7`,
    },
    {
      label: "Tasks",
      complete: canStartTasks && taskCount > 0,
      detail: canStartTasks ? `${taskCount} completed` : "Locked until training",
    },
    {
      label: "Referrals",
      complete: (referralCount ?? 0) > 0,
      detail: `${referralCount ?? 0} friends`,
    },
  ];
  const completedPathSteps = earningPathSteps.filter((step) => step.complete).length;
  const pathProgressValue = Math.round((completedPathSteps / earningPathSteps.length) * 100);

  // Recent transactions
  const { data: recentTxnRows } = await supabase
    .from("wallet_transactions")
    .select("id, type, direction, amount, status, created_at")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const recentTxns = (recentTxnRows ?? []) as RecentTxn[];
  const stateVariant =
    accountStatus.setupComplete || paidActivated
      ? "success"
      : accountStatus.state === "suspended"
        ? "destructive"
        : "muted";

  return (
    <>
      <BannerStrip />
      <div className="mb-6">
        <ReferralNudgeCard activatedReferralCount={activatedReferralCount} />
      </div>
      <DashboardOverviewClient
        stateLabel={accountStatus.state.replace(/_/g, " ").toUpperCase()}
      stateVariant={stateVariant}
      activated={paidActivated}
      setupComplete={accountStatus.setupComplete}
      activationFeeKsh={activationFeeKsh}
      trainingActivated={trainingSnapshot.activated}
      trainingCompleted={trainingSnapshot.trainingCompleted}
      trainingDay={trainingSnapshot.training.current_day}
      canStartTasks={canStartTasks}
      taskCount={taskCount}
      referralCount={referralCount ?? 0}
      availableBalance={availableBalance}
      pendingBalance={pendingBalance}
      totalEarned={walletSummary.totalEarned}
      pathProgressValue={pathProgressValue}
      completedPathSteps={completedPathSteps}
      totalPathSteps={earningPathSteps.length}
      pathSteps={earningPathSteps}
      recentTransactions={recentTxns}
      />
    </>
  );
}
