import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAccountProgressSnapshot, resolveAccountFlags } from "@/lib/account-progress";
import { getTrainingProgramSnapshotForUser } from "@/lib/training";
import { formatKSh } from "@/lib/utils";
import { redirect } from "next/navigation";
import {
  Wallet,
  ClipboardList,
  Users,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  ChevronRight,
  BookOpen,
  Gift,
  Target,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

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
  bucket: string | null;
  description: string | null;
  created_at: string;
};

type RewardSpinRow = {
  payout_amount: number | null;
};

type ReferralBonusRow = {
  amount: number | null;
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

  const pendingBalance =
    walletTxns
      .filter((t) => t.bucket === "pending")
      .reduce((sum, t) => sum + (t.direction === "debit" ? -t.amount : t.amount), 0);

  const availableBalance =
    walletTxns
      .filter((t) => t.bucket === "available")
      .reduce((sum, t) => sum + (t.direction === "debit" ? -t.amount : t.amount), 0);

  const totalWithdrawn =
    walletTxns
      .filter((t) => t.type === "withdrawal")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // Fetch task stats
  const totalEarned =
    walletTxns
      .filter((t) => t.type === "task_earning")
      .reduce((sum, t) => sum + t.amount, 0);

  const taskCount = walletTxns.filter((t) => t.type === "task_earning").length;

  // Fetch referral stats
  const { count: referralCount } = await supabase
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", user!.id)
    .eq("level", 1);

  const [{ data: rewardSpinRows }, { data: referralBonusRows }] = await Promise.all([
    (supabase.from("reward_spins" as never) as any)
      .select("payout_amount")
      .eq("user_id", user!.id),
    supabase
      .from("referral_bonuses")
      .select("amount")
      .eq("referrer_id", user!.id),
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

  if (!accountStatusResult.data) {
    redirect("/onboarding");
  }

  const accountStatus = resolveAccountFlags(accountStatusResult.data as any);
  const progressSnapshot = getAccountProgressSnapshot(profileRow?.metadata);
  const rewardState = progressSnapshot.rewards;
  const canStartTasks = trainingSnapshot.canStartTasks;
  const rewardSpins = (rewardSpinRows ?? []) as RewardSpinRow[];
  const wheelEarnings = rewardSpins.reduce((sum, row) => sum + Number(row.payout_amount ?? 0), 0);
  const referralEarnings = ((referralBonusRows ?? []) as ReferralBonusRow[]).reduce(
    (sum: number, row) => sum + Number(row.amount ?? 0),
    0
  );
  const earningPathSteps = [
    {
      label: "Setup",
      complete: accountStatus.setupComplete,
      detail: accountStatus.setupComplete ? "Profile ready" : "Finish onboarding",
    },
    {
      label: "Activate",
      complete: accountStatus.activated,
      detail: accountStatus.activated ? "Account active" : "Pay activation",
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
      label: "Rewards",
      complete: rewardSpins.length > 0,
      detail: `${rewardSpins.length} wheel spins`,
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
    .select("id, type, amount, bucket, description, created_at")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const recentTxns = (recentTxnRows ?? []) as RecentTxn[];

  return (
    <div className="space-y-6">
      {/* Welcome + Status */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy">
            Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your tasks, wallet, and referrals
          </p>
        </div>
        <Badge
          variant={
            accountStatus.setupComplete || accountStatus.activated
              ? "success"
              : accountStatus.state === "suspended"
                ? "destructive"
                : "muted"
          }
        >
          {accountStatus.state.replace("_", " ").toUpperCase()}
        </Badge>
      </div>

      {/* Activation Prompt */}
      {(!accountStatus.activated && accountStatus.setupComplete) && (
        <Card className="border-primary/20 bg-accent">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium text-foreground">
                Activate your account to start earning
              </p>
              <p className="text-sm text-muted-foreground">
                One-time activation fee of KSh 500 via M-Pesa
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/dashboard/activate">
                Activate Now
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {trainingSnapshot.activated && !trainingSnapshot.trainingCompleted ? (
        <Card className="border-outline-variant/40 bg-surface-container-low">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-medium text-foreground">
                Training is your next required step
              </p>
              <p className="text-sm text-muted-foreground">
                Day {trainingSnapshot.training.current_day} of 7 is active. Finish the training before live task starts unlock.
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/dashboard/training">
                Continue Training
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {canStartTasks ? (
        <Card className="border-teal/30 bg-teal/5">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-medium text-foreground">
                Tasks are fully unlocked
              </p>
              <p className="text-sm text-muted-foreground">
                Your activation and mandatory training are complete. You can now move into live provider tasks.
              </p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/tasks">
                Open Tasks
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-outline-variant/40">
        <CardContent className="flex items-center justify-between gap-4 p-4">
          <div>
            <p className="font-medium text-foreground">Daily reward streak</p>
            <p className="text-sm text-muted-foreground">
              Keep your free-spin streak alive to maintain consistent reward momentum.
            </p>
          </div>
          <Badge variant="muted">Streak: {rewardState.dailyStreak}</Badge>
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-outline-variant/40">
        <CardContent className="p-0">
          <div className="grid gap-0 lg:grid-cols-[1.2fr,0.8fr]">
            <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                    Progress
                  </p>
                  <h2 className="mt-2 text-xl font-bold text-navy">Your earning path</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Track every step from account setup through training, task work, wheel rewards, and referrals.
                  </p>
                </div>
                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <Target className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-navy">{pathProgressValue}% complete</span>
                  <span className="text-muted-foreground">
                    {completedPathSteps}/{earningPathSteps.length} steps
                  </span>
                </div>
                <Progress value={pathProgressValue} />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {earningPathSteps.map((step) => (
                  <div
                    key={step.label}
                    className={`rounded-xl border px-4 py-3 ${
                      step.complete
                        ? "border-teal/25 bg-teal/5"
                        : "border-outline-variant/40 bg-surface-container-low"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-navy">{step.label}</p>
                      <Badge variant={step.complete ? "success" : "muted"} className="text-[11px]">
                        {step.complete ? "Done" : "Next"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{step.detail}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-outline-variant/40 bg-surface-container-low p-5 sm:p-6 lg:border-l lg:border-t-0">
              <h2 className="text-base font-bold text-navy">Earning insights</h2>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ClipboardList className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium text-foreground">Task earnings</span>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-navy">{formatKSh(totalEarned)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Gift className="h-5 w-5 text-teal" />
                    <span className="text-sm font-medium text-foreground">Wheel rewards</span>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-navy">{formatKSh(wheelEarnings)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-teal" />
                    <span className="text-sm font-medium text-foreground">Referral bonuses</span>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-navy">{formatKSh(referralEarnings)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white px-4 py-3">
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium text-foreground">Training</span>
                  </div>
                  <span className="text-sm font-bold text-navy">
                    {trainingSnapshot.trainingCompleted
                      ? "Complete"
                      : `${trainingSnapshot.training.completed_days.length}/7 days`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bento Grid Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-outline-variant/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Available Balance
            </CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-navy">
              {formatKSh(availableBalance)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatKSh(pendingBalance)} pending
            </p>
          </CardContent>
        </Card>

        <Card className="border-outline-variant/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tasks Completed
            </CardTitle>
            <ClipboardList className="h-4 w-4 text-teal" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-navy">
              {taskCount}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatKSh(totalEarned)} earned
            </p>
          </CardContent>
        </Card>

        <Card className="border-outline-variant/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Direct Referrals
            </CardTitle>
            <Users className="h-4 w-4 text-teal" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-navy">
              {referralCount ?? 0}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              20% commission each
            </p>
          </CardContent>
        </Card>

        <Card className="border-outline-variant/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Withdrawn
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-navy">
              {formatKSh(totalWithdrawn)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Lifetime payouts
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions + Recent */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <Card className="border-outline-variant/40">
          <CardHeader>
            <CardTitle className="text-base text-navy">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Button variant="outline" asChild className="h-auto flex-col gap-2 py-4">
              <Link href="/dashboard/tasks">
                <ClipboardList className="h-5 w-5 text-primary" />
                <span className="text-xs">Browse Tasks</span>
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-auto flex-col gap-2 py-4">
              <Link href="/dashboard/wallet/withdraw">
                <Wallet className="h-5 w-5 text-primary" />
                <span className="text-xs">Withdraw</span>
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-auto flex-col gap-2 py-4">
              <Link href="/dashboard/referrals">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-xs">Invite Friends</span>
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-auto flex-col gap-2 py-4">
              <Link href="/dashboard/support">
                <Clock className="h-5 w-5 text-primary" />
                <span className="text-xs">Get Help</span>
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="border-outline-variant/40">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base text-navy">
              Recent Transactions
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/wallet" className="text-xs">
                View All
                <ChevronRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentTxns.length > 0 ? (
              <div className="space-y-3">
                {recentTxns.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-md ${
                          tx.amount > 0 ? "bg-teal/10" : "bg-destructive/10"
                        }`}
                      >
                        {tx.amount > 0 ? (
                          <ArrowDownRight className="h-4 w-4 text-teal" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          {tx.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.created_at).toLocaleDateString("en-KE", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-sm font-semibold tabular-nums ${
                        tx.amount > 0 ? "text-teal" : "text-destructive"
                      }`}
                    >
                      {tx.amount > 0 ? "+" : ""}
                      {formatKSh(Math.abs(tx.amount))}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No transactions yet. Complete tasks to start earning.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
