import { InfoPageShell, type InfoSection } from "@/components/marketing/info-page-shell";

export const metadata = {
  title: "FAQ",
  description:
    "Answers to common questions about Pesatrix training, activation, tasks, M-Pesa payouts, withdrawals, and support.",
};

const sections: InfoSection[] = [
  {
    title: "What is Pesatrix",
    body: [
      "Pesatrix is a Kenya-first earning platform that trains users for digital tasks, reviews completed work, and pays eligible cleared earnings through M-Pesa.",
      "It is not presented as a get-rich-quick system. Earnings depend on available tasks, accuracy, review results, and platform rules.",
    ],
  },
  {
    title: "How do I start",
    body: [
      "Create an account, complete the required setup, activate the account when prompted, and finish the training path before working on paid tasks.",
      "The dashboard shows the next required step so you can move from registration to activation, training, tasks, and withdrawals without guessing.",
    ],
  },
  {
    title: "Why is activation required",
    body: [
      "Activation helps unlock the training and task allocation flow for verified users. The current activation process is shown inside the product before you continue.",
      "Activation does not guarantee fixed earnings. It gives access to the platform flow, while actual earnings depend on eligible work completed and approved.",
    ],
  },
  {
    title: "How are payouts made",
    body: [
      "Approved earnings are withdrawn to the M-Pesa number connected to your account. Your dashboard keeps wallet and transaction records so you can track activity.",
      "Payouts may be delayed or reviewed if there are account checks, payment provider issues, incomplete work, suspicious activity, or maintenance.",
    ],
  },
  {
    title: "Can I get support",
    body: [
      "Yes. Use the Support area inside your account dashboard to create and follow up on tickets. This keeps help requests tied to your account and transaction history.",
      "If you are not signed in, the dashboard support link will ask you to log in first.",
    ],
  },
  {
    title: "What if my task is rejected",
    body: [
      "Rejected tasks usually mean the submission did not meet the stated instructions, quality requirements, originality checks, or review standards.",
      "Use training feedback and task instructions carefully before submitting. Repeated low-quality or abusive submissions may limit account access.",
    ],
  },
];

export default function FaqPage() {
  return (
    <InfoPageShell
      title="Frequently Asked Questions"
      eyebrow="Quick answers"
      intro="Clear answers for new and returning users about account setup, activation, training, task review, M-Pesa payouts, and support."
      updated="May 2, 2026"
      sections={sections}
    />
  );
}
