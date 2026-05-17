import { NextResponse } from "next/server";
import { z } from "zod";
import { buildOnboardingMetadataPatch, mergeAccountMetadata } from "@/lib/account-progress";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const onboardingSchema = z.object({
  fullName: z.string().trim().min(3, "Full name is too short").max(120).optional(),
  county: z.string().trim().min(2, "County is required").max(80).optional(),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms to continue" }),
  }),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = onboardingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0].message } },
        { status: 422 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    const admin = createAdminSupabaseClient();

    const [{ data: currentStatus }, { data: currentProfile }] = await Promise.all([
      (admin.from("account_status" as never) as any)
        .select("is_activated, activated_at, status, state")
        .eq("user_id", user.id)
        .maybeSingle(),
      (admin.from("profiles" as never) as any)
        .select("full_name, county, phone, email, metadata")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    const nextStatus =
      currentStatus?.is_activated || currentStatus?.state === "activated"
        ? "activated"
        : "setup_complete";
    const nextState = nextStatus;

    const userMeta =
      user.user_metadata && typeof user.user_metadata === "object"
        ? (user.user_metadata as Record<string, unknown>)
        : {};

    const fullName =
      parsed.data.fullName?.trim() ||
      (typeof currentProfile?.full_name === "string"
        ? currentProfile.full_name.trim()
        : "") ||
      (typeof userMeta.full_name === "string" ? userMeta.full_name.trim() : "");

    const county =
      parsed.data.county?.trim() ||
      (typeof currentProfile?.county === "string"
        ? currentProfile.county.trim()
        : "") ||
      (typeof userMeta.county === "string" ? userMeta.county.trim() : "");

    if (!fullName || !county) {
      return NextResponse.json(
        {
          error: {
            code: "PROFILE_INCOMPLETE",
            message:
              "Your signup profile is missing a name or county. Update your profile before completing onboarding.",
          },
        },
        { status: 422 }
      );
    }

    const mergedMetadata = mergeAccountMetadata(
      currentProfile?.metadata,
      buildOnboardingMetadataPatch()
    );

    const profilePayload = {
      id: user.id,
      full_name: fullName,
      county,
      phone:
        currentProfile?.phone ??
        (typeof user.user_metadata.phone === "string" ? user.user_metadata.phone : null),
      email: currentProfile?.email ?? user.email ?? null,
      email_verified: Boolean(user.email_confirmed_at),
      metadata: mergedMetadata,
      updated_at: new Date().toISOString(),
    };

    const { error: profileError } = await (admin.from("profiles" as never) as any).upsert(profilePayload, {
      onConflict: "id",
    });

    if (profileError) {
      throw profileError;
    }

    const accountStatusPayload = {
      user_id: user.id,
      is_setup_complete: true,
      setup_completed_at: new Date().toISOString(),
      is_activated: currentStatus?.is_activated ?? false,
      activated_at: currentStatus?.activated_at ?? null,
      status: nextStatus,
      state: nextState,
    };

    const { error: accountStatusError } = await (admin.from("account_status" as never) as any).upsert(
      accountStatusPayload,
      { onConflict: "user_id" }
    );

    if (accountStatusError) {
      throw accountStatusError;
    }

    return NextResponse.json({ ok: true, setupComplete: true });
  } catch (error) {
    console.error("[POST /api/onboarding/complete]", error);

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to complete onboarding" } },
      { status: 500 }
    );
  }
}
