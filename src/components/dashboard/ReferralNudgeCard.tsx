"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const DISMISS_KEY = "pesatrix_referral_nudge_dismissed";

export function ReferralNudgeCard({ activatedReferralCount }: { activatedReferralCount: number }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "true");
  }, []);

  if (dismissed) {
    return null;
  }

  const message =
    activatedReferralCount === 0
      ? "Your friend really needs this. Share Pesatrix with someone you trust and earn together."
      : activatedReferralCount < 5
        ? "You're building your community. Members with 5+ active friends get first access to premium tasks."
        : "Your community is strong. You're getting priority on all new tasks.";

  return (
    <Card className="border border-pesatrix-blue/20 bg-pesatrix-blue/5 shadow-sm">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-pesatrix-blue">
            <Users className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium leading-6 text-navy">{message}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild size="sm">
            <Link href="/dashboard/referrals">Share</Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              window.localStorage.setItem(DISMISS_KEY, "true");
              setDismissed(true);
            }}
            aria-label="Dismiss referral nudge"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
