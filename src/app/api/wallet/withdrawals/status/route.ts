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
      .select("status, amount, phone")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      throw error;
    }

    if (requests && requests.length > 0) {
      const latest = requests[0];
      return NextResponse.json({
        hasPending: ["requested", "processing"].includes(latest.status),
        status: latest.status,
        amount: latest.amount,
        phone: latest.phone,
      });
    }

    return NextResponse.json({
      hasPending: false,
      status: null,
      amount: null,
      phone: null,
    });
  } catch (err) {
    console.error("[GET /api/wallet/withdrawals/status] Error:", err);
    return NextResponse.json(
      { hasPending: false, status: null, amount: null, error: "Failed to query withdrawal status" },
      { status: 500 }
    );
  }
}
