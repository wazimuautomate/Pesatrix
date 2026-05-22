import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminPageShell, StatusBadge } from "@/components/admin/admin-native";
import { WithdrawalActions, WithdrawalEditActions } from "@/app/wazim/withdrawals/withdrawal-actions";
import { getAdminWithdrawalById } from "@/lib/admin-withdrawals";
import { money, requireWazimAdmin, shortDate } from "@/lib/wazim-admin";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminWithdrawalDetailPage({ params }: PageProps) {
  const adminSession = await requireWazimAdmin();
  const { id } = await params;
  const withdrawal = await getAdminWithdrawalById(id);

  if (!withdrawal) notFound();

  return (
    <AdminPageShell
      admin={adminSession}
      title="Withdrawal Detail"
      description="Confirm payout state, user, target phone, M-Pesa transaction reference, and failure reason."
      actions={["requested", "held"].includes(withdrawal.status) ? <WithdrawalActions withdrawalId={withdrawal.id} /> : null}
    >
      <Card className="mb-6 border border-outline-variant/40 shadow-sm">
        <CardHeader><CardTitle className="text-lg text-navy">Withdrawal Operations</CardTitle></CardHeader>
        <CardContent>
          <WithdrawalEditActions
            withdrawalId={id}
            initialAmount={withdrawal.amount}
            initialPhone={withdrawal.phone}
            initialStatus={withdrawal.status}
          />
        </CardContent>
      </Card>

      <Card className="border border-outline-variant/40 shadow-sm">
        <CardHeader><CardTitle className="text-lg text-navy">{withdrawal.profiles?.full_name ?? withdrawal.phone}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <Info label="Status" value={<StatusBadge status={withdrawal.status} />} />
          <Info label="Amount" value={money(withdrawal.amount)} />
          <Info label="Phone" value={withdrawal.phone} />
          <Info label="M-Pesa transaction" value={withdrawal.mpesa_txn_id ?? "Not set"} />
          <Info label="Failure reason" value={withdrawal.failure_reason ?? "Not set"} />
          <Info label="Created" value={shortDate(withdrawal.created_at)} />
          <Info label="Processed" value={shortDate(withdrawal.processed_at)} />
          <Info label="User email" value={withdrawal.profiles?.email ?? "Not set"} />
        </CardContent>
      </Card>
    </AdminPageShell>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-outline-variant/40 bg-white p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 font-semibold text-navy">{value}</div>
    </div>
  );
}
