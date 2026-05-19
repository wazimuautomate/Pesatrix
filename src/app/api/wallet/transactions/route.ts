import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getWalletTransactionsForUser } from "@/lib/wallet";

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const type = searchParams.get("type");
    const direction = searchParams.get("direction");
    const normalizedDirection =
      direction === "credit" || direction === "debit" ? direction : undefined;

    if (direction && !normalizedDirection) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid transaction direction" } },
        { status: 422 }
      );
    }

    const result = await getWalletTransactionsForUser(user.id, {
      direction: normalizedDirection,
      page,
      type: type ?? undefined,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[Transactions Error]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch transactions" } },
      { status: 500 }
    );
  }
}
