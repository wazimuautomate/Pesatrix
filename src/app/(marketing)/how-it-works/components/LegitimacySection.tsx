"use client";

import { motion } from "framer-motion";
import { ShieldCheck, CheckCircle, ShieldAlert, Award } from "lucide-react";

export function LegitimacySection() {
  const platformFeatures = [
    "Real user registration and email verification",
    "M-Pesa STK Push payment integration (Daraja API)",
    "A 7-stage training program with quiz gates",
    "Live task management with slot tracking and expiry",
    "An immutable wallet ledger — balances are never edited manually",
    "M-Pesa B2C withdrawal processing",
    "AI-assisted and admin-reviewed task submissions",
    "Fraud detection and risk scoring on accounts",
    "An operations console (Wazim) where admins manage users, tasks, payouts, and platform settings",
    "Support ticketing connected to your full account history",
  ];

  const trustProofItems = [
    "M-Pesa activation with real receipt validation",
    "Pending-to-available wallet hold system (protects against fraud)",
    "Task review before any payout is credited",
    "Fraud checks on referrals and submissions",
    "Admin audit log on all financial actions",
  ];

  return (
    <section className="bg-zinc-950 py-20 px-6 text-zinc-100 relative overflow-hidden">
      {/* Dynamic glow decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 h-[400px] w-[600px] rounded-full bg-emerald-500/5 blur-[120px]" />

      <div className="mx-auto max-w-6xl space-y-12">
        {/* Section Header */}
        <div className="text-center space-y-4">
          <p className="text-xs sm:text-sm font-black tracking-widest text-emerald-400 uppercase">
            Is Pesatrix Legitimate?
          </p>
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            A Direct Answer To Your Most Common Question.
          </h2>
        </div>

        {/* 2 Column Details */}
        <div className="grid gap-12 lg:grid-cols-12 lg:items-start pt-6">
          
          {/* Column 1: Feature Checklist (60%) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-4 text-zinc-400 font-medium">
              <p>
                Pesatrix is a fully built, operational platform — not a WhatsApp group, not a pyramid scheme, not a referral chain with no product behind it.
              </p>
              <p>
                Every feature on the platform is integrated with professional software rails:
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {platformFeatures.map((feat, idx) => (
                <div key={idx} className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded bg-emerald-500/10 text-emerald-400">
                    <CheckCircle className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-zinc-300 leading-relaxed">
                    {feat}
                  </span>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-5 text-sm text-zinc-400 leading-relaxed">
              Pesatrix does not promise fixed income. Earnings depend on available tasks, quality of your work, and current platform rules. <strong className="text-emerald-400">That honesty is intentional</strong> — because platforms that overpromise always disappoint.
            </div>
          </div>

          {/* Column 2: Trust Proof Block (50%) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-8 shadow-xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 -translate-y-4 translate-x-4 text-emerald-500/10 shrink-0">
              <ShieldCheck className="h-40 w-40" />
            </div>

            <h3 className="mb-6 flex items-center gap-2.5 text-lg font-black text-white z-10 relative">
              <ShieldCheck className="h-5.5 w-5.5 text-emerald-400" /> Trust Proof Block
            </h3>

            <div className="space-y-4 z-10 relative">
              {trustProofItems.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 pb-3 border-b border-zinc-800/80 last:border-0 last:pb-0">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                    <CheckCircle className="h-3.5 w-3.5" strokeWidth={3} />
                  </div>
                  <span className="text-sm font-semibold text-zinc-300">
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
