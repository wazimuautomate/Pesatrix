"use client";

import { usePathname } from "next/navigation";
import { MarketingHeader } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

const immersiveMarketingRoutes = new Set([
  "/",
  "/faq",
  "/how-it-works",
  "/privacy",
  "/support",
  "/terms",
  "/training",
  "/transparency",
]);

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (immersiveMarketingRoutes.has(pathname)) {
    return children;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
