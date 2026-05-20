"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bell,
  Clock3,
  Filter,
  LineChart,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type EmptyTaskStateProps = {
  completedTaskCount?: number;
};

type EmptyStateKey = "traffic" | "curating" | "sampling" | "countdown";

const STATE_OPTIONS: EmptyStateKey[] = ["traffic", "curating", "sampling", "countdown"];

function randomCountdownSeconds() {
  const minutes = Math.floor(Math.random() * (47 - 18 + 1)) + 18;
  return minutes * 60;
}

function pickRandomState(excluded?: EmptyStateKey[]): EmptyStateKey {
  const pool = STATE_OPTIONS.filter((state) => !(excluded ?? []).includes(state));
  return pool[Math.floor(Math.random() * pool.length)] ?? "traffic";
}

function formatCountdown(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return {
    mins: mins.toString().padStart(2, "0"),
    secs: secs.toString().padStart(2, "0"),
  };
}

export function EmptyTaskState({ completedTaskCount = 0 }: EmptyTaskStateProps) {
  const router = useRouter();
  const [stateKey, setStateKey] = useState<EmptyStateKey>("traffic");
  const [countdownSeconds, setCountdownSeconds] = useState(0);

  useEffect(() => {
    const initialState = pickRandomState();
    setStateKey(initialState);
    if (initialState === "countdown") {
      setCountdownSeconds(randomCountdownSeconds());
    }
  }, []);

  useEffect(() => {
    if (stateKey !== "countdown") {
      return;
    }

    const timer = window.setInterval(() => {
      setCountdownSeconds((current) => {
        if (current <= 1) {
          setStateKey(pickRandomState(["countdown", "sampling"]));
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [stateKey]);

  const countdown = useMemo(() => formatCountdown(countdownSeconds), [countdownSeconds]);

  const scrollToReferralSection = () => {
    document.getElementById("task-earn-more-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const renderMainState = () => {
    if (stateKey === "traffic") {
      return (
        <>
          <StateIcon icon={Users} tone="blue" />
          <h2 className="text-3xl font-bold text-navy">Tasks are flying right now</h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
            Our system is managing high demand at the moment. New tasks are being assigned in batches to ensure
            everyone gets a fair chance.
          </p>
          <div className="flex items-center gap-2 text-sm font-medium text-pesatrix-blue">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-pesatrix-blue" />
            Check back in a few minutes
          </div>
          <Button
            className="w-full sm:w-auto"
            onClick={() => toast.success("We’ll alert you soon")}
          >
            <Bell className="mr-2 h-4 w-4" />
            Notify me when tasks drop
          </Button>
        </>
      );
    }

    if (stateKey === "curating") {
      return (
        <>
          <StateIcon icon={Filter} tone="teal" />
          <h2 className="text-3xl font-bold text-navy">We&apos;re handpicking tasks for you</h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
            Our team reviews and approves tasks before they go live to make sure you only see quality work worth your
            time.
          </p>
          <div className="w-full max-w-sm">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-teal" />
            </div>
            <p className="mt-2 text-sm font-medium text-teal">Usually ready within the hour</p>
          </div>
          <Button variant="outline" className="w-full sm:w-auto" onClick={scrollToReferralSection}>
            <Sparkles className="mr-2 h-4 w-4" />
            Explore other ways to earn
          </Button>
        </>
      );
    }

    if (stateKey === "sampling") {
      return (
        <>
          <StateIcon icon={LineChart} tone="amber" />
          <h2 className="text-3xl font-bold text-navy">Building your task profile</h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
            The more tasks you complete, the better we match you with higher-paying work. New tasks dropping soon.
          </p>
          {completedTaskCount > 0 ? (
            <p className="rounded-full bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">
              You&apos;ve completed {completedTaskCount} task{completedTaskCount === 1 ? "" : "s"}
            </p>
          ) : null}
          <p className="text-sm font-medium text-pesatrix-blue">Your next batch is being prepared</p>
          <Button className="w-full sm:w-auto" onClick={() => router.push("/dashboard/wallet")}>
            <Wallet className="mr-2 h-4 w-4" />
            View my earnings
          </Button>
        </>
      );
    }

    return (
      <>
        <StateIcon icon={Clock3} tone="blue" />
        <h2 className="text-3xl font-bold text-navy">Next task batch drops in</h2>
        <div className="flex items-center gap-3">
          <TimerBlock value={countdown.mins} label="MIN" />
          <TimerBlock value={countdown.secs} label="SEC" />
        </div>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
          We release tasks in scheduled batches so everyone gets equal access. You&apos;re in the queue.
        </p>
        <Button variant="outline" className="w-full sm:w-auto" onClick={() => toast.success("Reminder set")}>
          <Bell className="mr-2 h-4 w-4" />
          Set a reminder
        </Button>
      </>
    );
  };

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border border-outline-variant/40 bg-white shadow-sm">
        <CardContent className="flex min-h-[70vh] flex-col items-center justify-center gap-5 px-6 py-10 text-center sm:px-10">
          {renderMainState()}
        </CardContent>
      </Card>

      <section
        id="task-earn-more-section"
        className="rounded-2xl border border-outline-variant/40 bg-surface-container-low px-5 py-6"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">While you wait</p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-navy">Keep your earning momentum moving</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Referral bonuses and wallet history stay open even when the next task batch is still loading.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => router.push("/dashboard/referrals")}>
              Explore referrals
            </Button>
            <Button onClick={() => router.push("/dashboard/wallet")}>View wallet</Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function StateIcon({
  icon: Icon,
  tone,
}: {
  icon: typeof Users;
  tone: "blue" | "teal" | "amber";
}) {
  const tones = {
    blue: "bg-pesatrix-blue/10 text-pesatrix-blue",
    teal: "bg-teal/10 text-teal",
    amber: "bg-amber-100 text-amber-700",
  } as const;

  return (
    <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${tones[tone]}`}>
      <Icon className="h-8 w-8" />
    </div>
  );
}

function TimerBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-outline-variant/40 bg-surface px-5 py-4">
      <p className="font-mono text-3xl font-bold text-navy">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
    </div>
  );
}
