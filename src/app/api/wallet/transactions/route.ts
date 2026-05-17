import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { mapWalletTransactionForApi } from "@/lib/wallet";

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
    const limit = 20;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("wallet_transactions")
      .select("id, type, direction, amount, status, bucket, description, available_at, created_at, reference_table, reference_id", { count: "exact" })
      .eq("user_id", user.id);

    if (type) {
      query = query.eq("type", type);
    }

    if (direction) {
      query = query.eq("direction", direction);
    }

    const { data: items, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const total = count ?? 0;
    const hasMore = offset + (items?.length ?? 0) < total;

    return NextResponse.json({
      items: (items ?? []).map(mapWalletTransactionForApi),
      total,
      page,
      hasMore,
    });
  } catch (err) {
    console.error("[Transactions Error]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to fetch transactions" } },
      { status: 500 }
    );
  }
}
