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
import { AdminPageShell, EmptyState, StatusBadge } from "@/components/admin/admin-native";
import { AdminUserActions } from "@/app/wazim/users/[id]/user-actions";
import { Button } from "@/components/ui/button";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { asArray, requireWazimAdmin, shortDate } from "@/lib/wazim-admin";

export default async function SuspendedUsersPage() {
  const adminSession = await requireWazimAdmin();
  const admin = createAdminSupabaseClient();
  const { data } = await (admin.from("account_status" as never) as any)
    .select("user_id, status, suspended_at, suspension_reason, updated_at, profiles(full_name, email, phone, county)")
    .in("status", ["suspended", "banned"])
    .order("updated_at", { ascending: false })
    .limit(100);
  const rows = asArray<any>(data);

  return (
    <AdminPageShell
      admin={adminSession}
      title="Suspended Users"
      description="Review users who are blocked from normal platform activity and restore access when the issue is resolved."
      actions={<Button asChild variant="outline"><Link href="/wazim/users">All users</Link></Button>}
    >
      <Card className="border border-outline-variant/40 shadow-sm">
        <CardHeader><CardTitle className="text-lg text-navy">Suspension Queue</CardTitle></CardHeader>
        <CardContent>
          {rows.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>County</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Suspended</TableHead>
                  <TableHead className="text-right">Operation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.user_id}>
                    <TableCell>
                      <Link className="font-semibold text-pesatrix-blue" href={`/wazim/users/${row.user_id}`}>
                        {row.profiles?.full_name ?? row.profiles?.email ?? row.user_id}
                      </Link>
                    </TableCell>
                    <TableCell>{row.profiles?.phone ?? "Not set"}</TableCell>
                    <TableCell>{row.profiles?.county ?? "Not set"}</TableCell>
                    <TableCell><StatusBadge status={row.status} /></TableCell>
                    <TableCell>{row.suspension_reason ?? "Not recorded"}</TableCell>
                    <TableCell>{shortDate(row.suspended_at ?? row.updated_at)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <AdminUserActions userId={row.user_id} currentStatus={row.status} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState>No suspended users.</EmptyState>
          )}
        </CardContent>
      </Card>
    </AdminPageShell>
  );
}
