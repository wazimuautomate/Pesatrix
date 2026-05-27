"use client";

import { motion } from "framer-motion";
import { Shield, Wallet, GraduationCap } from "lucide-react";

export function WhatIsPesatrix() {
  const cards = [
    {
      icon: Shield,
      title: "Verified Platform",
      body: "Built with real payment rails — M-Pesa STK Push for activation, B2C for withdrawals. Not a group chat promise.",
    },
    {
      icon: Wallet,
      title: "Clear Wallet Tracking",
      body: "Pending and available balances shown separately. You always know where your money is and when it clears.",
    },
    {
      icon: GraduationCap,
      title: "Training Before Tasks",
      body: "You complete a 7-day training program before working. This is why our users submit better work and earn more consistently.",
    },
  ];

  const containerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.15,
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring" as const,
        stiffness: 100,
        damping: 15,
      },
    },
  };

  return (
    <section className="bg-zinc-50 py-20 px-6 dark:bg-zinc-900 border-y border-zinc-200/50 dark:border-zinc-800/50">
      <div className="mx-auto max-w-6xl space-y-12">
        {/* Section Header */}
        <div className="text-center space-y-4">
          <p className="text-xs sm:text-sm font-black tracking-widest text-emerald-500 uppercase">
            What Is Pesatrix?
          </p>
          <div className="mx-auto max-w-2xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400 space-y-4 font-medium">
            <p>
              Pesatrix is an online work and earnings platform built specifically for Kenyans. You create an account, activate it through M-Pesa, complete a 7-day training program, then unlock real digital tasks.
            </p>
            <p>
              When your submitted work is approved, your wallet is credited. When your balance is eligible, you withdraw to M-Pesa. That's the entire flow — and every step is visible on your dashboard.
            </p>
          </div>
        </div>

        {/* 3 Highlight Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="grid gap-6 sm:grid-cols-3 pt-6"
        >
          {cards.map((card, index) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={index}
                variants={cardVariants}
                className="flex flex-col rounded-2xl border border-zinc-200/60 bg-white p-8 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-400">
                  <Icon className="h-6 w-6" strokeWidth={2.2} />
                </div>
                <h3 className="mb-3 text-lg font-bold text-navy dark:text-zinc-100">
                  {card.title}
                </h3>
                <p className="text-sm font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {card.body}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
