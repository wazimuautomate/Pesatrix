"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  ClipboardList,
  Gift,
  Headphones,
  Loader2,
  UserCircle2,
  Users,
  Wallet,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  LayoutDashboard,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

const onboardingSchema = z.object({
  acceptTerms: z.boolean().refine((value) => value === true, {
    message: "You must confirm before continuing",
  }),
});

type OnboardingForm = z.infer<typeof onboardingSchema>;

type OnboardingPageClientProps = {
  fullName: string;
  county: string;
};

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
}

const STEPS: OnboardingStep[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    description: "Track your account status, balances, recent activity, and daily streaks.",
    icon: LayoutDashboard,
  },
  {
    id: "tasks",
    title: "Tasks",
    description: "Browse available work and understand the rules before you start real provider tasks.",
    icon: ClipboardList,
  },
  {
    id: "rewards",
    title: "Rewards",
    description: "Use daily engagement features like the reward wheel after your account is ready.",
    icon: Gift,
  },
  {
    id: "profile",
    title: "Profile",
    description: "Manage your personal details, phone number, and payout identity.",
    icon: UserCircle2,
  },
  {
    id: "training",
    title: "Training",
    description: "Complete the staged learning path before you begin protected work categories.",
    icon: BookOpen,
  },
  {
    id: "wallet",
    title: "Wallet",
    description: "Review earnings, activation payments, and future withdrawals in one place.",
    icon: Wallet,
  },
  {
    id: "support",
    title: "Support",
    description: "Open tickets when you need account, payment, or task assistance.",
    icon: Headphones,
  },
  {
    id: "referrals",
    title: "Referrals",
    description: "Share your code, monitor pending referrals, and track referral rewards.",
    icon: Users,
  },
];

export function OnboardingPageClient({ fullName, county }: OnboardingPageClientProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(0);
  const [isLastStepReached, setIsLastStepReached] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingForm>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      acceptTerms: false,
    },
  });

  const acceptTerms = watch("acceptTerms");

  async function onSubmit(values: OnboardingForm) {
    try {
      const response = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...values,
          ...(fullName.trim() ? { fullName } : {}),
          ...(county.trim() ? { county } : {}),
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? "Unable to complete onboarding.");
        return;
      }

      toast.success("Onboarding completed. Proceed to activation.");
      window.location.assign("/dashboard");
    } catch {
      toast.error("Unable to complete onboarding right now.");
    }
  }

  const nextStep = () => {
    if (currentStep < STEPS.length - 1) {
      setDirection(1);
      setCurrentStep((s) => s + 1);
    } else {
      setIsLastStepReached(true);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setDirection(-1);
      setCurrentStep((s) => s - 1);
    }
  };

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      zIndex: 0,
      x: dir < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  if (isLastStepReached) {
    return (
      <div className="min-h-screen bg-surface-container-low flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-2xl bg-white border border-outline-variant/40 rounded-2xl shadow-xl p-8 md:p-12 space-y-8"
        >
          <div className="space-y-4 text-center">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-navy">
              Complete onboarding
            </h1>
            <p className="text-muted-foreground text-lg">
              You're almost there! Please confirm your understanding to proceed to the dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div
              className={`flex items-start gap-4 p-6 rounded-xl border-2 transition-all cursor-pointer select-none ${
                acceptTerms
                  ? "bg-primary/5 border-primary shadow-sm"
                  : "bg-surface-container-low border-transparent hover:border-outline-variant"
              }`}
            >
              <label className="mt-1 flex-shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only"
                  {...register("acceptTerms")}
                />
                <CheckCircle2
                  className={`w-6 h-6 transition-colors ${
                    acceptTerms
                      ? "text-primary fill-primary text-white"
                      : "text-muted-foreground"
                  }`}
                />
              </label>
              <p className="text-sm md:text-base font-medium leading-relaxed text-on-surface">
                I understand the dashboard flow: onboarding first, activation next, then training and approved task work after compliance checks.
              </p>
            </div>
            {errors.acceptTerms ? (
              <p className="mt-2 text-xs text-destructive">{errors.acceptTerms.message}</p>
            ) : null}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full mt-6 py-4 px-8 rounded-xl font-semibold text-lg transition-all hover:bg-primary/90"
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : null}
              Continue to Dashboard
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setIsLastStepReached(false)}
            className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Back to overview
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-container-low flex flex-col items-center justify-center p-6 sm:p-12">
      <div className="w-full max-w-4xl flex flex-col items-center space-y-12">
        <header className="text-center space-y-4 max-w-2xl">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold tracking-tight text-navy"
          >
            Welcome to <span className="text-pesatrix-blue">Pesatrix</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground text-lg leading-relaxed"
          >
            Before you activate your account, finish this onboarding so you understand every dashboard section and the required earning sequence.
          </motion.p>
        </header>

        <div className="relative w-full flex items-center justify-center min-h-[320px]">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentStep}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 },
              }}
              className="absolute w-full max-w-md"
            >
              <div className="bg-white border border-outline-variant/40 rounded-3xl shadow-2xl p-10 flex flex-col items-center text-center space-y-6">
                <div className="w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center mb-2">
                  {(() => {
                    const Icon = STEPS[currentStep].icon;
                    return <Icon className="w-8 h-8 text-pesatrix-blue" />;
                  })()}
                </div>
                <div className="space-y-3">
                  <h3 className="text-2xl font-bold text-navy">{STEPS[currentStep].title}</h3>
                  <p className="text-muted-foreground text-lg leading-relaxed">
                    {STEPS[currentStep].description}
                  </p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="absolute -bottom-24 sm:static sm:contents">
            <button
              type="button"
              onClick={prevStep}
              disabled={currentStep === 0}
              className={`p-4 rounded-full border border-outline-variant bg-white shadow-sm transition-all sm:absolute sm:left-4 md:-left-12 ${
                currentStep === 0
                  ? "opacity-20 cursor-not-allowed"
                  : "hover:bg-surface-container-low cursor-pointer"
              }`}
              aria-label="Previous step"
            >
              <ChevronLeft className="w-6 h-6 text-navy" />
            </button>
            <button
              type="button"
              onClick={nextStep}
              className="p-4 rounded-full bg-pesatrix-blue text-white shadow-lg shadow-pesatrix-blue/20 transition-all sm:absolute sm:right-4 md:-right-12 hover:bg-pesatrix-blue/90"
              aria-label="Next step"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>

        <footer className="w-full flex flex-col items-center space-y-6 pt-12 sm:pt-4">
          <div className="flex gap-2">
            {STEPS.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentStep ? "w-8 bg-pesatrix-blue" : "w-2 bg-outline-variant"
                }`}
              />
            ))}
          </div>
          <p className="text-sm font-medium text-muted-foreground tabular-nums">
            Step {currentStep + 1} of {STEPS.length}
          </p>
        </footer>
      </div>
    </div>
  );
}