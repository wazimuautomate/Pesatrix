"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, CreditCard, ArrowDownToLine, BookOpen,
  Users2, ClipboardList, HeadphonesIcon, Shield, Settings, LogOut,
  ChevronLeft, ChevronRight, FileText, Megaphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
  { href: "/wazim/banners", label: "Banners", icon: Megaphone },
  { href: "/wazim/fraud", label: "Fraud & Risk", icon: Shield },
  { href: "/wazim/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [supabase] = useState(() => createClient());

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/wazim/login");
    router.refresh();
  }

  return (
    <aside
      className={cn(
        "hidden flex-shrink-0 border-r border-white/10 bg-navy text-white shadow-[18px_0_60px_rgba(11,31,59,0.12)] transition-all duration-200 lg:flex lg:flex-col",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn("flex h-20 items-center justify-between border-b border-white/10", collapsed ? "gap-1 px-2" : "px-4")}>
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
          className="flex h-9 w-9 items-center justify-center rounded-xl text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
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
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-white text-navy shadow-sm"
                  : "text-white/62 hover:bg-white/10 hover:text-white",
                collapsed && "justify-center px-0"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                  isActive ? "bg-pesatrix-blue/10 text-pesatrix-blue" : "bg-white/10 text-white/75 group-hover:bg-white/15 group-hover:text-white"
                )}
              >
                <link.icon className="h-4 w-4" />
              </span>
              {!collapsed && <span>{link.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="border-t border-white/10 p-3">
        <Button
          variant="ghost"
          type="button"
          disabled={signingOut}
          onClick={handleSignOut}
          className={cn(
            "w-full justify-start rounded-xl text-white/60 hover:bg-white/10 hover:text-white",
            collapsed && "justify-center"
          )}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-3">{signingOut ? "Signing out..." : "Sign Out"}</span>}
        </Button>
      </div>
    </aside>
  );
}
