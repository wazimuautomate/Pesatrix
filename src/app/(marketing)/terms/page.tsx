import { InfoPageShell, type InfoSection } from "@/components/marketing/info-page-shell";

export const metadata = {
  title: "Terms of Service",
  description:
    "Pesatrix terms for account use, training, tasks, activation, payouts, referrals, and support.",
};

const sections: InfoSection[] = [
  {
    title: "Using Pesatrix",
    body: [
      "Pesatrix provides training, task access, account tools, wallet records, referrals, and M-Pesa payout workflows for eligible users in Kenya. By creating an account, you agree to use the platform honestly and only for lawful purposes.",
      "You are responsible for keeping your login details secure, making sure your account information is accurate, and using an M-Pesa number that belongs to you or that you are authorized to use.",
    ],
  },
  {
    title: "Account activation",
    body: [
      "Some account features may require activation before training, task allocation, or withdrawals become available. Activation requirements, pricing, and status are shown inside the product flow before you continue.",
      "Activation does not guarantee a fixed income. Earnings depend on task availability, task quality, review outcomes, platform rules, and payout eligibility.",
    ],
  },
  {
    title: "Training and tasks",
    body: [
      "Training is provided to help users understand task standards. You must follow task instructions, submit original work, and avoid spam, automation abuse, duplicate submissions, or misleading information.",
      "Pesatrix may reject, reverse, hold, or review work that appears incomplete, low quality, fraudulent, duplicated, or against task rules.",
    ],
  },
  {
    title: "Wallet and payouts",
    body: [
      "Wallet balances shown in Pesatrix are platform records. Withdrawals are paid through supported M-Pesa workflows when the account, amount, and task status meet current requirements.",
      "Payout timing can be affected by review checks, M-Pesa availability, network issues, account verification, suspected abuse, or maintenance.",
    ],
  },
  {
    title: "Referrals",
    body: [
      "Referral rewards, if available, are subject to the current rules shown in your dashboard. Referral rewards may depend on valid account activation, eligible activity, and fraud checks.",
      "Pesatrix may withhold or reverse referral rewards connected to fake accounts, self-referrals, coordinated abuse, chargebacks, or policy violations.",
    ],
  },
  {
    title: "Changes and suspension",
    body: [
      "Pesatrix may update product features, fees, task categories, payout limits, review rules, or these terms as the service grows. Continued use after updates means you accept the updated terms.",
      "We may restrict, suspend, or close accounts that violate these terms, create risk for other users, abuse platform workflows, or attempt to bypass verification and review systems.",
    ],
  },
];

export default function TermsPage() {
  return (
    <InfoPageShell
      title="Terms of Service"
      eyebrow="Pesatrix agreement"
      intro="These terms explain the basic rules for using Pesatrix, completing training and tasks, activating your account, and receiving M-Pesa payouts."
      updated="May 2, 2026"
      sections={sections}
    />
  );
}
