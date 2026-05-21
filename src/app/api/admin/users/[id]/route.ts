import { NextResponse } from "next/server";
import { z } from "zod";
import { hasPaidActivationPayment } from "@/lib/activation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog, requireAdmin } from "../../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const updateUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().min(10).max(20).optional(),
  county: z.string().trim().min(2).max(80).optional(),
  status: z.enum(["registered", "setup_complete", "pending_activation", "activated", "active", "suspended", "banned"]).optional(),
  isActivated: z.boolean().optional(),
  isSetupComplete: z.boolean().optional(),
  reason: z.string().trim().min(5).max(240).optional(),
});

export async function GET(
  _req: Request,
  { params }: RouteContext
) {
  const { id } = await params;
  const { error } = await requireAdmin();
  if (error) return error;

  const admin = createAdminSupabaseClient();

  const [
    { data: profile },
    { data: status },
    { data: verification },
    { data: wallet },
    { data: activationPayment },
    { data: txns },
    { data: withdrawals },
    { data: tickets },
    { data: audit },
    { data: training },
  ] = await Promise.all([
    (admin.from("profiles" as never) as any).select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
    (admin.from("account_status" as never) as any).select("*").eq("user_id", id).maybeSingle(),
    (admin.from("user_verification" as never) as any).select("*").eq("user_id", id).maybeSingle(),
    (admin.from("wallets" as never) as any).select("*").eq("user_id", id).maybeSingle(),
    (admin.from("activation_payments" as never) as any).select("*").eq("user_id", id).order("created_at", { ascending: false }).limit(1),
    (admin.from("wallet_transactions" as never) as any)
      .select("id, amount, direction, status, bucket, type, description, reference_table, reference_id, available_at, created_at, created_by_admin_id")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    (admin.from("withdrawal_requests" as never) as any)
      .select("id, amount, phone, status, mpesa_txn_id, failure_reason, created_at, processed_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    (admin.from("support_tickets" as never) as any)
      .select("id, category, subject, status, priority, assigned_to, created_at, updated_at")
      .eq("user_id", id)
      .order("updated_at", { ascending: false })
      .limit(10),
    (admin.from("audit_log" as never) as any)
      .select("id, action, entity_type, entity_id, reason, before_json, after_json, created_at, admin_id")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    (admin.from("training_progress" as never) as any).select("*").eq("user_id", id).maybeSingle(),
  ]);

  if (!profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const timeline = buildTimeline(profile, status, activationPayment);

  return NextResponse.json({
    profile,
    status,
    verification,
    wallet: wallet ?? { available_balance: 0, pending_balance: 0, total_earned: 0 },
    activationPayment: activationPayment?.[0] ?? null,
    walletTransactions: txns ?? [],
    withdrawals: withdrawals ?? [],
    supportTickets: tickets ?? [],
    auditLog: audit ?? [],
    timeline,
    training: training ?? null,
  });
}

function buildTimeline(profile: any, status: any, activationPayment: any) {
  const events: { label: string; date: string; detail?: string }[] = [];

  if (profile?.created_at) {
    events.push({ label: "Registered", date: profile.created_at, detail: "Account created" });
  }

  if (status?.is_setup_complete && status?.setup_completed_at) {
    events.push({ label: "Setup Complete", date: status.setup_completed_at });
  }

  const payment = activationPayment?.[0];
  if (payment?.paid_at) {
    events.push({
      label: "Activation Payment",
      date: payment.paid_at,
      detail: `KSh ${Number(payment.amount).toLocaleString()} (${payment.mpesa_receipt ?? "pending receipt"})`,
    });
  }

  if (status?.is_activated && status?.activated_at) {
    events.push({ label: "Activated", date: status.activated_at });
  }

  if (status?.suspended_at) {
    events.push({
      label: status.status === "banned" ? "Banned" : "Suspended",
      date: status.suspended_at,
      detail: status.suspension_reason ?? undefined,
    });
  }

  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return events;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const { error, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = updateUserSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid user update" } },
      { status: 422 }
    );
  }

  const admin = createAdminSupabaseClient();
  const [{ data: beforeProfile }, { data: beforeStatus }] = await Promise.all([
    (admin.from("profiles" as never) as any).select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
    (admin.from("account_status" as never) as any).select("*").eq("user_id", id).maybeSingle(),
  ]);

  if (!beforeProfile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const profilePatch: Record<string, unknown> = {};
  if (parsed.data.fullName !== undefined) profilePatch.full_name = parsed.data.fullName;
  if (parsed.data.email !== undefined) profilePatch.email = parsed.data.email.toLowerCase();
  if (parsed.data.phone !== undefined) profilePatch.phone = parsed.data.phone;
  if (parsed.data.county !== undefined) profilePatch.county = parsed.data.county;

  let updatedProfile = beforeProfile;
  if (Object.keys(profilePatch).length > 0) {
    const { data, error: profileError } = await (admin.from("profiles" as never) as any)
      .update(profilePatch)
      .eq("id", id)
      .select("*")
      .single();

    if (profileError || !data) {
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    updatedProfile = data;
  }

  if (parsed.data.email !== undefined) {
    const { error: authError } = await admin.auth.admin.updateUserById(id, {
      email: parsed.data.email.toLowerCase(),
      email_confirm: true,
    });

    if (authError) {
      return NextResponse.json({ error: "Profile updated, but auth email update failed" }, { status: 500 });
    }
  }

  const statusPatch: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) {
    statusPatch.status = parsed.data.status;
    statusPatch.state = parsed.data.status === "active" ? "activated" : parsed.data.status;
    if (["suspended", "banned"].includes(parsed.data.status)) {
      statusPatch.suspended_at = new Date().toISOString();
      statusPatch.suspension_reason = parsed.data.reason ?? "Updated by admin";
    }
  }
  if (parsed.data.isActivated !== undefined) {
    statusPatch.is_activated = parsed.data.isActivated;
    statusPatch.activated_at = parsed.data.isActivated ? new Date().toISOString() : null;
  }
  if (parsed.data.isSetupComplete !== undefined) {
    statusPatch.is_setup_complete = parsed.data.isSetupComplete;
    statusPatch.setup_completed_at = parsed.data.isSetupComplete ? new Date().toISOString() : null;
  }

  let updatedStatus = beforeStatus;
  if (Object.keys(statusPatch).length > 0) {
    const requestsActivation =
      statusPatch.is_activated === true ||
      statusPatch.state === "activated" ||
      statusPatch.status === "active" ||
      statusPatch.status === "activated";

    if (requestsActivation && !(await hasPaidActivationPayment(admin, id))) {
      return NextResponse.json(
        { error: "User cannot be activated without a paid activation payment" },
        { status: 422 }
      );
    }

    const { data, error: statusError } = await (admin.from("account_status" as never) as any)
      .upsert({ user_id: id, ...statusPatch }, { onConflict: "user_id" })
      .select("*")
      .single();

    if (statusError || !data) {
      return NextResponse.json({ error: "Failed to update account status" }, { status: 500 });
    }

    updatedStatus = data;
  }

  await auditLog({
    adminId: userId,
    action: "user_update",
    entityType: "profiles",
    entityId: id,
    before: { profile: beforeProfile, status: beforeStatus },
    after: { profile: updatedProfile, status: updatedStatus },
    reason: parsed.data.reason ?? "Admin user update",
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ profile: updatedProfile, status: updatedStatus });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const { error, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (userId === id) {
    return NextResponse.json({ error: "You cannot delete yourself" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();

  const { data: beforeProfile } = await (admin.from("profiles" as never) as any)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!beforeProfile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: beforeStatus } = await (admin.from("account_status" as never) as any)
    .select("*")
    .eq("user_id", id)
    .maybeSingle();

  const deletedAt = new Date().toISOString();

  const { error: profileError } = await (admin.from("profiles" as never) as any)
    .update({ deleted_at: deletedAt })
    .eq("id", id);

  if (profileError) {
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }

  await (admin.from("account_status" as never) as any)
    .update({ status: "banned", state: "banned", suspended_at: deletedAt, suspension_reason: "Deleted by admin" })
    .eq("user_id", id);

  await auditLog({
    adminId: userId,
    action: "user_delete",
    entityType: "profiles",
    entityId: id,
    before: { profile: beforeProfile, status: beforeStatus },
    after: { profile: { ...beforeProfile, deleted_at: deletedAt }, status: { status: "banned" } },
    reason: "Deleted by admin (soft delete)",
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ ok: true, method: "soft_delete" });
}
