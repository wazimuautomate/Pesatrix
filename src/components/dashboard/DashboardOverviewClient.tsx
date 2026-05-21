"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Wallet,
  ClipboardList,
  Users,
  TrendingUp,
  Clock,
  ChevronRight,
  Target,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageTransition } from "@/components/ui/PageTransition";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { formatKSh } from "@/lib/utils";

type PathStep = {
  label: string;
  complete: boolean;
  detail: string;
};

type RecentTransaction = {
  id: string;
  type: string | null;
  direction: string | null;
  amount: number;
  status: string | null;
  created_at: string;
};

type DashboardOverviewProps = {
  stateLabel: string;
  stateVariant: "success" | "destructive" | "muted";
  activated: boolean;
  setupComplete: boolean;
  activationFeeKsh: number;
  trainingActivated: boolean;
  trainingCompleted: boolean;
  trainingDay: number;
  canStartTasks: boolean;
  taskCount: number;
  referralCount: number;
  availableBalance: number;
  pendingBalance: number;
  totalEarned: number;
  pathProgressValue: number;
  completedPathSteps: number;
  totalPathSteps: number;
  pathSteps: PathStep[];
  recentTransactions: RecentTransaction[];
};

const cardMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

export function DashboardOverviewClient(props: DashboardOverviewProps) {
  const quickActions = [
    { href: "/dashboard/tasks", label: "Browse Tasks", icon: ClipboardList },
    { href: "/dashboard/wallet/withdraw", label: "Withdraw", icon: Wallet },
    { href: "/dashboard/referrals", label: "Invite Friends", icon: Users },
    { href: "/dashboard/support", label: "Get Help", icon: Clock },
  ];

  const stats = [
    {
      label: "Available Balance",
      value: formatKSh(props.availableBalance),
      icon: Wallet,
      detail: "Available (withdrawable)",
    },
    {
      label: "Pending Balance",
      value: formatKSh(props.pendingBalance),
      icon: Clock,
      detail: "Pending hold period",
    },
    {
      label: "Direct Referrals",
      value: String(props.referralCount),
      icon: Users,
      detail: "20% commission each",
    },
    {
      label: "Total Earned",
      value: formatKSh(props.totalEarned),
      icon: TrendingUp,
      detail: "Lifetime earnings",
    },
  ];

  return (
    <PageTransition className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage your tasks, wallet, and referrals</p>
        </div>
        <Badge variant={props.stateVariant}>{props.stateLabel}</Badge>
      </div>

      {!props.activated && props.setupComplete ? (
        <motion.div
          {...cardMotion}
          transition={{ duration: 0.22 }}
          className="rounded-2xl border border-primary/20 bg-accent"
        >
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-foreground">Activate your account to start earning</p>
              <p className="text-sm text-muted-foreground">
                One-time activation fee of {formatKSh(props.activationFeeKsh)} via M-Pesa
              </p>
            </div>
            <motion.div
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            >
              <Button asChild size="sm">
                <Link href="/dashboard/activate">
                  Activate Now
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </motion.div>
          </div>
        </motion.div>
      ) : null}

      {props.trainingActivated && !props.trainingCompleted ? (
        <motion.div {...cardMotion} transition={{ duration: 0.22, delay: 0.04 }} className="rounded-2xl border border-outline-variant/40 bg-surface-container-low">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-foreground">Training is your next required step</p>
              <p className="text-sm text-muted-foreground">
                Day {props.trainingDay} of 7 is active. Finish training before live tasks unlock.
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/dashboard/training">
                Continue Training
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </motion.div>
      ) : null}

      {props.canStartTasks ? (
        <motion.div {...cardMotion} transition={{ duration: 0.22, delay: 0.08 }} className="rounded-2xl border border-teal/30 bg-teal/5">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-foreground">Tasks are fully unlocked</p>
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
          </div>
        </motion.div>
      ) : null}

      <motion.div {...cardMotion} transition={{ duration: 0.22, delay: 0.12 }}>
        <Card className="overflow-hidden border-outline-variant/40">
          <CardContent className="p-0">
            <div className="p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Progress</p>
                  <h2 className="mt-2 text-xl font-bold text-navy">Your earning path</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Track every step from account setup through training, task work, rewards, and referrals.
                  </p>
                </div>
                <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                  <Target className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-navy">{props.pathProgressValue}% complete</span>
                  <span className="text-muted-foreground">
                    {props.completedPathSteps}/{props.totalPathSteps} steps
                  </span>
                </div>
                <Progress value={props.pathProgressValue} />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {props.pathSteps.map((step, index) => (
                  <motion.div
                    key={step.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.16 + index * 0.05 }}
                    className={`rounded-xl border px-4 py-3 ${
                      step.complete ? "border-teal/25 bg-teal/5" : "border-outline-variant/40 bg-surface-container-low"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-navy">{step.label}</p>
                      <Badge variant={step.complete ? "success" : "muted"} className="text-[11px]">
                        {step.complete ? "Done" : "Next"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{step.detail}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial="initial"
        animate="animate"
        variants={{ animate: { transition: { staggerChildren: 0.06 } } }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {stats.map((stat) => (
          <motion.div key={stat.label} variants={cardMotion} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Card className="border-outline-variant/40">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                <stat.icon className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums text-navy">{stat.value}</div>
                <p className="mt-1 text-xs text-muted-foreground">{stat.detail}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div {...cardMotion} transition={{ duration: 0.22, delay: 0.18 }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Card className="border-outline-variant/40">
            <CardHeader>
              <CardTitle className="text-base text-navy">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => (
                <motion.div key={action.href} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button variant="outline" asChild className="h-auto w-full flex-col gap-2 py-4">
                    <Link href={action.href}>
                      <action.icon className="h-5 w-5 text-primary" />
                      <span className="text-xs">{action.label}</span>
                    </Link>
                  </Button>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div {...cardMotion} transition={{ duration: 0.22, delay: 0.22 }}>
          <Card className="border-outline-variant/40">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base text-navy">Recent Transactions</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dashboard/wallet" className="text-xs">
                  View All
                  <ChevronRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <RecentTransactions transactions={props.recentTransactions} />
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </PageTransition>
  );
}
