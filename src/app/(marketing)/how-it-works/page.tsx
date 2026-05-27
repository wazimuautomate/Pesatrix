import { Suspense } from "react";
import HowItWorksClient from "./how-it-works-client";

export const metadata = {
  title: "How Pesatrix Works — Kenya's Online Earning Platform",
  description:
    "Pesatrix is a Kenya-built online earning platform. Complete digital tasks, track your wallet, and withdraw approved earnings to M-Pesa. Learn how it works before you register.",
  openGraph: {
    title: "How Pesatrix Works",
    description: "Complete digital tasks. Withdraw to M-Pesa. Structured earning for Kenyans.",
    url: "https://pesatrix.vercel.app/how-it-works",
  },
};

export default function HowItWorksPage() {
  return (
    <Suspense 
      fallback={
        <div className="min-h-screen bg-white dark:bg-zinc-950 flex items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
        </div>
      }
    >
      <HowItWorksClient />
    </Suspense>
  );
}
