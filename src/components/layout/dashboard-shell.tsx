"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  History,
  Wallet,
  Users,
  HeadphonesIcon,
  UserCircle,
  Gift,
  GraduationCap,
  Bell,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const sidebarLinks = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/submissions", label: "My Submissions", icon: History },
  { href: "/dashboard/wallet", label: "Wallet", icon: Wallet },
  { href: "/dashboard/referrals", label: "Referrals", icon: Users },
  { href: "/dashboard/rewards", label: "Daily Rewards", icon: Gift },
  { href: "/dashboard/training", label: "Training", icon: GraduationCap },
  { href: "/dashboard/support", label: "Support", icon: HeadphonesIcon },
  { href: "/dashboard/profile", label: "Profile", icon: UserCircle },
];

const mobileNavLinks = [
  sidebarLinks[0],
  sidebarLinks[1],
  sidebarLinks[2],
  sidebarLinks[5],
  sidebarLinks[7],
  sidebarLinks[6],
  sidebarLinks[3],
  sidebarLinks[4],
  sidebarLinks[8],
];

const immersiveDashboardRoutes = new Set([
  "/dashboard/tasks/preview",
]);

interface DashboardShellProps {
  children: React.ReactNode;
  user?: {
    full_name: string;
    phone: string;
  };
}

export function DashboardShell({ children, user }: DashboardShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isImmersiveRoute =
    immersiveDashboardRoutes.has(pathname) ||
    (pathname.startsWith("/dashboard/tasks/") &&
      pathname !== "/dashboard/tasks" &&
      pathname !== "/dashboard/tasks/preview");

  if (isImmersiveRoute) {
    return <>{children}</>;
  }

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <div className="dashboard-canvas flex min-h-screen">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden flex-shrink-0 border-r border-white/10 bg-navy text-white shadow-[18px_0_60px_rgba(11,31,59,0.12)] transition-[width] duration-200 lg:flex lg:flex-col",
          collapsed ? "lg:w-20" : "lg:w-64"
        )}
      >
        {/* Logo */}
        <div className={cn("flex h-20 items-center border-b border-white/10", collapsed ? "justify-center px-3" : "gap-2 px-6")}>
          <BrandLogo size={collapsed ? "topbar" : "sidebar"} inverted />
          {!collapsed ? (
            <span className="text-base font-bold tracking-tight text-white">
              Pesatrix
            </span>
          ) : null}
        </div>

        {/* Nav Links */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {sidebarLinks.map((link) => {
            const isActive =
              link.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                title={collapsed ? link.label : undefined}
                className={cn(
                  "group flex items-center rounded-xl py-2.5 text-sm font-medium transition-all duration-200",
                  collapsed ? "justify-center px-2" : "gap-3 px-3",
                  isActive
                    ? "bg-white text-navy shadow-sm"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                    isActive ? "bg-pesatrix-blue/10 text-pesatrix-blue" : "bg-white/10 text-white/75 group-hover:bg-white/15 group-hover:text-white"
                  )}
                >
                  <link.icon className="h-4 w-4" />
                </span>
                {!collapsed ? link.label : null}
              </Link>
            );
          })}
        </nav>

        {/* User Info */}
        <div className={cn("border-t border-white/10", collapsed ? "p-3" : "p-4")}>
          <div className={cn("rounded-2xl bg-white/10", collapsed ? "flex justify-center p-2" : "flex items-center gap-3 p-3")}>
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-white text-xs text-navy">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!collapsed ? (
              <div className="flex-1 truncate">
                <p className="truncate text-sm font-medium text-white">
                  {user?.full_name || "User"}
                </p>
                <p className="truncate text-xs text-white/58">
                  {user?.phone || ""}
                </p>
              </div>
            ) : null}
          </div>
          <Button
            asChild
            variant="ghost"
            className={cn(
              "mt-3 w-full justify-start rounded-xl text-white/70 hover:bg-white/10 hover:text-white",
              collapsed && "justify-center px-0"
            )}
          >
            <Link href="/login">
              <LogOut className="h-4 w-4" />
              {!collapsed && <span className="ml-3">Log out</span>}
            </Link>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Top Bar (Mobile + Desktop) */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-outline-variant/30 bg-white/80 px-4 shadow-sm shadow-navy/5 backdrop-blur-xl sm:px-6 lg:h-20 lg:px-8">
          {/* Mobile: Logo */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 lg:hidden">
              <BrandLogo size="topbar" />
              <span className="text-base font-bold tracking-tight text-navy">
                Pesatrix
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex"
              onClick={() => setCollapsed((current) => !current)}
            >
              <ChevronRight
                className={cn("h-5 w-5 transition-transform", collapsed ? "rotate-0" : "rotate-180")}
              />
            </Button>
          </div>

          {/* Desktop: Page Title Area */}
          <div className="hidden lg:block" />

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" asChild className="lg:hidden">
              <Link href="/dashboard/profile">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-xs text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Link>
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:py-8 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-outline-variant/30 bg-white/90 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-16px_34px_rgba(11,31,59,0.12)] backdrop-blur-xl lg:hidden"
        aria-label="Dashboard mobile navigation"
      >
        <div className="flex gap-2 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {mobileNavLinks.map((link) => {
            const isActive =
              link.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex min-w-[4.75rem] flex-none flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-[11px] font-medium leading-tight transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-on-surface-variant hover:bg-accent/60 hover:text-foreground"
                )}
              >
                <link.icon className="h-5 w-5" />
                <span className="whitespace-nowrap">{link.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
