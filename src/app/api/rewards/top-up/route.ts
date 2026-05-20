import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getWalletSummaryForUser } from "@/lib/wallet";

const topUpSchema = z.object({
  amount: z.coerce.number().int().positive().max(100000),
});

function errorResponse(message: string, code: string, status = 400) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status }
  );
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }

    const parsed = topUpSchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0]?.message ?? "Enter a valid top up amount.", "INVALID_AMOUNT", 422);
    }
    const amount = parsed.data.amount;

    const nowIso = new Date().toISOString();
    const admin = createAdminSupabaseClient();
    const { error } = await (admin.from("wallet_transactions" as never) as any).insert({
      user_id: user.id,
      type: "deposit",
      direction: "credit",
      amount,
      status: "available",
      bucket: "available",
      description: "M-Pesa reward wheel top up",
      reference_table: "daily_rewards_top_up",
      available_at: nowIso,
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      ok: true,
      wallet: await getWalletSummaryForUser(user.id),
    });
  } catch (error) {
    console.error("[POST /api/rewards/top-up]", error);
    return errorResponse("Failed to complete top up", "INTERNAL_ERROR", 500);
  }
}
