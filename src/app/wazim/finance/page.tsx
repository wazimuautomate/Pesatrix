import Link from "next/link";

import { AdminPageShell, MetricCard, StatusBadge } from "@/components/admin/admin-native";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { money, requireWazimAdmin, shortDate } from "@/lib/wazim-admin";
import { FinanceChart } from "./FinanceChart";
import { Button } from "@/components/ui/button";

export default async function FinancePage() {
  const adminSession = await requireWazimAdmin();
  if (adminSession.role !== "finance" && adminSession.role !== "super_admin") {
    return (
      <AdminPageShell admin={adminSession} title="Finance" description="">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Finance access is limited to finance and super admin roles.</CardContent>
        </Card>
      </AdminPageShell>
    );
  }

  const admin = createAdminSupabaseClient();
  const [activations, withdrawals, referralBonuses] = await Promise.all([
    (admin.from("activation_payments" as never) as any).select("amount, paid_at, created_at, status").eq("status", "paid"),
    (admin.from("withdrawal_requests" as never) as any)
      .select("id, user_id, amount, status, mpesa_txn_id, b2c_request_id, created_at, processed_at")
      .order("created_at", { ascending: false }),
    (admin.from("wallet_transactions" as never) as any).select("amount, status, type").eq("type", "referral_bonus"),
  ]);

  const activationRows = activations.data ?? [];
  const withdrawalRows = withdrawals.data ?? [];
  const sentWithdrawals = withdrawalRows.filter((row: any) => row.status === "sent");
  const pendingWithdrawals = withdrawalRows.filter((row: any) => ["requested", "processing"].includes(row.status));
  const revenue = sum(activationRows);
  const paidOut = sum(sentWithdrawals);
  const pendingOutflow = sum(pendingWithdrawals);
  const net = revenue - paidOut;
  const dailyBreakdown = buildDailyBreakdown(activationRows, sentWithdrawals);
  const topWithdrawers = await buildTopWithdrawers(admin, sentWithdrawals);
  const recentWithdrawals = await hydrateWithdrawalUsers(admin, withdrawalRows.slice(0, 20));

  return (
    <AdminPageShell admin={adminSession} title="Finance" description="Live inflow and outflow audit from activation payments, withdrawals, and referral bonuses.">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total Platform Revenue" value={money(revenue)} detail={`${activationRows.length} paid activations`} tone="blue" />
        <MetricCard label="Total Paid Out" value={money(paidOut)} detail="Sent withdrawals" tone="red" />
        <MetricCard label="Net Position" value={money(net)} detail={net >= 0 ? "Positive cash position" : "Negative cash position"} tone={net >= 0 ? "teal" : "red"} />
        <MetricCard label="Pending Outflow Risk" value={money(pendingOutflow)} detail={net < pendingOutflow ? "Pending outflow exceeds net" : "Covered by net position"} tone={net < pendingOutflow ? "red" : "amber"} />
      </section>

      <Card className="mt-6 border border-outline-variant/40 shadow-sm">
        <CardHeader><CardTitle className="text-lg text-navy">Daily Inflow vs Outflow</CardTitle></CardHeader>
        <CardContent>
          <FinanceChart data={dailyBreakdown} />
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card className="border border-outline-variant/40 shadow-sm">
          <CardHeader><CardTitle className="text-lg text-navy">Top Withdrawers</CardTitle></CardHeader>
          <CardContent><TopWithdrawersTable rows={topWithdrawers} /></CardContent>
        </Card>
        <Card className="border border-outline-variant/40 shadow-sm">
          <CardHeader><CardTitle className="text-lg text-navy">Recent Withdrawals</CardTitle></CardHeader>
          <CardContent><RecentWithdrawalsTable rows={recentWithdrawals} /></CardContent>
        </Card>
      </div>

      <div className="mt-4 text-xs text-muted-foreground">
        Referral bonuses paid: {money(sum((referralBonuses.data ?? []).filter((row: any) => row.status === "available")))}. Pending referral bonuses: {money(sum((referralBonuses.data ?? []).filter((row: any) => row.status === "pending")))}.
      </div>
    </AdminPageShell>
  );
}

