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
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { asArray, firstRelation, requireWazimAdmin, shortDate } from "@/lib/wazim-admin";

export default async function AdminFraudPage() {
  const adminSession = await requireWazimAdmin();
  const admin = createAdminSupabaseClient();
  const [riskResult, suspendedResult, rewardResult] = await Promise.all([
    (admin.from("user_verification" as never) as any)
      .select("user_id, risk_score, flags, kyc_status, updated_at, profiles(full_name, email, phone)")
      .order("risk_score", { ascending: false })
      .limit(100),
    (admin.from("account_status" as never) as any)
      .select("user_id, status, suspension_reason, suspended_at, profiles(full_name, email, phone)")
      .in("status", ["suspended", "banned"])
      .order("updated_at", { ascending: false })
      .limit(50),
    (admin.from("reward_spins" as never) as any)
      .select("user_id, spin_type, outcome, payout_amount, spin_cost, net_amount, created_at, profiles(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const riskRows = asArray<any>(riskResult.data);
  const highRisk = riskRows.filter((row) => Number(row.risk_score ?? 0) >= 70);
  const suspended = asArray<any>(suspendedResult.data);
  const paidSpins = asArray<any>(rewardResult.data).filter((row) => Number(row.spin_cost ?? 0) > 0);

  return (
    <AdminPageShell
      admin={adminSession}
      title="Fraud & Risk"
      description="Review high-risk verification records, suspended accounts, reward-spin patterns, and repeated suspicious activity."
    >
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="High risk users" value={highRisk.length} detail="Risk score 70 or above" tone="red" />
        <MetricCard label="Suspended/banned" value={suspended.length} detail="Accounts currently blocked" tone="amber" />
        <MetricCard label="Paid spins loaded" value={paidSpins.length} detail="Recent paid reward activity" />
        <MetricCard label="Risk records" value={riskRows.length} detail="Latest verification/risk rows" />
      </section>

      <Card className="mt-6 border border-outline-variant/40 shadow-sm">
        <CardHeader><CardTitle className="text-lg text-navy">Risk Queue</CardTitle></CardHeader>
        <CardContent>
          {riskRows.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>KYC</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {riskRows.map((row) => {
                  const profile = firstRelation<any>(row.profiles);
                  return (
                    <TableRow key={row.user_id}>
                      <TableCell>
                        <Link className="font-semibold text-pesatrix-blue" href={`/wazim/users/${row.user_id}`}>
                          {profile?.full_name ?? profile?.email ?? row.user_id}
                        </Link>
                      </TableCell>
                      <TableCell>{profile?.phone ?? "Not set"}</TableCell>
                      <TableCell>{row.risk_score ?? 0}</TableCell>
                      <TableCell><StatusBadge status={row.kyc_status} /></TableCell>
                      <TableCell className="max-w-[280px] truncate">{JSON.stringify(row.flags ?? {})}</TableCell>
                      <TableCell>{shortDate(row.updated_at)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <EmptyState>No risk records yet.</EmptyState>
          )}
        </CardContent>
      </Card>
    </AdminPageShell>
  );
}
