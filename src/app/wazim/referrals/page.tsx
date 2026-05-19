import Link from "next/link";

import { ReferralCreateForm, ReferralRowActions } from "@/components/admin/referral-admin-actions";
import { AdminPageShell, EmptyState, MetricCard, StatusBadge } from "@/components/admin/admin-native";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildReferralLink, getAppBaseUrl } from "@/lib/app-url";
import { getReferralProgramSettings } from "@/lib/referral-program";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { money, requireWazimAdmin, shortDate } from "@/lib/wazim-admin";

type ReferralRow = {
  id: string;
  referrer_id: string;
  referee_id: string;
  level: 1 | 2 | 3;
  source: "signup" | "admin" | "import";
  created_at: string;
};

type ReferralBonusRow = {
  id: string;
  referrer_id: string;
  referee_id: string;
  level: 1 | 2 | 3;
  amount: number;
  status: "pending" | "available" | "revoked";
  available_at: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  referral_code: string;
};

function labelForProfile(profile: ProfileRow | undefined, fallback: string) {
  return profile?.full_name?.trim() || profile?.email?.trim() || profile?.phone?.trim() || fallback;
}

export default async function AdminReferralsPage() {
  const adminSession = await requireWazimAdmin();
  const admin = createAdminSupabaseClient();
  const appBaseUrl = await getAppBaseUrl();
  const rules = await getReferralProgramSettings();

  const [
    referralCounts,
    level1Counts,
    recentReferralResult,
    recentBonusResult,
    referralLinksCountResult,
    pendingBonusTotals,
    availableBonusTotals,
  ] = await Promise.all([
    (admin.from("referrals" as never) as any)
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    (admin.from("referrals" as never) as any)
      .select("id", { count: "exact", head: true })
      .eq("level", 1),
    (admin.from("referrals" as never) as any)
      .select("id, referrer_id, referee_id, level, source, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    (admin.from("referral_bonuses" as never) as any)
      .select("id, referrer_id, referee_id, level, amount, status, available_at, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
    (admin.from("profiles" as never) as any)
      .select("id", { count: "exact", head: true })
      .not("referral_code", "is", null),
    (admin.from("referral_bonuses" as never) as any)
      .select("amount", { count: "exact" })
      .eq("status", "pending"),
    (admin.from("referral_bonuses" as never) as any)
      .select("amount", { count: "exact" })
      .eq("status", "available"),
  ]);

  const referrals = (recentReferralResult.data ?? []) as ReferralRow[];
  const bonuses = (recentBonusResult.data ?? []) as ReferralBonusRow[];
  const pendingBonuses = (pendingBonusTotals.data ?? []) as Array<{ amount: number }>;
  const availableBonuses = (availableBonusTotals.data ?? []) as Array<{ amount: number }>;

  const profileIds = Array.from(
    new Set([
      ...referrals.flatMap((row) => [row.referrer_id, row.referee_id]),
      ...bonuses.flatMap((row) => [row.referrer_id, row.referee_id]),
    ])
  );

  const profiles = new Map<string, ProfileRow>();

  if (profileIds.length > 0) {
    const { data: profileRows, error: profileError } = await (admin.from("profiles" as never) as any)
      .select("id, full_name, email, phone, referral_code")
      .in("id", profileIds);

    if (profileError) {
      throw profileError;
    }

    for (const row of (profileRows ?? []) as ProfileRow[]) {
      profiles.set(row.id, row);
    }
  }

  return (
    <AdminPageShell
      admin={adminSession}
      title="Referrals"
      description="Track direct signups, multi-level bonuses, and the live payout configuration for the referral program."
    >
      <section className="grid gap-4 md:grid-cols-5">
        <MetricCard label="Referral Links" value={referralLinksCountResult.count ?? 0} detail="Profiles with generated referral codes" />
        <MetricCard label="Latest Referral Records" value={referralCounts.count ?? 0} detail="Created in the last 7 days" />
        <MetricCard
          label="Pending Bonuses"
          value={pendingBonusTotals.count ?? 0}
          detail={money(pendingBonuses.reduce((sum, row) => sum + Number(row.amount ?? 0), 0))}
          tone="amber"
        />
        <MetricCard
          label="Available Bonuses"
          value={availableBonusTotals.count ?? 0}
          detail={money(availableBonuses.reduce((sum, row) => sum + Number(row.amount ?? 0), 0))}
          tone="teal"
        />
        <MetricCard label="Level 1 Referrals" value={level1Counts.count ?? 0} detail="Direct referrals only" />
      </section>

      <Card className="mt-6 border border-outline-variant/40 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-navy">Create Referral</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ReferralCreateForm />
          <p className="text-sm text-muted-foreground">
            Direct referral assignment accepts a user ID, referral code, email, or phone for both people. If the referee is already activated, any missing referral bonus is credited immediately without duplicate payout.
          </p>
        </CardContent>
      </Card>

      <Card className="mt-6 border border-outline-variant/40 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-navy">Referral Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {rules.levels.map((rule) => (
            <div key={rule.level} className="rounded-lg border border-outline-variant/40 bg-white p-4">
              <p className="text-sm font-medium text-navy">Level {rule.level}</p>
              <p className="mt-2 text-2xl font-bold text-navy">{money(rule.amount)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Unlock rule: paid activation</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mt-6 border border-outline-variant/40 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-navy">Referral Network</CardTitle>
        </CardHeader>
        <CardContent>
          {referrals.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referrer</TableHead>
                  <TableHead>Referrer Link</TableHead>
                  <TableHead>Referee</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Operations</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.map((row) => {
                  const referrer = profiles.get(row.referrer_id);
                  const referee = profiles.get(row.referee_id);
                  const referrerLink = buildReferralLink(appBaseUrl, referrer?.referral_code ?? null);

                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link className="font-semibold text-pesatrix-blue" href={`/wazim/users/${row.referrer_id}`}>
                          {labelForProfile(referrer, row.referrer_id)}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground">{referrerLink}</TableCell>
                      <TableCell>
                        <Link className="font-semibold text-pesatrix-blue" href={`/wazim/users/${row.referee_id}`}>
                          {labelForProfile(referee, row.referee_id)}
                        </Link>
                      </TableCell>
                      <TableCell>Level {row.level}</TableCell>
                      <TableCell>{row.source}</TableCell>
                      <TableCell>{shortDate(row.created_at)}</TableCell>
                      <TableCell>
                        <ReferralRowActions referralId={row.id} source={row.source} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <EmptyState>No referral records yet.</EmptyState>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6 border border-outline-variant/40 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-navy">Referral Bonuses</CardTitle>
        </CardHeader>
        <CardContent>
          {bonuses.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referrer</TableHead>
                  <TableHead>Referee</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Available</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bonuses.map((bonus) => (
                  <TableRow key={bonus.id}>
                    <TableCell>
                      <Link className="text-pesatrix-blue" href={`/wazim/users/${bonus.referrer_id}`}>
                        {labelForProfile(profiles.get(bonus.referrer_id), bonus.referrer_id)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Link className="text-pesatrix-blue" href={`/wazim/users/${bonus.referee_id}`}>
                        {labelForProfile(profiles.get(bonus.referee_id), bonus.referee_id)}
                      </Link>
                    </TableCell>
                    <TableCell>Level {bonus.level}</TableCell>
                    <TableCell>{money(bonus.amount)}</TableCell>
                    <TableCell><StatusBadge status={bonus.status} /></TableCell>
                    <TableCell>{shortDate(bonus.available_at ?? bonus.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState>No referral bonuses recorded yet.</EmptyState>
          )}
        </CardContent>
      </Card>
    </AdminPageShell>
  );
}
