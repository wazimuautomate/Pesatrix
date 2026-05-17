import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireAdmin } from "../../_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { error } = await requireAdmin({
    allowedRoles: ["super_admin", "finance"],
  });
  if (error) return error;

  const { id } = await params;
  const admin = createAdminSupabaseClient();

  const { data: withdrawal, error: fetchError } = await (admin.from("withdrawal_requests" as never) as any)
    .select(
      "id, user_id, amount, phone, status, mpesa_txn_id, failure_reason, b2c_conversation_id, b2c_originator_id, created_at, processed_at, profiles(full_name, email, phone)"
    )
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !withdrawal) {
    return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
  }

  return NextResponse.json({ withdrawal });
}
