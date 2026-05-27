"use client";

import { motion } from "framer-motion";
import { 
  UserPlus, 
  MailCheck, 
  Compass, 
  Smartphone, 
  GraduationCap, 
  Unlock, 
  FileCheck, 
  Coins 
} from "lucide-react";

export function HowItWorks() {
  const steps = [
    {
      number: 1,
      title: "Create Your Account",
      body: "Register with your full name, Kenyan phone number, county, email address, and password. An optional referral code can be entered here if someone invited you.",
      icon: UserPlus,
    },
    {
      number: 2,
      title: "Confirm Email & Sign In",
      body: "Verify your email to protect your account and confirm your identity. Then sign in.",
      icon: MailCheck,
    },
    {
      number: 3,
      title: "Complete Onboarding",
      body: "A guided walkthrough shows you the dashboard: Tasks, Wallet, Referrals, Training, Support, and Rewards. You'll understand the full earning path before spending anything.",
      icon: Compass,
    },
    {
      number: 4,
      title: "Activate via M-Pesa",
      body: "A one-time M-Pesa STK Push activates your account. This unlocks training, tasks, wallet activity, referrals, and withdrawals. The payment is tracked, receipt-verified, and tied to your account — no manual transfers.",
      icon: Smartphone,
    },
    {
      number: 5,
      title: "Complete the 7-Day Training",
      body: "Pesatrix trains you before you work. The program covers survey integrity, data labeling, content tasks, AI evaluation, and quality review standards. You must pass stage checks to proceed.",
      icon: GraduationCap,
    },
    {
      number: 6,
      title: "Unlock Tasks",
      body: "After training, your task access unlocks. A short preparation window may apply. A successful referral can reduce this wait.",
      icon: Unlock,
    },
    {
      number: 7,
      title: "Work & Submit Proof",
      body: "Browse active tasks. Each task shows: payout (KSh), category, difficulty, slots remaining, instructions, and proof requirements. Submit your work — answers, screenshots, URLs, or written content depending on the task.",
      icon: FileCheck,
    },
    {
      number: 8,
      title: "Get Paid to M-Pesa",
      body: "Approved work credits your wallet. Pending balances clear after a hold period. When eligible, request withdrawal to your M-Pesa number directly from the dashboard.",
      icon: Coins,
    },
  ];

  return (
    <section className="relative overflow-hidden bg-white py-20 px-6 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl space-y-16">
        {/* Section Header */}
        <div className="text-center space-y-4">
          <p className="text-xs sm:text-sm font-black tracking-widest text-emerald-500 uppercase">
            How Pesatrix Works
          </p>
          <h2 className="text-3xl font-extrabold tracking-tight text-navy dark:text-zinc-100 sm:text-4xl">
            Eight steps from zero to your first M-Pesa withdrawal.
          </h2>
        </div>

        {/* Stepper container */}
        <div className="relative pt-6">
          {/* Vertical central connector line (Desktop only) */}
          <div className="absolute left-[20px] top-6 bottom-6 hidden w-0.5 bg-emerald-500/20 md:left-1/2 md:block -translate-x-1/2" />

          <div className="space-y-12">
            {steps.map((step, index) => {
              const StepIcon = step.icon;
              const isEven = index % 2 === 0;

              return (
                <div 
                  key={index} 
                  className={`relative flex flex-col md:flex-row items-start ${
                    isEven ? "md:flex-row-reverse" : ""
                  }`}
                >
                  {/* Step Connector Line for Mobile */}
                  {index < steps.length - 1 && (
                    <div className="absolute left-[20px] top-10 bottom-[-48px] w-0.5 bg-emerald-500/20 md:hidden" />
                  )}

                  {/* Circle number element */}
                  <div className="absolute left-0 md:left-1/2 top-0 flex items-center justify-center md:-translate-x-1/2">
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white font-bold text-base shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                      {step.number}
                    </div>
                  </div>

                  {/* Content card */}
                  <motion.div
                    initial={{ opacity: 0, x: isEven ? 40 : -40 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={{ duration: 0.5, type: "spring", stiffness: 100, damping: 18 }}
                    className={`w-full md:w-[45%] pl-14 md:pl-0 ${
                      isEven ? "md:pr-10 text-left md:text-right" : "md:pl-10 text-left"
                    }`}
                  >
                    <div className={`inline-flex rounded-xl bg-zinc-50 p-6 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm flex-col ${
                      isEven ? "md:items-end" : "items-start"
                    }`}>
                      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-400">
                        <StepIcon className="h-5 w-5" strokeWidth={2.2} />
                      </div>
                      <h3 className="mb-2 text-lg font-bold text-navy dark:text-zinc-100">
                        Step {step.number} — {step.title}
                      </h3>
                      <p className="text-sm font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
                        {step.body}
                      </p>
                    </div>
                  </motion.div>
                  
                  {/* Empty spacer block for desktop symmetry */}
                  <div className="hidden md:block w-[45%]" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
