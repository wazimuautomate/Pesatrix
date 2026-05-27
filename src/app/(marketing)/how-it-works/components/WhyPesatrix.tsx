"use client";

import { motion } from "framer-motion";
import { X, Check } from "lucide-react";

export function WhyPesatrix() {
  const comparisons = [
    {
      others: "Throw you into tasks with no preparation",
      pesatrix: "7-day structured training before any live task access",
    },
    {
      others: "Vague payment status — no one explains when you get paid",
      pesatrix: "Wallet split into Pending and Available with full transaction history",
    },
    {
      others: "Manual payments, unclear timelines, admin DMs",
      pesatrix: "M-Pesa STK Push for activation. M-Pesa B2C API for withdrawals. Automated.",
    },
    {
      others: "No accountability for rejected work",
      pesatrix: "Every submission is reviewed — AI-assisted or manual. Outcome shown in your dashboard.",
    },
    {
      others: "Referral promises with no tracking",
      pesatrix: "Real referral dashboard. Amounts, status, pipeline, bonus history.",
    },
    {
      others: "Support is a WhatsApp number you may never reach",
      pesatrix: "In-dashboard support tickets tied to your account, task, and payment history",
    },
  ];

  return (
    <section className="bg-white py-20 px-6 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl space-y-12">
        {/* Section Header */}
        <div className="text-center space-y-4">
          <p className="text-xs sm:text-sm font-black tracking-widest text-emerald-500 uppercase">
            Why Pesatrix Is Different
          </p>
          <h2 className="text-3xl font-extrabold tracking-tight text-navy dark:text-zinc-100 sm:text-4xl">
            A Platform Built On Accountability.
          </h2>
        </div>

        {/* 6 Comparison Cards Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {comparisons.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              {/* Others row */}
              <div className="flex items-start gap-2.5 pb-3 border-b border-zinc-200/50 dark:border-zinc-800/80">
                <div className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  <X className="h-3 w-3" strokeWidth={3} />
                </div>
                <div className="text-zinc-500 text-sm font-semibold leading-relaxed line-through">
                  <span className="text-xs font-bold uppercase tracking-wider block text-zinc-400 dark:text-zinc-500 mb-0.5">Typical Platforms</span>
                  {item.others}
                </div>
              </div>

              {/* Pesatrix row */}
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-400">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </div>
                <div className="text-emerald-600 dark:text-emerald-400 font-bold leading-relaxed text-sm">
                  <span className="text-xs font-black uppercase tracking-wider block text-emerald-500/80 dark:text-emerald-400/80 mb-0.5">Pesatrix Advantage</span>
                  {item.pesatrix}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
