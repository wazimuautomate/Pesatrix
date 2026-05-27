"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ShieldCheck, GraduationCap, CheckCircle2 } from "lucide-react";

interface HeroSectionProps {
  refCode?: string | null;
}

export function HeroSection({ refCode }: HeroSectionProps) {
  const registerHref = refCode ? `/register?ref=${encodeURIComponent(refCode)}` : "/register";

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-white text-navy px-6 py-20 text-center dark:bg-zinc-950 dark:text-zinc-100">
      {/* Subtle emerald radial gradient background */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.06)_0%,rgba(255,255,255,0)_70%)] dark:bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.08)_0%,rgba(0,0,0,0)_70%)]" />

      <div className="mx-auto w-full max-w-4xl space-y-8">
        {/* Trust Badges */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> M-Pesa Payments
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-4 w-4" /> Real Task Review
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            <GraduationCap className="h-4 w-4" /> 7-Day Training Included
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="font-display text-4xl font-extrabold tracking-tight text-navy sm:text-6xl lg:text-7xl dark:text-zinc-100"
        >
          Stop Guessing Which <br className="hidden sm:inline" />
          <span className="text-emerald-500 dark:text-emerald-400">Earning Sites Are Real.</span>
        </motion.h1>

        {/* Sub-headline */}
        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mx-auto max-w-2xl text-lg font-medium leading-relaxed text-zinc-600 dark:text-zinc-400 sm:text-xl"
        >
          Pesatrix is a Kenya-built platform where you complete digital tasks, track your wallet clearly, and withdraw approved earnings straight to M-Pesa.
        </motion.p>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45 }}
          className="flex flex-col items-center justify-center gap-4 pt-4"
        >
          <Link
            href={registerHref}
            className="flex h-14 w-full items-center justify-center rounded-xl bg-emerald-500 text-lg font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-600 hover:scale-[1.02] active:scale-[0.98] sm:w-auto sm:px-10"
          >
            Create Free Account →
          </Link>
          <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
            One-time activation via M-Pesa. No hidden charges.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
