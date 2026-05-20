import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { creditDirectReferralBonus } from "@/lib/referral";
import { auditLog, requireAdmin } from "../_lib";

const referralSchema = z.object({
  referrerIdentifier: z.string().trim().min(2).max(120),
  refereeIdentifier: z.string().trim().min(2).max(120),
  source: z.enum(["signup", "admin", "import"]).default("admin"),
  reason: z.string().trim().min(3).max(240).optional(),
});

type ResolvedProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  referral_code: string;
  referred_by: string | null;
};

async function resolveProfileByIdentifier(identifier: string) {
  const admin = createAdminSupabaseClient();
  const normalized = identifier.trim();
  const upperCode = normalized.toUpperCase();
  const lowerEmail = normalized.toLowerCase();

  const candidates = [
    { column: "id", value: normalized },
    { column: "referral_code", value: upperCode },
    { column: "email", value: lowerEmail },
    { column: "phone", value: normalized.replace(/\s+/g, "") },
  ];

  for (const candidate of candidates) {
    const { data, error } = await (admin.from("profiles" as never) as any)
      .select("id, full_name, email, phone, referral_code, referred_by")
      .eq(candidate.column, candidate.value)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data) {
      return data as ResolvedProfile;
    }
  }

  return null;
}

export async function POST(request: Request) {
  const { error, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
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

  const [referrer, referee] = await Promise.all([
    resolveProfileByIdentifier(parsed.data.referrerIdentifier),
    resolveProfileByIdentifier(parsed.data.refereeIdentifier),
  ]);

  if (!referrer) {
    return NextResponse.json({ error: "Referrer profile could not be found" }, { status: 404 });
  }

  if (!referee) {
    return NextResponse.json({ error: "Referee profile could not be found" }, { status: 404 });
  }

  if (referrer.id === referee.id) {
    return NextResponse.json({ error: "Referrer and referee cannot be the same user" }, { status: 422 });
  }

  const admin = createAdminSupabaseClient();
  const { data: existingDirectReferral, error: existingReferralError } = await (admin.from("referrals" as never) as any)
    .select("id, referrer_id, referee_id, level, source, created_at")
    .eq("referee_id", referee.id)
    .eq("level", 1)
    .maybeSingle();

  if (existingReferralError) {
    return NextResponse.json({ error: "Failed to validate existing referral" }, { status: 500 });
  }

  if (existingDirectReferral && existingDirectReferral.referrer_id !== referrer.id) {
    return NextResponse.json(
      { error: "This user already has a different direct referrer. Clean up the existing relationship first." },
      { status: 409 }
    );
  }

  const { error: profileUpdateError } = await (admin.from("profiles" as never) as any)
    .update({ referred_by: referrer.id })
    .eq("id", referee.id);

  if (profileUpdateError) {
    return NextResponse.json({ error: "Failed to assign the direct referral on profile" }, { status: 500 });
  }

  let referral = existingDirectReferral;

  if (!referral) {
    const { data: insertedReferral, error: insertError } = await (admin.from("referrals" as never) as any)
      .insert({
        referrer_id: referrer.id,
        referee_id: referee.id,
        level: 1,
        source: parsed.data.source,
      })
      .select("*")
      .single();

    if (insertError || !insertedReferral) {
      return NextResponse.json({ error: "Failed to create referral" }, { status: 500 });
    }

    referral = insertedReferral;
  } else if (existingDirectReferral.source !== parsed.data.source) {
    const { data: updatedReferral, error: updateError } = await (admin.from("referrals" as never) as any)
      .update({ source: parsed.data.source })
      .eq("id", existingDirectReferral.id)
      .select("*")
      .single();

    if (updateError || !updatedReferral) {
      return NextResponse.json({ error: "Failed to update referral source" }, { status: 500 });
    }

    referral = updatedReferral;
  }

  await creditDirectReferralBonus(referee.id);

  await auditLog({
    adminId: userId,
    action: "referral_create",
    entityType: "referrals",
    entityId: referral.id,
    after: {
      referral,
      referrer: { id: referrer.id, referral_code: referrer.referral_code },
      referee: { id: referee.id, previous_referred_by: referee.referred_by },
    },
    reason: parsed.data.reason ?? "Created by admin",
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json(
    {
      referral,
      referrer,
      referee: {
        ...referee,
        referred_by: referrer.id,
      },
    },
    { status: existingDirectReferral ? 200 : 201 }
  );
}
