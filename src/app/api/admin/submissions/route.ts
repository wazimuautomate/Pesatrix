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
  const statusFilter = url.searchParams.get("status");
  const taskIdFilter = url.searchParams.get("task_id");
  const categoryFilter = url.searchParams.get("category");
  const search = url.searchParams.get("search");
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10)), 100);
  const offset = (page - 1) * limit;

  const admin = createAdminSupabaseClient();

  const { data: summaryRows, error: summaryError } = await admin.rpc("get_submission_summary" as never);

  let counts: Record<string, number>;

  if (!summaryError && summaryRows && summaryRows.length > 0) {
    const row = summaryRows[0] as Record<string, unknown>;
    counts = {
      pending: Number(row.pending ?? 0),
      ai_reviewing: Number(row.ai_reviewing ?? 0),
      approved: Number(row.approved ?? 0),
      declined: Number(row.declined ?? 0),
      flagged: Number(row.flagged ?? 0),
      admin_reviewed: Number(row.admin_reviewed ?? 0),
      payout_credited: Number(row.payout_credited ?? 0),
    };
  } else {
    const [{ data: s1 }, { data: s2 }, { data: s3 }, { data: s4 }, { data: s5 }, { data: s6 }, { data: s7 }] = await Promise.all([
      admin.from("task_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
      admin.from("task_submissions").select("id", { count: "exact", head: true }).eq("status", "ai_reviewing"),
      admin.from("task_submissions").select("id", { count: "exact", head: true }).eq("status", "approved"),
      admin.from("task_submissions").select("id", { count: "exact", head: true }).eq("status", "declined"),
      admin.from("task_submissions").select("id", { count: "exact", head: true }).eq("status", "flagged"),
      admin.from("task_submissions").select("id", { count: "exact", head: true }).eq("status", "admin_reviewed"),
      admin.from("task_submissions").select("id", { count: "exact", head: true }).eq("payout_credited", true),
    ]);
    counts = {
      pending: s1?.length ?? 0,
      ai_reviewing: s2?.length ?? 0,
      approved: s3?.length ?? 0,
      declined: s4?.length ?? 0,
      flagged: s5?.length ?? 0,
      admin_reviewed: s6?.length ?? 0,
      payout_credited: s7?.length ?? 0,
    };
  }

  let query = admin
    .from("task_submissions")
    .select(
      `
      *,
      tasks!task_submissions_task_id_fkey(id, title, category, payout_ksh, ai_grading_enabled, ai_rubric),
      profiles!task_submissions_user_id_fkey(full_name, phone)
    `,
      { count: "exact" }
    )
    .order("submitted_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  if (taskIdFilter) {
    query = query.eq("task_id", taskIdFilter);
  }

  if (categoryFilter && categoryFilter !== "all") {
    query = query.eq("tasks.category", categoryFilter);
  }

  if (search && search.trim()) {
    const searchTrimmed = search.trim();
    query = query.or(
      `profiles.full_name.ilike.%${searchTrimmed}%,profiles.phone.ilike.%${searchTrimmed}%`
    );
  }

  const { data: items, error: fetchError, count } = await query.range(offset, offset + limit - 1);

  if (fetchError) {
    return NextResponse.json(
      { error: "Failed to fetch submissions" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    items: items ?? [],
    total: count ?? 0,
    page,
    limit,
    counts,
  });
}
