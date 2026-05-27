"use client";

import { motion } from "framer-motion";
import { 
  Wallet as WalletIcon, 
  Clock, 
  ArrowUpRight, 
  ArrowRight, 
  Coins, 
  Download, 
  CheckCircle2,
  FileCheck2
} from "lucide-react";

export function WalletSection() {
  const transactions = [
    {
      description: "Direct Referral Bonus (Level 1)",
      type: "Referral",
      amount: "KSh 100.00",
      status: "Available",
      date: "May 27, 2026",
      statusColor: "text-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/20",
    },
    {
      description: "Survey Earning — Brands & Ads Integrity",
      type: "Task",
      amount: "KSh 200.00",
      status: "Pending",
      date: "May 26, 2026",
      statusColor: "text-amber-500 bg-amber-500/10 dark:bg-amber-500/20",
    },
    {
      description: "M-Pesa Withdrawal Request",
      type: "Payout",
      amount: "-KSh 500.00",
      status: "Approved",
      date: "May 25, 2026",
      statusColor: "text-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/20",
    },
  ];

  return (
    <section className="bg-white py-20 px-6 dark:bg-zinc-950">
      <div className="mx-auto max-w-6xl space-y-16">
        {/* Section Header */}
        <div className="text-center space-y-4">
          <p className="text-xs sm:text-sm font-black tracking-widest text-emerald-500 uppercase">
            Your Wallet. No Guessing.
          </p>
          <h2 className="text-3xl font-extrabold tracking-tight text-navy dark:text-zinc-100 sm:text-4xl">
            Every earning platform has a wallet. Most make it confusing. Pesatrix doesn't.
          </h2>
          <p className="mx-auto max-w-2xl text-base font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400">
            Your Pesatrix wallet shows four things at all times: Available Balance, Pending Balance, Total Earned, and a full Transaction History.
          </p>
        </div>

        {/* 2 Column Details + Mock UI */}
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          {/* Text descriptions */}
          <div className="space-y-6">
            <div className="space-y-4 text-zinc-600 dark:text-zinc-400 font-medium">
              <p>
                When you earn from a task, it enters as <strong className="text-navy dark:text-white">Pending</strong>. After the hold period clears (to prevent fraud), it moves directly to <strong className="text-emerald-500">Available</strong>.
              </p>
              <p>
                From <strong className="text-emerald-500">Available</strong>, you request withdrawal to your M-Pesa number directly.
              </p>
              <p className="font-bold text-navy dark:text-zinc-100">
                You will always know where your money is.
              </p>
            </div>

            {/* List */}
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-bold text-navy dark:text-zinc-200">Available Balance</h4>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Money you can request for withdrawal right now.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-bold text-navy dark:text-zinc-200">Pending Balance</h4>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Approved or incoming earnings still in the hold period.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20">
                  <ArrowUpRight className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-bold text-navy dark:text-zinc-200">Total Earned</h4>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Your lifetime earnings on the platform.</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Premium Mock Wallet UI Block */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
          >
            {/* Header */}
            <div className="mb-6 flex items-center justify-between border-b border-zinc-200/60 pb-4 dark:border-zinc-800/80">
              <div>
                <h3 className="text-lg font-black text-navy dark:text-zinc-100">My Pesatrix Wallet</h3>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">KSh Payments Ledger</p>
              </div>
              <WalletIcon className="h-6 w-6 text-emerald-500" />
            </div>

            {/* Balance Cards Grid */}
            <div className="grid gap-4 sm:grid-cols-3 mb-6">
              {/* Available */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 dark:bg-emerald-500/10">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <WalletIcon className="h-3.5 w-3.5" /> Available
                </div>
                <p className="mt-2 text-xl font-black text-navy dark:text-zinc-100 tabular-nums">KSh 850.00</p>
                <p className="mt-1 text-[10px] text-emerald-600/70 dark:text-emerald-400/80">Ready to withdraw</p>
              </div>

              {/* Pending */}
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                  <Clock className="h-3.5 w-3.5" /> Pending
                </div>
                <p className="mt-2 text-xl font-black text-navy dark:text-zinc-100 tabular-nums">KSh 200.00</p>
                <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">Under 7-day hold</p>
              </div>

              {/* Total Earned */}
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 dark:text-zinc-500">
                  <ArrowUpRight className="h-3.5 w-3.5" /> Total Earned
                </div>
                <p className="mt-2 text-xl font-black text-navy dark:text-zinc-100 tabular-nums">KSh 1,050.00</p>
                <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">Lifetime earnings</p>
              </div>
            </div>

            {/* Mock Transaction History */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Recent Transactions</h4>
              <div className="space-y-2">
                {transactions.map((t, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-xl bg-white p-3 text-xs shadow-sm dark:bg-zinc-950 border border-zinc-200/50 dark:border-zinc-800/50">
                    <div className="space-y-1">
                      <p className="font-bold text-navy dark:text-zinc-100">{t.description}</p>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{t.date} • {t.type}</p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="font-bold text-navy dark:text-zinc-100">{t.amount}</p>
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${t.statusColor}`}>
                        {t.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* 3-Step Visual Flow below */}
        <div className="rounded-2xl bg-zinc-50 p-8 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50">
          <h4 className="mb-6 text-center text-sm font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500">Wallet Flow Checklist</h4>
          
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12">
            {/* Step 1 */}
            <div className="flex items-center gap-4 text-center md:flex-col md:w-36">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20">
                <FileCheck2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-zinc-400 dark:text-zinc-500">Stage 1</p>
                <p className="text-sm font-black text-navy dark:text-zinc-200">1. Earn (Pending)</p>
              </div>
            </div>

            <ArrowRight className="h-6 w-6 text-zinc-300 dark:text-zinc-700 hidden md:block" />

            {/* Step 2 */}
            <div className="flex items-center gap-4 text-center md:flex-col md:w-36">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20">
                <Clock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-zinc-400 dark:text-zinc-500">Stage 2</p>
                <p className="text-sm font-black text-navy dark:text-zinc-200">2. Hold Clears</p>
              </div>
            </div>

            <ArrowRight className="h-6 w-6 text-zinc-300 dark:text-zinc-700 hidden md:block" />

            {/* Step 3 */}
            <div className="flex items-center gap-4 text-center md:flex-col md:w-36">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20">
                <Coins className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-zinc-400 dark:text-zinc-500">Stage 3</p>
                <p className="text-sm font-black text-navy dark:text-zinc-200">3. Available</p>
              </div>
            </div>

            <ArrowRight className="h-6 w-6 text-zinc-300 dark:text-zinc-700 hidden md:block" />

            {/* Step 4 */}
            <div className="flex items-center gap-4 text-center md:flex-col md:w-36">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-500/25">
                <Download className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-zinc-400 dark:text-zinc-500">Final Stage</p>
                <p className="text-sm font-black text-navy dark:text-zinc-200">4. Withdraw to M-Pesa</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
