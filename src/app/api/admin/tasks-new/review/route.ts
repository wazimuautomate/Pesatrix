import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/app/api/admin/_lib";

export async function GET(request: Request) {
  const { error } = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "admin", "support"],
  });
  if (error) return error;

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status") ?? "flagged";
  const categoryFilter = url.searchParams.get("category");
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");

  const admin = createAdminSupabaseClient();

  let query = admin
    .from("task_submissions")
    .select(`
      *,
      task:tasks(title, category, payout_ksh, instructions),
      profile:profiles!task_submissions_user_id_fkey(full_name, email, phone)
    `)
    .eq("status", statusFilter)
    .order("submitted_at", { ascending: false });

  if (categoryFilter) {
    query = query.eq("task.category", categoryFilter);
  }

  if (dateFrom) {
    query = query.gte("submitted_at", dateFrom);
  }

  if (dateTo) {
    query = query.lte("submitted_at", dateTo);
  }

  const { data: submissions, error: fetchError } = await query;

  if (fetchError) {
    return NextResponse.json(
      { error: "Failed to fetch submissions" },
      { status: 500 }
    );
  }

  return NextResponse.json({ submissions: submissions ?? [] });
}
