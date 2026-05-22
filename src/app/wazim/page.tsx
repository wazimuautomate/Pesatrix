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
import { AdminPageShell, MetricCard, StatusBadge } from "@/components/admin/admin-native";
import { getAdminWithdrawals } from "@/lib/admin-withdrawals";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { asArray, money, requireWazimAdmin, shortDate } from "@/lib/wazim-admin";

export default async function AdminOverviewPage() {
  const adminSession = await requireWazimAdmin();
  const admin = createAdminSupabaseClient();

  const [
    usersCount,
    paidPayments,
    pendingWithdrawals,
    openTickets,
    completedTraining,
    riskRows,
    recentPaymentsResult,
    recentWithdrawals,
  ] = await Promise.all([
    (admin.from("profiles" as never) as any).select("id", { count: "exact", head: true }),
    (admin.from("wallet_transactions" as never) as any)
      .select("amount")
      .eq("type", "activation_fee")
      .eq("status", "available")
      .limit(1000),
    (admin.from("withdrawal_requests" as never) as any)
      .select("id", { count: "exact", head: true })
      .in("status", ["requested", "processing", "held"]),
    (admin.from("support_tickets" as never) as any)
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "in_progress", "waiting_on_user"]),
    (admin.from("training_progress" as never) as any)
      .select("user_id", { count: "exact", head: true })
      .eq("status", "completed"),
    (admin.from("user_verification" as never) as any)
      .select("user_id", { count: "exact", head: true })
      .gte("risk_score", 70),
    (admin.from("wallet_transactions" as never) as any)
      .select("id, amount, status, created_at, user_id, type")
      .eq("direction", "credit")
      .order("created_at", { ascending: false })
      .limit(5),
    getAdminWithdrawals({ limit: 5 }),
  ]);

  const revenue = asArray<{ amount?: number }>(paidPayments.data).reduce(
    (total, row) => total + Number(row.amount ?? 0),
    0
  );

  const paymentRows = asArray<any>(recentPaymentsResult.data);
  const paymentUserIds = [...new Set(paymentRows.map((row) => row.user_id).filter(Boolean))];

  let paymentProfilesById = new Map<string, { full_name: string | null; email: string | null }>();
  if (paymentUserIds.length > 0) {
    const { data: profiles, error: profilesError } = await (admin.from("profiles" as never) as any)
      .select("id, full_name, email")
      .in("id", paymentUserIds);
    if (!profilesError && profiles) {
      paymentProfilesById = new Map(
        profiles.map((p: any) => [p.id, { full_name: p.full_name, email: p.email }])
      );
    }
  }

  const recentPayments = paymentRows.map((row) => {
    let status = row.status;
    if (row.status === "available") {
      status = "paid";
    } else if (row.status === "pending" || row.status === "locked") {
      status = "pending";
    }
    return {
      ...row,
      status,
      profiles: paymentProfilesById.get(row.user_id) ?? null,
    };
  });

  return (
    <AdminPageShell
      admin={adminSession}
      title="Overview"
      description=""
    >
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total users" value={usersCount.count ?? 0} detail="Registered Pesatrix profiles" />
        <MetricCard label="Activation revenue" value={money(revenue)} detail="Paid activation records loaded for this view" tone="teal" />
        <MetricCard label="Pending withdrawals" value={pendingWithdrawals.count ?? 0} detail="Requested, processing, or held payouts" tone="amber" />
        <MetricCard label="High risk users" value={riskRows.count ?? 0} detail="Risk score of 70 or higher" tone="red" />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="border border-outline-variant/40 shadow-sm">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-lg text-navy">Recent Payments</CardTitle>
            <Link className="text-sm font-semibold text-pesatrix-blue" href="/wazim/payments">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {asArray<any>(recentPayments).map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{payment.profiles?.full_name ?? payment.profiles?.email ?? "Unknown"}</TableCell>
                    <TableCell>{money(payment.amount)}</TableCell>
                    <TableCell><StatusBadge status={payment.status} /></TableCell>
                    <TableCell>{shortDate(payment.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border border-outline-variant/40 shadow-sm">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-lg text-navy">Withdrawal Queue</CardTitle>
            <Link className="text-sm font-semibold text-pesatrix-blue" href="/wazim/withdrawals">
              Review queue
            </Link>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {asArray<any>(recentWithdrawals).map((withdrawal) => (
                  <TableRow key={withdrawal.id}>
                    <TableCell>{withdrawal.profiles?.full_name ?? withdrawal.profiles?.email ?? withdrawal.phone}</TableCell>
                    <TableCell>{money(withdrawal.amount)}</TableCell>
                    <TableCell><StatusBadge status={withdrawal.status} /></TableCell>
                    <TableCell>{shortDate(withdrawal.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <MetricCard label="Open support tickets" value={openTickets.count ?? 0} detail="Needs operator attention" tone="amber" />
        <MetricCard label="Training completed" value={completedTraining.count ?? 0} detail="Users who finished the current program" tone="teal" />
      </section>
    </AdminPageShell>
  );
}
