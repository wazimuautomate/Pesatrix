"use client";

import { motion } from "framer-motion";
import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown, HelpCircle } from "lucide-react";

const WhatsAppIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="currentColor"
    {...props}
  >
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.451 5.403.002 9.803-4.392 9.807-9.799.002-2.618-1.01-5.08-2.857-6.932C16.378 2.023 13.916.99 11.998.99c-5.405 0-9.806 4.394-9.81 9.8.001 1.57.447 3.102 1.291 4.468L2.482 20.6l5.525-1.446zm11.016-5.592c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.149-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
  </svg>
);

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
      a: "Yes. Your referral link is in your dashboard. When someone registers through your link and activates their account, you earn a flat, direct referral bonus of KSh 100.",
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
      q: "What if I have a problem before registering?",
      a: "If you have any questions before creating an account, you can reach out directly to our official pre-registration support on WhatsApp using the button below. Once registered, you can open support tickets inside the platform.",
    },
  ];

  return (
    <section className="bg-white py-20 px-6 dark:bg-zinc-950 space-y-16">
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

      {/* Premium WhatsApp Support Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 p-8 text-center space-y-6 max-w-2xl mx-auto shadow-sm relative overflow-hidden"
      >
        {/* Subtle glowing radial background */}
        <div className="absolute -inset-x-20 -top-20 h-64 bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center space-y-4">
          <div className="h-16 w-16 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 animate-pulse">
            <WhatsAppIcon className="h-9 w-9" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xl font-black tracking-tight text-navy dark:text-zinc-100">
              Have questions before registering?
            </h3>
            <p className="text-sm font-semibold text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-md mx-auto">
              Chat with our official pre-registration support directly. Click the button below to start a secure WhatsApp conversation.
            </p>
          </div>

          <motion.a
            href="https://wa.me/254103144018?text=Hello%20Pesatrix%20Support%2C%20I%20have%20a%20question%20before%20registering%20my%20account%3A"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-8 py-3.5 text-sm font-black text-white shadow-xl shadow-emerald-500/30 hover:bg-emerald-600 transition-colors duration-200"
          >
            <WhatsAppIcon className="h-5 w-5" />
            Chat on WhatsApp
          </motion.a>

          <div className="rounded-xl border border-amber-200 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/20 p-4 text-xs font-semibold text-amber-800 dark:text-amber-400 max-w-md border-l-4 border-l-amber-500">
            ⚠️ <span className="font-bold">Caution:</span> This contact channel is strictly dedicated for WhatsApp messaging and text inquiries only. Telephone calls, voice calls, and standard SMS cellular texts are not active and will not be received.
          </div>
        </div>
      </motion.div>
    </section>
  );
}
