import Link from "next/link";
import { BookOpenCheck, CheckCircle2, ClipboardCheck, ShieldCheck } from "lucide-react";
import { HomepageFooter, HomepageHeader } from "@/components/marketing/homepage-chrome";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Training Academy",
  description:
    "Learn how Pesatrix training prepares users for accurate task submissions, review standards, wallet eligibility, and safe platform use.",
};

const modules = [
  {
    title: "Platform basics",
    body: "Understand the earning flow, activation, training gates, task access, reviews, and wallet states before submitting paid work.",
    icon: BookOpenCheck,
  },
  {
    title: "Task quality",
    body: "Learn how to follow instructions, submit complete evidence, write original responses, and avoid common rejection reasons.",
    icon: ClipboardCheck,
  },
  {
    title: "Safety and trust",
    body: "Review account rules, payment expectations, fraud prevention, support channels, and withdrawal checks.",
    icon: ShieldCheck,
  },
];

const outcomes = [
  "Know how task instructions map to review decisions.",
  "Understand when earnings become pending, available, or withdrawn.",
  "Avoid low-quality submissions that can delay or block earning access.",
  "Use dashboard support when account, task, or wallet issues need review.",
];

export default function TrainingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-navy selection:bg-teal-container selection:text-navy">
      <HomepageHeader />
      <main>
        <section className="px-5 pb-14 pt-32 sm:px-8 sm:pb-20 sm:pt-40">
          <div className="mx-auto max-w-5xl">
            <p className="text-sm font-black uppercase text-secondary">Training</p>
            <h1 className="mt-4 max-w-4xl font-display text-5xl font-black leading-[1.02] tracking-normal text-navy sm:text-6xl">
              Learn the rules before you earn.
            </h1>
            <p className="mt-6 max-w-3xl text-lg font-medium leading-relaxed text-on-surface-variant sm:text-xl">
              Pesatrix training prepares users for real task requirements, review standards, wallet eligibility, and safe M-Pesa withdrawals.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="rounded-full bg-navy px-7 text-base font-black">
                <Link href="/register">Create account</Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="rounded-full px-7 text-base font-black">
                <Link href="/login">Continue training</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="border-t border-outline-variant/20 bg-surface-container-lowest px-5 py-14 sm:px-8 sm:py-20">
          <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
            {modules.map((module) => (
              <Card key={module.title} className="border-outline-variant/40">
                <CardContent className="p-6">
                  <module.icon className="h-7 w-7 text-secondary" />
                  <h2 className="mt-5 font-display text-2xl font-black tracking-normal text-navy">
                    {module.title}
                  </h2>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-on-surface-variant">
                    {module.body}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="bg-white px-5 py-14 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-4xl">
            <h2 className="font-display text-4xl font-black leading-tight tracking-normal text-navy">
              What users should know after training
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {outcomes.map((outcome) => (
                <div key={outcome} className="flex gap-3 border-t border-outline-variant/30 pt-5">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
                  <p className="text-base font-semibold leading-relaxed text-on-surface-variant">
                    {outcome}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <HomepageFooter />
    </div>
  );
}
