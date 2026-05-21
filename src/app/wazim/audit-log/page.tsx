import { AdminPageShell, EmptyState } from "@/components/admin/admin-native";
import { requireWazimAdmin } from "@/lib/wazim-admin";

export default async function AdminAuditLogPage() {
  const adminSession = await requireWazimAdmin();

  return (
    <AdminPageShell
      admin={adminSession}
      title="Audit Log"
      description="Audit entries are currently surfaced through the existing admin workflows and per-record review screens."
    >
      <EmptyState>
        A dedicated audit log view has not been wired into the portal yet. For now, audit details remain available through user, submission, payment, and withdrawal actions.
      </EmptyState>
    </AdminPageShell>
  );
}
