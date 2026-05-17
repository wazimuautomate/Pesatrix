"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Coins,
  Copy,
  ExternalLink,
  Mail,
  MessageCircle,
  Share2,
  TimerReset,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatKSh } from "@/lib/utils";

type ReferralRow = {
  id: string;
  level: 1 | 2 | 3;
  referred_id: string;
  referredName: string;
  created_at: string;
};

type ReferralBonusRow = {
  id: string;
  amount: number;
  level: 1 | 2 | 3;
  created_at: string;
  status: "pending" | "available" | "revoked";
  referee_id: string;
};

type Props = {
  referralCode: string;
  referralLink: string;
  referrals: ReferralRow[];
  bonuses: ReferralBonusRow[];
};

function shareUrl(kind: "email" | "whatsapp" | "facebook", link: string) {
  const shareText = `Join me on Pesatrix and use my referral link to register: ${link}`;

  if (kind === "email") {
    return `mailto:?subject=${encodeURIComponent("Join me on Pesatrix")}&body=${encodeURIComponent(shareText)}`;
  }

  if (kind === "whatsapp") {
    return `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  }

  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;
}

export function ReferralsClient({ referralCode, referralLink, referrals, bonuses }: Props) {
  const [copied, setCopied] = useState(false);

  const levelStats = useMemo(() => {
    return [1, 2, 3].map((level) => {
      const totalReferrals = referrals.filter((row) => row.level === level).length;
      const activatedBonuses = bonuses.filter(
        (row) => row.level === level && row.status === "available"
      ).length;
      const totalBonus = bonuses
        .filter((row) => row.level === level && row.status === "available")
        .reduce((sum, row) => sum + row.amount, 0);

      return {
        level: level as 1 | 2 | 3,
        totalReferrals,
        activatedBonuses,
        pendingActivations: Math.max(0, totalReferrals - activatedBonuses),
        totalBonus,
      };
    });
  }, [bonuses, referrals]);

  const totalEarned = bonuses
    .filter((row) => row.status === "available")
    .reduce((sum, row) => sum + row.amount, 0);

  const directPending = levelStats.find((row) => row.level === 1)?.pendingActivations ?? 0;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      toast.success("Referral link copied");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Copy failed");
    }
  }

  async function handleNativeShare() {
    if (!navigator.share) {
      window.open(shareUrl("whatsapp", referralLink), "_blank", "noopener,noreferrer");
      return;
    }

    try {
      await navigator.share({
        title: "Join me on Pesatrix",
        text: "Use my referral link to register on Pesatrix.",
        url: referralLink,
      });
    } catch {
      // Ignore user-cancelled share attempts.
    }
  }

  function openShare(kind: "email" | "whatsapp" | "facebook") {
    window.open(shareUrl(kind, referralLink), "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-outline-variant/50 bg-[linear-gradient(135deg,rgba(9,31,59,0.98),rgba(16,73,163,0.92)_45%,rgba(11,31,59,0.98))] p-6 text-white shadow-[0_24px_70px_rgba(11,31,59,0.22)]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl space-y-3">
            <Badge className="w-fit bg-white/12 px-3 py-1 text-white" variant="outline">
              <Users className="mr-1.5 h-3.5 w-3.5" />
              3-level activation rewards
            </Badge>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/70">
                Referral Program
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">
                Track pending signups now, then get paid the moment activation lands
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-white/78">
                Referral relationships are captured at signup and kept pending until activation. Once the account is
                activated, level 1, 2, and 3 bonuses credit to the wallet immediately and queue an email notification.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">Referral code</p>
              <p className="mt-2 text-2xl font-bold">{referralCode || "Pending"}</p>
            </div>
            <div className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">Total earned</p>
              <p className="mt-2 text-2xl font-bold">{formatKSh(totalEarned)}</p>
            </div>
            <div className="rounded-2xl border border-white/12 bg-white/8 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-white/60">Pending direct activations</p>
              <p className="mt-2 text-2xl font-bold">{directPending}</p>
            </div>
          </div>
        </div>
      </div>

      <Card className="border-primary/20 bg-accent">
        <CardContent className="space-y-4 pt-6">
          <div>
            <p className="text-sm font-medium text-foreground">Your Referral Link</p>
            <div className="mt-3 rounded-2xl border border-outline-variant bg-background px-4 py-3 text-sm text-muted-foreground">
              {referralLink}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Signup visits with this link can auto-fill your code during registration.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={handleCopy}>
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? "Copied" : "Copy link"}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem onClick={() => openShare("email")}>
                  <Mail className="mr-2 h-4 w-4" />
                  Share by email
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openShare("whatsapp")}>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Share on WhatsApp
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openShare("facebook")}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Share on Facebook
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button onClick={handleNativeShare}>
              <Share2 className="mr-2 h-4 w-4" />
              Quick share
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-outline-variant/40">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Coins className="h-4 w-4 text-teal" />
              Available referral earnings
            </div>
            <p className="mt-2 text-2xl font-bold text-navy">{formatKSh(totalEarned)}</p>
          </CardContent>
        </Card>

        {levelStats.map((row) => (
          <Card key={row.level} className="border-outline-variant/40">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4 text-primary" />
                Level {row.level}
              </div>
              <p className="mt-2 text-2xl font-bold text-navy">{row.totalReferrals}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {row.activatedBonuses} activated · {row.pendingActivations} pending
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr,1.08fr]">
        <Card className="border-outline-variant/40">
          <CardHeader>
            <CardTitle className="text-base text-navy">Commission Structure</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-on-surface-variant">
            {[
              { level: "L1", title: "20% of KSh 500", body: "KSh 100 when your direct referral activates." },
              { level: "L2", title: "10% of KSh 500", body: "KSh 50 when your referral's referral activates." },
              { level: "L3", title: "5% of KSh 500", body: "KSh 25 when third-level activations land." },
            ].map((item) => (
              <div key={item.level} className="rounded-2xl border border-outline-variant/40 p-4">
                <div className="flex items-center gap-3">
                  <Badge variant="default">{item.level}</Badge>
                  <div>
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="mt-1">{item.body}</p>
                  </div>
                </div>
              </div>
            ))}

            <div className="rounded-2xl border border-dashed border-outline-variant/50 p-4 text-muted-foreground">
              Email delivery is now queued in-app on activation. A sender worker/provider still needs to process the outbox.
            </div>
          </CardContent>
        </Card>

        <Card className="border-outline-variant/40">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base text-navy">Referral Pipeline</CardTitle>
            <Badge variant="muted">
              <TimerReset className="mr-1.5 h-3.5 w-3.5" />
              Pending until activation
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {referrals.length > 0 ? (
              referrals.map((row) => {
                const bonus = bonuses.find(
                  (entry) => entry.level === row.level && entry.referee_id === row.referred_id
                );

                return (
                  <div key={row.id} className="rounded-2xl border border-outline-variant/40 bg-white px-4 py-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold text-navy">{row.referredName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Level {row.level} referral · joined{" "}
                          {new Date(row.created_at).toLocaleDateString("en-KE", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <Badge variant={bonus ? "success" : "warning"}>
                          {bonus ? "Activated" : "Pending activation"}
                        </Badge>
                        <p className="mt-2 text-sm font-semibold text-navy">
                          {bonus ? formatKSh(bonus.amount) : "Awaiting release"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-outline-variant/50 px-4 py-8 text-center text-sm text-muted-foreground">
                No referrals yet. Share your link to start building the activation pipeline.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
