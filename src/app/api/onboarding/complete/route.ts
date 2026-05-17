import { NextResponse } from "next/server";
import { z } from "zod";
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
        .select("full_name, county")
        .eq("id", user.id)
        .maybeSingle(),
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
      console.error("[POST /api/onboarding/complete] Profile update failed:", profileError);
      return NextResponse.json(
        {
          error: {
            code: "PROFILE_UPDATE_FAILED",
            message: "Profile update failed",
            detail: profileError.message,
          },
        },
        { status: 500 }
      );
    }

    const activated = Boolean(
      currentStatus?.is_activated ||
        currentStatus?.state === "activated" ||
        currentStatus?.status === "active"
    );
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

    const { data: updatedStatus, error: accountStatusError } = await (admin.from("account_status" as never) as any)
      .update(statusPatch)
      .eq("user_id", user.id)
      .select("user_id")
      .maybeSingle();

    if (accountStatusError) {
      console.error("[POST /api/onboarding/complete] Status update failed:", accountStatusError);
      return NextResponse.json(
        {
          error: {
            code: "STATUS_UPDATE_FAILED",
            message: "Status update failed",
            detail: accountStatusError.message,
          },
        },
        { status: 500 }
      );
    }

    if (!updatedStatus) {
      const { error: insertStatusError } = await (admin.from("account_status" as never) as any).insert({
        user_id: user.id,
        ...statusPatch,
        is_activated: activated,
        activated_at: currentStatus?.activated_at ?? null,
      });

      if (insertStatusError) {
        console.error("[POST /api/onboarding/complete] Status insert failed:", insertStatusError);
        return NextResponse.json(
          {
            error: {
              code: "STATUS_INSERT_FAILED",
              message: "Status insert failed",
              detail: insertStatusError.message,
            },
          },
          { status: 500 }
        );
      }
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
