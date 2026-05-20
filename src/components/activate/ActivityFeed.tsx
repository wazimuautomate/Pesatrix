"use client";

import { useEffect, useMemo, useState } from "react";

import type { ActivityFeedItem } from "@/lib/mockData/activityFeed";

type ActivityFeedProps = {
  items: ActivityFeedItem[];
};

function getWindow(items: ActivityFeedItem[], startIndex: number, size: number) {
  if (items.length === 0) {
    return [];
  }

  return Array.from({ length: Math.min(size, items.length) }, (_, offset) => items[(startIndex + offset) % items.length]);
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  const [startIndex, setStartIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 4) {
      return;
    }

    const timer = window.setInterval(() => {
      setStartIndex((current) => (current + 1) % items.length);
    }, 4000);

    return () => window.clearInterval(timer);
  }, [items.length]);

  const visibleItems = useMemo(() => getWindow(items, startIndex, 4), [items, startIndex]);

  return (
    <div className="space-y-3">
      {visibleItems.map((item, index) => (
        <div
          key={`${item.name}-${item.location}-${startIndex}-${index}`}
          className="rounded-xl border border-outline-variant/40 bg-white px-4 py-3 shadow-sm transition-opacity duration-500"
        >
          <p className="text-sm leading-relaxed text-foreground">
            <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="font-semibold text-navy">{item.name}</span> from {item.location} {item.action} • earned{" "}
            <span className="font-semibold text-emerald-600">KSh {item.amount.toLocaleString("en-KE")}</span> • {item.minutesAgo} mins ago
          </p>
        </div>
      ))}
    </div>
  );
}
