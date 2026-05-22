import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const PAGE_SIZE = 20;

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const offset = Math.max(0, Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0);
  const limit = Math.min(
    PAGE_SIZE,
    Math.max(1, Number.parseInt(searchParams.get("limit") ?? String(PAGE_SIZE), 10) || PAGE_SIZE)
  );

  const { data, error, count } = await supabase
    .from("task_submissions")
    .select(
      `
      id,
      submitted_at,
      status,
      ai_score,
      ai_reasoning,
      ai_reviewed_at,
      admin_decision,
      admin_note,
      admin_reviewed_at,
      payout_credited,
      payout_credited_at,
      screenshot_url,
      submitted_url,
      task:tasks (
        id,
        title,
        category,
        payout_ksh
      )
    `,
      { count: "exact" }
    )
    .eq("user_id", user.id)
    .order("submitted_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[GET /api/tasks/submissions] fetch error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to load submissions" } },
      { status: 500 }
    );
  }

  let items = data || [];
  if (items.length > 0) {
    const submissionIds = items.map((item: any) => item.id);
    const { data: txs } = await supabase
      .from("wallet_transactions")
      .select("status, available_at, reference_id")
      .eq("user_id", user.id)
      .eq("reference_table", "task_submissions")
      .in("reference_id", submissionIds);

    const txMap = new Map<string, any>(
      (txs ?? []).map((tx: any) => [tx.reference_id, tx] as [string, any])
    );

    items = items.map((item: any) => {
      const tx = txMap.get(item.id);
      return {
        ...item,
        transaction_status: tx?.status ?? null,
        transaction_available_at: tx?.available_at ?? null,
      };
    });
  }

  const total = count ?? 0;

  return NextResponse.json({
    items,
    total,
    offset,
    limit,
    hasMore: offset + items.length < total,
  });
}
