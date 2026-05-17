import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getTrainingProgramSnapshotForUser } from "@/lib/training";
import { buildMeResponse } from "@/lib/user-bootstrap";

export async function GET() {
  try {
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

    const [profileResult, accountStatusResult, verificationResult, walletResult, trainingSnapshot] =
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
        (supabase.from("wallet_transactions" as never) as any)
          .select("amount, bucket, direction")
          .eq("user_id", user.id),
        getTrainingProgramSnapshotForUser(user.id),
      ]);

    return NextResponse.json(
      buildMeResponse({
        authEmail: user.email ?? null,
        authMetadata: user.user_metadata ?? null,
        emailConfirmed: Boolean(user.email_confirmed_at),
        profile: profileResult.data ?? null,
        accountStatus: accountStatusResult.data ?? null,
        verification: verificationResult.data ?? null,
        walletTransactions: walletResult.data ?? [],
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
