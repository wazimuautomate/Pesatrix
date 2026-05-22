import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const admin = createAdminSupabaseClient();

    // Query platform_settings table for withdrawal configuration keys
    const { data: settings, error } = await admin
      .from("platform_settings")
      .select("key, value")
      .in("key", ["withdrawal_min_amount", "withdrawals_enabled"]);

    if (error) {
      throw error;
    }

    const minAmountRow = settings?.find((s: any) => s.key === "withdrawal_min_amount");
    const enabledRow = settings?.find((s: any) => s.key === "withdrawals_enabled");

    const rawMinAmount = minAmountRow ? parseInt(minAmountRow.value, 10) : null;
    const isMinAmountConfigured = minAmountRow !== undefined && !isNaN(rawMinAmount as number);
    
    // Withdrawals are enabled if withdrawals_enabled key does not exist or is not 'false' AND min amount is configured
    const withdrawalsEnabled =
      isMinAmountConfigured &&
      (enabledRow ? enabledRow.value !== "false" : true);

    return NextResponse.json({
      minAmount: isMinAmountConfigured ? rawMinAmount : null,
      withdrawalsEnabled: withdrawalsEnabled,
    });
  } catch (err) {
    console.error("[GET /api/settings/withdrawal] Failed to fetch settings:", err);
    return NextResponse.json(
      { minAmount: null, withdrawalsEnabled: false, error: "Failed to fetch withdrawal settings" },
      { status: 500 }
    );
  }
}
