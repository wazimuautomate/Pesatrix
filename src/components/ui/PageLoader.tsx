"use client";

import { motion } from "framer-motion";

export function PageLoader({ label = "Loading page" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-4 py-10" aria-live="polite" aria-label={label}>
      <div className="flex items-center gap-2">
        {[0, 1, 2].map((index) => (
          <motion.span
            key={index}
            className="h-3 w-3 rounded-full bg-primary"
            animate={{ opacity: [0.35, 1, 0.35], y: [0, -4, 0] }}
            transition={{
              duration: 0.9,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
              delay: index * 0.12,
            }}
          />
        ))}
      </div>
    </div>
  );
}
