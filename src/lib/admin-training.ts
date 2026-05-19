import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { TrainingProgramStatus } from "@/lib/training-program";

export type AdminTrainingStatus = TrainingProgramStatus;

export type AdminTrainingProfile = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
};

export type AdminTrainingProgressRow = {
  user_id: string;
  status: AdminTrainingStatus;
  current_day: number;
  current_stage: number;
  stage_attempt: number;
  completed_days: number[];
  failed_stage_attempts: Record<string, number>;
  next_day_unlock_at: string | null;
  last_completed_at: string | null;
  completed_at: string | null;
  reward_transaction_id: string | null;
  created_at: string;
  updated_at: string;
  task_unlock_at: string | null;
  task_unlock_accelerated: boolean;
};

export type AdminTrainingListItem = {
  user_id: string;
  profile: AdminTrainingProfile | null;
  status: AdminTrainingStatus;
  current_day: number;
  current_stage: number;
  stage_attempt: number;
  completed_days: number[];
  completed_days_count: number;
  failed_attempts_count: number;
  next_day_unlock_at: string | null;
  last_completed_at: string | null;
  completed_at: string | null;
  reward_transaction_id: string | null;
  is_reward_paid: boolean;
  updated_at: string;
};

export type AdminTrainingCounts = {
  total: number;
  not_started: number;
  in_progress: number;
  awaiting_test: number;
  completed: number;
  reward_paid: number;
};

function normalizeCompletedDays(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => Number(entry))
    .filter((entry) => Number.isInteger(entry) && entry >= 1 && entry <= 7)
    .sort((left, right) => left - right);
}

function normalizeFailedStageAttempts(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, raw]) => {
      const count = Number(raw);
      return Number.isFinite(count) && count > 0 ? [[key, Math.floor(count)]] : [];
    })
  ) as Record<string, number>;
}

function normalizeRow(row: Record<string, unknown>): AdminTrainingProgressRow {
  return {
    user_id: String(row.user_id),
    status: (row.status as AdminTrainingStatus) ?? "not_started",
    current_day: Math.min(7, Math.max(1, Number(row.current_day ?? 1))),
    current_stage: Math.min(3, Math.max(1, Number(row.current_stage ?? 1))),
    stage_attempt: Math.max(1, Number(row.stage_attempt ?? 1)),
    completed_days: normalizeCompletedDays(row.completed_days),
    failed_stage_attempts: normalizeFailedStageAttempts(row.failed_stage_attempts),
    next_day_unlock_at: typeof row.next_day_unlock_at === "string" ? row.next_day_unlock_at : null,
    last_completed_at: typeof row.last_completed_at === "string" ? row.last_completed_at : null,
    completed_at: typeof row.completed_at === "string" ? row.completed_at : null,
    reward_transaction_id: typeof row.reward_transaction_id === "string" ? row.reward_transaction_id : null,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
    task_unlock_at: typeof row.task_unlock_at === "string" ? row.task_unlock_at : null,
    task_unlock_accelerated: Boolean(row.task_unlock_accelerated),
  };
}

function buildCounts(rows: AdminTrainingProgressRow[]): AdminTrainingCounts {
  return {
    total: rows.length,
    not_started: rows.filter((row) => row.status === "not_started").length,
    in_progress: rows.filter((row) => row.status === "in_progress").length,
    awaiting_test: rows.filter((row) => row.status === "awaiting_test").length,
    completed: rows.filter((row) => row.status === "completed").length,
    reward_paid: rows.filter((row) => row.reward_transaction_id !== null).length,
  };
}

function mapItem(
  row: AdminTrainingProgressRow,
  profiles: Map<string, AdminTrainingProfile>
): AdminTrainingListItem {
  const failedAttemptsCount = Object.values(row.failed_stage_attempts).reduce(
    (sum, value) => sum + Number(value ?? 0),
    0
  );

  return {
    user_id: row.user_id,
    profile: profiles.get(row.user_id) ?? null,
    status: row.status,
    current_day: row.current_day,
    current_stage: row.current_stage,
    stage_attempt: row.stage_attempt,
    completed_days: row.completed_days,
    completed_days_count: row.completed_days.length,
    failed_attempts_count: failedAttemptsCount,
    next_day_unlock_at: row.next_day_unlock_at,
    last_completed_at: row.last_completed_at,
    completed_at: row.completed_at,
    reward_transaction_id: row.reward_transaction_id,
    is_reward_paid: row.reward_transaction_id !== null,
    updated_at: row.updated_at,
  };
}

export async function fetchAdminTrainingList(args: {
  page: number;
  limit: number;
  search?: string;
  status?: string;
}) {
  const admin = createAdminSupabaseClient();
  const page = Math.max(1, args.page);
  const limit = Math.min(Math.max(1, args.limit), 100);
  const search = args.search?.trim().toLowerCase() ?? "";
  const status = args.status?.trim() ?? "";

  const { data, error } = await (admin.from("training_progress" as never) as any)
    .select(
      "user_id, status, current_day, current_stage, stage_attempt, completed_days, failed_stage_attempts, next_day_unlock_at, last_completed_at, completed_at, reward_transaction_id, created_at, updated_at, task_unlock_at, task_unlock_accelerated"
    )
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  const allRows = ((data ?? []) as Record<string, unknown>[]).map(normalizeRow);
  const counts = buildCounts(allRows);

  let filteredRows = allRows;

  if (status) {
    filteredRows = filteredRows.filter((row) => row.status === status);
  }

  let profileMap = new Map<string, AdminTrainingProfile>();
  const userIds = filteredRows.map((row) => row.user_id);

  if (userIds.length > 0) {
    const { data: profileRows, error: profileError } = await (admin.from("profiles" as never) as any)
      .select("id, full_name, phone, email")
      .in("id", userIds);

    if (profileError) {
      throw profileError;
    }

    profileMap = new Map(
      ((profileRows ?? []) as AdminTrainingProfile[]).map((row) => [row.id, row])
    );
  }

  if (search) {
    filteredRows = filteredRows.filter((row) => {
      const profile = profileMap.get(row.user_id);
      const haystacks = [
        profile?.full_name ?? "",
        profile?.phone ?? "",
        profile?.email ?? "",
        row.user_id,
      ].map((value) => value.toLowerCase());

      return haystacks.some((value) => value.includes(search));
    });
  }

  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const items = filteredRows
    .slice(start, start + limit)
    .map((row) => mapItem(row, profileMap));

  return {
    items,
    counts,
    total,
    page,
    limit,
    totalPages,
  };
}
