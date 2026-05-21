"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

import { AdminBottomNav } from "@/components/admin/AdminBottomNav";
import { BrandLogo } from "@/components/brand-logo";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { WazimAdminSession } from "@/lib/wazim-admin";

export function AdminPageShell({
  admin,
  title,
  description,
  actions,
  children,
  headerVariant = "default",
}: {
  admin: WazimAdminSession;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
  headerVariant?: "default" | "logoOnly";
}) {
  const showHeaderText = headerVariant === "default";

  return (
    <div className="dashboard-canvas min-h-screen lg:flex">
      <AdminSidebar />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-outline-variant/30 bg-white/80 shadow-sm shadow-navy/5 backdrop-blur-xl">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 lg:min-h-20 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <BrandLogo size="topbar" className="shrink-0" />
              <div className={cn("min-w-0", !showHeaderText && "hidden")}>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pesatrix-blue">
                  Wazim Control
                </p>
                <h1 className="mt-1 truncate text-xl font-bold text-navy lg:text-2xl">
                  {title}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {actions}
              <Badge variant="outline" className="hidden border-outline-variant/60 bg-white/80 text-navy sm:inline-flex">
                {admin.role}
              </Badge>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 pb-28 md:pb-8 lg:px-8 lg:py-8">
          <div className="mb-6 rounded-2xl border border-outline-variant/40 bg-white/70 px-5 py-4 shadow-sm shadow-navy/5">
            <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </main>
      </div>
      <AdminBottomNav />
    </div>
  );
}

export function MetricCard({
  label,
  value,
  detail,
  tone = "blue",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: "blue" | "teal" | "amber" | "red";
}) {
  const toneClass = {
    blue: "bg-pesatrix-blue/10 text-pesatrix-blue",
    teal: "bg-teal/10 text-teal",
    amber: "bg-amber-500/10 text-amber-700",
    red: "bg-destructive/10 text-destructive",
  }[tone];

  return (
    <Card className="overflow-hidden border border-outline-variant/40 shadow-sm">
      <CardContent className="p-5">
        <div className={cn("mb-4 h-2 w-14 rounded-full", toneClass)} />
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-bold text-navy">{value}</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-outline-variant/70 bg-white/70 p-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function StatusBadge({ status }: { status: unknown }) {
  const value = String(status ?? "unknown");
  const variant =
    ["paid", "sent", "available", "active", "completed", "resolved", "closed", "activated"].includes(value)
      ? "success"
      : ["pending", "requested", "processing", "open", "in_progress", "awaiting_test"].includes(value)
        ? "warning"
        : ["failed", "reversed", "suspended", "banned", "held", "rejected"].includes(value)
          ? "destructive"
          : "muted";

  return <Badge variant={variant}>{value.replaceAll("_", " ")}</Badge>;
}
