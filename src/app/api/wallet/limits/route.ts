import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { MAX_WITHDRAWAL_AMOUNT } from "@/lib/wallet";
import { getWithdrawalHoldDays, getWithdrawalProcessingDays } from "@/lib/platform-settings";
import { getWalletSummaryForUser } from "@/lib/wallet";
import { getMinWithdrawalAmount, getWithdrawalContactForUser, getWithdrawalFeeAmount } from "@/lib/withdrawals";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [minWithdrawal, withdrawalFee, withdrawalHoldDays, withdrawalProcessingDays, contact, walletSummary] = await Promise.all([
      getMinWithdrawalAmount(),
      getWithdrawalFeeAmount(),
      getWithdrawalHoldDays(),
      getWithdrawalProcessingDays(),
      getWithdrawalContactForUser(user.id),
      getWalletSummaryForUser(user.id),
    ]);

    return NextResponse.json({
      allowedPhone: contact.phone,
      availableBalance: walletSummary.available,
      minWithdrawal,
      maxWithdrawal: MAX_WITHDRAWAL_AMOUNT,
      withdrawalFee,
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
