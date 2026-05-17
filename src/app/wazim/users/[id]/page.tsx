import { notFound } from "next/navigation";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AdminPageShell, MetricCard } from "@/components/admin/admin-native";
import { AdminUserEditForm } from "@/components/admin/user-admin-actions";
import { UserStatusActions } from "@/app/wazim/users/[id]/user-status-actions";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { asArray, money, requireWazimAdmin, shortDate } from "@/lib/wazim-admin";
import {
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Mail,
  Phone,
  Clock,
  Wallet,
  AlertTriangle,
} from "lucide-react";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminUserDetailPage({ params }: PageProps) {
  const adminSession = await requireWazimAdmin();
  const { id } = await params;
  const admin = createAdminSupabaseClient();

  const [
    { data: profile },
    { data: status },
    { data: verification },
    { data: wallet },
    { data: activationPayment },
    { data: transactions },
    { data: withdrawals },
    { data: tickets },
    { data: training },
  ] = await Promise.all([
    (admin.from("profiles" as never) as any).select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
    (admin.from("account_status" as never) as any).select("*").eq("user_id", id).maybeSingle(),
    (admin.from("user_verification" as never) as any).select("*").eq("user_id", id).maybeSingle(),
    (admin.from("wallets" as never) as any).select("*").eq("user_id", id).maybeSingle(),
    (admin.from("activation_payments" as never) as any).select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(1),
    (admin.from("wallet_transactions" as never) as any)
      .select("id, amount, direction, status, bucket, type, description, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    (admin.from("withdrawal_requests" as never) as any)
      .select("id, amount, phone, status, mpesa_txn_id, created_at, processed_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(8),
    (admin.from("support_tickets" as never) as any)
      .select("id, subject, category, status, priority, updated_at")
      .eq("user_id", id)
      .order("updated_at", { ascending: false })
      .limit(8),
    (admin.from("training_progress" as never) as any).select("*").eq("user_id", id).maybeSingle(),
  ]);

  if (!profile) notFound();

  const walletData = wallet ?? { available_balance: 0, pending_balance: 0, total_earned: 0 };
  const activationPay = activationPayment?.[0] ?? null;
  const currentStatus = status?.status ?? "registered";
  const timeline = buildTimeline(profile, status, activationPay);

  return (
    <AdminPageShell
      admin={adminSession}
      title={profile.full_name ?? "User Detail"}
      description={`${profile.email ?? "No email"} · ${profile.phone ?? "No phone"} · Joined ${shortDate(profile.created_at)}`}
      actions={
        <div className="flex flex-wrap gap-2">
          <Link href="/wazim/users">
            <Button variant="outline" size="sm">Back to Users</Button>
          </Link>
          <UserStatusActions userId={id} currentStatus={currentStatus} />
        </div>
      }
    >
      <section className="flex flex-wrap gap-2">
        <StatusChip label="Activated" active={status?.is_activated ?? false} />
        <StatusChip label="Setup Complete" active={status?.is_setup_complete ?? false} />
        <StatusChip label="Phone Verified" active={verification?.phone_verified ?? false} />
        <StatusChip label="Email Verified" active={verification?.email_verified ?? false} />
        <Badge variant={kycVariant(verification?.kyc_status)}>
          KYC: {verification?.kyc_status ?? "not_submitted"}
        </Badge>
        {status?.status && (
          <Badge variant={statusBadgeVariant(status.status)}>
            Status: {status.status.replaceAll("_", " ")}
          </Badge>
        )}
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Available Balance" value={money(walletData.available_balance)} detail="Ready to withdraw" tone="teal" />
        <MetricCard label="Pending Balance" value={money(walletData.pending_balance)} detail="Processing" tone="amber" />
        <MetricCard label="Total Earned" value={money(walletData.total_earned)} detail="Lifetime earnings" tone="blue" />
        <MetricCard label="Risk Score" value={verification?.risk_score ?? 0} detail={riskDetail(verification?.risk_score)} tone={(verification?.risk_score ?? 0) >= 70 ? "red" : "blue"} />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="border border-outline-variant/40 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-navy">Profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <Info label="Full Name" value={profile.full_name} />
            <Info label="Email" value={profile.email} />
            <Info label="Phone" value={profile.phone} />
            <Info label="County" value={profile.county} />
            <Info label="Referral Code" value={profile.referral_code} />
            <Info label="Referred By" value={profile.referred_by} />
            <Info label="Joined" value={shortDate(profile.created_at)} />
          </CardContent>
        </Card>

        <Card className="border border-outline-variant/40 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-navy">Account Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {timeline.length ? (
              <ol className="relative border-l border-outline-variant/40">
                {timeline.map((event, i) => (
                  <li key={i} className="ml-6 pb-4">
                    <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-pesatrix-blue" />
                    <p className="text-sm font-semibold text-navy">{event.label}</p>
                    <p className="text-xs text-muted-foreground">{shortDate(event.date)}</p>
                    {event.detail && <p className="text-xs text-muted-foreground mt-1">{event.detail}</p>}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">No timeline events.</p>
            )}
          </CardContent>
        </Card>
      </section>

      {activationPay && (
        <Card className="mt-6 border border-outline-variant/40 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-navy">Activation Payment</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
            <Info label="Amount" value={money(activationPay.amount)} />
            <Info label="Phone" value={activationPay.phone} />
            <Info label="Receipt" value={activationPay.mpesa_receipt ?? "Pending"} />
            <Info label="Status" value={activationPay.status} />
            <Info label="Paid At" value={shortDate(activationPay.paid_at)} />
            <Info label="Created" value={shortDate(activationPay.created_at)} />
          </CardContent>
        </Card>
      )}

      {training && (
        <Card className="mt-6 border border-outline-variant/40 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg text-navy">Training Progress</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
            <Info label="Status" value={training.status} />
            <Info label="Current Day" value={`${training.current_day ?? 1} of 7`} />
            <Info label="Completed Days" value={Array.isArray(training.completed_days) ? training.completed_days.length : 0} />
            <Info label="Completed At" value={shortDate(training.completed_at)} />
          </CardContent>
        </Card>
      )}

      <Card className="mt-6 border border-outline-variant/40 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-navy">Recent Wallet Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {asArray<any>(transactions).map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell className="text-sm">{txn.type}</TableCell>
                  <TableCell>
                    <span className={txn.direction === "credit" ? "text-teal" : "text-destructive"}>
                      {txn.direction}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{money(txn.amount)}</TableCell>
                  <TableCell><StatusBadge status={txn.status} /></TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{txn.description ?? "—"}</TableCell>
                  <TableCell className="text-sm">{shortDate(txn.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!transactions?.length && <p className="py-4 text-center text-sm text-muted-foreground">No transactions yet.</p>}
        </CardContent>
      </Card>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <MiniList title="Withdrawals" items={asArray<any>(withdrawals)} render={(w) => (
          <div key={w.id} className="flex justify-between text-sm">
            <span>{money(w.amount)} → {w.phone}</span>
            <StatusBadge status={w.status} />
          </div>
        )} />
        <MiniList title="Support Tickets" items={asArray<any>(tickets)} render={(t) => (
          <div key={t.id} className="flex justify-between text-sm">
            <span className="truncate">{t.subject}</span>
            <StatusBadge status={t.status} />
          </div>
        )} />
      </section>

      <Card className="mt-6 border border-outline-variant/40 shadow-sm">
        <CardHeader><CardTitle className="text-lg text-navy">Edit User</CardTitle></CardHeader>
        <CardContent>
          <AdminUserEditForm user={profile} />
        </CardContent>
      </Card>

      <Card className="mt-6 border border-destructive/40 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Suspend, ban, or reactivate this user. All actions are logged to the audit trail.
          </p>
          <UserStatusActions userId={id} currentStatus={currentStatus} variant="danger" />
        </CardContent>
      </Card>
    </AdminPageShell>
  );
}

function buildTimeline(profile: any, status: any, activationPayment: any) {
  const events: { label: string; date: string; detail?: string }[] = [];

  if (profile?.created_at) {
    events.push({ label: "Registered", date: profile.created_at, detail: "Account created" });
  }

  if (status?.is_setup_complete && status?.setup_completed_at) {
    events.push({ label: "Setup Complete", date: status.setup_completed_at });
  }

  if (activationPayment?.paid_at) {
    events.push({
      label: "Activation Payment",
      date: activationPayment.paid_at,
      detail: `KSh ${Number(activationPayment.amount).toLocaleString()} (${activationPayment.mpesa_receipt ?? "pending receipt"})`,
    });
  }

  if (status?.is_activated && status?.activated_at) {
    events.push({ label: "Activated", date: status.activated_at });
  }

  if (status?.suspended_at) {
    events.push({
      label: status.status === "banned" ? "Banned" : "Suspended",
      date: status.suspended_at,
      detail: status.suspension_reason ?? undefined,
    });
  }

  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return events;
}

function StatusChip({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${active ? "border-teal/30 bg-teal/10 text-teal" : "border-outline-variant/40 bg-muted text-muted-foreground"}`}>
      {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: unknown }) {
  const value = String(status ?? "unknown");
  const variant = statusBadgeVariant(value);
  return <Badge variant={variant}>{value.replaceAll("_", " ")}</Badge>;
}

function statusBadgeVariant(status: string) {
  if (["active", "activated", "completed", "paid", "sent", "available", "resolved"].includes(status)) return "success";
  if (["pending", "processing", "open", "in_progress", "requested"].includes(status)) return "warning";
  if (["suspended", "banned", "failed", "rejected", "reversed"].includes(status)) return "destructive";
  return "muted";
}

function kycVariant(kycStatus: string | null) {
  if (kycStatus === "verified" || kycStatus === "approved") return "success";
  if (kycStatus === "pending" || kycStatus === "under_review") return "warning";
  if (kycStatus === "rejected") return "destructive";
  return "muted";
}

function riskDetail(score: number | null) {
  const s = score ?? 0;
  if (s >= 70) return "High risk — review recommended";
  if (s >= 40) return "Medium risk";
  return "Low risk";
}

function Info({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-outline-variant/30 pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-navy">{String(value ?? "Not set")}</span>
    </div>
  );
}

function MiniList({ title, items, render }: { title: string; items: any[]; render: (item: any) => React.ReactNode }) {
  return (
    <Card className="border border-outline-variant/40 shadow-sm">
      <CardHeader><CardTitle className="text-lg text-navy">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {items.length ? items.map(render) : <p className="text-sm text-muted-foreground">No records yet.</p>}
      </CardContent>
    </Card>
  );
}
