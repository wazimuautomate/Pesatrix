import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog, requireAdmin } from "../../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const updatePaymentSchema = z.object({
  status: z.enum(["pending", "paid", "failed", "reversed"]).optional(),
  phone: z.string().trim().min(10).max(20).optional(),
  mpesaReceipt: z.string().trim().max(80).optional(),
  merchantRequestId: z.string().trim().max(120).optional(),
  checkoutRequestId: z.string().trim().max(120).optional(),
  reason: z.string().trim().min(3).max(240).optional(),
});

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const { error, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "admin", "finance"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = updatePaymentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid payment update" } },
      { status: 422 }
    );
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) {
    update.status = parsed.data.status;
    update.paid_at = parsed.data.status === "paid" ? new Date().toISOString() : null;
  }
  if (parsed.data.phone !== undefined) update.phone = parsed.data.phone;
  if (parsed.data.mpesaReceipt !== undefined) update.mpesa_receipt = parsed.data.mpesaReceipt || null;
  if (parsed.data.merchantRequestId !== undefined) update.merchant_request_id = parsed.data.merchantRequestId || null;
  if (parsed.data.checkoutRequestId !== undefined) update.checkout_request_id = parsed.data.checkoutRequestId || null;

  const admin = createAdminSupabaseClient();
  const { data: before } = await (admin.from("activation_payments" as never) as any)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!before) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

  const { data: payment, error: updateError } = await (admin.from("activation_payments" as never) as any)
    .update(update)
    .eq("id", id)
    .select("*")
    .single();

  if (updateError || !payment) {
    return NextResponse.json({ error: "Failed to update payment" }, { status: 500 });
  }

  await auditLog({
    adminId: userId,
    action: "payment_update",
    entityType: "activation_payments",
    entityId: id,
    before,
    after: payment,
    reason: parsed.data.reason ?? "Payment update",
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ payment });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const { error, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "admin"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminSupabaseClient();
  const { data: before } = await (admin.from("activation_payments" as never) as any)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!before) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

  const { error: deleteError } = await (admin.from("activation_payments" as never) as any)
    .delete()
    .eq("id", id);
  if (deleteError) return NextResponse.json({ error: "Failed to delete payment" }, { status: 500 });

  await auditLog({
    adminId: userId,
    action: "payment_delete",
    entityType: "activation_payments",
    entityId: id,
    before,
    reason: "Deleted by admin",
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ ok: true });
}
