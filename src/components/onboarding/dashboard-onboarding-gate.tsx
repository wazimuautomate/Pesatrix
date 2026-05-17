"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Gift,
  HeadphonesIcon,
  LayoutDashboard,
  Loader2,
  UserCircle,
  Users,
  Wallet,
  ClipboardList,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type OnboardingGateProps = {
  isSetupComplete: boolean;
  initialFullName: string;
  initialCounty: string;
  phone: string;
  email: string;
  userId: string;
};

function buildOnboardingStorageKey(userId: string) {
  return `pesatrix:onboarding-complete:${userId}`;
}

const TOUR_STEPS = [
  {
    eyebrow: "Start here",
    title: "Your earning flow starts from the dashboard, then moves into activation and training.",
    description:
      "This short required walkthrough explains how every major area works before you begin live earning.",
    items: [
      {
        title: "Dashboard",
        text: "Track your status, wallet balance, recent activity, and the next step you need to complete.",
        icon: LayoutDashboard,
      },
      {
        title: "Tasks",
        text: "You can browse tasks immediately, but live task starts stay locked until activation and training are both complete.",
        icon: ClipboardList,
      },
      {
        title: "Training",
        text: "The 7-day staged program is mandatory and unlocks one day at a time to protect quality and provider trust.",
        icon: BookOpen,
      },
    ],
  },
  {
    eyebrow: "Money and growth",
    title: "Rewards, referrals, and wallet activity all connect to your account state.",
    description:
      "Use these sections to grow earnings safely after your account is fully prepared for provider work.",
    items: [
      {
        title: "Daily Rewards",
        text: "Daily rewards add small wallet boosts and streak motivation, but they do not replace training or activation.",
        icon: Gift,
      },
      {
        title: "Wallet",
        text: "Your wallet records activation charges, rewards, task earnings, and withdrawals in one place.",
        icon: Wallet,
      },
      {
        title: "Referrals",
        text: "Invite friends using your referral system and increase your earnings upto x10.",
        icon: Users,
      },
    ],
  },
  {
    eyebrow: "Support and identity",
    title: "Profile accuracy and fast support responses protect your account.",
    description:
      "Keep your details correct and use support when a provider rule, task, or payout issue needs attention.",
    items: [
      {
        title: "Support",
        text: "Open support tickets when tasks break, provider instructions conflict, or you need payout help.",
        icon: HeadphonesIcon,
      },
      {
        title: "Profile",
        text: "Your profile holds the personal details that power onboarding, communication, and verification.",
        icon: UserCircle,
      },
      {
        title: "Required sequence",
        text: "Finish this onboarding, activate with KSh 500, then complete the full 7-day training before starting tasks.",
        icon: BadgeCheck,
      },
    ],
  },
];

export function DashboardOnboardingGate({
  isSetupComplete,
  initialFullName,
  initialCounty,
  phone,
  email,
  userId,
}: OnboardingGateProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [completedLocally, setCompletedLocally] = useState(false);

  const totalSteps = TOUR_STEPS.length;
  const progress = ((step + 1) / totalSteps) * 100;
  const isLastStep = step === totalSteps - 1;
  const currentTourStep = TOUR_STEPS[step];

  const summaryRows = useMemo(
    () => [
      { label: "Name", value: initialFullName || "Supplied during signup" },
      { label: "Email", value: email || "Supplied during signup" },
      { label: "Phone", value: phone || "Supplied during signup" },
      { label: "County", value: initialCounty || "Supplied during signup" },
    ],
    [email, initialCounty, initialFullName, phone]
  );

  useEffect(() => {
    if (isSetupComplete) {
      setCompletedLocally(true);
      try {
        window.localStorage.setItem(buildOnboardingStorageKey(userId), "1");
      } catch {
        // Ignore storage failures.
      }
      return;
    }

    try {
      if (window.localStorage.getItem(buildOnboardingStorageKey(userId)) === "1") {
        setCompletedLocally(true);
      }
    } catch {
      // Ignore storage failures.
    }
  }, [isSetupComplete, userId]);

  if (isSetupComplete || completedLocally) {
    return null;
  }

  async function handleFinish() {
    if (submitting) return;

    setSubmitting(true);

    try {
      const hasName = Boolean(initialFullName?.trim());
      const hasCounty = Boolean(initialCounty?.trim());

      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acceptTerms: true,
          ...(hasName ? { fullName: initialFullName } : {}),
          ...(hasCounty ? { county: initialCounty } : {}),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload.error?.message || "Could not complete onboarding");
        return;
      }

      setCompletedLocally(true);
      try {
        window.localStorage.setItem(buildOnboardingStorageKey(userId), "1");
      } catch {
        // Ignore storage failures.
      }
      toast.success("Onboarding completed. Activate your account next.");
      startTransition(() => {
        router.refresh();
      });
    } catch {
      toast.error("Could not complete onboarding. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#07111f]/78 px-4 py-8 backdrop-blur-sm">
      <div className="mx-auto flex min-h-full max-w-5xl items-center justify-center">
        <Card className="relative w-full overflow-hidden border-white/10 bg-white shadow-[0_32px_120px_rgba(3,11,24,0.35)]">
          <div className="grid lg:grid-cols-[0.95fr,1.05fr]">
            <div className="bg-[radial-gradient(circle_at_top,_rgba(20,99,255,0.18),_transparent_50%),linear-gradient(180deg,#0b1f3b_0%,#102b4f_100%)] p-8 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-white/70">
                Required onboarding
              </p>
              <h2 className="mt-4 text-3xl font-bold leading-tight">
                Learn the Pesatrix dashboard before you start real earning.
              </h2>
              <p className="mt-3 max-w-md text-sm text-white/78">
                This walkthrough is required once per account so every new user
                understands the correct sequence: onboarding, activation,
                training, then live tasks.
              </p>

              <div className="mt-8 space-y-3">
                {summaryRows.map((row) => (
                  <div
                    key={row.label}
                    className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3"
                  >
                    <p className="text-xs uppercase tracking-[0.18em] text-white/55">
                      {row.label}
                    </p>
                    <p className="mt-1 text-sm font-medium text-white">
                      {row.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8">
              <button
                type="button"
                onClick={() => setCompletedLocally(true)}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                    Step {step + 1} of {totalSteps}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Please complete this flow to continue to your dashboard.
                  </p>
                </div>
                <div className="w-40">
                  <Progress value={progress} />
                </div>
              </div>

              <div className="mt-8 space-y-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                    {currentTourStep.eyebrow}
                  </p>
                  <h3 className="mt-2 text-2xl font-bold tracking-tight text-navy">
                    {currentTourStep.title}
                  </h3>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {currentTourStep.description}
                  </p>
                </div>

                <div className="grid gap-4">
                  {currentTourStep.items.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-outline-variant/40 bg-surface-container-low px-4 py-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <item.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">
                            {item.title}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {item.text}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {isLastStep ? (
                  <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-4 text-sm text-muted-foreground">
                    By finishing this onboarding, you confirm that you understand the
                    correct Pesatrix flow: finish onboarding, activate your account,
                    complete the full 7-day training, then start provider tasks.
                  </div>
                ) : null}
              </div>

              <div className="mt-8 flex gap-3">
                {step > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep((current) => current - 1)}
                    className="flex-1"
                  >
                    Back
                  </Button>
                ) : null}

                {isLastStep ? (
                  <Button
                    type="button"
                    onClick={handleFinish}
                    disabled={submitting}
                    className="flex-1"
                  >
                    {submitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Finish onboarding
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => setStep((current) => current + 1)}
                    className="flex-1"
                  >
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
