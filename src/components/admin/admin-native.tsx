import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowDownToLine,
  BookOpen,
  CreditCard,
  HeadphonesIcon,
  LayoutDashboard,
  Settings,
  Shield,
  Users,
  Users2,
  ClipboardList,
  FileText,
} from "lucide-react";

import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { WazimAdminSession } from "@/lib/wazim-admin";

const mobileLinks = [
  { href: "/wazim", label: "Overview", icon: LayoutDashboard },
  { href: "/wazim/users", label: "Users", icon: Users },
  { href: "/wazim/training", label: "Training", icon: BookOpen },
  { href: "/wazim/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/wazim/submissions", label: "Submissions", icon: FileText },
  { href: "/wazim/withdrawals", label: "Withdrawals", icon: ArrowDownToLine },
  { href: "/wazim/payments", label: "Payments", icon: CreditCard },
  { href: "/wazim/referrals", label: "Referrals", icon: Users2 },
  { href: "/wazim/support", label: "Support", icon: HeadphonesIcon },
  { href: "/wazim/fraud", label: "Fraud", icon: Shield },
  { href: "/wazim/settings", label: "Settings", icon: Settings },
];

export function AdminPageShell({
  admin,
  title,
  description,
  actions,
  children,
}: {
  admin: WazimAdminSession;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background lg:flex">
      <AdminSidebar />
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-outline-variant/40 bg-background/95 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 lg:px-8">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pesatrix-blue">
                Wazim Control
              </p>
              <h1 className="mt-1 truncate text-xl font-bold text-navy lg:text-2xl">
                {title}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              {actions}
              <Badge variant="outline" className="hidden border-outline-variant/60 bg-white text-navy sm:inline-flex">
                {admin.role}
              </Badge>
            </div>
          </div>
          <nav className="flex gap-2 overflow-x-auto border-t border-outline-variant/30 px-4 py-2 lg:hidden">
            {mobileLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-outline-variant/50 bg-white px-3 py-2 text-xs font-semibold text-on-surface"
              >
                <link.icon className="h-3.5 w-3.5" />
                {link.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8">
          <p className="mb-6 max-w-3xl text-sm leading-6 text-muted-foreground">
            {description}
          </p>
          {children}
        </main>
      </div>
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
    <Card className="border border-outline-variant/40 shadow-sm">
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
    <div className="rounded-lg border border-dashed border-outline-variant/70 bg-white p-8 text-center text-sm text-muted-foreground">
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
