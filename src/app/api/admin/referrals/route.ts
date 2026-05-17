import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog, requireAdmin } from "../_lib";

const referralSchema = z.object({
  referrerId: z.string().uuid(),
  refereeId: z.string().uuid(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
  source: z.enum(["signup", "admin", "import"]).default("admin"),
  reason: z.string().trim().min(3).max(240).optional(),
});

export async function POST(request: Request) {
  const { error, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "admin"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = referralSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid referral" } },
      { status: 422 }
    );
  }

  if (parsed.data.referrerId === parsed.data.refereeId) {
    return NextResponse.json({ error: "Referrer and referee cannot be the same user" }, { status: 422 });
  }

  const admin = createAdminSupabaseClient();
  const { data: referral, error: insertError } = await (admin.from("referrals" as never) as any)
    .insert({
      referrer_id: parsed.data.referrerId,
      referee_id: parsed.data.refereeId,
      level: parsed.data.level,
      source: parsed.data.source,
    })
    .select("*")
    .single();

  if (insertError || !referral) {
    return NextResponse.json({ error: "Failed to create referral" }, { status: 500 });
  }

  await auditLog({
    adminId: userId,
    action: "referral_create",
    entityType: "referrals",
    entityId: referral.id,
    after: referral,
    reason: parsed.data.reason ?? "Created by admin",
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({ referral }, { status: 201 });
}
