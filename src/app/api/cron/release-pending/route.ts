import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { reconcileStuckTransactions } from "@/lib/mpesa/reconciliation";

export async function GET(request: Request) {
  const cronSecret = request.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createAdminSupabaseClient();
  const [{ error }, reconciliation] = await Promise.all([
    supabaseAdmin.rpc("release_pending_wallet_credits"),
    reconcileStuckTransactions(),
  ]);

  if (error) {
    console.error("[GET /api/cron/release-pending] release_pending_wallet_credits failed:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to release pending credits" } },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, ran: new Date().toISOString(), reconciliation });
}
