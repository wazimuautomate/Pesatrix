import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminPageShell, StatusBadge } from "@/components/admin/admin-native";
import { PaymentAdminActions } from "@/components/admin/payment-admin-actions";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { money, requireWazimAdmin, shortDate } from "@/lib/wazim-admin";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminPaymentDetailPage({ params }: PageProps) {
  const adminSession = await requireWazimAdmin();
  const { id } = await params;
  const admin = createAdminSupabaseClient();
  const { data: payment } = await (admin.from("activation_payments" as never) as any)
    .select("*, profiles(full_name, email, phone)")
    .eq("id", id)
    .maybeSingle();

  if (!payment) notFound();

  return (
    <AdminPageShell
      admin={adminSession}
      title="Payment Detail"
      description="Inspect a single activation payment, M-Pesa references, callback payload, and the linked account."
    >
      <Card className="mb-6 border border-outline-variant/40 shadow-sm">
        <CardHeader><CardTitle className="text-lg text-navy">Payment Operations</CardTitle></CardHeader>
        <CardContent>
          <PaymentAdminActions
            paymentId={id}
            initialStatus={payment.status}
            initialReceipt={payment.mpesa_receipt}
          />
        </CardContent>
      </Card>

      <Card className="border border-outline-variant/40 shadow-sm">
        <CardHeader><CardTitle className="text-lg text-navy">{payment.profiles?.full_name ?? payment.phone}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <Info label="Status" value={<StatusBadge status={payment.status} />} />
          <Info label="Amount" value={money(payment.amount)} />
          <Info label="Phone" value={payment.phone} />
          <Info label="Receipt" value={payment.mpesa_receipt ?? "Not set"} />
          <Info label="Checkout request" value={payment.checkout_request_id ?? "Not set"} />
          <Info label="Merchant request" value={payment.merchant_request_id ?? "Not set"} />
          <Info label="Paid at" value={shortDate(payment.paid_at)} />
          <Info label="Created" value={shortDate(payment.created_at)} />
        </CardContent>
      </Card>
      <Card className="mt-6 border border-outline-variant/40 shadow-sm">
        <CardHeader><CardTitle className="text-lg text-navy">Callback Raw</CardTitle></CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded-lg bg-navy p-4 text-xs text-white">
            {JSON.stringify(payment.callback_raw ?? {}, null, 2)}
          </pre>
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
