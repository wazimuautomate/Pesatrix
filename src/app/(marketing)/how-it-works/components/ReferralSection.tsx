"use client";

import { motion } from "framer-motion";
import { Users, Link, CheckSquare, Award } from "lucide-react";

export function ReferralSection() {
  const dashboardFeatures = [
    "Your unique referral link and referral code",
    "How many people joined through your link",
    "Who has activated their account",
    "Your pending referral earnings under hold",
    "Your available referral earnings ready to withdraw",
    "Comprehensive bonus history with amounts and status",
  ];

  return (
    <section className="bg-zinc-50 py-20 px-6 dark:bg-zinc-900 border-y border-zinc-200/50 dark:border-zinc-800/50">
      <div className="mx-auto max-w-6xl space-y-16">
        {/* Section Header */}
        <div className="text-center space-y-4">
          <p className="text-xs sm:text-sm font-black tracking-widest text-emerald-500 uppercase">
            Invite People. Earn When They Activate.
          </p>
          <h2 className="text-3xl font-extrabold tracking-tight text-navy dark:text-zinc-100 sm:text-4xl">
            Direct Earning Made Simple.
          </h2>
          <p className="mx-auto max-w-2xl text-base font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400">
            Every Pesatrix account comes with a personal referral code and link. When someone registers through your link and completes activation, you earn a flat, direct referral bonus of KSh 100 — simple, clear, and high-paying. We do not do multi-tier referrals. You refer a person, they activate, you earn KSh 100.
          </p>
        </div>

        {/* Direct Referral Visual Section */}
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          {/* Visual: Direct 1-Level Referral Flow */}
          <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative min-h-[380px]">
            <h4 className="mb-4 text-center text-xs font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              Direct 1-Level Referral Flow
            </h4>

            <div className="flex flex-col items-center justify-between h-[280px] w-full relative z-10 py-4">
              {/* Node 1: Your Account */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="z-10"
              >
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-6 py-4 text-center text-navy dark:text-zinc-100 shadow-sm flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Step 1</p>
                    <p className="text-sm font-black text-navy dark:text-zinc-200">Your Account</p>
                  </div>
                </div>
              </motion.div>

              {/* Connector Arrow with reward badge */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div className="h-32 w-0.5 border-l-2 border-dashed border-emerald-500/50" />
                <div className="absolute z-20">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 }}
                    className="rounded-full border-2 border-emerald-500 bg-emerald-500 px-5 py-2.5 text-center text-white shadow-xl shadow-emerald-500/30 font-black text-base flex flex-col items-center justify-center min-w-[120px]"
                  >
                    <span className="text-[9px] font-extrabold uppercase tracking-widest opacity-80 leading-none">Earnings</span>
                    <span className="text-lg font-black leading-none mt-1">KSh 100</span>
                  </motion.div>
                </div>
              </div>

              {/* Node 2: Referred Friend */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="z-10"
              >
                <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-500 px-6 py-4 text-center text-white shadow-xl shadow-emerald-500/20 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-white/20 text-white flex items-center justify-center">
                    <Link className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] font-black uppercase tracking-wider opacity-80 leading-none">Step 2</p>
                    <p className="text-sm font-black mt-1">Activated Referral</p>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Text: Features of the dashboard */}
          <div className="space-y-6">
            <div>
              <h3 className="text-2xl font-bold text-navy dark:text-zinc-100 mb-2">
                Your Referral Dashboard Shows:
              </h3>
              <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                You receive full transparency over your affiliate network directly in your portal.
              </p>
            </div>

            <ul className="space-y-3">
              {dashboardFeatures.map((feat, index) => (
                <li key={index} className="flex items-center gap-3">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20">
                    <CheckSquare className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                    {feat}
                  </span>
                </li>
              ))}
            </ul>

            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400 border-l-4 border-l-emerald-500">
              <p className="font-bold text-navy dark:text-zinc-200 mb-1">Fraud Detection Enforced</p>
              Referral bonuses are protected by fraud checks. Fake signups and duplicate device patterns are detected and blocked — protecting serious users who build real referral networks.
            </div>

            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
              Your referral link is waiting inside your dashboard.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
