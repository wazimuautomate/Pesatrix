import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { MAX_WITHDRAWAL_AMOUNT } from "@/lib/wallet";
import { getWithdrawalHoldDays, getWithdrawalProcessingDays } from "@/lib/platform-settings";
import { getMinWithdrawalAmount, getWithdrawalContactForUser } from "@/lib/withdrawals";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [minWithdrawal, withdrawalHoldDays, withdrawalProcessingDays, contact] = await Promise.all([
      getMinWithdrawalAmount(),
      getWithdrawalHoldDays(),
      getWithdrawalProcessingDays(),
      getWithdrawalContactForUser(user.id),
    ]);

    return NextResponse.json({
      allowedPhone: contact.phone,
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
