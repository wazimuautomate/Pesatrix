import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const createTicketSchema = z.object({
  category: z.string().trim().min(1, "Category is required").max(50),
  subject: z.string().trim().min(3, "Subject is too short").max(120),
  message: z.string().trim().min(10, "Message is too short").max(4000),
  priority: z.enum(["low", "medium", "high"]).optional(),
});

export const createMessageSchema = z.object({
  message: z.string().trim().min(1, "Message is required").max(4000),
  attachmentUrl: z.string().trim().url("Attachment URL must be valid").optional(),
});

export function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function requireSupportUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      user: null,
      error: errorResponse(401, "UNAUTHORIZED", "Authentication required"),
    };
  }

  return { supabase, user, error: null };
}

export async function getOwnedTicket(args: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  ticketId: string;
  userId: string;
  columns?: string;
}) {
  const { supabase, ticketId, userId, columns = "id, status" } = args;

  return (supabase.from("support_tickets" as never) as any)
    .select(columns)
    .eq("id", ticketId)
    .eq("user_id", userId)
    .maybeSingle();
}

export async function appendUserMessage(args: {
  ticketId: string;
  userId: string;
  message: string;
  attachmentUrl?: string;
}) {
  const { ticketId, userId, message, attachmentUrl } = args;
  const admin = createAdminSupabaseClient();

  return (admin.from("support_messages" as never) as any).insert({
    ticket_id: ticketId,
    sender_type: "user",
    sender_id: userId,
    message,
    attachment_url: attachmentUrl ?? null,
  });
}

export async function reopenTicketForUserReply(args: {
  ticketId: string;
}) {
  const { ticketId } = args;
  const admin = createAdminSupabaseClient();

  return (admin.from("support_tickets" as never) as any)
    .update({
      status: "open",
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId);
}
