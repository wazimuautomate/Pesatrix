import { AlertCircle, TrendingUp, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReferralActions } from "./referral-actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatKSh } from "@/lib/utils";
import { getAppBaseUrl } from "@/lib/app-url";
import { getUserReferralDashboardData } from "@/lib/referral-dashboard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Referrals" };

function formatReferralDate(value: string | null | undefined) {
  if (!value) return "Not set";

  return new Intl.DateTimeFormat("en-KE", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "Africa/Nairobi",
  }).format(new Date(value));
}

export default async function ReferralsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  try {
    const appBaseUrl = await getAppBaseUrl();
    const data = await getUserReferralDashboardData(user.id, appBaseUrl);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy">Referral Program</h1>
          <p className="text-sm text-muted-foreground">
            Referral links are captured at signup and bonuses unlock after the referred account finishes paid activation.
          </p>
        </div>

        <Card className="border-primary/20 bg-accent">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-foreground">Your Referral Link</p>
            <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex-1 rounded-md border border-outline-variant bg-background px-3 py-2 text-sm text-muted-foreground">
                {data.referralLink}
              </div>
              <ReferralActions referralLink={data.referralLink} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Code: {data.referralCode}</p>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-outline-variant/40">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-teal" />
                Available Earned
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-navy">{formatKSh(data.availableEarned)}</p>
            </CardContent>
          </Card>

          <Card className="border-outline-variant/40">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-primary" />
                Pending
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-navy">{formatKSh(data.pendingEarned)}</p>
            </CardContent>
          </Card>

          <Card className="border-outline-variant/40">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4 text-primary" />
                Direct Referrals
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-navy">{data.referralCount}</p>
            </CardContent>
          </Card>

          <Card className="border-outline-variant/40">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4 text-primary" />
                Referral Bonus
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-navy">{formatKSh(data.rules.rewardAmount)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr,1.05fr]">
          <Card className="border-outline-variant/40">
            <CardHeader>
              <CardTitle className="text-base text-navy">Referral payout rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-on-surface-variant">
              <div className="rounded-xl border border-outline-variant/40 p-4">
                <p className="font-medium text-foreground">Referral Bonus - {formatKSh(data.rules.rewardAmount)}</p>
                <p className="mt-1">Earn KSh 100 when your direct referral completes paid activation.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-outline-variant/40">
            <CardHeader>
              <CardTitle className="text-base text-navy">Referral pipeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.network.length > 0 ? (
                data.network.slice(0, 10).map((row) => {
                  return (
                    <div key={row.id} className="rounded-xl border border-outline-variant/40 bg-white px-4 py-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-navy">{row.referredName}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Direct referral joined {formatReferralDate(row.createdAt)}
                          </p>
                        </div>
                        <div className="text-left sm:text-right">
                          <Badge variant={row.bonusStatus === "available" ? "success" : "warning"}>
                            {row.bonusStatus === "available" ? "Activated" : "Pending activation"}
                          </Badge>
                          <p className="mt-2 text-sm font-semibold text-navy">
                            {row.bonusAmount !== null ? formatKSh(row.bonusAmount) : "Awaiting activation"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">No referrals yet. Share your link to start building the network.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-outline-variant/40">
          <CardHeader>
            <CardTitle className="text-base text-navy">Latest referral bonuses</CardTitle>
          </CardHeader>
          <CardContent>
            {data.latestBonuses.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referred user</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.latestBonuses.map((bonus) => (
                    <TableRow key={bonus.id}>
                      <TableCell>{bonus.referredUser}</TableCell>
                      <TableCell>{formatKSh(bonus.amount)}</TableCell>
                      <TableCell>
                        <Badge variant={bonus.status === "available" ? "success" : "warning"}>{bonus.status}</Badge>
                      </TableCell>
                      <TableCell>{formatReferralDate(bonus.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">No referral bonuses yet. Share your link to start earning from direct referrals.</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  } catch (error) {
    console.error("[ReferralsPage]", error);

    return (
      <Card className="border-destructive/30">
        <CardContent className="flex items-start gap-3 pt-6 text-sm text-muted-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
          <div>
            <p className="font-medium text-foreground">Referral data could not be loaded.</p>
            <p className="mt-1">Refresh the page or check the referral configuration if the problem persists.</p>
          </div>
        </CardContent>
      </Card>
    );
  }
}
