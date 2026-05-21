import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/app/api/admin/_lib";
import { getTaskScreenshotPublicUrlFromStoredUrl } from "@/lib/task-screenshots";

export async function GET(request: Request) {
  const { error } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
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
      task:tasks(title, category, payout_ksh, instructions, task_data),
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

  const rows = submissions ?? [];
  const userIds = [...new Set(rows.map((row: Record<string, unknown>) => row.user_id as string).filter(Boolean))];
  const [{ data: verificationRows }, { data: accountRows }] = await Promise.all([
    userIds.length
      ? admin
          .from("user_verification")
          .select("user_id, risk_score, flags")
          .in("user_id", userIds)
      : Promise.resolve({ data: [] }),
    userIds.length
      ? admin
          .from("account_status")
          .select("user_id, activated_at")
          .in("user_id", userIds)
      : Promise.resolve({ data: [] }),
  ]);

  const verificationMap = new Map((verificationRows ?? []).map((row: Record<string, unknown>) => [row.user_id, row]));
  const accountMap = new Map((accountRows ?? []).map((row: Record<string, unknown>) => [row.user_id, row]));

  const enriched = await Promise.all(rows.map(async (row: Record<string, unknown>) => {
    const screenshotUrl = typeof row.screenshot_url === "string" ? row.screenshot_url : null;
    const publicScreenshotUrl = getTaskScreenshotPublicUrlFromStoredUrl(screenshotUrl);
    return {
      ...row,
      screenshot_url: publicScreenshotUrl,
      screenshot_signed_url: publicScreenshotUrl,
      user_verification: verificationMap.get(row.user_id) ?? null,
      account_status: accountMap.get(row.user_id) ?? null,
    };
  }));

  return NextResponse.json({ submissions: enriched });
}

