"use client";

import { motion } from "framer-motion";
import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown, HelpCircle } from "lucide-react";

export function FAQSection() {
  const faqs = [
    {
      q: "How much does it cost to join?",
      a: "Registration is free. Account activation requires a one-time M-Pesa payment (amount shown at activation). No recurring fees.",
    },
    {
      q: "How do I get paid?",
      a: "Approved earnings are credited to your Pesatrix wallet. When your available balance meets the withdrawal minimum, you request a withdrawal to your M-Pesa number from the dashboard.",
    },
    {
      q: "How long before I can start tasks?",
      a: "After activation, you complete the 7-day training program. After training, a short task preparation window may apply. A successful referral activation can reduce this window.",
    },
    {
      q: "What if my submission is rejected?",
      a: "Declined submissions do not receive payout. You can view the reason in your submission history. Follow the task instructions carefully to avoid rejection.",
    },
    {
      q: "Can I refer people?",
      a: "Yes. Your referral link is in your dashboard. When someone registers through your link and activates their account, you earn a bonus tracked in your referral dashboard.",
    },
    {
      q: "What happens to my pending balance?",
      a: "Pending earnings are in a hold period. After the hold clears, they move to Available. You can see the expected available date in your transaction history.",
    },
    {
      q: "Is this available outside Kenya?",
      a: "Pesatrix is currently built for Kenyan users with M-Pesa phone numbers.",
    },
    {
      q: "What if I have a problem?",
      a: "Open a support ticket from your dashboard. Your ticket is linked to your account, task, and payment history so the support team has full context without you repeating details.",
    },
  ];

  return (
    <section className="bg-white py-20 px-6 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl space-y-12">
        {/* Section Header */}
        <div className="text-center space-y-4">
          <p className="text-xs sm:text-sm font-black tracking-widest text-emerald-500 uppercase">
            Frequently Asked Questions
          </p>
          <h2 className="text-3xl font-extrabold tracking-tight text-navy dark:text-zinc-100 sm:text-4xl">
            Everything You Need To Know.
          </h2>
        </div>

        {/* Radix UI Accordion */}
        <Accordion.Root
          type="single"
          collapsible
          defaultValue="item-0"
          className="space-y-4"
        >
          {faqs.map((faq, index) => (
            <Accordion.Item
              key={index}
              value={`item-${index}`}
              className="rounded-2xl border border-zinc-200 bg-zinc-50 overflow-hidden dark:border-zinc-800 dark:bg-zinc-900 shadow-sm"
            >
              <Accordion.Header className="flex">
                <Accordion.Trigger className="group flex flex-1 items-center justify-between px-6 py-5 text-left font-bold text-navy dark:text-zinc-100 transition-all hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 focus:outline-none">
                  <span className="flex items-center gap-3 pr-4 text-sm sm:text-base">
                    <HelpCircle className="h-5 w-5 shrink-0 text-emerald-500 dark:text-emerald-400" />
                    {faq.q}
                  </span>
                  <ChevronDown className="h-4.5 w-4.5 shrink-0 text-zinc-400 transition-transform duration-200 group-data-[state=open]:rotate-180 dark:text-zinc-500" />
                </Accordion.Trigger>
              </Accordion.Header>

              <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                <div className="px-6 pb-6 pt-1 text-sm font-medium leading-relaxed text-zinc-500 dark:text-zinc-400 pl-14">
                  {faq.a}
                </div>
              </Accordion.Content>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      </div>
    </section>
  );
}
