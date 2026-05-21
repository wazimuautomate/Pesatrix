import React from "react";
import Skeleton from "react-loading-skeleton";
import { TableRow, TableCell } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";

// 1. CardSkeleton - Matches standard task card or summary card dimensions perfectly
export function CardSkeleton() {
  return (
    <Card className="border border-outline-variant/40 bg-card shadow-sm">
      <CardContent className="p-5 flex flex-col justify-between h-full">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <Skeleton width={140} height={20} />
              <div className="mt-2 flex gap-1.5">
                <Skeleton width={80} height={20} borderRadius={9999} />
                <Skeleton width={60} height={20} borderRadius={9999} />
              </div>
            </div>
            <Skeleton width={70} height={24} />
          </div>
          <div className="mt-4">
            <Skeleton count={2} height={14} className="mt-1" />
          </div>
        </div>
        
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <Skeleton width={100} height={16} />
            <Skeleton width={120} height={16} />
          </div>
          <div className="mt-4 flex gap-2">
            <div className="flex-1">
              <Skeleton height={36} borderRadius={6} />
            </div>
            <div className="flex-1">
              <Skeleton height={36} borderRadius={6} />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// 2. TableSkeleton - Renders clean table rows inline to prevent header/layout shifts
export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIndex) => (
        <TableRow key={rIndex} className="hover:bg-transparent">
          {Array.from({ length: columns }).map((_, cIndex) => (
            <TableCell key={cIndex} className="py-4">
              <Skeleton height={18} width={cIndex === 0 ? "70%" : cIndex === columns - 1 ? "40%" : "85%"} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

// 3. ProfileSkeleton - Circular avatar + matching metadata rows
export function ProfileSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border border-outline-variant/40 rounded-xl bg-card">
      <Skeleton circle width={48} height={48} containerClassName="flex shrink-0" />
      <div className="flex-1 min-w-0">
        <Skeleton width={130} height={18} />
        <div className="mt-2">
          <Skeleton width={200} height={14} />
        </div>
      </div>
    </div>
  );
}

// 4. ListSkeleton - Matches generic dashboard list structures
export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center justify-between border-b border-outline-variant/30 pb-4 last:border-0 last:pb-0">
          <div className="space-y-2 flex-1 mr-4">
            <Skeleton width="45%" height={16} />
            <Skeleton width="75%" height={12} />
          </div>
          <Skeleton width={70} height={24} borderRadius={4} />
        </div>
      ))}
    </div>
  );
}

// 5. DashboardStatsSkeleton - Grid of summary metric cards
export function DashboardStatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="border border-outline-variant/40 bg-card shadow-sm">
          <CardContent className="p-5">
            <div className="mb-4">
              <Skeleton width={56} height={8} borderRadius={9999} />
            </div>
            <Skeleton width={120} height={14} />
            <div className="mt-2">
              <Skeleton width={80} height={28} />
            </div>
            <div className="mt-2">
              <Skeleton width="100%" height={12} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// 6. FormSkeleton - Modular rows for fields, labels, and submit actions
export function FormSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <div className="space-y-5 p-5 border border-outline-variant/40 bg-card rounded-xl">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton width={90} height={14} />
          <Skeleton height={42} borderRadius={6} />
        </div>
      ))}
      <div className="pt-4 flex justify-end gap-3">
        <Skeleton width={90} height={38} borderRadius={6} />
        <Skeleton width={110} height={38} borderRadius={6} />
      </div>
    </div>
  );
}
