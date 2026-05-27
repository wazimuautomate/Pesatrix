"use client";

import { useSearchParams } from "next/navigation";
import { HomepageHeader, HomepageFooter } from "@/components/marketing/homepage-chrome";
import { HeroSection } from "./components/HeroSection";
import { WhatIsPesatrix } from "./components/WhatIsPesatrix";
import { HowItWorks } from "./components/HowItWorks";
import { TaskCategories } from "./components/TaskCategories";
import { WalletSection } from "./components/WalletSection";
import { ReferralSection } from "./components/ReferralSection";
import { WhyPesatrix } from "./components/WhyPesatrix";
import { WhoIsItFor } from "./components/WhoIsItFor";
import { LegitimacySection } from "./components/LegitimacySection";
import { FAQSection } from "./components/FAQSection";
import { FinalCTA } from "./components/FinalCTA";

export default function HowItWorksClient() {
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref");

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-navy dark:bg-zinc-950 dark:text-zinc-100 selection:bg-emerald-500/20 selection:text-emerald-700">
      <HomepageHeader />
      <main>
        <HeroSection refCode={refCode} />
        <WhatIsPesatrix />
        <HowItWorks />
        <TaskCategories />
        <WalletSection />
        <ReferralSection />
        <WhyPesatrix />
        <WhoIsItFor />
        <LegitimacySection />
        <FAQSection />
        <FinalCTA refCode={refCode} />
      </main>
      <HomepageFooter />
    </div>
  );
}
