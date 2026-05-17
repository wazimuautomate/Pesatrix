import { InfoPageShell, type InfoSection } from "@/components/marketing/info-page-shell";

export const metadata = {
  title: "How It Works",
  description:
    "How Pesatrix takes users from registration to activation, training, task completion, review, wallet credit, and M-Pesa withdrawal.",
};

const sections: InfoSection[] = [
  {
    title: "Create your account",
    body: [
      "Start with a Pesatrix account using accurate personal and contact details. Your dashboard uses this profile to guide setup, support, referrals, and wallet activity.",
      "Use a real phone number because account activation, withdrawal records, and M-Pesa support depend on matching payment details.",
    ],
  },
  {
    title: "Complete setup and activation",
    body: [
      "After registration, the dashboard shows the remaining account steps. Complete onboarding, then activate the account when the product asks for it.",
      "Activation unlocks the guided earning flow. It does not promise fixed earnings, but it prepares your account for training, task access, review, and wallet operations.",
    ],
  },
  {
    title: "Finish training first",
    body: [
      "Training explains how tasks are reviewed, how to follow instructions, how to avoid low-quality submissions, and how payouts become eligible.",
      "Tasks remain gated until training requirements are complete. This protects task quality and helps new users understand the platform before submitting paid work.",
    ],
  },
  {
    title: "Work on available tasks",
    body: [
      "Once eligible, open the Tasks area to see active work from the database. Each task includes instructions, category, difficulty, payout, requirements, and remaining slots.",
      "Submit only original, accurate work that matches the task brief. Some tasks require screenshots, links, written answers, or minimum word counts.",
    ],
  },
  {
    title: "Review and wallet credit",
    body: [
      "Submitted work can be pending, approved, rejected, or flagged for additional review. Approved work is credited according to the task and wallet rules.",
      "Wallet balances separate pending, available, and withdrawn activity so users can track what is still under review and what can be withdrawn.",
    ],
  },
  {
    title: "Withdraw to M-Pesa",
    body: [
      "Eligible available earnings can be requested for withdrawal to the M-Pesa number on the account, subject to current platform limits and review checks.",
      "Support tickets remain available from the dashboard if a payment, task, activation, or account issue needs follow-up.",
    ],
  },
];

export default function HowItWorksPage() {
  return (
    <InfoPageShell
      title="How Pesatrix Works"
      eyebrow="Step by step"
      intro="Pesatrix guides users through account setup, activation, training, task completion, review, wallet credit, and M-Pesa withdrawal."
      updated="May 17, 2026"
      sections={sections}
    />
  );
}
