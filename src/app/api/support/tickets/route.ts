import { NextResponse } from "next/server";
import {
  appendUserMessage,
  createTicketSchema,
  errorResponse,
  requireSupportUser,
} from "../_lib";
import { rateLimitedResponse } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET() {
  const { supabase, user, error } = await requireSupportUser();
  if (error) return error;

  const { data, error: ticketsError } = await (supabase.from("support_tickets" as never) as any)
    .select("id, category, subject, status, priority, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (ticketsError) {
    console.error("[GET /api/support/tickets]", ticketsError);
    return errorResponse(500, "INTERNAL_ERROR", "Failed to load support tickets");
  }

  return NextResponse.json({ tickets: data ?? [] });
}

export async function POST(request: Request) {
  try {
    const { supabase, user, error } = await requireSupportUser();
    if (error) return error;
    const admin = createAdminSupabaseClient();
    const ticketRateLimit = await checkRateLimit(`support_tickets:user:${user.id}`, 5, 60 * 60);
    if (!ticketRateLimit.allowed) {
      return rateLimitedResponse("Too many support tickets. Please try again later.");
    }

    const parsed = createTicketSchema.safeParse(await request.json());
    if (!parsed.success) {
      return errorResponse(422, "VALIDATION_ERROR", parsed.error.errors[0].message);
    }

    const { category, subject, message, priority = "medium" } = parsed.data;

    const { data: ticket, error: createError } = await (admin.from("support_tickets" as never) as any)
      .insert({
        user_id: user.id,
        category,
        subject,
        status: "open",
        priority,
      })
      .select("id, category, subject, status, priority, created_at, updated_at")
      .single();

    if (createError || !ticket) {
      console.error("[POST /api/support/tickets]", createError);
      return errorResponse(500, "INTERNAL_ERROR", "Failed to create support ticket");
    }

    const { error: messageError } = await appendUserMessage({
      ticketId: ticket.id,
      userId: user.id,
      message,
    });

    if (messageError) {
      console.error("[POST /api/support/tickets] message", messageError);
      return errorResponse(500, "INTERNAL_ERROR", "Ticket was created but the first message failed");
    }

    return NextResponse.json({ ticketId: ticket.id, ticket }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/support/tickets]", error);
    return errorResponse(500, "INTERNAL_ERROR", "Failed to create support ticket");
  }
}
