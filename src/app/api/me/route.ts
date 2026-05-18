import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getTrainingProgramSnapshotForUser } from "@/lib/training";
import { buildMeResponse } from "@/lib/user-bootstrap";
import { getWalletSummaryForUser } from "@/lib/wallet";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const admin = createAdminSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
        { status: 401 }
      );
    }

    const [profileResult, accountStatusResult, verificationResult, walletSummary, trainingSnapshot] =
      await Promise.all([
        (supabase.from("profiles" as never) as any)
          .select("full_name, phone, email, county, metadata")
          .eq("id", user.id)
          .maybeSingle(),
        (supabase.from("account_status" as never) as any)
          .select("is_setup_complete, is_activated, state, status")
          .eq("user_id", user.id)
          .maybeSingle(),
        (supabase.from("user_verification" as never) as any)
          .select("phone_verified, email_verified, kyc_status")
          .eq("user_id", user.id)
          .maybeSingle(),
        getWalletSummaryForUser(user.id),
        getTrainingProgramSnapshotForUser(user.id),
      ]);

    let accountStatus = accountStatusResult.data;

    if (!accountStatus) {
      const { data: upserted, error: upsertError } = await admin
        .from("account_status")
        .upsert(
          {
            user_id: user.id,
            is_activated: false,
            is_setup_complete: false,
            status: "registered",
            state: "registered",
          },
          { onConflict: "user_id", ignoreDuplicates: true }
        )
        .select("is_setup_complete, is_activated, state, status")
        .maybeSingle();

      if (upsertError) {
        console.warn("[GET /api/me] Upsert account_status failed, fetching existing:", upsertError.message);
        const { data: existing } = await admin
          .from("account_status")
          .select("is_setup_complete, is_activated, state, status")
          .eq("user_id", user.id)
          .maybeSingle();
        accountStatus = existing ?? {
          is_activated: false,
          is_setup_complete: false,
          status: "registered",
          state: "registered",
        };
      } else if (upserted) {
        accountStatus = upserted;
      }
    }

    return NextResponse.json(
      buildMeResponse({
        authEmail: user.email ?? null,
        authMetadata: user.user_metadata ?? null,
        emailConfirmed: Boolean(user.email_confirmed_at),
        profile: profileResult.data ?? null,
        accountStatus,
        verification: verificationResult.data ?? null,
        walletTransactions: [],
        walletSummary,
        trainingSnapshot,
      })
    );
  } catch (error) {
    console.error("[GET /api/me]", error);

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to load account data" } },
      { status: 500 }
    );
  }
}
