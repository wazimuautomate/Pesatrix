import { NextResponse } from "next/server";
import { z } from "zod";
import { hasPaidActivationPayment } from "@/lib/activation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { creditDirectReferralBonus } from "@/lib/referral";
import { internalErrorResponse, unauthorizedResponse, validationErrorResponse } from "@/lib/api";
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
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return unauthorizedResponse();
    }

    const parsed = onboardingSchema.safeParse(await request.json());

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.errors[0].message);
    }

    const admin = createAdminSupabaseClient();

    const [{ data: currentProfile }, hasPaidActivation] = await Promise.all([
      (admin.from("profiles" as never) as any)
        .select("full_name, county")
        .eq("id", user.id)
        .maybeSingle(),
      hasPaidActivationPayment(admin, user.id),
    ]);

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

    const { error: profileError } = await (admin.from("profiles" as never) as any)
      .update({
        full_name: fullName,
        county,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (profileError) {
      console.error("[POST /api/onboarding/complete] profile update failed:", profileError);
      return NextResponse.json(
        {
          error: {
            code: "PROFILE_UPDATE_FAILED",
            message: "Profile update failed",
          },
        },
        { status: 500 }
      );
    }

    const activated = hasPaidActivation;
    const statusPatch = activated
      ? {
          is_setup_complete: true,
          setup_completed_at: new Date().toISOString(),
          status: "active",
          state: "activated",
        }
      : {
          is_setup_complete: true,
          setup_completed_at: new Date().toISOString(),
          status: "setup_complete",
          state: "setup_complete",
        };

    const { error: accountStatusError } = await (admin.from("account_status" as never) as any).upsert(
      {
        user_id: user.id,
        ...statusPatch,
      },
      { onConflict: "user_id" }
    );

    if (accountStatusError) {
      console.error("[POST /api/onboarding/complete] status update failed:", accountStatusError);
      return NextResponse.json(
        {
          error: {
            code: "STATUS_UPDATE_FAILED",
            message: "Status update failed",
          },
        },
        { status: 500 }
      );
    }

    const { data: verifiedStatus, error: verifyError } = await (admin.from("account_status" as never) as any)
      .select("is_setup_complete, status, state")
      .eq("user_id", user.id)
      .maybeSingle();

    if (verifyError || verifiedStatus?.is_setup_complete !== true) {
      console.error("[POST /api/onboarding/complete] status verification failed:", {
        error: verifyError,
        status: verifiedStatus,
      });
      return NextResponse.json(
        {
          error: {
            code: "STATUS_VERIFY_FAILED",
            message: "Status verification failed",
          },
        },
        { status: 500 }
      );
    }

    if (activated) {
      void creditDirectReferralBonus(user.id);
    }

    return NextResponse.json({ ok: true, setupComplete: true });
  } catch (error) {
    console.error("[POST /api/onboarding/complete] error:", error);
    return internalErrorResponse("Failed to complete onboarding");
  }
}
