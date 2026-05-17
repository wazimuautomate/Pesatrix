import { InfoPageShell, type InfoSection } from "@/components/marketing/info-page-shell";

export const metadata = {
  title: "Transparency",
  description:
    "Pesatrix transparency notes covering training, task review, wallet states, withdrawals, risk checks, and earning expectations.",
};

const sections: InfoSection[] = [
  {
    title: "Earnings are task-based",
    body: [
      "Pesatrix is not a fixed-income promise or get-rich-quick product. Earnings depend on task availability, eligibility, review quality, platform rules, and payment status.",
      "Users should read each task brief carefully because payout, evidence requirements, difficulty, review timing, and slot availability can differ by task.",
    ],
  },
  {
    title: "Training gates task access",
    body: [
      "Training exists to reduce poor submissions and clarify how the platform works. Some task access is unavailable until required training steps are complete.",
      "Completing training does not guarantee task approval. It helps users understand expectations before they submit work for review.",
    ],
  },
  {
    title: "Reviews can reject work",
    body: [
      "Submissions may be rejected if they are incomplete, duplicated, low quality, unrelated to the task, missing evidence, suspicious, or outside task instructions.",
      "Admin review and automated checks may be used to protect task quality, wallet accuracy, and platform integrity.",
    ],
  },
  {
    title: "Wallet states matter",
    body: [
      "Pending wallet activity is not always withdrawable. Available balances represent earnings that have passed the current platform checks and can be considered for withdrawal.",
      "Withdrawals may still be reviewed, delayed, failed, or reversed if there are payment provider issues, incorrect details, fraud checks, or account restrictions.",
    ],
  },
  {
    title: "M-Pesa details must be accurate",
    body: [
      "Users are responsible for using accurate M-Pesa details. Payment issues may take longer to resolve if account and withdrawal information do not match.",
      "Support tickets should be created from the dashboard so payment, task, and account records can be reviewed together.",
    ],
  },
  {
    title: "Platform rules can change",
    body: [
      "Task categories, limits, payout timing, activation rules, training requirements, support policies, and withdrawal thresholds may change as Pesatrix evolves.",
      "When the product shows a current rule or limit, that current in-product rule controls the user's next action.",
    ],
  },
];

export default function TransparencyPage() {
  return (
    <InfoPageShell
      title="Transparency"
      eyebrow="How we operate"
      intro="Clear expectations about training, task review, wallet states, withdrawals, risk checks, and what Pesatrix does not promise."
      updated="May 17, 2026"
      sections={sections}
    />
  );
}
