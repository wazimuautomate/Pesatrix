import { AdminPageShell } from "@/components/admin/admin-native";
import { requireWazimAdmin } from "@/lib/wazim-admin";
import { PaymentsClient } from "./payments-client";

export default async function AdminPaymentsPage() {
  const adminSession = await requireWazimAdmin();

  return (
    <AdminPageShell
      admin={adminSession}
      title="Payments"
      description=""
    >
      <PaymentsClient />
    </AdminPageShell>
  );
}
