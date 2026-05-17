"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  BookOpen,
  ClipboardList,
  Gift,
  Headphones,
  Loader2,
  UserCircle2,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

const dashboardSections = [
  {
    title: "Dashboard",
    description: "Track your account status, balances, recent activity, and daily streaks.",
    icon: ClipboardList,
  },
  {
    title: "Tasks",
    description: "Browse available work and understand the rules before you start real provider tasks.",
    icon: ClipboardList,
  },
  {
    title: "Rewards",
    description: "Use daily engagement features like the reward wheel after your account is ready.",
    icon: Gift,
  },
  {
    title: "Profile",
    description: "Manage your personal details, phone number, and payout identity.",
    icon: UserCircle2,
  },
  {
    title: "Training",
    description: "Complete the staged learning path before you begin protected work categories.",
    icon: BookOpen,
  },
  {
    title: "Wallet",
    description: "Review earnings, activation payments, and future withdrawals in one place.",
    icon: Wallet,
  },
  {
    title: "Support",
    description: "Open tickets when you need account, payment, or task assistance.",
    icon: Headphones,
  },
  {
    title: "Referrals",
    description: "Share your code, monitor pending referrals, and track referral rewards.",
    icon: Users,
  },
];

export function OnboardingPageClient({ fullName, county }: OnboardingPageClientProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingForm>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      acceptTerms: false,
    },
  });

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

  return (
    <div className="min-h-screen bg-surface-container-low px-4 py-8">
      <main className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-navy">
            Welcome to Pesatrix
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Before you activate your account, finish this onboarding so you understand
            every dashboard section and the required earning sequence.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {dashboardSections.map((section) => {
            const Icon = section.icon;

            return (
              <Card key={section.title} className="border-outline-variant/40">
                <CardHeader className="pb-3">
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base text-navy">{section.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{section.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="border-outline-variant/40">
          <CardHeader>
            <CardTitle className="text-xl text-navy">Complete onboarding</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="rounded-md border border-outline-variant/40 bg-surface-container-low p-4">
                <label className="flex items-start gap-3 text-sm text-foreground">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-input"
                    {...register("acceptTerms")}
                  />
                  <span>
                    I understand the dashboard flow: onboarding first, activation next,
                    then training and approved task work after compliance checks.
                  </span>
                </label>
                {errors.acceptTerms ? (
                  <p className="mt-2 text-xs text-destructive">
                    {errors.acceptTerms.message}
                  </p>
                ) : null}
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Continue to Dashboard
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
