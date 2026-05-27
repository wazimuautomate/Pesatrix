"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle } from "lucide-react";
import { useState, Suspense } from "react";

function FloatingInfoButtonContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showTooltip, setShowTooltip] = useState(false);

  // Don't show the floating button on the /how-it-works page itself
  if (pathname === "/how-it-works" || pathname === "/about") {
    return null;
  }

  // Preserve the referral code if it exists in the current URL
  const refCode = searchParams.get("ref");
  const href = refCode ? `/how-it-works?ref=${encodeURIComponent(refCode)}` : "/how-it-works";

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center justify-end">
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, x: 10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.95 }}
            className="mr-3 hidden rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white shadow-xl backdrop-blur-md md:block border border-white/10 whitespace-nowrap"
          >
            How Pesatrix Works
            <div className="absolute right-[-4px] top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 bg-navy border-r border-t border-white/10" />
          </motion.div>
        )}
      </AnimatePresence>

      <Link href={href} aria-label="How Pesatrix Works">
        <motion.div
          className="relative flex h-[52px] w-[52px] cursor-pointer items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_4px_20px_rgba(16,185,129,0.4)] transition-all hover:bg-emerald-600 hover:shadow-[0_6px_24px_rgba(16,185,129,0.6)] focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onFocus={() => setShowTooltip(true)}
          onBlur={() => setShowTooltip(false)}
          initial={{ scale: 0 }}
          animate={{
            scale: [0, 1.08, 1, 1.08, 1],
          }}
          transition={{
            duration: 1.2,
            times: [0, 0.25, 0.5, 0.75, 1],
            ease: "easeInOut",
          }}
        >
          {/* Pulsing glow effect */}
          <span className="absolute inset-0 -z-10 rounded-full bg-emerald-400/30 animate-ping opacity-75" style={{ animationDuration: '3s' }} />
          <HelpCircle className="h-6 w-6 shrink-0" strokeWidth={2.4} />
        </motion.div>
      </Link>
    </div>
  );
}

export function FloatingInfoButton() {
  return (
    <Suspense fallback={null}>
      <FloatingInfoButtonContent />
    </Suspense>
  );
}
