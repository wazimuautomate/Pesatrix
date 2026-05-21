"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  FileCheck,
  LayoutDashboard,
  Settings,
  Shield,
  Users,
  Wallet,
  Megaphone,
  BookOpen,
  CreditCard,
  Users2,
  HeadphonesIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const adminLinks = [
  { href: "/wazim", label: "Dash", icon: LayoutDashboard },
  { href: "/wazim/users", label: "Users", icon: Users },
  { href: "/wazim/training", label: "Training", icon: BookOpen },
  { href: "/wazim/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/wazim/submissions", label: "Submissions", icon: FileCheck },
  { href: "/wazim/withdrawals", label: "With", icon: Wallet },
  { href: "/wazim/payments", label: "Pay", icon: CreditCard },
  { href: "/wazim/referrals", label: "Referrals", icon: Users2 },
  { href: "/wazim/support", label: "Sup", icon: HeadphonesIcon },
  { href: "/wazim/banners", label: "Banners", icon: Megaphone },
  { href: "/wazim/fraud", label: "Fraud", icon: Shield },
  { href: "/wazim/settings", label: "Set", icon: Settings },
] as const;

function isRouteActive(pathname: string, href: string) {
  return href === "/wazim" ? pathname === href : pathname.startsWith(href);
}

export function AdminBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-outline-variant/20 bg-card px-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 shadow-[0_-16px_34px_rgba(11,31,59,0.12)] md:hidden"
      aria-label="Admin mobile navigation"
    >
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory px-2 py-1">
        {adminLinks.map((link) => {
          const isActive = isRouteActive(pathname, link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex min-w-[68px] flex-shrink-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-semibold transition-colors snap-center",
                isActive
                  ? "bg-pesatrix-blue/10 text-pesatrix-blue"
                  : "text-muted-foreground hover:bg-muted/40"
              )}
            >
              <link.icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