function TopWithdrawersTable({ rows }: { rows: any[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Total Withdrawn</TableHead>
            <TableHead>Activated At</TableHead>
            <TableHead>Referrals</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.userId}>
              <TableCell>{row.name}</TableCell>
              <TableCell>{row.phone ?? "Not set"}</TableCell>
              <TableCell>{money(row.totalWithdrawn)}</TableCell>
              <TableCell>{shortDate(row.activatedAt)}</TableCell>
              <TableCell>{row.referralsMade}</TableCell>
              <TableCell><Button asChild size="sm" variant="outline"><Link href={`/wazim/users/${row.userId}`}>View User</Link></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function RecentWithdrawalsTable({ rows }: { rows: any[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Requested At</TableHead>
            <TableHead>Processed At</TableHead>
            <TableHead>M-Pesa ID</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.user?.full_name ?? row.user_id}</TableCell>
              <TableCell>{money(row.amount)}</TableCell>
              <TableCell><StatusBadge status={row.status} /></TableCell>
              <TableCell>{shortDate(row.created_at)}</TableCell>
              <TableCell>{shortDate(row.processed_at)}</TableCell>
              <TableCell>{row.mpesa_txn_id ?? row.b2c_request_id ?? "Not set"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function sum(rows: any[]) {
  return rows.reduce((total, row) => total + Number(row.amount ?? 0), 0);
}

function buildDailyBreakdown(activations: any[], withdrawals: any[]) {
  const rows = new Map<string, any>();
  for (let i = 29; i >= 0; i -= 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - i);
    rows.set(date.toISOString().slice(0, 10), {
      date: date.toISOString().slice(0, 10),
      activationRevenue: 0,
      withdrawalAmount: 0,
    });
  }
  for (const activation of activations) {
    const key = new Date(activation.paid_at ?? activation.created_at).toISOString().slice(0, 10);
    const row = rows.get(key);
    if (row) row.activationRevenue += Number(activation.amount ?? 0);
  }
  for (const withdrawal of withdrawals) {
    const key = new Date(withdrawal.processed_at ?? withdrawal.created_at).toISOString().slice(0, 10);
    const row = rows.get(key);
    if (row) row.withdrawalAmount += Number(withdrawal.amount ?? 0);
  }
  return [...rows.values()];
}

async function buildTopWithdrawers(admin: any, sentWithdrawals: any[]) {
  const totals = new Map<string, number>();
  for (const withdrawal of sentWithdrawals) {
    totals.set(withdrawal.user_id, (totals.get(withdrawal.user_id) ?? 0) + Number(withdrawal.amount ?? 0));
  }
  const userIds = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([userId]) => userId);
  const [{ data: profiles }, { data: statuses }, { data: referrals }] = userIds.length
    ? await Promise.all([
        (admin.from("profiles" as never) as any).select("id, full_name, phone").in("id", userIds),
        (admin.from("account_status" as never) as any).select("user_id, activated_at").in("user_id", userIds),
        (admin.from("referrals" as never) as any).select("referrer_id").in("referrer_id", userIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const profileById = new Map<string, any>((profiles ?? []).map((row: any) => [row.id, row]));
  const statusById = new Map<string, any>((statuses ?? []).map((row: any) => [row.user_id, row]));
  const referralCounts = new Map<string, number>();
  for (const referral of referrals ?? []) {
    referralCounts.set(referral.referrer_id, (referralCounts.get(referral.referrer_id) ?? 0) + 1);
  }
  return userIds.map((userId) => ({
    userId,
    name: profileById.get(userId)?.full_name ?? "Unknown user",
    phone: profileById.get(userId)?.phone ?? null,
    totalWithdrawn: totals.get(userId) ?? 0,
    activatedAt: statusById.get(userId)?.activated_at ?? null,
    referralsMade: referralCounts.get(userId) ?? 0,
  }));
}

async function hydrateWithdrawalUsers(admin: any, withdrawals: any[]) {
  const userIds = [...new Set(withdrawals.map((row) => row.user_id).filter(Boolean))];
  const { data: profiles } = userIds.length
    ? await (admin.from("profiles" as never) as any).select("id, full_name, phone").in("id", userIds)
    : { data: [] };
  const profileById = new Map<string, any>((profiles ?? []).map((row: any) => [row.id, row]));
  return withdrawals.map((withdrawal) => ({ ...withdrawal, user: profileById.get(withdrawal.user_id) ?? null }));
}
