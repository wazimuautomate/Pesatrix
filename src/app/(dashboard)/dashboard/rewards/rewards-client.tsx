"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  KeyRound,
  Loader2,
  PlayCircle,
  RotateCw,
  Sparkles,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn, formatKSh } from "@/lib/utils";
import Skeleton from "react-loading-skeleton";

const FREE_WHEEL_SEGMENTS = ["KSh 5", "KSh 10", "KSh 15", "KSh 20", "KSh 25", "KSh 40", "Miss"];
const PAID_WHEEL_SEGMENTS = ["x0", "x1", "x2", "x3", "x4"];

type RewardStatus = {
  activated: boolean;
  wallet: {
    available: number;
    pending: number;
    total: number;
  };
  rewardState: {
    dailyStreak: number;
    consecutiveSmallWins: number;
  };
  free: {
    canSpin: boolean;
    spinsUsed: number;
    spinsRemaining: number;
    nextSpinAt: string | null;
    latestReward: { amount: number } | null;
  };
  paid: {
    enabled: boolean;
    cost: number;
    canSpin: boolean;
    spinsUsed: number;
    spinsRemaining: number;
    latestReward: { amount: number } | null;
  };
  error?: {
    message: string;
  };
};

type RewardSpinResponse = {
  mode: "free" | "paid";
  outcome: {
    amount: number;
    label: string;
    wheelLabel: string;
    nearMissLabel: string | null;
  };
  wallet: RewardStatus["wallet"];
  rewardState: RewardStatus["rewardState"];
  nextSpinAt: string | null;
  cost: number;
  reward: { amount: number } | null;
  error?: {
    message: string;
  };
};

type TopUpResponse = {
  wallet?: RewardStatus["wallet"];
  error?: {
    message: string;
  };
};

