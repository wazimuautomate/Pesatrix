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
import { AdminPageShell, EmptyState, MetricCard, StatusBadge } from "@/components/admin/admin-native";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { asArray, requireWazimAdmin, shortDate } from "@/lib/wazim-admin";

export default async function AdminSupportTicketsPage() {
  const adminSession = await requireWazimAdmin();
  const admin = createAdminSupabaseClient();
  const { data } = await (admin.from("support_tickets" as never) as any)
    .select("id, user_id, category, subject, status, priority, assigned_admin_id, created_at, updated_at, profiles(full_name, email, phone)")
    .order("updated_at", { ascending: false })
    .limit(100);
  const tickets = asArray<any>(data);
  const open = tickets.filter((ticket) => ["open", "in_progress", "waiting_on_user"].includes(ticket.status));
  const high = tickets.filter((ticket) => ticket.priority === "high");

  return (
    <AdminPageShell
      admin={adminSession}
      title="Support"
      description="Handle customer issues around activation, withdrawals, tasks, referrals, and account access."
    >
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Open tickets" value={open.length} detail="Needs support attention" tone="amber" />
        <MetricCard label="High priority" value={high.length} detail="Escalate quickly" tone="red" />
        <MetricCard label="Closed/resolved" value={tickets.length - open.length} detail="Loaded completed tickets" tone="teal" />
        <MetricCard label="Loaded tickets" value={tickets.length} detail="Latest support records" />
      </section>

      <Card className="mt-6 border border-outline-variant/40 shadow-sm">
        <CardHeader><CardTitle className="text-lg text-navy">Ticket Queue</CardTitle></CardHeader>
        <CardContent>
          {tickets.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell>
                      <Link className="font-semibold text-pesatrix-blue" href={`/wazim/support/${ticket.id}`}>
                        {ticket.subject}
                      </Link>
                    </TableCell>
                    <TableCell>{ticket.profiles?.full_name ?? ticket.profiles?.email ?? ticket.user_id}</TableCell>
                    <TableCell>{ticket.category}</TableCell>
                    <TableCell>{ticket.priority}</TableCell>
                    <TableCell><StatusBadge status={ticket.status} /></TableCell>
                    <TableCell>{shortDate(ticket.updated_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState>No support tickets yet.</EmptyState>
          )}
        </CardContent>
      </Card>
    </AdminPageShell>
  );
}
