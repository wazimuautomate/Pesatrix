"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, CreditCard, ArrowDownToLine, BookOpen,
  Users2, ClipboardList, HeadphonesIcon, Shield, Settings, LogOut,
  ChevronLeft, ChevronRight, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const adminLinks = [
  { href: "/wazim", label: "Overview", icon: LayoutDashboard },
  { href: "/wazim/users", label: "Users", icon: Users },
  { href: "/wazim/training", label: "Training", icon: BookOpen },
  { href: "/wazim/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/wazim/submissions", label: "Submissions", icon: FileText },
  { href: "/wazim/withdrawals", label: "Withdrawals", icon: ArrowDownToLine },
  { href: "/wazim/payments", label: "Payments", icon: CreditCard },
  { href: "/wazim/referrals", label: "Referrals", icon: Users2 },
  { href: "/wazim/support", label: "Support", icon: HeadphonesIcon },
  { href: "/wazim/fraud", label: "Fraud & Risk", icon: Shield },
  { href: "/wazim/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden flex-shrink-0 border-r border-outline-variant/40 bg-navy text-white transition-all duration-200 lg:flex lg:flex-col",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn("flex h-16 items-center justify-between border-b border-white/10", collapsed ? "gap-1 px-2" : "px-4")}>
        <div className={cn("flex items-center", collapsed ? "justify-center" : "gap-3")}>
          <BrandLogo size={collapsed ? "compact" : "sidebarExpanded"} inverted />
          {!collapsed && (
            <span className="text-base font-bold tracking-tight">
              Pesatrix Wazim
            </span>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {adminLinks.map((link) => {
          const isActive =
            link.href === "/wazim"
              ? pathname === "/wazim"
              : pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              title={collapsed ? link.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-white/15 text-white"
                  : "text-white/60 hover:bg-white/10 hover:text-white",
                collapsed && "justify-center px-0"
              )}
            >
              <link.icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span>{link.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="border-t border-white/10 p-3">
        <Button
          asChild
          variant="ghost"
          className={cn(
            "w-full justify-start text-white/60 hover:bg-white/10 hover:text-white",
            collapsed && "justify-center"
          )}
        >
          <Link href="/login">
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-3">Sign Out</span>}
          </Link>
        </Button>
      </div>
    </aside>
  );
}
