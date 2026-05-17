import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireAdmin } from "../_lib";

export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);
  const statusFilter = searchParams.get("status") ?? "";
  const search = searchParams.get("search") ?? "";

  const admin = createAdminSupabaseClient();

  const [{ data: countRows }, { data: allData }] = await Promise.all([
    admin.from("training_progress").select("status, reward_transaction_id, next_day_unlock_at"),
    (() => {
      let query = admin
        .from("training_progress")
        .select("user_id, status, current_day, current_stage, stage_attempt, completed_days, failed_stage_attempts, next_day_unlock_at, last_completed_at, completed_at, reward_transaction_id, created_at, updated_at, profiles(full_name, phone, email)")
        .order("updated_at", { ascending: false });

      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }

      return query;
    })(),
  ]);

  const rows = allData ?? [];
  let items = rows;

  if (search) {
    const lower = search.toLowerCase();
    items = items.filter((row: any) => {
      const name = (row.profiles?.full_name ?? "").toLowerCase();
      const phone = (row.profiles?.phone ?? "").toLowerCase();
      return name.includes(lower) || phone.includes(lower);
    });
  }

  const total = items.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const pageItems = items.slice(start, start + limit);
  const now = new Date();

  const counts = {
    total: countRows?.length ?? 0,
    not_started: countRows?.filter((r: any) => r.status === "not_started").length ?? 0,
    in_progress: countRows?.filter((r: any) => r.status === "in_progress").length ?? 0,
    awaiting_test: countRows?.filter((r: any) => r.status === "awaiting_test").length ?? 0,
    completed: countRows?.filter((r: any) => r.status === "completed").length ?? 0,
    reward_paid: countRows?.filter((r: any) => r.reward_transaction_id !== null).length ?? 0,
    time_locked: countRows?.filter((r: any) => r.next_day_unlock_at && new Date(r.next_day_unlock_at) > now).length ?? 0,
  };

  const resultItems = pageItems.map((row: any) => {
    const completedDays = Array.isArray(row.completed_days) ? row.completed_days : [];
    const failedAttempts = row.failed_stage_attempts && typeof row.failed_stage_attempts === "object" ? row.failed_stage_attempts : {};
    const failedAttemptsCount = Object.values(failedAttempts).reduce((sum: number, v: any) => sum + Number(v || 0), 0);
    const isTimeLocked = row.next_day_unlock_at && new Date(row.next_day_unlock_at) > now;

    return {
      user_id: row.user_id,
      full_name: row.profiles?.full_name ?? null,
      phone: row.profiles?.phone ?? null,
      email: row.profiles?.email ?? null,
      status: row.status,
      current_day: row.current_day,
      current_stage: row.current_stage,
      completed_days: completedDays,
      days_completed: completedDays.length,
      progress_percent: Math.min((completedDays.length / 7) * 100, 100),
      is_reward_paid: row.reward_transaction_id !== null,
      is_time_locked: !!isTimeLocked,
      next_day_unlock_at: row.next_day_unlock_at,
      last_completed_at: row.last_completed_at,
      completed_at: row.completed_at,
      failed_attempts_count: failedAttemptsCount,
      updated_at: row.updated_at,
    };
  });

  return NextResponse.json({
    items: resultItems,
    counts,
    total,
    page,
    limit,
    totalPages,
  });
}
