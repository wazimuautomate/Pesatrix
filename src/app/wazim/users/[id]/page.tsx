import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";

import { AdminPageShell, MetricCard, StatusBadge } from "@/components/admin/admin-native";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { asArray, money, requireWazimAdmin, shortDate } from "@/lib/wazim-admin";
import { UserActionMenu } from "./components/UserActionMenu";
import { WalletLedger } from "./components/WalletLedger";
import { TaskHistory } from "./components/TaskHistory";
import { ReferralTree } from "./components/ReferralTree";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminUserDetailPage({ params }: PageProps) {
  const adminSession = await requireWazimAdmin();
  const { id } = await params;
  const admin = createAdminSupabaseClient();

  const [
    { data: profile },
    { data: accountStatus },
    { data: verification },
    { data: wallet },
    { data: transactions },
    { data: submissions },
    { data: referralsMade },
    { data: referralBonuses },
    { data: withdrawalRequests },
  ] = await Promise.all([
    (admin.from("profiles" as never) as any).select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
    (admin.from("account_status" as never) as any).select("*").eq("user_id", id).maybeSingle(),
    (admin.from("user_verification" as never) as any).select("*").eq("user_id", id).maybeSingle(),
    (admin.from("wallets" as never) as any).select("*").eq("user_id", id).maybeSingle(),
    (admin.from("wallet_transactions" as never) as any)
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    (admin.from("task_submissions" as never) as any)
      .select("*, tasks(title, category, payout_ksh)")
      .eq("user_id", id)
      .order("submitted_at", { ascending: false })
      .limit(50),
    (admin.from("referrals" as never) as any)
      .select("*")
      .eq("referrer_id", id)
      .order("created_at", { ascending: false }),
    (admin.from("referral_bonuses" as never) as any)
      .select("*")
      .eq("referrer_id", id)
      .order("created_at", { ascending: false }),
    (admin.from("withdrawal_requests" as never) as any)
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (!profile) {
    notFound();
  }

  const referralRows = asArray<any>(referralsMade);
  const refereeIds = referralRows.map((row) => row.referee_id).filter(Boolean);
  const { data: refereeProfiles } = refereeIds.length
    ? await (admin.from("profiles" as never) as any)
        .select("id, full_name, phone")
        .in("id", refereeIds)
    : { data: [] };
  const refereeById = new Map(asArray<any>(refereeProfiles).map((row) => [row.id, row]));
  const referralsWithProfiles = referralRows.map((referral) => ({
    ...referral,
    profiles: refereeById.get(referral.referee_id) ?? null,
  }));

  const walletData = wallet ?? { available_balance: 0, pending_balance: 0, total_earned: 0 };
  const currentStatus = accountStatus?.status ?? "registered";
  const canAdjustBalance = adminSession.role === "finance" || adminSession.role === "super_admin";

  return (
    <AdminPageShell
      admin={adminSession}
      title={profile.full_name ?? "User Detail"}
      description={`${profile.phone ?? "No phone"} - ${profile.email ?? "No email"} - Joined ${shortDate(profile.created_at)}`}
      actions={
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/wazim/users">Back</Link>
          </Button>
          <UserActionMenu
            userId={id}
            currentStatus={currentStatus}
            canAdjustBalance={canAdjustBalance}
            currentAvailableBalance={Number(walletData.available_balance ?? 0)}
          />
        </div>
      }
    >
      <section className="flex flex-wrap items-center gap-2">
        <StatusBadge status={currentStatus} />
        <StateChip label="Activated" active={accountStatus?.is_activated === true} />
        <StateChip label="Setup Complete" active={accountStatus?.is_setup_complete === true} />
        <StateChip label="Phone Verified" active={verification?.phone_verified === true} />
        <StateChip label="Email Verified" active={verification?.email_verified === true} />
        <Badge variant={kycVariant(verification?.kyc_status)}>KYC: {verification?.kyc_status ?? "not_started"}</Badge>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Available Balance" value={money(walletData.available_balance)} detail="Ready to withdraw" tone="teal" />
        <MetricCard label="Pending Balance" value={money(walletData.pending_balance)} detail="Awaiting release" tone="amber" />
        <MetricCard label="Total Earned" value={money(walletData.total_earned)} detail="Lifetime ledger earnings" tone="blue" />
        <MetricCard label="Referrals Made" value={referralRows.length} detail="Direct referral records" tone="blue" />
      </section>

      <Tabs defaultValue="overview" className="mt-6">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="referrals">Referrals</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <InfoCard
              title="Profile"
              rows={[
                ["Full Name", profile.full_name],
                ["Email", profile.email],
                ["Phone", profile.phone],
                ["County", profile.county],
                ["Referral Code", profile.referral_code],
                ["Referred By", profile.referred_by],
                ["Joined", shortDate(profile.created_at)],
              ]}
            />
            <InfoCard
              title="Account Status"
              rows={[
                ["Status", currentStatus],
                ["Activated", accountStatus?.is_activated ? "Yes" : "No"],
                ["Activated At", shortDate(accountStatus?.activated_at)],
                ["Setup Complete", accountStatus?.is_setup_complete ? "Yes" : "No"],
                ["Setup Completed At", shortDate(accountStatus?.setup_completed_at)],
                ["Suspended At", shortDate(accountStatus?.suspended_at)],
                ["Suspension Reason", accountStatus?.suspension_reason],
              ]}
            />
            <InfoCard
              title="Verification"
              id="verification"
              rows={[
                ["Phone Verified", verification?.phone_verified ? "Yes" : "No"],
                ["Email Verified", verification?.email_verified ? "Yes" : "No"],
                ["KYC Status", verification?.kyc_status ?? "not_started"],
                ["Risk Score", verification?.risk_score ?? 0],
                ["Flags", JSON.stringify(verification?.flags ?? {})],
              ]}
            />
            <InfoCard
              title="Wallet"
              rows={[
                ["Available", money(walletData.available_balance)],
                ["Pending", money(walletData.pending_balance)],
                ["Total Earned", money(walletData.total_earned)],
                ["Updated", shortDate(walletData.updated_at)],
              ]}
            />
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="mt-4">
          <WalletLedger transactions={asArray<any>(transactions)} />
        </TabsContent>

        <TabsContent value="tasks" className="mt-4">
          <TaskHistory submissions={asArray<any>(submissions)} />
        </TabsContent>

        <TabsContent value="referrals" className="mt-4">
          <ReferralTree referralsMade={referralsWithProfiles} referralBonuses={asArray<any>(referralBonuses)} />
        </TabsContent>

        <TabsContent value="withdrawals" className="mt-4">
          <WithdrawalsTable withdrawals={asArray<any>(withdrawalRequests)} />
        </TabsContent>
      </Tabs>
    </AdminPageShell>
  );
}

function InfoCard({ title, rows, id }: { title: string; rows: Array<[string, unknown]>; id?: string }) {
  return (
    <Card id={id} className="border border-outline-variant/40 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg text-navy">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 border-b border-outline-variant/30 pb-2">
            <span className="text-muted-foreground">{label}</span>
            <span className="max-w-[60%] break-words text-right font-medium text-navy">
              {String(value ?? "Not set")}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function WithdrawalsTable({ withdrawals }: { withdrawals: any[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-outline-variant/40 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Requested</TableHead>
            <TableHead>Processed</TableHead>
            <TableHead>M-Pesa ID</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {withdrawals.map((withdrawal) => (
            <TableRow key={withdrawal.id}>
              <TableCell className="font-semibold">{money(withdrawal.amount)}</TableCell>
              <TableCell><StatusBadge status={withdrawal.status} /></TableCell>
              <TableCell>{withdrawal.phone ?? "Not set"}</TableCell>
              <TableCell>{shortDate(withdrawal.created_at)}</TableCell>
              <TableCell>{shortDate(withdrawal.processed_at)}</TableCell>
              <TableCell>{withdrawal.mpesa_txn_id ?? withdrawal.b2c_request_id ?? "Not set"}</TableCell>
            </TableRow>
          ))}
          {!withdrawals.length && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                No withdrawals found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function StateChip({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${active ? "border-teal/30 bg-teal/10 text-teal" : "border-outline-variant/40 bg-muted text-muted-foreground"}`}>
      {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

function kycVariant(kycStatus: string | null) {
  if (kycStatus === "verified" || kycStatus === "approved") return "success";
  if (kycStatus === "pending" || kycStatus === "under_review") return "warning";
  if (kycStatus === "rejected") return "destructive";
  return "muted";
}
