import { NextResponse } from "next/server";

import { requireAdmin } from "../../../_lib";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const { error } = await requireAdmin({ request, allowedRoles: ["admin"] });
  if (error) return error;

  const admin = createAdminSupabaseClient();
  const [
    profile,
    accountStatus,
    verification,
    wallet,
    transactions,
    submissions,
    referralsMade,
    referralBonuses,
    withdrawalRequests,
  ] = await Promise.all([
    (admin.from("profiles" as never) as any).select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
    (admin.from("account_status" as never) as any).select("*").eq("user_id", id).maybeSingle(),
    (admin.from("user_verification" as never) as any).select("*").eq("user_id", id).maybeSingle(),
    (admin.from("wallets" as never) as any).select("*").eq("user_id", id).maybeSingle(),
    (admin.from("wallet_transactions" as never) as any)
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    (admin.from("task_submissions" as never) as any)
      .select("*, tasks(title, category, payout_ksh)")
      .eq("user_id", id)
      .order("submitted_at", { ascending: false })
      .limit(50),
    (admin.from("referrals" as never) as any)
      .select("*, profiles!referrals_referee_id_fkey(full_name, phone)")
      .eq("referrer_id", id),
    (admin.from("referral_bonuses" as never) as any)
      .select("*")
      .eq("referrer_id", id)
      .order("created_at", { ascending: false }),
    (admin.from("withdrawal_requests" as never) as any)
      .select("*")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  if (profile.error) {
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }

  if (!profile.data) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    profile: profile.data,
    accountStatus: accountStatus.data ?? null,
    verification: verification.data ?? null,
    wallet: wallet.data ?? { available_balance: 0, pending_balance: 0, total_earned: 0 },
    transactions: transactions.data ?? [],
    submissions: submissions.data ?? [],
    referralsMade: referralsMade.data ?? [],
    referralBonuses: referralBonuses.data ?? [],
    withdrawalRequests: withdrawalRequests.data ?? [],
  });
}
