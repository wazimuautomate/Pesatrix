import { NextResponse } from "next/server";
import {
  appendUserMessage,
  createMessageSchema,
  errorResponse,
  getOwnedTicket,
  reopenTicketForUserReply,
  requireSupportUser,
} from "../../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _req: Request,
  { params }: RouteContext
) {
  const { id } = await params;
  const { supabase, user, error } = await requireSupportUser();
  if (error) return error;

  const { data: ticket, error: ticketError } = await getOwnedTicket({
    supabase,
    ticketId: id,
    userId: user.id,
    columns: "id, category, subject, status, priority, assigned_admin_id, created_at, updated_at",
  });

  if (ticketError) {
    console.error("[GET /api/support/tickets/:id]", ticketError);
    return errorResponse(500, "INTERNAL_ERROR", "Failed to load ticket");
  }

  if (!ticket) return errorResponse(404, "NOT_FOUND", "Support ticket not found");

  const { data: messages, error: messagesError } = await (supabase.from("support_messages" as never) as any)
    .select("id, sender_type, sender_id, message, attachment_url, created_at")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  if (messagesError) {
    console.error("[GET /api/support/tickets/:id] messages", messagesError);
    return errorResponse(500, "INTERNAL_ERROR", "Failed to load ticket messages");
  }

  return NextResponse.json({ ticket, messages: messages ?? [] });
}

export async function POST(
  request: Request,
  { params }: RouteContext
) {
  const { id } = await params;
  const { supabase, user, error } = await requireSupportUser();
  if (error) return error;

  const { data: ticket, error: ticketError } = await getOwnedTicket({
    supabase,
    ticketId: id,
    userId: user.id,
  });

  if (ticketError) {
    console.error("[POST /api/support/tickets/:id]", ticketError);
    return errorResponse(500, "INTERNAL_ERROR", "Failed to load ticket");
  }

  if (!ticket) return errorResponse(404, "NOT_FOUND", "Support ticket not found");
  if (ticket.status === "closed") {
    return errorResponse(422, "TICKET_CLOSED", "Closed tickets cannot receive new messages");
  }

  const body = await request.json();
  const parsed = createMessageSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(422, "VALIDATION_ERROR", parsed.error.errors[0].message);
  }

  const { error: messageError } = await appendUserMessage({
    ticketId: id,
    userId: user.id,
    message: parsed.data.message,
    attachmentUrl: parsed.data.attachmentUrl,
  });

  if (messageError) {
    console.error("[POST /api/support/tickets/:id]", messageError);
    return errorResponse(500, "INTERNAL_ERROR", "Failed to create ticket message");
  }

  const { error: updateError } = await reopenTicketForUserReply({ ticketId: id });
  if (updateError) {
    console.error("[POST /api/support/tickets/:id] reopen", updateError);
    return errorResponse(500, "INTERNAL_ERROR", "Message saved but ticket status update failed");
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
