import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/app/api/admin/_lib";

type SupabaseErrorLike = {
  message?: string;
  code?: string;
};

function supabaseErrorResponse(context: string, error: SupabaseErrorLike) {
  console.error(`[${context}]`, {
    message: error.message,
    code: error.code,
  });

  return NextResponse.json(
    {
      error: error.message ?? "Supabase request failed",
      code: error.code ?? null,
    },
    { status: 500 }
  );
}

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
    if (summaryError) {
      console.error("[Admin submissions] Summary RPC failed:", {
        message: summaryError.message,
        code: summaryError.code,
      });
    }

    const [
      { count: pending },
      { count: aiReviewing },
      { count: approved },
      { count: declined },
      { count: flagged },
      { count: adminReviewed },
      { count: payoutCredited },
    ] = await Promise.all([
      admin.from("task_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
      admin.from("task_submissions").select("id", { count: "exact", head: true }).eq("status", "ai_reviewing"),
      admin.from("task_submissions").select("id", { count: "exact", head: true }).eq("status", "approved"),
      admin.from("task_submissions").select("id", { count: "exact", head: true }).eq("status", "declined"),
      admin.from("task_submissions").select("id", { count: "exact", head: true }).eq("status", "flagged"),
      admin.from("task_submissions").select("id", { count: "exact", head: true }).eq("status", "admin_reviewed"),
      admin.from("task_submissions").select("id", { count: "exact", head: true }).eq("payout_credited", true),
    ]);
    counts = {
      pending: pending ?? 0,
      ai_reviewing: aiReviewing ?? 0,
      approved: approved ?? 0,
      declined: declined ?? 0,
      flagged: flagged ?? 0,
      admin_reviewed: adminReviewed ?? 0,
      payout_credited: payoutCredited ?? 0,
    };
  }

  let categoryTaskIds: string[] = [];
  if (categoryFilter && categoryFilter !== "all") {
    const { data: tasks, error: taskFilterError } = await admin
      .from("tasks")
      .select("id")
      .eq("category", categoryFilter);

    if (taskFilterError) {
      return supabaseErrorResponse("Admin submissions task category filter", taskFilterError);
    }

    const matchingTaskIds = (tasks ?? []).map((task: { id: string }) => task.id);
    if (matchingTaskIds.length === 0) {
      return NextResponse.json({ items: [], total: 0, page, limit, counts });
    }
    categoryTaskIds = matchingTaskIds;
  }

  let searchUserIds: string[] = [];
  if (search && search.trim()) {
    const searchTrimmed = search.trim();
    const { data: profiles, error: profileSearchError } = await admin
      .from("profiles")
      .select("id")
      .or(`full_name.ilike.%${searchTrimmed}%,phone.ilike.%${searchTrimmed}%,email.ilike.%${searchTrimmed}%`);

    if (profileSearchError) {
      return supabaseErrorResponse("Admin submissions profile search", profileSearchError);
    }

    const matchingUserIds = (profiles ?? []).map((profile: { id: string }) => profile.id);
    if (matchingUserIds.length === 0) {
      return NextResponse.json({ items: [], total: 0, page, limit, counts });
    }
    searchUserIds = matchingUserIds;
  }

  let query = admin
    .from("task_submissions")
    .select(
      `
      id,
      task_id,
      user_id,
      submitted_at,
      answers,
      screenshot_url,
      submitted_url,
      status,
      ai_score,
      ai_reasoning,
      ai_reviewed_at,
      admin_decision,
      admin_note,
      admin_reviewed_at,
      payout_credited
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

  if (categoryTaskIds.length > 0) {
    query = query.in("task_id", categoryTaskIds);
  }

  if (searchUserIds.length > 0) {
    query = query.in("user_id", searchUserIds);
  }

  const { data: submissions, error: fetchError, count } = await query.range(offset, offset + limit - 1);

  if (fetchError) {
    return supabaseErrorResponse("Admin submissions fetch", fetchError);
  }

  const rows = submissions ?? [];
  const taskIds = [...new Set(rows.map((row: { task_id: string }) => row.task_id))];
  const userIds = [...new Set(rows.map((row: { user_id: string }) => row.user_id))];

  const [{ data: tasks, error: tasksError }, { data: profiles, error: profilesError }] = await Promise.all([
    taskIds.length
      ? admin
          .from("tasks")
          .select("id, title, category, payout_ksh")
          .in("id", taskIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? admin
          .from("profiles")
          .select("id, full_name, phone, email")
          .in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (tasksError) {
    return supabaseErrorResponse("Admin submissions task enrichment", tasksError);
  }

  if (profilesError) {
    return supabaseErrorResponse("Admin submissions profile enrichment", profilesError);
  }

  const taskMap = new Map((tasks ?? []).map((task: Record<string, unknown>) => [task.id, task]));
  const profileMap = new Map((profiles ?? []).map((profile: Record<string, unknown>) => [profile.id, profile]));
  const items = rows.map((row: Record<string, unknown>) => ({
    ...row,
    tasks: taskMap.get(row.task_id) ?? null,
    profiles: profileMap.get(row.user_id) ?? null,
  }));

  return NextResponse.json({
    items,
    total: count ?? 0,
    page,
    limit,
    counts,
  });
}
