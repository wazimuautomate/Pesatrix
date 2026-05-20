import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getAdminWithdrawalById } from "@/lib/admin-withdrawals";
import { normalizeWithdrawalStoragePhone } from "@/lib/withdrawals";
import { requireAdmin, auditLog, getRequestMeta } from "../../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const updateSchema = z.object({
  amount: z.number().int().positive().optional(),
  phone: z.string().trim().optional(),
  status: z.enum(["requested", "processing", "sent", "failed", "held"]).optional(),
  mpesaTxnId: z.string().trim().optional(),
  reason: z.string().trim().optional(),
});

async function getWithdrawal(admin: ReturnType<typeof createAdminSupabaseClient>, id: string) {
  const { data: withdrawal, error } = await (admin.from("withdrawal_requests" as never) as any)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !withdrawal) {
    return null;
  }

  return withdrawal;
}

export async function GET(request: Request, { params }: RouteContext) {
  const { error } = await requireAdmin({
    allowedRoles: ["super_admin", "finance", "admin", "support"],
  });
  if (error) return error;

  const { id } = await params;

  const withdrawal = await getAdminWithdrawalById(id);

  if (!withdrawal) {
    return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
  }

  return NextResponse.json({ withdrawal });
}

export async function POST(request: Request, context: RouteContext) {
  const body = await request.json().catch(() => ({}));

  if (body?.action === "mark-sent") {
    const { POST: markSent } = await import("./send/route");
    return markSent(
      new Request(request.url, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify({ mpesaTxnId: body.mpesaTxnId, reason: body.reason }),
      }),
      context
    );
  }

  if (body?.action === "fail") {
    const { POST: fail } = await import("./fail/route");
    return fail(
      new Request(request.url, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify({ reason: body.reason }),
      }),
      context
    );
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 422 });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { error, userId } = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "finance", "admin"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Invalid request" },
      { status: 422 }
    );
  }

  const { id } = await params;
  const admin = createAdminSupabaseClient();
  const before = await getWithdrawal(admin, id);
  if (!before) {
    return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.amount !== undefined) patch.amount = parsed.data.amount;
  if (parsed.data.phone !== undefined) patch.phone = normalizeWithdrawalStoragePhone(parsed.data.phone);
  if (parsed.data.mpesaTxnId !== undefined) patch.mpesa_txn_id = parsed.data.mpesaTxnId || null;

  if (parsed.data.status === "requested" && before.status === "failed") {
    patch.status = "requested";
    patch.failure_reason = null;
    patch.processed_at = null;
    patch.mpesa_txn_id = null;
    patch.b2c_conversation_id = null;
    patch.b2c_originator_id = null;

    await (admin.from("wallet_transactions" as never) as any)
      .update({ status: "reversed" })
      .eq("reference_table", "withdrawal_requests")
      .eq("reference_id", id)
      .eq("type", "reversal")
      .eq("direction", "credit");

    await (admin.from("wallet_transactions" as never) as any)
      .update({ status: "locked", bucket: "available" })
      .eq("reference_table", "withdrawal_requests")
      .eq("reference_id", id)
      .eq("type", "withdrawal")
      .eq("direction", "debit");
  } else if (parsed.data.status !== undefined) {
    patch.status = parsed.data.status;
  }

  const { data: updated, error: updateError } = await (admin.from("withdrawal_requests" as never) as any)
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (updateError || !updated) {
    return NextResponse.json({ error: "Failed to update withdrawal" }, { status: 500 });
  }

  await auditLog({
    adminId: userId,
    action: "withdrawal_update",
    entityType: "withdrawal_requests",
    entityId: id,
    before,
    after: updated,
    reason: parsed.data.reason ?? "Withdrawal updated manually",
    ip: getRequestMeta(request).ip ?? undefined,
    userAgent: getRequestMeta(request).userAgent ?? undefined,
  });

  return NextResponse.json({ withdrawal: updated });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { error, userId } = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "finance", "admin"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const admin = createAdminSupabaseClient();
  const before = await getWithdrawal(admin, id);

  if (!before) {
    return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
  }

  if (before.status === "sent") {
    return NextResponse.json(
      { error: "Completed withdrawals cannot be deleted" },
      { status: 409 }
    );
  }

  await (admin.from("wallet_transactions" as never) as any)
    .delete()
    .eq("reference_table", "withdrawal_requests")
    .eq("reference_id", id);

  const { error: deleteError } = await (admin.from("withdrawal_requests" as never) as any)
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete withdrawal" }, { status: 500 });
  }

  await auditLog({
    adminId: userId,
    action: "withdrawal_delete",
    entityType: "withdrawal_requests",
    entityId: id,
    before,
    after: null,
    reason: "Withdrawal deleted manually",
    ip: getRequestMeta(request).ip ?? undefined,
    userAgent: getRequestMeta(request).userAgent ?? undefined,
  });

  return NextResponse.json({ ok: true });
}
