"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Gift, Sparkles, Trophy, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageTransition } from "@/components/ui/PageTransition";

export function RewardsTeaser() {
  const teasers = [
    {
      title: "Spin & Win",
      description: "Quick spins with surprise cash boosts and mystery rewards.",
      icon: Sparkles,
    },
    {
      title: "Daily Check-in Bonus",
      description: "Show up consistently and stack small wins every day.",
      icon: Gift,
    },
    {
      title: "Referral Streak Rewards",
      description: "Earn extra when your referrals keep activating week after week.",
      icon: Users,
    },
    {
      title: "Milestone Drops",
      description: "Special bonuses when you hit earning and submission streak goals.",
      icon: Trophy,
    },
  ];

  return (
    <PageTransition className="space-y-6">
      <Card className="overflow-hidden border-outline-variant/40 bg-white shadow-sm">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col gap-6 text-center sm:text-left">
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 2.4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
              className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary sm:mx-0"
            >
              <Gift className="h-10 w-10" />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
              <h1 className="text-3xl font-bold text-navy sm:text-4xl">Daily Rewards are Coming</h1>
              <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
                We&apos;re building something special. Stay tuned.
              </p>
            </motion.div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {teasers.map((item, index) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: index * 0.06 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Card className="h-full border-outline-variant/40 bg-white">
              <CardContent className="flex h-full flex-col gap-4 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-navy">{item.title}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div whileTap={{ scale: 0.97 }} className="w-full sm:w-auto">
        <Button asChild className="w-full sm:w-auto">
          <Link href="/dashboard/referrals">Refer a Friend, Earn More</Link>
        </Button>
      </motion.div>
    </PageTransition>
  );
}
