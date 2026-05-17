import Link from "next/link";
import { Headphones, Mail, MessageCircle, ShieldCheck } from "lucide-react";
import { HomepageFooter, HomepageHeader } from "@/components/marketing/homepage-chrome";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Support",
  description:
    "Get help with Pesatrix account setup, activation, training, tasks, wallet records, withdrawals, referrals, and platform safety.",
};

const supportTopics = [
  {
    title: "Account and activation",
    body: "Use dashboard support for login, setup, activation, verification, or account status questions.",
    icon: ShieldCheck,
  },
  {
    title: "Tasks and training",
    body: "Ask for help when training progress, task access, submission requirements, or review outcomes are unclear.",
    icon: MessageCircle,
  },
  {
    title: "Wallet and withdrawals",
    body: "Create a ticket for wallet balances, transaction history, withdrawal limits, or M-Pesa payout status.",
    icon: Headphones,
  },
];

export default function SupportPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-navy selection:bg-teal-container selection:text-navy">
      <HomepageHeader />
      <main>
        <section className="px-5 pb-14 pt-32 sm:px-8 sm:pb-20 sm:pt-40">
          <div className="mx-auto max-w-5xl">
            <p className="text-sm font-black uppercase text-secondary">Support center</p>
            <h1 className="mt-4 max-w-4xl font-display text-5xl font-black leading-[1.02] tracking-normal text-navy sm:text-6xl">
              Get help with your Pesatrix account.
            </h1>
            <p className="mt-6 max-w-3xl text-lg font-medium leading-relaxed text-on-surface-variant sm:text-xl">
              The fastest way to resolve account, task, wallet, and withdrawal issues is to open a support ticket from your dashboard.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="rounded-full bg-navy px-7 text-base font-black">
                <Link href="/dashboard/support">Open dashboard support</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full px-7 text-base font-black">
                <Link href="/faq">Read FAQ</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="border-t border-outline-variant/20 bg-surface-container-lowest px-5 py-14 sm:px-8 sm:py-20">
          <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
            {supportTopics.map((topic) => (
              <Card key={topic.title} className="border-outline-variant/40">
                <CardContent className="p-6">
                  <topic.icon className="h-7 w-7 text-secondary" />
                  <h2 className="mt-5 font-display text-2xl font-black tracking-normal text-navy">
                    {topic.title}
                  </h2>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-on-surface-variant">
                    {topic.body}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="bg-white px-5 py-14 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-4xl border-t border-outline-variant/30 pt-10">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[8px] bg-secondary/10">
                <Mail className="h-6 w-6 text-secondary" />
              </span>
              <div>
                <h2 className="font-display text-2xl font-black tracking-normal text-navy">
                  Keep support requests inside your account
                </h2>
                <p className="mt-3 text-base font-medium leading-relaxed text-on-surface-variant">
                  Dashboard tickets keep replies connected to your account, transactions, task submissions, and training status. This helps support review the issue without asking for details that are already tied to your profile.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <HomepageFooter />
    </div>
  );
}
