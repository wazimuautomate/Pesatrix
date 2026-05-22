import { NextResponse } from "next/server";
import { getMinWithdrawalKsh, getPlatformSetting } from "@/lib/platform-settings";
import { WITHDRAWALS_ENABLED_KEY } from "@/lib/platform-setting-keys";

export async function GET() {
  try {
    const minAmount = await getMinWithdrawalKsh();
    const enabledRow = await getPlatformSetting(WITHDRAWALS_ENABLED_KEY);

    if (minAmount === null) {
      return NextResponse.json({
        minAmount: null,
        withdrawalsEnabled: false,
        reason: "configuration_error",
      });
    }

    const withdrawalsEnabled = enabledRow ? enabledRow.value !== "false" : true;

    return NextResponse.json({
      minAmount,
      withdrawalsEnabled,
      reason: withdrawalsEnabled ? null : "disabled",
    });
  } catch (err) {
    console.error("[GET /api/settings/withdrawal] Failed to fetch settings:", err);
    return NextResponse.json(
      { minAmount: null, withdrawalsEnabled: false, error: "Failed to fetch withdrawal settings" },
      { status: 500 }
    );
  }
}
