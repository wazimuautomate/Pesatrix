"use client";

import Link from "next/link";
import { motion } from "framer-motion";

interface FinalCTAProps {
  refCode?: string | null;
}

export function FinalCTA({ refCode }: FinalCTAProps) {
  const registerHref = refCode ? `/register?ref=${encodeURIComponent(refCode)}` : "/register";
  const loginHref = refCode ? `/login?ref=${encodeURIComponent(refCode)}` : "/login";

  return (
    <section className="relative overflow-hidden bg-zinc-50 py-24 px-6 text-center dark:bg-zinc-900 border-t border-zinc-200/50 dark:border-zinc-800/50">
      {/* Subtle emerald radial gradient background (inverted relative to Hero) */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_bottom,rgba(16,185,129,0.06)_0%,rgba(255,255,255,0)_70%)] dark:bg-[radial-gradient(circle_at_bottom,rgba(16,185,129,0.08)_0%,rgba(0,0,0,0)_70%)]" />

      <div className="mx-auto max-w-4xl space-y-8">
        <motion.h2
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-4xl font-extrabold tracking-tight text-navy dark:text-zinc-100 sm:text-5xl"
        >
          Your earning journey starts with one account.
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mx-auto max-w-2xl text-base font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400 sm:text-lg"
        >
          Register free, activate via M-Pesa, complete training, and start earning from real digital tasks. Your wallet, your tasks, your referrals — all in one place.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-col items-center justify-center gap-4 pt-4"
        >
          <Link
            href={registerHref}
            className="flex h-14 w-full items-center justify-center rounded-xl bg-emerald-500 text-lg font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-600 hover:scale-[1.02] active:scale-[0.98] sm:w-auto sm:px-10"
          >
            Create My Account →
          </Link>
          <Link
            href={loginHref}
            className="text-sm font-semibold text-zinc-500 hover:text-emerald-500 dark:text-zinc-400 dark:hover:text-emerald-400 transition-colors"
          >
            Already have an account? Sign in
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
