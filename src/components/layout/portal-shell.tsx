"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  BarChart3,
  Users,
  UserCircle,
  Menu,
  X,
  ChevronRight,
  Store,
  Image,
  MessageSquare,
  Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const sidebarLinks = [
  { href: "/manage-sales", label: "Manage Sales", icon: ShoppingCart },
  { href: "/mini-site/sales", label: "Mini-Site Sales", icon: Store },
];

const mobileNavLinks = sidebarLinks;

interface PortalShellProps {
  children: React.ReactNode;
  user?: {
    full_name: string;
    phone: string;
  };
}

export function PortalShell({ children, user }: PortalShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden flex-shrink-0 border-r border-white/10 bg-navy text-white shadow-[18px_0_60px_rgba(11,31,59,0.12)] transition-[width] duration-200 lg:flex lg:flex-col",
          collapsed ? "lg:w-20" : "lg:w-64"
        )}
      >
        <div className={cn("flex h-20 items-center border-b border-white/10", collapsed ? "justify-center px-3" : "gap-2 px-6")}>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white">
            <span className="text-xs font-bold text-navy">B</span>
          </div>
          {!collapsed ? (
            <span className="text-base font-bold tracking-tight text-white">
              BingwaZone
            </span>
          ) : null}
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {sidebarLinks.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + "/");

            return (
              <Link
                key={link.href}
                href={link.href}
                title={collapsed ? link.label : undefined}
                className={cn(
                  "flex items-center rounded-xl py-2.5 text-sm font-medium transition-colors",
                  collapsed ? "justify-center px-2" : "gap-3 px-3",
                  isActive
                    ? "bg-white text-navy shadow-sm"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                )}
              >
                <link.icon className="h-4 w-4" />
                {!collapsed ? link.label : null}
              </Link>
            );
          })}
        </nav>

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
        </div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform border-r border-outline-variant/40 bg-surface-container-lowest transition-transform duration-200 lg:hidden",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-outline-variant/40 px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-navy">
              <span className="text-xs font-bold text-white">B</span>
            </div>
            <span className="text-base font-bold tracking-tight text-navy">
              BingwaZone
            </span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="space-y-1 px-3 py-4">
          {sidebarLinks.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + "/");

            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-primary"
                    : "text-on-surface-variant hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-outline-variant/40 p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary/10 text-xs text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 truncate">
              <p className="truncate text-sm font-medium">
                {user?.full_name || "User"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user?.phone || ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-outline-variant/30 bg-white/80 px-4 shadow-sm shadow-navy/5 backdrop-blur-xl sm:px-6 lg:h-20 lg:px-8">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
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

          <div className="flex items-center gap-2">
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

        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:py-8 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-outline-variant/30 bg-white/90 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-16px_34px_rgba(11,31,59,0.12)] backdrop-blur-xl lg:hidden"
        aria-label="Portal mobile navigation"
      >
        <div className="flex gap-2 overflow-x-auto px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {mobileNavLinks.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + "/");

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
