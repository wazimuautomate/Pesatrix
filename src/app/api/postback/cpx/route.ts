import { NextRequest, NextResponse } from "next/server";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function cpxOk() {
  return new NextResponse("1", { status: 200 });
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const userId = params.get("user_id");
  const transactionId = params.get("transaction_id");
  const reward = Number(params.get("reward") ?? 0);
  const status = params.get("status");

  if (!userId || !transactionId || !Number.isFinite(reward) || reward <= 0 || !isUuid(userId)) {
    return new NextResponse("MISSING_OR_INVALID_PARAMS", { status: 400 });
  }

  const admin = createAdminSupabaseClient();
  const referenceId = `cpx_${transactionId}`;

  try {
    const { data: existing, error: existingError } = await admin
      .from("wallet_transactions")
      .select("id")
      .eq("reference_table", "cpx_research")
      .eq("reference_id", referenceId)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existing?.id) {
      return cpxOk();
    }

    if (status !== "1") {
      const { error: reversalError } = await admin.from("wallet_transactions").insert({
        user_id: userId,
        type: "reversal",
        direction: "debit",
        amount: reward,
        status: "reversed",
        bucket: "available",
        description: "CPX Research reversed or rejected a partner task completion",
        reference_table: "cpx_research",
        reference_id: referenceId,
      });

      if (reversalError) {
        throw reversalError;
      }

      return cpxOk();
    }

    const { error: creditError } = await admin.from("wallet_transactions").insert({
      user_id: userId,
      type: "task_earning",
      direction: "credit",
      amount: reward,
      status: "available",
      bucket: "available",
      description: "CPX Research partner survey completed",
      reference_table: "cpx_research",
      reference_id: referenceId,
    });

    if (creditError) {
      throw creditError;
    }

    return cpxOk();
  } catch (error) {
    console.error("[GET /api/postback/cpx]", {
      error,
      params: Object.fromEntries(params),
    });
    return new NextResponse("DB_ERROR", { status: 500 });
  }
}
