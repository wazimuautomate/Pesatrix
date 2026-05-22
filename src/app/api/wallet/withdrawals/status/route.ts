import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

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

    // Query the absolute latest withdrawal request for the current user
    const { data: requests, error } = await admin
      .from("withdrawal_requests")
      .select("id, status, amount, phone, fee_ksh, amount_after_fee, failure_reason, created_at, processed_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      throw error;
    }

    if (requests && requests.length > 0) {
      const latest = requests[0];
      return NextResponse.json({
        hasPending: ["requested", "processing", "held"].includes(latest.status),
        id: latest.id,
        status: latest.status,
        amount: latest.amount,
        phone: latest.phone,
        fee: latest.fee_ksh,
        amountToReceive: latest.amount_after_fee,
        failureReason: latest.failure_reason,
        createdAt: latest.created_at,
        processedAt: latest.processed_at,
      });
    }

    return NextResponse.json({
      hasPending: false,
      id: null,
      status: null,
      amount: null,
      phone: null,
      fee: null,
      amountToReceive: null,
      failureReason: null,
      createdAt: null,
      processedAt: null,
    });
  } catch (err) {
    console.error("[GET /api/wallet/withdrawals/status] Error:", err);
    return NextResponse.json(
      { hasPending: false, status: null, amount: null, error: "Failed to query withdrawal status" },
      { status: 500 }
    );
  }
}
