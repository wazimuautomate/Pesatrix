import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, auditLog } from "../../../_lib";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const verifyPaymentSchema = z.object({
  mpesaReceipt: z.string().trim().min(1, "M-Pesa receipt is required").max(80),
  note: z.string().trim().max(500).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { error, adminUser } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });

  if (error || !adminUser) return error;

  try {
    const parsed = verifyPaymentSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid request" } },
        { status: 422 }
      );
    }
    const { mpesaReceipt, note } = parsed.data;

    const supabase = createAdminSupabaseClient();

    // 1. Fetch the target payment
    const { data: payment, error: fetchError } = await supabase
      .from("activation_payments")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !payment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    // 2. Check receipt uniqueness globally
    const { data: existingReceipt } = await supabase
      .from("activation_payments")
      .select("id")
      .eq("mpesa_receipt", mpesaReceipt)
      .single();

    if (existingReceipt && existingReceipt.id !== id) {
      return NextResponse.json(
        { error: "M-Pesa receipt already exists for another payment" },
        { status: 400 }
      );
    }

    // 3. Update the payment
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("activation_payments")
      .update({
        status: "paid",
        mpesa_receipt: mpesaReceipt,
        paid_at: now,
      })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update payment record" },
        { status: 500 }
      );
    }

    // 4. Update the user's account_status
    const { data: accountStatus } = await supabase
      .from("account_status")
      .select("is_activated, state")
      .eq("user_id", payment.user_id)
      .single();

    if (accountStatus && !accountStatus.is_activated) {
      await supabase
        .from("account_status")
        .update({
          is_activated: true,
          activated_at: now,
          state: accountStatus.state === "pending_activation" || accountStatus.state === "registered" ? "activated" : accountStatus.state,
        })
        .eq("user_id", payment.user_id);
    }

    // 5. Write to audit_log
    await auditLog({
      adminId: adminUser.id,
      action: "payment_manual_verify",
      entityType: "activation_payments",
      entityId: id,
      before: payment,
      after: {
        ...payment,
        status: "paid",
        mpesa_receipt: mpesaReceipt,
        paid_at: now,
        note,
      },
      reason: note || "Manual verification by admin",
      ip: request.headers.get("x-forwarded-for")?.split(",")[0] || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/admin/payments/:id/verify] error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to verify payment" } },
      { status: 500 }
    );
  }
}
