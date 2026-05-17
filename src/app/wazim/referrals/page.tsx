import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminPageShell, EmptyState, MetricCard, StatusBadge } from "@/components/admin/admin-native";
import { ReferralCreateForm, ReferralRowActions } from "@/components/admin/referral-admin-actions";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { asArray, firstRelation, money, requireWazimAdmin, shortDate } from "@/lib/wazim-admin";

export default async function AdminReferralsPage() {
  const adminSession = await requireWazimAdmin();
  const admin = createAdminSupabaseClient();
  const [referralResult, bonusResult] = await Promise.all([
    (admin.from("referrals" as never) as any)
      .select("id, referrer_id, referee_id, level, source, created_at, referrer:profiles!referrals_referrer_id_fkey(full_name, email, referral_code), referee:profiles!referrals_referee_id_fkey(full_name, email, phone)")
      .order("created_at", { ascending: false })
      .limit(100),
    (admin.from("referral_bonuses" as never) as any)
      .select("id, referrer_id, referee_id, level, amount, status, available_at, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  const referrals = asArray<any>(referralResult.data);
  const bonuses = asArray<any>(bonusResult.data);
  const pending = bonuses.filter((bonus) => bonus.status === "pending");
  const available = bonuses.filter((bonus) => bonus.status === "available");

  return (
    <AdminPageShell
      admin={adminSession}
      title="Referrals"
      description="Track referral relationships, bonus status, level depth, and pending referral money before release."
    >
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Referral links" value={referrals.length} detail="Latest referral records" />
        <MetricCard label="Pending bonuses" value={pending.length} detail={money(pending.reduce((sum, row) => sum + Number(row.amount ?? 0), 0))} tone="amber" />
        <MetricCard label="Available bonuses" value={available.length} detail={money(available.reduce((sum, row) => sum + Number(row.amount ?? 0), 0))} tone="teal" />
        <MetricCard label="Level 1 referrals" value={referrals.filter((row) => row.level === 1).length} detail="Direct referrals" />
      </section>

      <Card className="mt-6 border border-outline-variant/40 shadow-sm">
        <CardHeader><CardTitle className="text-lg text-navy">Create Referral</CardTitle></CardHeader>
        <CardContent>
          <ReferralCreateForm />
        </CardContent>
      </Card>

      <Card className="mt-6 border border-outline-variant/40 shadow-sm">
        <CardHeader><CardTitle className="text-lg text-navy">Referral Network</CardTitle></CardHeader>
        <CardContent>
          {referrals.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referrer</TableHead>
                  <TableHead>Referee</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Operations</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {referrals.map((row) => {
                  const referrer = firstRelation<any>(row.referrer);
                  const referee = firstRelation<any>(row.referee);

                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link className="font-semibold text-pesatrix-blue" href={`/wazim/users/${row.referrer_id}`}>
                          {referrer?.full_name ?? referrer?.email ?? row.referrer_id}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link className="font-semibold text-pesatrix-blue" href={`/wazim/users/${row.referee_id}`}>
                          {referee?.full_name ?? referee?.email ?? row.referee_id}
                        </Link>
                      </TableCell>
                      <TableCell>{row.level}</TableCell>
                      <TableCell>{row.source}</TableCell>
                      <TableCell>{shortDate(row.created_at)}</TableCell>
                      <TableCell>
                        <ReferralRowActions referralId={row.id} level={row.level} source={row.source} />
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
        <CardHeader><CardTitle className="text-lg text-navy">Referral Bonuses</CardTitle></CardHeader>
        <CardContent>
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
                  <TableCell><Link className="text-pesatrix-blue" href={`/wazim/users/${bonus.referrer_id}`}>{bonus.referrer_id}</Link></TableCell>
                  <TableCell><Link className="text-pesatrix-blue" href={`/wazim/users/${bonus.referee_id}`}>{bonus.referee_id}</Link></TableCell>
                  <TableCell>{bonus.level}</TableCell>
                  <TableCell>{money(bonus.amount)}</TableCell>
                  <TableCell><StatusBadge status={bonus.status} /></TableCell>
                  <TableCell>{shortDate(bonus.available_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AdminPageShell>
  );
}
