"use client";

import { motion } from "framer-motion";
import { Check, X } from "lucide-react";

export function WhoIsItFor() {
  const goodFit = [
    "Want extra income online with clear, structured steps",
    "Are comfortable with a phone, internet, and basic instructions",
    "Prefer M-Pesa as their payment method",
    "Can follow task instructions carefully and submit quality work",
    "Are students, young professionals, or anyone with consistent internet access",
    "Want to build referral income by sharing with their network",
    "Are tired of earning sites that never explain what's actually going on",
  ];

  const notForYou = [
    "Want guaranteed income without effort",
    "Plan to submit low-quality or copied work",
    "Are looking for instant payment with no process",
  ];

  return (
    <section className="bg-zinc-50 py-20 px-6 dark:bg-zinc-900 border-y border-zinc-200/50 dark:border-zinc-800/50">
      <div className="mx-auto max-w-6xl space-y-12">
        {/* Section Header */}
        <div className="text-center space-y-4">
          <p className="text-xs sm:text-sm font-black tracking-widest text-emerald-500 uppercase">
            Is Pesatrix For You?
          </p>
          <h2 className="text-3xl font-extrabold tracking-tight text-navy dark:text-zinc-100 sm:text-4xl">
            Let's Keep It Honest.
          </h2>
          <p className="mx-auto max-w-xl text-base font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400">
            Pesatrix is built to be a high-integrity, quality-driven platform. Here is exactly who thrives here—and who should skip it.
          </p>
        </div>

        {/* Two Columns Grid */}
        <div className="grid gap-8 md:grid-cols-2 pt-4">
          {/* Good Fit Column */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-emerald-500/20 bg-white p-8 shadow-sm dark:border-emerald-500/10 dark:bg-zinc-950"
          >
            <h3 className="mb-6 flex items-center gap-2.5 text-xl font-black text-emerald-600 dark:text-emerald-400">
              <Check className="h-6 w-6" strokeWidth={3} /> Good Fit
            </h3>
            <ul className="space-y-4">
              {goodFit.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div className="mt-1 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-400">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </div>
                  <span className="text-sm font-semibold leading-relaxed text-zinc-600 dark:text-zinc-300">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Not For You Column */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <h3 className="mb-6 flex items-center gap-2.5 text-xl font-black text-zinc-500 dark:text-zinc-400">
              <X className="h-6 w-6" strokeWidth={3} /> Not For You
            </h3>
            <ul className="space-y-4">
              {notForYou.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <div className="mt-1 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    <X className="h-3 w-3" strokeWidth={3} />
                  </div>
                  <span className="text-sm font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
