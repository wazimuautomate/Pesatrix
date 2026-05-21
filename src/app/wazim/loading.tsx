import React from "react";
import Skeleton from "react-loading-skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardStatsSkeleton } from "@/components/ui/skeleton-loaders";

export default function LoadingWazimPage() {
  return (
    <div className="space-y-6 px-4 py-6 lg:px-8 lg:py-8">
      {/* Premium Header Skeleton */}
      <div className="rounded-2xl border border-outline-variant/40 bg-white/70 px-5 py-4 shadow-sm shadow-navy/5">
        <Skeleton width={180} height={20} />
        <div className="mt-3">
          <Skeleton width="100%" height={14} />
        </div>
      </div>

      {/* Grid of Metric Boxes using DashboardStatsSkeleton */}
      <DashboardStatsSkeleton count={4} />

      {/* Table Shell Skeleton */}
      <div className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 2 }).map((_, sectionIndex) => (
          <Card key={sectionIndex} className="border border-outline-variant/40 bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <Skeleton width={140} height={22} />
                <Skeleton width={60} height={16} />
              </div>
              <div className="border-t border-outline-variant/30 my-4" />
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, rowIndex) => (
                  <div key={rowIndex} className="flex items-center justify-between py-2 border-b border-outline-variant/20 last:border-0">
                    <div className="space-y-1 flex-1">
                      <Skeleton width="50%" height={16} />
                      <Skeleton width="30%" height={12} />
                    </div>
                    <div className="flex gap-4 items-center w-1/2 justify-end">
                      <Skeleton width={70} height={16} />
                      <Skeleton width={60} height={20} borderRadius={9999} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
