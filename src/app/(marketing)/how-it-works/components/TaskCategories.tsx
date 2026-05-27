"use client";

import { motion } from "framer-motion";
import { 
  ClipboardList, 
  Tag, 
  Share2, 
  FileText, 
  ShieldAlert, 
  Tv 
} from "lucide-react";

export function TaskCategories() {
  const categories = [
    {
      icon: ClipboardList,
      title: "Surveys",
      desc: "Answer structured questions — multiple choice, ratings, yes/no, open text. Fast and straightforward.",
      payout: "Payout: Varies per survey",
      borderAccent: "border-t-emerald-300 dark:border-t-emerald-600",
    },
    {
      icon: Tag,
      title: "Data Labeling",
      desc: "Label batches of text or image items using defined options. Ideal for detail-oriented users.",
      payout: "Payout: Per batch approved",
      borderAccent: "border-t-emerald-400 dark:border-t-emerald-500",
    },
    {
      icon: Share2,
      title: "Social Engagement",
      desc: "Follow, like, comment, subscribe, join, review, or share — then submit proof. Clear instructions provided.",
      payout: "Payout: Per verified proof",
      borderAccent: "border-t-emerald-500 dark:border-t-emerald-400",
    },
    {
      icon: FileText,
      title: "Content Creation",
      desc: "Write captions, reviews, articles, tweets, or short paragraphs. Minimum word counts apply.",
      payout: "Payout: Per approved submission",
      borderAccent: "border-t-emerald-600 dark:border-t-emerald-300",
    },
    {
      icon: ShieldAlert,
      title: "Verification Tasks",
      desc: "Submit a text answer, screenshot, URL, or mixed proof depending on the task requirement.",
      payout: "Payout: Per verified task",
      borderAccent: "border-t-emerald-400 dark:border-t-emerald-500",
    },
    {
      icon: Tv,
      title: "Watch & Respond",
      desc: "Watch content for a required time, then answer comprehension questions. Anti-cheat timers enforced.",
      payout: "Payout: Per completed session",
      borderAccent: "border-t-emerald-500 dark:border-t-emerald-400",
    },
  ];

  return (
    <section className="bg-zinc-50 py-20 px-6 dark:bg-zinc-900 border-y border-zinc-200/50 dark:border-zinc-800/50">
      <div className="mx-auto max-w-6xl space-y-12">
        {/* Section Header */}
        <div className="text-center space-y-4">
          <p className="text-xs sm:text-sm font-black tracking-widest text-emerald-500 uppercase">
            What Kind of Work Will You Do?
          </p>
          <h2 className="text-3xl font-extrabold tracking-tight text-navy dark:text-zinc-100 sm:text-4xl">
            Pesatrix supports multiple task types.
          </h2>
          <p className="mx-auto max-w-xl text-base font-semibold leading-relaxed text-zinc-500 dark:text-zinc-400">
            You don't have to be good at everything — pick what suits you.
          </p>
        </div>

        {/* Categories Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 pt-4">
          {categories.map((cat, index) => {
            const Icon = cat.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className={`flex flex-col justify-between rounded-2xl border border-zinc-200 border-t-4 bg-white p-6 shadow-sm transition-all hover:border-emerald-500/60 hover:shadow-emerald-500/10 hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-950 ${cat.borderAccent}`}
              >
                <div className="space-y-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-400">
                    <Icon className="h-5 w-5" strokeWidth={2.2} />
                  </div>
                  <h3 className="text-lg font-bold text-navy dark:text-zinc-100">
                    {cat.title}
                  </h3>
                  <p className="text-sm font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
                    {cat.desc}
                  </p>
                </div>
                <div className="mt-6 border-t border-zinc-100 pt-4 dark:border-zinc-800/80">
                  <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    {cat.payout}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Footer Note */}
        <div className="text-center pt-4">
          <p className="text-sm font-semibold text-zinc-400 dark:text-zinc-500">
            Partner survey offers (CPX Research) are also available for eligible accounts.
          </p>
        </div>
      </div>
    </section>
  );
}
