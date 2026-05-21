"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ClipboardList,
  FileCheck,
  LayoutDashboard,
  MoreHorizontal,
  Settings,
  Shield,
  Users,
  Wallet,
  Megaphone,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const primaryLinks = [
  { href: "/wazim", label: "Dashboard", icon: LayoutDashboard },
  { href: "/wazim/users", label: "Users", icon: Users },
  { href: "/wazim/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/wazim/submissions", label: "Submissions", icon: FileCheck },
  { href: "/wazim/withdrawals", label: "Withdrawals", icon: Wallet },
] as const;

const moreLinks = [
  { href: "/wazim/banners", label: "Banners", icon: Megaphone },
  { href: "/wazim/fraud", label: "Fraud", icon: Shield },
  { href: "/wazim/audit-log", label: "Audit Log", icon: ClipboardList },
  { href: "/wazim/settings", label: "Settings", icon: Settings },
] as const;

function isRouteActive(pathname: string, href: string) {
  return href === "/wazim" ? pathname === href : pathname.startsWith(href);
}

export function AdminBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = moreLinks.some((link) => isRouteActive(pathname, link.href));

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-gray-100 bg-white px-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 shadow-[0_-16px_34px_rgba(11,31,59,0.12)] md:hidden"
        aria-label="Admin mobile navigation"
      >
        <div className="grid grid-cols-6 gap-1">
          {primaryLinks.map((link) => {
            const isActive = isRouteActive(pathname, link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold transition-colors",
                  isActive
                    ? "bg-pesatrix-blue/10 text-pesatrix-blue"
                    : "text-muted-foreground"
                )}
              >
                <link.icon className="h-5 w-5" />
                <span className="truncate">{link.label}</span>
              </Link>
            );
          })}

          <Button
            variant="ghost"
            className={cn(
              "h-auto flex-col gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold",
              moreActive
                ? "bg-pesatrix-blue/10 text-pesatrix-blue hover:bg-pesatrix-blue/10 hover:text-pesatrix-blue"
                : "text-muted-foreground hover:bg-muted/60"
            )}
            onClick={() => setMoreOpen(true)}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="truncate">More</span>
          </Button>
        </div>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="top-auto w-full max-w-none translate-x-[-50%] translate-y-0 rounded-t-[1.75rem] rounded-b-none border border-outline-variant/30 px-5 pb-8 pt-6 data-[state=closed]:slide-out-to-bottom-8 data-[state=open]:slide-in-from-bottom-8 md:hidden">
          <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-muted" />
          <DialogTitle className="text-left text-base text-navy">More admin tools</DialogTitle>
          <DialogDescription className="text-left">
            Quick access to the remaining admin sections.
          </DialogDescription>

          <div className="mt-2 space-y-2">
            {moreLinks.map((link) => {
              const isActive = isRouteActive(pathname, link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors",
                    isActive
                      ? "border-pesatrix-blue/20 bg-pesatrix-blue/10 text-pesatrix-blue"
                      : "border-outline-variant/40 bg-white text-navy"
                  )}
                >
                  <link.icon className="h-4 w-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
