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
            A Multi-Level Earning Accelerator.
          </h2>
          <p className="mx-auto max-w-2xl text-base font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400">
            Every Pesatrix account comes with a personal referral code and link. When someone registers through your link and completes activation, you earn passive bonuses down three tiers.
          </p>
        </div>

        {/* 3-Level Visual Section */}
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          {/* Visual: Tree/Pyramid Style */}
          <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-zinc-950 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm relative min-h-[360px]">
            <h4 className="mb-8 text-center text-xs font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              3-Level Referral Matrix
            </h4>

            {/* Tree Connections (SVG Background) */}
            <svg className="absolute inset-0 h-full w-full pointer-events-none stroke-zinc-200 dark:stroke-zinc-800" strokeWidth="2.5" fill="none">
              {/* Lines from L1 to L2 */}
              <path d="M 280,120 L 160,200" className="stroke-emerald-500/30" />
              <path d="M 280,120 L 400,200" className="stroke-emerald-500/30" />
              {/* Lines from L2 Left to L3 */}
              <path d="M 160,200 L 90,285" className="stroke-emerald-500/20" />
              <path d="M 160,200 L 230,285" className="stroke-emerald-500/20" />
              {/* Lines from L2 Right to L3 */}
              <path d="M 400,200 L 330,285" className="stroke-emerald-500/20" />
              <path d="M 400,200 L 470,285" className="stroke-emerald-500/20" />
            </svg>

            {/* Tree Nodes */}
            <div className="relative w-full max-w-[560px] h-[300px]">
              
              {/* Level 1 (You -> Direct Referral) */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="absolute left-1/2 top-4 -translate-x-1/2 z-10 flex flex-col items-center"
              >
                <div className="rounded-xl border-2 border-emerald-500 bg-emerald-500 px-5 py-2.5 text-center text-white shadow-lg shadow-emerald-500/20">
                  <p className="text-[10px] font-black uppercase tracking-wider opacity-90">Level 1 (Direct)</p>
                  <p className="text-lg font-black tabular-nums">KSh 100</p>
                </div>
                <p className="mt-2 text-xs font-semibold text-zinc-400 dark:text-zinc-500">Per Activated User</p>
              </motion.div>

              {/* Level 2 (Indirect) */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 }}
                className="absolute left-[15%] top-40 z-10 flex flex-col items-center"
              >
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-center text-emerald-600 dark:text-emerald-400">
                  <p className="text-[9px] font-black uppercase tracking-wider">Level 2</p>
                  <p className="text-base font-black tabular-nums">KSh 50</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 }}
                className="absolute right-[15%] top-40 z-10 flex flex-col items-center"
              >
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-center text-emerald-600 dark:text-emerald-400">
                  <p className="text-[9px] font-black uppercase tracking-wider">Level 2</p>
                  <p className="text-base font-black tabular-nums">KSh 50</p>
                </div>
              </motion.div>

              {/* Level 3 (Indirect) */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="absolute left-[4%] top-[250px] z-10 flex flex-col items-center"
              >
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 px-3 py-1.5 text-center text-zinc-500 dark:text-zinc-400">
                  <p className="text-[8px] font-black uppercase tracking-wider">Level 3</p>
                  <p className="text-xs font-black tabular-nums">KSh 25</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="absolute left-[29%] top-[250px] z-10 flex flex-col items-center"
              >
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 px-3 py-1.5 text-center text-zinc-500 dark:text-zinc-400">
                  <p className="text-[8px] font-black uppercase tracking-wider">Level 3</p>
                  <p className="text-xs font-black tabular-nums">KSh 25</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="absolute right-[29%] top-[250px] z-10 flex flex-col items-center"
              >
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 px-3 py-1.5 text-center text-zinc-500 dark:text-zinc-400">
                  <p className="text-[8px] font-black uppercase tracking-wider">Level 3</p>
                  <p className="text-xs font-black tabular-nums">KSh 25</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="absolute right-[4%] top-[250px] z-10 flex flex-col items-center"
              >
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 px-3 py-1.5 text-center text-zinc-500 dark:text-zinc-400">
                  <p className="text-[8px] font-black uppercase tracking-wider">Level 3</p>
                  <p className="text-xs font-black tabular-nums">KSh 25</p>
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
