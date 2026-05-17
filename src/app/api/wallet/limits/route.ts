import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { MAX_WITHDRAWAL_AMOUNT } from "@/lib/wallet";
import { getWithdrawalHoldDays, getWithdrawalProcessingDays } from "@/lib/platform-settings";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminSupabaseClient();
    const { data: settings } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", "min_withdrawal_amount_ksh")
      .maybeSingle();

    const minWithdrawal = settings?.value ? parseInt(settings.value, 10) : 100;

    const [withdrawalHoldDays, withdrawalProcessingDays] = await Promise.all([
      getWithdrawalHoldDays(),
      getWithdrawalProcessingDays(),
    ]);

    return NextResponse.json({
      minWithdrawal,
      maxWithdrawal: MAX_WITHDRAWAL_AMOUNT,
      withdrawalHoldDays,
      withdrawalProcessingDays,
    });
  } catch (err) {
    console.error("[Wallet Limits Error]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch wallet limits" } },
      { status: 500 }
    );
  }
}
