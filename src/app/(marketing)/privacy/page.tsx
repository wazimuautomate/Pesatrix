import { InfoPageShell, type InfoSection } from "@/components/marketing/info-page-shell";

export const metadata = {
  title: "Privacy Policy",
  description:
    "How Pesatrix handles account data, verification details, task activity, wallet records, referrals, and support information.",
};

const sections: InfoSection[] = [
  {
    title: "Information we collect",
    body: [
      "Pesatrix collects the information needed to create and protect your account, such as your name, contact details, phone number, county, authentication records, profile status, and support messages.",
      "We also process product activity such as training progress, task submissions, wallet transactions, referral relationships, activation status, and payout records.",
    ],
  },
  {
    title: "How we use information",
    body: [
      "We use your information to run the platform, verify accounts, provide training, allocate and review tasks, process wallet activity, support referrals, respond to support requests, and protect users from fraud.",
      "We may also use aggregated or operational data to understand product performance, improve task quality, troubleshoot errors, and keep the service reliable.",
    ],
  },
  {
    title: "M-Pesa and payments",
    body: [
      "When you activate your account or request a withdrawal, Pesatrix may use your phone number, payment references, transaction status, and related metadata to process and reconcile M-Pesa activity.",
      "Payment providers and infrastructure partners may process data according to their own policies where necessary to complete payments, verify status, or handle disputes.",
    ],
  },
  {
    title: "Sharing and protection",
    body: [
      "We do not sell your personal data. We share information only where needed to operate the service, comply with law, process payments, investigate fraud, provide support, or work with service providers acting on our behalf.",
      "We use access controls, account checks, and operational safeguards to reduce misuse, but no online service can promise absolute security.",
    ],
  },
  {
    title: "Your choices",
    body: [
      "You can update account details where the dashboard allows it and contact support for help with account, wallet, or privacy-related questions.",
      "Some records may need to be retained for security, accounting, dispute resolution, legal compliance, fraud prevention, or platform integrity.",
    ],
  },
  {
    title: "Policy updates",
    body: [
      "We may update this policy as Pesatrix changes. When we make material updates, the updated date on this page will change and the new policy will apply from that date.",
      "If you continue using Pesatrix after a policy update, you accept the updated handling described here.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <InfoPageShell
      title="Privacy Policy"
      eyebrow="Data and trust"
      intro="This policy explains the information Pesatrix uses to run accounts, training, tasks, wallet records, referrals, support, and M-Pesa payment flows."
      updated="May 2, 2026"
      sections={sections}
    />
  );
}
