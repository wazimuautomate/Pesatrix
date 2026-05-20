"use client";

import { useEffect, useMemo, useState } from "react";

type SocialProofTickerProps = {
  items: string[];
};

function getVisibleItems(items: string[], startIndex: number, size: number) {
  if (items.length === 0) {
    return [];
  }

  return Array.from({ length: Math.min(size, items.length) }, (_, offset) => items[(startIndex + offset) % items.length]);
}

export function SocialProofTicker({ items }: SocialProofTickerProps) {
  const [startIndex, setStartIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 3) {
      return;
    }

    const timer = window.setInterval(() => {
      setStartIndex((current) => (current + 1) % items.length);
    }, 3200);

    return () => window.clearInterval(timer);
  }, [items.length]);

  const visibleItems = useMemo(() => getVisibleItems(items, startIndex, 3), [items, startIndex]);

  return (
    <div className="flex flex-wrap gap-2">
      {visibleItems.map((item, index) => (
        <div
          key={`${item}-${startIndex}-${index}`}
          className="rounded-full border border-outline-variant/40 bg-white px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm transition-opacity duration-300"
        >
          {item}
        </div>
      ))}
    </div>
  );
}
