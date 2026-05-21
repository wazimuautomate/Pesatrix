import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _req: Request,
  { params }: RouteContext
) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await supabase
    .from("activation_payments")
    .select("status, mpesa_receipt, paid_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  return NextResponse.json({
    status: data?.status ?? "not_found",
    receipt: data?.mpesa_receipt ?? null,
    paidAt: data?.paid_at ?? null,
  });
}
