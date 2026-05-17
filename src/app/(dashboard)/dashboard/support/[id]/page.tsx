import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageSquare } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { relativeTime } from "@/lib/utils";
import { SupportReplyForm } from "./support-reply-form";

type RouteContext = {
  params: Promise<{ id: string }>;
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

type SupportMessage = {
  id: string;
  sender_type: "user" | "admin";
  sender_id: string;
  message: string;
  attachment_url: string | null;
  created_at: string;
};

const STATUS_VARIANT: Record<string, "success" | "warning" | "muted" | "destructive"> = {
  open: "warning",
  in_progress: "warning",
  waiting_on_user: "muted",
  resolved: "success",
  closed: "muted",
};

export const metadata = { title: "Support Ticket" };

export default async function SupportTicketDetailPage({ params }: RouteContext) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: ticketRow, error: ticketError } = await (supabase.from("support_tickets" as never) as any)
    .select("id, category, subject, status, priority, created_at, updated_at")
    .eq("id", id)
    .eq("user_id", user!.id)
    .maybeSingle();

  if (ticketError) {
    throw ticketError;
  }

  if (!ticketRow) {
    notFound();
  }

  const { data: messageRows, error: messagesError } = await (supabase.from("support_messages" as never) as any)
    .select("id, sender_type, sender_id, message, attachment_url, created_at")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  if (messagesError) {
    throw messagesError;
  }

  const ticket = ticketRow as SupportTicket;
  const messages = (messageRows ?? []) as SupportMessage[];
  const isClosed = ticket.status === "closed";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-3 mb-2">
            <Link href="/dashboard/support">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight text-navy">{ticket.subject}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Opened {relativeTime(ticket.created_at)}
            {ticket.category ? ` · ${ticket.category.replace(/_/g, " ")}` : ""}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT[ticket.status] ?? "muted"} className="w-fit text-xs capitalize">
          {ticket.status.replace(/_/g, " ")}
        </Badge>
      </div>

      <Card className="border-outline-variant/50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-navy">
            <MessageSquare className="h-5 w-5 text-primary" />
            Conversation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {messages.length > 0 ? (
            messages.map((message) => {
              const isUser = message.sender_type === "user";
              return (
                <div
                  key={message.id}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[780px] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                      isUser
                        ? "bg-primary text-white"
                        : "border border-outline-variant/50 bg-surface-container-low text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{message.message}</p>
                    <p className={`mt-2 text-[11px] ${isUser ? "text-white/75" : "text-muted-foreground"}`}>
                      {relativeTime(message.created_at)}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="rounded-xl border border-dashed border-outline-variant/70 p-6 text-center text-sm text-muted-foreground">
              No messages were found for this ticket.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-outline-variant/50 shadow-sm">
        <CardContent className="pt-6">
          <SupportReplyForm ticketId={ticket.id} disabled={isClosed} />
        </CardContent>
      </Card>
    </div>
  );
}
