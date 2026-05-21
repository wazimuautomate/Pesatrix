"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  Phone,
  ShieldCheck,
  Smartphone,
  Users,
  Wallet,
} from "lucide-react";

import { ActivityFeed } from "@/components/activate/ActivityFeed";
import { SocialProofTicker } from "@/components/activate/SocialProofTicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ACTIVITY_FEED } from "@/lib/mockData/activityFeed";
import { formatKSh } from "@/lib/utils";

const schema = z.object({
  phone: z
    .string()
    .min(10, "Enter a valid phone number")
    .regex(/^(?:\+?254|0)[17]\d{8}$/, "Enter a valid Kenyan M-Pesa number"),
});

type FormData = z.infer<typeof schema>;

type ActivateClientPageProps = {
  activationFeeKsh: number;
  defaultPhone?: string;
  isLoggedIn: boolean;
  minimal?: boolean;
};

type Step = "form" | "pending" | "success";

const TESTIMONIALS = [
  {
    name: "Cynthia A.",
    location: "Nairobi",
    avatar: "C",
    text: "I was skeptical at first but the money hits M-Pesa for real. I recovered my membership in the first week.",
    earned: "KSh 1,200 earned",
  },
  {
    name: "James M.",
    location: "Mombasa",
    avatar: "J",
    text: "Referred 3 friends and got KSh 300 without doing anything extra. Simple.",
    earned: "KSh 850 earned",
  },
  {
    name: "Aisha K.",
    location: "Kisumu",
    avatar: "A",
    text: "Most tasks are light enough to finish between classes. I withdraw and use it for bundles and lunch.",
    earned: "KSh 650 earned",
  },
];

const PROOF_TICKER_ITEMS = [
  "2,400+ members already inside",
  "KSh 180,000+ already sent to M-Pesa",
  "Referral wins land at KSh 100 each",
  "New batches open daily across Kenya",
  "Students are cashing out from campus and home",
];

const FAQ_ITEMS = [
  {
    question: "Is this real money?",
    answer: "Yes. All payouts are via M-Pesa directly to your phone number. No points, no vouchers.",
  },
  {
    question: "Why the activation fee?",
    answer: "It verifies your account and keeps out bots, so real tasks go to real people like you.",
  },
  {
    question: "How quickly can I recover it?",
    answer: "Most members recover their membership within their first 5-7 tasks.",
  },
  {
    question: "What if there aren't enough tasks?",
    answer: "We add new task batches daily. You’re also earning KSh 100 for every friend you refer.",
  },
  {
    question: "Can I withdraw anytime?",
    answer: "Yes, once your balance reaches KSh 200.",
  },
];