function formatCountdown(nextSpinAt: string | null) {
  if (!nextSpinAt) return "Ready now";

  const remainingMs = new Date(nextSpinAt).getTime() - Date.now();
  if (remainingMs <= 0) return "Ready now";

  const totalMinutes = Math.floor(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m left`;
}

function wheelGradient(mode: "free" | "paid") {
  return mode === "free"
    ? "conic-gradient(from -25.7deg,#1463ff 0deg 51.42deg,#006a66 51.42deg 102.84deg,#e0e8ff 102.84deg 154.26deg,#73f7f0 154.26deg 205.68deg,#0b1f3b 205.68deg 257.1deg,#dbe2f9 257.1deg 308.52deg,#f1f3ff 308.52deg 360deg)"
    : "conic-gradient(from -36deg,#0b1f3b 0deg 72deg,#1463ff 72deg 144deg,#006a66 144deg 216deg,#73f7f0 216deg 288deg,#dbe2f9 288deg 360deg)";
}

export function RewardsClient() {
  const [status, setStatus] = useState<RewardStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [spinningMode, setSpinningMode] = useState<"free" | "paid" | null>(null);
  const [selectedMode, setSelectedMode] = useState<"free" | "paid">("free");
  const [rotation, setRotation] = useState(0);
  const [latestResult, setLatestResult] = useState("Spin to reveal");
  const [settling, setSettling] = useState(false);

  async function loadStatus() {
    setLoading(true);
    try {
      const response = await fetch("/api/rewards/spin", { cache: "no-store" });
      const payload = (await response.json()) as RewardStatus;
      if (!response.ok) {
        toast.error(payload.error?.message || "Failed to load rewards.");
        return;
      }

      setStatus(payload);
    } catch {
      toast.error("Failed to load rewards.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  const paidTopUpAmount = useMemo(() => {
    if (!status) return 0;
    return Math.max(0, status.paid.cost - status.wallet.available);
  }, [status]);

  async function mockTopUp(amount: number) {
    const response = await fetch("/api/rewards/top-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });

    const payload = (await response.json()) as TopUpResponse;
    if (!response.ok) {
      throw new Error(payload.error?.message || "Top up failed.");
    }

    return payload.wallet;
  }

  async function handleSpin(mode: "free" | "paid") {
    if (!status || spinningMode) return;

    if (!status.activated) {
      toast.error("Activate your account before spinning.");
      return;
    }

    if (mode === "free" && status.free.spinsRemaining <= 0) {
      toast.error("Your free spins are finished for today.");
      return;
    }

    if (mode === "paid" && status.paid.spinsRemaining <= 0) {
      toast.error("Your paid spins are finished for today.");
      return;
    }

    setSpinningMode(mode);
    setSettling(true);

    try {
      if (mode === "paid" && paidTopUpAmount > 0) {
        await mockTopUp(paidTopUpAmount);
        toast.success(`M-Pesa top up successful: ${formatKSh(paidTopUpAmount)}`);
      }

      const response = await fetch("/api/rewards/spin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mode,
          adConfirmed: mode === "free",
        }),
      });

      const payload = (await response.json()) as RewardSpinResponse;
      if (!response.ok) {
        toast.error(payload.error?.message || "Spin failed.");
        await loadStatus();
        return;
      }

      const currentSegments = mode === "free" ? FREE_WHEEL_SEGMENTS : PAID_WHEEL_SEGMENTS;
      const targetIndex = Math.max(
        0,
        currentSegments.findIndex(
          (segment) => segment.toLowerCase() === payload.outcome.wheelLabel.toLowerCase()
        )
      );
      const segmentAngle = 360 / currentSegments.length;
      const centeredStop = 360 - (targetIndex * segmentAngle + segmentAngle / 2);
      const finalRotation = rotation + 2520 + centeredStop;

      setLatestResult("Spinning...");
      setRotation(finalRotation);

      window.setTimeout(() => {
        void loadStatus();
        setLatestResult(
          payload.outcome.amount > 0
            ? `You won ${formatKSh(payload.outcome.amount)}`
            : "Try again"
        );
        toast.success(
          payload.outcome.amount > 0
            ? `You won ${formatKSh(payload.outcome.amount)}`
            : "Spin complete. Try again."
        );
        setSpinningMode(null);
        setSettling(false);
      }, 5200);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Spin failed.");
      setSpinningMode(null);
      setSettling(false);
      await loadStatus();
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              Daily Rewards
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy md:text-4xl">
              <Skeleton width={260} height={36} />
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Skeleton width={120} height={34} borderRadius={9999} />
            <Skeleton width={120} height={34} borderRadius={9999} />
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 xl:gap-8">
          {/* Wheel skeleton column */}
          <div className="relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden rounded-[28px] border border-outline-variant/50 bg-white p-5 shadow-sm sm:p-8 xl:col-span-5">
            <Skeleton circle width={280} height={280} containerClassName="flex items-center justify-center" />
            <div className="mt-4">
              <Skeleton width={160} height={32} borderRadius={9999} />
            </div>
          </div>

          {/* Mode selectors and controls column */}
          <div className="flex flex-col gap-4 xl:col-span-4">
            <div className="rounded-3xl border border-outline-variant/50 bg-white p-6 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-4">
                <Skeleton width={120} height={20} />
                <Skeleton width={60} height={20} borderRadius={9999} />
              </div>
              <Skeleton count={2} height={14} className="mt-2" />
            </div>

            <div className="rounded-3xl border border-outline-variant/50 bg-white p-6 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-4">
                <Skeleton width={120} height={20} />
                <Skeleton width={60} height={20} borderRadius={9999} />
              </div>
              <Skeleton count={2} height={14} className="mt-2" />
            </div>

            <div className="mt-auto overflow-hidden rounded-3xl border border-outline-variant/50 bg-white p-7 shadow-sm">
              <Skeleton width={90} height={12} />
              <div className="mt-4 mb-6">
                <Skeleton width={160} height={32} />
                <Skeleton width={120} height={18} className="mt-1" />
              </div>
              <Skeleton height={56} borderRadius={16} />
            </div>
          </div>

          {/* Wallet and stats column */}
          <div className="flex flex-col gap-6 xl:col-span-3">
            <div className="rounded-3xl border border-outline-variant/50 bg-white p-7 shadow-sm">
              <div className="mb-8 flex items-start justify-between gap-4">
                <div>
                  <Skeleton width={90} height={12} />
                  <div className="mt-2">
                    <Skeleton width={120} height={32} />
                  </div>
                </div>
                <Skeleton circle width={48} height={48} containerClassName="flex shrink-0" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-4">
                  <Skeleton width={60} height={10} />
                  <Skeleton width={40} height={20} className="mt-2" />
                </div>
                <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-4">
                  <Skeleton width={60} height={10} />
                  <Skeleton width={40} height={20} className="mt-2" />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-outline-variant/50 bg-white p-7 shadow-sm">
              <Skeleton width={90} height={16} />
              <Skeleton count={2} height={14} className="mt-2" />
            </div>

            <div className="rounded-3xl border border-outline-variant/50 bg-white p-6 shadow-sm">
              <div className="flex items-start gap-3">
                <Skeleton circle width={20} height={20} containerClassName="flex shrink-0" />
                <div className="flex-1">
                  <Skeleton height={14} count={2} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const wheelSegments = selectedMode === "free" ? FREE_WHEEL_SEGMENTS : PAID_WHEEL_SEGMENTS;
  const freeSpinsLeft = status.free.spinsRemaining;
  const paidSpinsLeft = status.paid.spinsRemaining;
  const selectedSpinsLeft = selectedMode === "free" ? freeSpinsLeft : paidSpinsLeft;
  const selectedAvailability = selectedSpinsLeft > 0;
  const isSpinReady = status.activated && selectedAvailability;
  const segmentAngle = 360 / wheelSegments.length;
  const choiceState = !status.activated
    ? "Requires activation"
    : selectedAvailability
      ? selectedMode === "free"
        ? formatCountdown(status.free.nextSpinAt)
        : `Cost: ${formatKSh(status.paid.cost)}`
      : "No spins left";
  const spinButtonText =
    selectedMode === "paid" && paidTopUpAmount > 0
      ? `Top up ${formatKSh(paidTopUpAmount)} & spin`
      : `Use ${selectedMode} spin`;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
            Daily Rewards
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-navy md:text-4xl">
            Spin the wheel.
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-wider",
              status.activated
                ? "border-teal/25 bg-teal/10 text-teal"
                : "border-primary/25 bg-primary/10 text-primary"
            )}
          >
            {status.activated ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <KeyRound className="h-4 w-4" />
            )}
            {status.activated ? "Activated" : "Activation required"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/60 bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-muted-foreground">
            <CalendarDays className="h-4 w-4 opacity-70" />
            {status.rewardState.dailyStreak} day streak
          </span>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 xl:gap-8">
        <section className="relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden rounded-[28px] border border-outline-variant/50 bg-[radial-gradient(circle_at_top,rgba(20,99,255,0.12),transparent_44%),linear-gradient(180deg,#ffffff_0%,#f5f8ff_100%)] p-5 shadow-sm sm:p-8 xl:col-span-5">
          <div className="relative flex aspect-square w-full max-w-[430px] items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-navy shadow-[0_24px_70px_rgba(11,31,59,0.22)]" />
            <div className="absolute inset-[3%] rounded-full border-[12px] border-white bg-surface-container-high shadow-[inset_0_0_30px_rgba(11,31,59,0.08)]" />
            <div
              className="absolute inset-[8%] rounded-full shadow-[inset_0_0_34px_rgba(11,31,59,0.22)] transition-transform duration-[5200ms] ease-[cubic-bezier(0.08,0.88,0.12,1)]"
              style={{
                transform: `rotate(${rotation}deg)`,
                background: wheelGradient(selectedMode),
              }}
            >
              {wheelSegments.map((segment, index) => {
                const angle = index * segmentAngle + segmentAngle / 2;
                return (
                  <div
                    key={`${selectedMode}-${segment}-${index}`}
                    className="absolute left-1/2 top-1/2 origin-center"
                    style={{
                      transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-28%)`,
                    }}
                  >
                    <div
                      className={cn(
                        "flex h-16 w-20 items-center justify-center rounded-full text-center text-sm font-black leading-tight [text-shadow:0_1px_8px_rgba(255,255,255,0.35)] sm:h-20 sm:w-24 sm:text-base",
                        selectedMode === "free" && index >= 2 ? "text-navy" : "text-white"
                      )}
                      style={{ transform: `translateY(-76px) rotate(${90}deg)` }}
                    >
                      {segment}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="absolute top-[-2px] z-20 h-0 w-0 border-x-[17px] border-t-[47px] border-x-transparent border-t-primary drop-shadow-[0_8px_14px_rgba(20,99,255,0.34)]" />
            <button
              type="button"
              disabled={spinningMode !== null || !isSpinReady}
              onClick={() => handleSpin(selectedMode)}
              className="absolute z-10 flex h-28 w-28 flex-col items-center justify-center rounded-full border-[10px] border-white bg-navy text-center shadow-[0_18px_44px_rgba(11,31,59,0.28)] transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60 sm:h-32 sm:w-32"
            >
              {spinningMode ? (
                <RotateCw className="h-8 w-8 animate-spin text-white" />
              ) : (
                <>
                  <span className="text-[11px] font-black uppercase tracking-[0.38em] text-white/45">
                    Spin
                  </span>
                  <span className="mt-1 text-2xl font-black uppercase text-white">Play</span>
                </>
              )}
            </button>
          </div>
          <div className="mt-4 rounded-full border border-outline-variant/60 bg-white px-7 py-3 text-xs font-black uppercase tracking-[0.18em] text-navy shadow-sm">
            {latestResult}
          </div>
        </section>

        <section className="flex flex-col gap-4 xl:col-span-4">
          <button
            type="button"
            onClick={() => setSelectedMode("free")}
            className={cn(
              "rounded-3xl border bg-white p-6 text-left shadow-sm transition focus:outline-none focus:ring-2 focus:ring-primary/40",
              selectedMode === "free"
                ? "border-primary shadow-[0_18px_40px_rgba(20,99,255,0.12)]"
                : "border-outline-variant/50 hover:border-primary/40"
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-4">
              <div
                className={cn(
                  "flex items-center gap-2 font-bold",
                  selectedMode === "free" ? "text-primary" : "text-navy"
                )}
              >
                <PlayCircle className="h-5 w-5 opacity-85" />
                Free spins
              </div>
              <span className="rounded-full border border-outline-variant/60 bg-surface-container-low px-3 py-1 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {freeSpinsLeft} left
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Use your daily free chances before they reset.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSelectedMode("paid")}
            className={cn(
              "rounded-3xl border bg-white p-6 text-left shadow-sm transition focus:outline-none focus:ring-2 focus:ring-primary/40",
              selectedMode === "paid"
                ? "border-primary shadow-[0_18px_40px_rgba(20,99,255,0.12)]"
                : "border-outline-variant/50 hover:border-primary/40"
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-4">
              <div
                className={cn(
                  "flex items-center gap-2 font-bold",
                  selectedMode === "paid" ? "text-primary" : "text-navy"
                )}
              >
                <CircleDollarSign className="h-5 w-5 opacity-85" />
                Paid spins
              </div>
              <span className="rounded-full border border-outline-variant/60 bg-surface-container-low px-3 py-1 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                {paidSpinsLeft} left
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Use wallet balance. If it is short, top up with M-Pesa first.
            </p>
          </button>

          <div className="mt-auto overflow-hidden rounded-3xl border border-outline-variant/50 bg-white p-7 shadow-sm">
            <p className="mb-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Current choice
            </p>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-navy">
                  {selectedMode === "free" ? "Free spin" : "Paid spin"}
                </h2>
                <p className="mt-1 font-medium text-muted-foreground">{choiceState}</p>
              </div>
              <Sparkles className="mt-1 h-7 w-7 text-primary" />
            </div>

            {selectedMode === "paid" && paidTopUpAmount > 0 ? (
              <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm font-medium text-navy">
                Top up {formatKSh(paidTopUpAmount)} with M-Pesa before play.
              </div>
            ) : null}

            <Button
              onClick={() => handleSpin(selectedMode)}
              disabled={spinningMode !== null || !isSpinReady}
              className="h-14 w-full rounded-2xl bg-primary text-sm font-black uppercase tracking-widest text-white shadow-[0_18px_38px_rgba(20,99,255,0.22)] hover:bg-primary/90 disabled:border disabled:border-outline-variant/60 disabled:bg-surface-container-low disabled:text-muted-foreground"
            >
              {settling ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-5 w-5" />
              )}
              {spinButtonText}
            </Button>
            <p className="mt-4 text-center text-xs font-black uppercase tracking-widest text-muted-foreground">
              Click the wheel center to play
            </p>
          </div>
        </section>

        <aside className="flex flex-col gap-6 xl:col-span-3">
          <div className="rounded-3xl border border-outline-variant/50 bg-white p-7 shadow-sm">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Wallet balance
                </p>
                <p className="font-mono text-3xl font-bold tracking-tight text-teal">
                  {formatKSh(status.wallet.available)}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-teal/25 bg-teal/10 text-teal">
                <Wallet className="h-6 w-6" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-4 text-center">
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Free used
                </p>
                <p className="font-mono text-xl font-bold text-navy">{status.free.spinsUsed}/2</p>
              </div>
              <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-low p-4 text-center">
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Paid used
                </p>
                <p className="font-mono text-xl font-bold text-navy">{status.paid.spinsUsed}/8</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-outline-variant/50 bg-white p-7 shadow-sm">
            <div className="flex items-center gap-3 font-bold text-navy">
              <Clock3 className="h-5 w-5 text-primary" />
              Daily reset
            </div>
            <p className="mt-4 text-sm font-medium leading-relaxed text-muted-foreground">
              Free spins refresh daily. Paid spins have their own daily limit.
            </p>
          </div>

          <div
            className={cn(
              "rounded-3xl border p-6 text-sm font-medium leading-relaxed shadow-sm",
              status.activated
                ? "border-teal/25 bg-teal/10 text-teal"
                : "border-primary/20 bg-primary/10 text-navy"
            )}
          >
            <div className="flex items-start gap-3">
              {status.activated ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <KeyRound className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <span>
                {status.activated
                  ? "Your account is active. You can now spin the wheel."
                  : "Activate your account to unlock the reward wheel."}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
