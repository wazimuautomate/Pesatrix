import { TrendingUp, Users } from "lucide-react";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatKSh } from "@/lib/utils";
import { ReferralActions } from "./referral-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata = { title: "Referrals" };

type Profile = {
  referral_code: string | null;
};

type Referral = {
  id: string;
  level: number;
  referred_id: string;
  created_at: string;
};

type ReferralBonus = {
  amount: number;
  level: number;
  status: string;
  created_at: string;
};

export default async function ReferralsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profileRow }, { data: referralRows }, { data: bonusRows }] = await Promise.all([
    supabase.from("profiles").select("referral_code").eq("id", user!.id).single(),
    supabase
      .from("referrals")
      .select("id, level, referred_id, created_at")
      .eq("referrer_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("referral_bonuses")
      .select("amount, level, status, created_at")
      .eq("referrer_id", user!.id)
      .order("created_at", { ascending: false }),
  ]);

  const profile = profileRow as Profile | null;
  const referralLink = `${process.env.NEXT_PUBLIC_APP_URL || "https://pesatrix.com"}/register?ref=${profile?.referral_code || ""}`;
  const referrals = (referralRows ?? []) as Referral[];
  const bonuses = (bonusRows ?? []) as ReferralBonus[];

  const level1 = referrals.filter((row) => row.level === 1);
  const level2 = referrals.filter((row) => row.level === 2);
  const level3 = referrals.filter((row) => row.level === 3);
  const totalBonusEarned = bonuses
    .filter((bonus) => bonus.status === "available")
    .reduce((sum, bonus) => sum + bonus.amount, 0);
  const pendingBonus = bonuses
    .filter((bonus) => bonus.status !== "available")
    .reduce((sum, bonus) => sum + bonus.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy">
          Referral Program
        </h1>
        <p className="text-sm text-muted-foreground">
          Referral links are captured at signup, kept pending, then released when activations clear.
        </p>
      </div>

      <Card className="border-primary/20 bg-accent">
        <CardContent className="pt-6">
          <p className="text-sm font-medium text-foreground">Your Referral Link</p>
          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex-1 rounded-md border border-outline-variant bg-background px-3 py-2 text-sm text-muted-foreground">
              {referralLink}
            </div>
            <ReferralActions referralLink={referralLink} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Code: {profile?.referral_code || "Unavailable"}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card className="border-outline-variant/40">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-teal" />
              Available Earned
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-navy">
              {formatKSh(totalBonusEarned)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-outline-variant/40">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-primary" />
              Pending
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-navy">
              {formatKSh(pendingBonus)}
            </p>
          </CardContent>
        </Card>

        {[level1, level2, level3].map((rows, index) => (
          <Card key={index} className="border-outline-variant/40">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4 text-primary" />
                Level {index + 1}
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-navy">
                {rows.length}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-outline-variant/40">
        <CardHeader>
          <CardTitle className="text-base text-navy">Referral payout rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-on-surface-variant">
          <div className="rounded-xl border border-outline-variant/40 p-4">
            <p className="font-medium text-foreground">Level 1</p>
            <p className="mt-1">Direct referral activates: earn KSh 100 immediately.</p>
          </div>
          <div className="rounded-xl border border-outline-variant/40 p-4">
            <p className="font-medium text-foreground">Level 2</p>
            <p className="mt-1">Your referral&apos;s referral activates: earn KSh 50.</p>
          </div>
          <div className="rounded-xl border border-outline-variant/40 p-4">
            <p className="font-medium text-foreground">Level 3</p>
            <p className="mt-1">Third-level activation clears: earn KSh 25.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-outline-variant/40">
        <CardHeader>
          <CardTitle className="text-base text-navy">Latest referral bonuses</CardTitle>
        </CardHeader>
        <CardContent>
          {bonuses.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Level</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bonuses.slice(0, 8).map((bonus, index) => (
                  <TableRow key={`${bonus.level}-${bonus.created_at}-${index}`}>
                    <TableCell>Level {bonus.level}</TableCell>
                    <TableCell>{formatKSh(bonus.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={bonus.status === "available" ? "success" : "warning"}>
                        {bonus.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(bonus.created_at).toLocaleDateString("en-KE", {
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              No referral bonuses yet. Share your link to start building the chain.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
