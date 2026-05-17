import { createServerSupabaseClient } from "@/lib/supabase/server";
import { relativeTime } from "@/lib/utils";
import { Plus, MessageSquare, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NewTicketForm } from "./new-ticket-form";

export const metadata = { title: "Support" };

const STATUS_VARIANT: Record<string, "success" | "warning" | "muted" | "destructive"> = {
  open: "warning",
  in_progress: "warning",
  waiting_on_user: "muted",
  resolved: "success",
  closed: "muted",
};

type SupportTicket = {
  id: string;
  category: string | null;
  subject: string;
  status: string;
  priority: string | null;
  created_at: string;
  updated_at: string | null;
};

export default async function SupportPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: ticketRows } = await supabase
    .from("support_tickets")
    .select("id, category, subject, status, priority, created_at, updated_at")
    .eq("user_id", user!.id)
    .order("updated_at", { ascending: false });

  const tickets = (ticketRows ?? []) as SupportTicket[];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy">
            Support
          </h1>
          <p className="text-sm text-muted-foreground">
            Get help with your account, payments, or tasks
          </p>
        </div>
        <NewTicketForm />
      </div>

      {tickets.length > 0 ? (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Card
              key={ticket.id}
              className="border-outline-variant/40 transition-shadow hover:shadow-sm"
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <MessageSquare className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{ticket.subject}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="capitalize">{ticket.category?.replace(/_/g, " ")}</span>
                      <span>·</span>
                      <span>Updated {relativeTime(ticket.updated_at || ticket.created_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={STATUS_VARIANT[ticket.status] ?? "muted"} className="text-xs capitalize">
                    {ticket.status.replace(/_/g, " ")}
                  </Badge>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/dashboard/support/${ticket.id}`}>
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-outline-variant/40">
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-navy">No support tickets</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Need help? Open a ticket using the button above.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
