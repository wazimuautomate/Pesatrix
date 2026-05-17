import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog, requireAdmin } from "../../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const updateTicketSchema = z.object({
  status: z.enum(["open", "in_progress", "waiting_on_user", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  reason: z.string().trim().min(3).max(240).optional(),
});

const replySchema = z.object({
  message: z.string().trim().min(2).max(4000),
});

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const { error, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "admin", "support"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = updateTicketSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid support update" } },
      { status: 422 }
    );
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) update.status = parsed.data.status;
  if (parsed.data.priority !== undefined) update.priority = parsed.data.priority;

  if (!Object.keys(update).length) {
    return NextResponse.json({ error: "No changes provided" }, { status: 422 });
  }

  const admin = createAdminSupabaseClient();
  const { data: before } = await (admin.from("support_tickets" as never) as any)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!before) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const { data: ticket, error: updateError } = await (admin.from("support_tickets" as never) as any)
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (updateError || !ticket) {
    return NextResponse.json({ error: "Failed to update ticket" }, { status: 500 });
  }

  await auditLog({
    adminId: userId,
    action: "support_ticket_update",
    entityType: "support_tickets",
    entityId: id,
    before,
    after: ticket,
    reason: parsed.data.reason ?? "Support ticket update",
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ ticket });
}

export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const { error, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "admin", "support"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = replySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid support reply" } },
      { status: 422 }
    );
  }

  const admin = createAdminSupabaseClient();
  const { data: ticket } = await (admin.from("support_tickets" as never) as any)
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  if (ticket.status === "closed") {
    return NextResponse.json({ error: "Closed tickets cannot receive replies" }, { status: 422 });
  }

  const { data: message, error: messageError } = await (admin.from("support_messages" as never) as any)
    .insert({
      ticket_id: id,
      sender_type: "admin",
      sender_id: userId,
      message: parsed.data.message,
    })
    .select("*")
    .single();

  if (messageError || !message) {
    return NextResponse.json({ error: "Failed to send reply" }, { status: 500 });
  }

  await (admin.from("support_tickets" as never) as any)
    .update({ status: "waiting_on_user", assigned_admin_id: userId })
    .eq("id", id);

  await auditLog({
    adminId: userId,
    action: "support_ticket_reply",
    entityType: "support_tickets",
    entityId: id,
    after: message,
    reason: "Admin reply",
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ message }, { status: 201 });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const { error, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "admin", "support"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminSupabaseClient();
  const { data: before } = await (admin.from("support_tickets" as never) as any)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!before) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  const { error: deleteError } = await (admin.from("support_tickets" as never) as any)
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete ticket" }, { status: 500 });
  }

  await auditLog({
    adminId: userId,
    action: "support_ticket_delete",
    entityType: "support_tickets",
    entityId: id,
    before,
    reason: "Deleted by admin",
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ ok: true });
}
