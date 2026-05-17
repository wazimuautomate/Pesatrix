import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminPageShell, StatusBadge } from "@/components/admin/admin-native";
import { SupportAdminActions } from "@/components/admin/support-admin-actions";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { asArray, requireWazimAdmin, shortDate } from "@/lib/wazim-admin";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminSupportTicketDetailPage({ params }: PageProps) {
  const adminSession = await requireWazimAdmin();
  const { id } = await params;
  const admin = createAdminSupabaseClient();
  const [{ data: ticket }, { data: messages }] = await Promise.all([
    (admin.from("support_tickets" as never) as any)
      .select("*, profiles(full_name, email, phone)")
      .eq("id", id)
      .maybeSingle(),
    (admin.from("support_messages" as never) as any)
      .select("id, sender_type, sender_id, message, attachment_url, created_at")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (!ticket) notFound();

  return (
    <AdminPageShell
      admin={adminSession}
      title={ticket.subject}
      description="Review the support conversation and use the user detail page for account, payment, wallet, or fraud actions."
    >
      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="border border-outline-variant/40 shadow-sm">
          <CardHeader><CardTitle className="text-lg text-navy">Ticket Details</CardTitle></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <Info label="User" value={ticket.profiles?.full_name ?? ticket.profiles?.email ?? ticket.user_id} />
            <Info label="Phone" value={ticket.profiles?.phone ?? "Not set"} />
            <Info label="Category" value={ticket.category} />
            <Info label="Priority" value={ticket.priority} />
            <Info label="Status" value={<StatusBadge status={ticket.status} />} />
            <Info label="Created" value={shortDate(ticket.created_at)} />
            <Info label="Updated" value={shortDate(ticket.updated_at)} />
          </CardContent>
        </Card>

        <Card className="border border-outline-variant/40 shadow-sm">
          <CardHeader><CardTitle className="text-lg text-navy">Conversation</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {asArray<any>(messages).map((message) => (
              <div
                key={message.id}
                className={`rounded-xl border p-4 text-sm ${
                  message.sender_type === "admin"
                    ? "border-pesatrix-blue/30 bg-pesatrix-blue/5"
                    : "border-outline-variant/50 bg-white"
                }`}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="font-semibold text-navy">{message.sender_type}</span>
                  <span className="text-xs text-muted-foreground">{shortDate(message.created_at)}</span>
                </div>
                <p className="leading-6 text-on-surface">{message.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card className="mt-6 border border-outline-variant/40 shadow-sm">
        <CardHeader><CardTitle className="text-lg text-navy">Support Operations</CardTitle></CardHeader>
        <CardContent>
          <SupportAdminActions
            ticketId={id}
            initialStatus={ticket.status}
            initialPriority={ticket.priority}
          />
        </CardContent>
      </Card>
    </AdminPageShell>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-outline-variant/30 pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-navy">{value}</span>
    </div>
  );
}