export default function ActivateClientPage({
  activationFeeKsh,
  defaultPhone = "",
  isLoggedIn,
  minimal = false,
}: ActivateClientPageProps) {
  const activationFeeLabel = formatKSh(activationFeeKsh);
  const [step, setStep] = useState<Step>("form");
  const socialStats = useMemo(
    () => [
      { label: "Members", value: "2,400+" },
      { label: "Sent out", value: "KSh 180,000+" },
      { label: "Member rating", value: "4.8★" },
    ],
    []
  );

  const faqItems = FAQ_ITEMS;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      phone: defaultPhone,
    },
  });

  useEffect(() => {
    if (defaultPhone) {
      setValue("phone", defaultPhone);
    }
  }, [defaultPhone, setValue]);

  const scrollToActivationForm = () => {
    document.getElementById("activation-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  async function onSubmit(data: FormData) {
    setStep("pending");

    try {
      const res = await fetch("/api/payments/activation/stk-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: data.phone }),
      });

      const json = await res.json();

      if (!res.ok) {
        setStep("form");
        if (json.alreadyActivated) {
          toast.success("Account is already active");
          window.location.href = "/dashboard";
          return;
        }
        toast.error(json.error?.message || "Could not complete activation right now");
        return;
      }

      setStep("pending");
      toast.success(json.message || "Check your phone for the M-Pesa prompt");
    } catch {
      setStep("form");
      toast.error("Could not complete activation right now");
    }
  }

  const activationSection = (
    <section
      id="activation-form"
      className={minimal ? "" : "border-b border-outline-variant/20 bg-surface-container-low"}
    >
      <div className={minimal ? "mx-auto max-w-3xl" : "mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10"}>
        <div className="max-w-2xl">
          <h2 className="mt-3 text-3xl font-bold text-navy">Join others already earning</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
            A one-time membership of {activationFeeLabel} unlocks your full earning account. This covers your account verification
            and guarantees your spot in the task queue.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-outline-variant/40 bg-white px-5 py-6 shadow-sm sm:px-6">
          {isLoggedIn ? (
            step === "success" ? (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal/10">
                  <CheckCircle2 className="h-8 w-8 text-teal" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-navy">Your earning access is ready</p>
                  <p className="mt-1 text-sm text-muted-foreground">Redirecting you to your dashboard now.</p>
                </div>
              </div>
            ) : step === "pending" ? (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-pesatrix-blue/10">
                  <Loader2 className="h-8 w-8 animate-spin text-pesatrix-blue" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-navy">Check your phone</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Confirm the M-Pesa prompt to finish activating your account. This page will stay pending until Safaricom confirms the payment.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="activate-phone">M-Pesa phone number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="activate-phone"
                      className="pl-10"
                      placeholder="07XX XXX XXX"
                      {...register("phone")}
                    />
                  </div>
                  {errors.phone ? <p className="text-xs text-destructive">{errors.phone.message}</p> : null}
                </div>

                <p className="text-xs text-muted-foreground">
                  We&apos;ll send an M-Pesa prompt to this number so you can complete your one-time membership.
                </p>

                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Reserve my spot with M-Pesa
                </Button>
              </form>
            )
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Create your account first so we can attach your task queue, M-Pesa number, and referrals correctly.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild className="w-full sm:w-auto">
                  <Link href="/register">Create account first</Link>
                </Button>
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link href="/login">I already have an account</Link>
                </Button>
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-teal" />
              Secured by M-Pesa
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-pesatrix-blue" />
              Account stays open for withdrawals
            </div>
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-600" />
              7-day earnings protection on payouts
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  if (minimal) {
    return <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">{activationSection}</div>;
  }

  return (
    <div className="relative left-1/2 right-1/2 w-screen -translate-x-1/2 overflow-x-hidden">
      <section className="border-b border-outline-variant/20 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full border border-teal/20 bg-teal/10 px-3 py-1 text-xs font-semibold text-teal">
              Verified Kenyan Earning Platform
            </div>
            <h1 className="mt-5 text-4xl font-bold leading-tight text-navy sm:text-5xl">
              Your phone is worth more than you think
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Join thousands of Kenyans earning real M-Pesa money by completing simple tasks from their phone.
            </p>
            <div className="mt-6">
              <Button size="lg" className="w-full sm:w-auto" onClick={scrollToActivationForm}>
                Start Earning Today
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <div className="mt-5">
              <SocialProofTicker items={PROOF_TICKER_ITEMS} />
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-outline-variant/20 bg-surface-container-low">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Happening right now</p>
          <div className="mt-4">
            <ActivityFeed items={ACTIVITY_FEED} />
          </div>
        </div>
      </section>

      <section className="border-b border-outline-variant/20 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
            <InfoCard
              icon={Smartphone}
              title="Simple phone tasks"
              description="Answer surveys, label images, verify information. No skills needed."
            />
            <InfoCard
              icon={Clock3}
              title="Work when you want"
              description="No schedules. Open the app, grab a task, earn."
            />
            <InfoCard
              icon={Wallet}
              title="Instant M-Pesa payouts"
              description="Earnings go straight to your M-Pesa. Minimum KSh 200."
            />
          </div>
        </div>
      </section>

      <section className="border-b border-outline-variant/20 bg-surface-container-low">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="grid gap-4 sm:grid-cols-3">
            {socialStats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-outline-variant/40 bg-white px-4 py-5 text-center shadow-sm">
                <p className="text-2xl font-bold text-navy">{stat.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-outline-variant/20 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
            {TESTIMONIALS.map((testimonial) => (
              <div
                key={testimonial.name}
                className="min-w-[280px] max-w-sm rounded-2xl border border-outline-variant/40 bg-surface-container-low px-4 py-5 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pesatrix-blue/10 font-semibold text-pesatrix-blue">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-semibold text-navy">{testimonial.name}</p>
                    <p className="text-xs text-muted-foreground">{testimonial.location}</p>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-on-surface-variant">{testimonial.text}</p>
                <p className="mt-4 text-sm font-semibold text-emerald-600">{testimonial.earned}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {activationSection}

      <section className="bg-white">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
          <h2 className="text-2xl font-bold text-navy">Questions people ask before joining</h2>
          <div className="mt-5 space-y-3">
            {faqItems.map((item) => (
              <details key={item.question} className="rounded-2xl border border-outline-variant/40 bg-surface-container-low px-4 py-3">
                <summary className="cursor-pointer list-none font-semibold text-navy">{item.question}</summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Smartphone;
  title: string;
  description: string;
}) {
  return (
    <div className="min-w-[240px] flex-1 rounded-2xl border border-outline-variant/40 bg-surface-container-low px-4 py-5 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pesatrix-blue/10 text-pesatrix-blue">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-navy">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
