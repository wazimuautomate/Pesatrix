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
    return {
      ...row,
      screenshot_signed_url: screenshotUrl ? await createTaskScreenshotSignedUrl(admin, screenshotUrl) : null,
      user_verification: verificationMap.get(row.user_id) ?? null,
      account_status: accountMap.get(row.user_id) ?? null,
    };
  }));

  return NextResponse.json({ submissions: enriched });
}

async function createTaskScreenshotSignedUrl(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  screenshotUrl: string
) {
  const parsed = parseTaskScreenshotUrl(screenshotUrl);
  if (!parsed) return null;

  const { data, error } = await admin.storage
    .from("task-screenshots")
    .createSignedUrl(parsed.path, 60 * 15);

  if (error) {
    console.error("[Admin review] Failed to sign screenshot URL:", error);
    return null;
  }

  return data.signedUrl;
}

function parseTaskScreenshotUrl(value: string) {
  try {
    const url = new URL(value);
    const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    if (url.origin !== supabaseUrl.origin) return null;

    const prefix = "/storage/v1/object/task-screenshots/";
    if (!url.pathname.startsWith(prefix)) return null;
    const path = decodeURIComponent(url.pathname.slice(prefix.length));
    if (!path || path.includes("..")) return null;
    return { path };
  } catch {
    return null;
  }
}
