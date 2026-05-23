import Link from "next/link";
import type { ReactNode } from "react";

import { AdminPageShell, StatusBadge } from "@/components/admin/admin-native";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { money, requireWazimAdmin, shortDate } from "@/lib/wazim-admin";

export default async function AdminFraudPage() {
  const adminSession = await requireWazimAdmin();
  const admin = createAdminSupabaseClient();
  const [verificationResult, withdrawalsResult, approvedSubmissionsResult, auditResult] = await Promise.all([
    (admin.from("user_verification" as never) as any)
      .select("user_id, risk_score, flags")
      .gt("risk_score", 50)
      .order("risk_score", { ascending: false })
      .limit(100),
    (admin.from("withdrawal_requests" as never) as any)
      .select("user_id, amount, status, created_at")
      .in("status", ["sent", "requested", "processing", "held"])
      .gte("created_at", daysAgo(7)),
    (admin.from("task_submissions" as never) as any).select("user_id").eq("status", "approved"),
    (admin.from("audit_log" as never) as any).select("*").order("created_at", { ascending: false }).limit(50),
  ]);

  const highRiskUsers = verificationResult.data ?? [];
  const withdrawals = withdrawalsResult.data ?? [];
  const approvedSubmitters = new Set((approvedSubmissionsResult.data ?? []).map((row: any) => row.user_id));
  const userIds = [...new Set([...highRiskUsers.map((row: any) => row.user_id), ...withdrawals.map((row: any) => row.user_id)].filter(Boolean))];
  const { data: profiles } = userIds.length
    ? await (admin.from("profiles" as never) as any).select("id, full_name, phone").in("id", userIds)
    : { data: [] };
  const profileById = new Map<string, any>((profiles ?? []).map((row: any) => [row.id, row]));
  const withdrawnByUser = new Map<string, number>();
  const withdrawalCountByUser = new Map<string, number>();
  for (const withdrawal of withdrawals) {
    withdrawnByUser.set(withdrawal.user_id, (withdrawnByUser.get(withdrawal.user_id) ?? 0) + Number(withdrawal.amount ?? 0));
    withdrawalCountByUser.set(withdrawal.user_id, (withdrawalCountByUser.get(withdrawal.user_id) ?? 0) + 1);
  }
  const zeroTaskWithdrawers = [...withdrawnByUser.entries()].filter(([userId, total]) => total > 0 && !approvedSubmitters.has(userId));
  const velocityAlerts = [...withdrawalCountByUser.entries()].filter(([, count]) => count > 2);

  return (
    <AdminPageShell admin={adminSession} title="Fraud" description="Real fraud signals from verification risk, withdrawals, task history, and admin audit activity.">
      <div className="grid gap-6 xl:grid-cols-2">
        <SignalCard title="High Risk Users">
          <UserSignalTable
            rows={highRiskUsers.map((row: any) => ({
              userId: row.user_id,
              name: profileById.get(row.user_id)?.full_name ?? "Unknown user",
              phone: profileById.get(row.user_id)?.phone ?? null,
              metric: row.risk_score,
              detail: JSON.stringify(row.flags ?? {}),
            }))}
            metricLabel="Risk"
          />
        </SignalCard>
        <SignalCard title="Suspicious Withdrawals">
          <UserSignalTable
            rows={zeroTaskWithdrawers.map(([userId, totalWithdrawn]) => ({
              userId,
              name: profileById.get(userId)?.full_name ?? "Unknown user",
              phone: profileById.get(userId)?.phone ?? null,
              metric: money(totalWithdrawn),
              detail: "0 approved task submissions",
            }))}
            metricLabel="Withdrawn"
          />
        </SignalCard>
        <SignalCard title="Velocity Alerts">
          <UserSignalTable
            rows={velocityAlerts.map(([userId, count]) => ({
              userId,
              name: profileById.get(userId)?.full_name ?? "Unknown user",
              phone: profileById.get(userId)?.phone ?? null,
              metric: count,
              detail: `${money(withdrawnByUser.get(userId) ?? 0)} in 7 days`,
            }))}
            metricLabel="Count"
          />
        </SignalCard>
        <SignalCard title="Recent Admin Actions">
          <AuditTable rows={auditResult.data ?? []} />
        </SignalCard>
      </div>
    </AdminPageShell>
  );
}

function SignalCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="border border-outline-variant/40 shadow-sm">
      <CardHeader><CardTitle className="text-lg text-navy">{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function UserSignalTable({ rows, metricLabel }: { rows: any[]; metricLabel: string }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>{metricLabel}</TableHead>
            <TableHead>Detail</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.userId}>
              <TableCell>{row.name}</TableCell>
              <TableCell>{row.phone ?? "Not set"}</TableCell>
              <TableCell>{row.metric}</TableCell>
              <TableCell className="max-w-[220px] truncate">{row.detail}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline"><Link href={`/wazim/users/${row.userId}`}>View</Link></Button>
                  <Button asChild size="sm" variant="outline"><Link href={`/wazim/users/${row.userId}?adjust=1`}>Adjust</Link></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {!rows.length && <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">No signals found.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}

function AuditTable({ rows }: { rows: any[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Action</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell><StatusBadge status={row.action} /></TableCell>
              <TableCell>{row.entity_type}</TableCell>
              <TableCell className="max-w-[240px] truncate">{row.reason ?? "Not set"}</TableCell>
              <TableCell>{shortDate(row.created_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function daysAgo(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}
