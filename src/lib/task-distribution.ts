export const TASK_VISIBILITY_MODES = [
  "all",
  "referral_gated",
  "assigned_only",
  "proof_tier",
] as const;

export type TaskVisibilityMode = (typeof TASK_VISIBILITY_MODES)[number];

export type TaskAccessContext = {
  referralCount: number;
  assignedTaskIds: Set<string>;
};

export type TaskDistributionRecord = {
  id: string;
  visibility_mode?: string | null;
  min_referrals_required?: number | null;
  status?: string | null;
  publish_at?: string | null;
  expires_at?: string | null;
  slots_remaining?: number | null;
};

export type AssignedUserSummary = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  is_activated: boolean;
  referral_count: number;
  assigned_at: string | null;
};

const DEFAULT_REFERRAL_GATE = 3;

export function normalizeTaskVisibilityMode(value: unknown): TaskVisibilityMode {
  return TASK_VISIBILITY_MODES.includes(value as TaskVisibilityMode)
    ? (value as TaskVisibilityMode)
    : "all";
}

export function getEffectiveMinReferrals(task: Pick<TaskDistributionRecord, "visibility_mode" | "min_referrals_required">) {
  if (normalizeTaskVisibilityMode(task.visibility_mode) !== "referral_gated") {
    return 0;
  }

  return Math.max(DEFAULT_REFERRAL_GATE, Number(task.min_referrals_required ?? 0));
}

export function canUserAccessTask(task: TaskDistributionRecord, context: TaskAccessContext) {
  const visibilityMode = normalizeTaskVisibilityMode(task.visibility_mode);

  if (visibilityMode === "all") {
    return true;
  }

  if (visibilityMode === "referral_gated") {
    return context.referralCount >= getEffectiveMinReferrals(task);
  }

  return context.assignedTaskIds.has(task.id);
}

export function isTaskLive(task: Pick<TaskDistributionRecord, "status" | "publish_at" | "expires_at" | "slots_remaining">, now = Date.now()) {
  const publishAt = task.publish_at ? new Date(task.publish_at).getTime() : null;
  const expiresAt = task.expires_at ? new Date(task.expires_at).getTime() : null;
  const isPublished =
    task.status === "active"
      ? publishAt === null || publishAt <= now
      : task.status === "scheduled" && publishAt !== null && publishAt <= now;

  return (
    isPublished &&
    Number(task.slots_remaining ?? 0) > 0 &&
    (expiresAt === null || expiresAt > now)
  );
}

export async function getTaskAccessContext(admin: any, userId: string): Promise<TaskAccessContext> {
  const [assignmentResult, referralResult] = await Promise.all([
    (admin.from("task_assignments" as never) as any)
      .select("task_id")
      .eq("user_id", userId),
    admin.rpc("get_user_referral_count", { p_user_id: userId }),
  ]);

  let referralCount = Number(referralResult.data ?? 0);
  if (referralResult.error) {
    const { count } = await (admin.from("referrals" as never) as any)
      .select("id", { count: "exact", head: true })
      .eq("referrer_id", userId);
    referralCount = count ?? 0;
  }

  const assignedTaskIds = new Set(
    ((assignmentResult.data ?? []) as Array<{ task_id: string | null }>)
      .map((row) => row.task_id)
      .filter((taskId): taskId is string => typeof taskId === "string")
  );

  return {
    referralCount,
    assignedTaskIds,
  };
}

export async function syncTaskAssignments({
  admin,
  taskId,
  assignedBy,
  assignedUserIds,
}: {
  admin: any;
  taskId: string;
  assignedBy: string;
  assignedUserIds: string[];
}) {
  const dedupedUserIds = [...new Set(assignedUserIds)];

  const { data: existingRows, error: existingError } = await (admin.from("task_assignments" as never) as any)
    .select("user_id")
    .eq("task_id", taskId);

  if (existingError) {
    throw existingError;
  }

  const existingUserIds = new Set(
    ((existingRows ?? []) as Array<{ user_id: string | null }>)
      .map((row) => row.user_id)
      .filter((userId): userId is string => typeof userId === "string")
  );

  const toInsert = dedupedUserIds.filter((userId) => !existingUserIds.has(userId));
  const toDelete = [...existingUserIds].filter((userId) => !dedupedUserIds.includes(userId));

  if (toDelete.length > 0) {
    const { error } = await (admin.from("task_assignments" as never) as any)
      .delete()
      .eq("task_id", taskId)
      .in("user_id", toDelete);

    if (error) {
      throw error;
    }
  }

  if (toInsert.length > 0) {
    const { error } = await (admin.from("task_assignments" as never) as any)
      .insert(
        toInsert.map((userId) => ({
          task_id: taskId,
          user_id: userId,
          assigned_by: assignedBy,
        }))
      );

    if (error) {
      throw error;
    }
  }
}

export async function getAssignedUsersForTask(admin: any, taskId: string): Promise<AssignedUserSummary[]> {
  const { data: assignmentRows, error: assignmentError } = await (admin.from("task_assignments" as never) as any)
    .select("user_id, assigned_at")
    .eq("task_id", taskId)
    .order("assigned_at", { ascending: true });

  if (assignmentError || !assignmentRows?.length) {
    return [];
  }

  const userIds: string[] = assignmentRows
    .map((row: { user_id?: string | null }) => row.user_id)
    .filter((userId: string | null | undefined): userId is string => typeof userId === "string");

  const [profilesResult, referralsResult] = await Promise.all([
    (admin.from("profiles" as never) as any)
      .select("id, full_name, email, phone, account_status(is_activated)")
      .in("id", userIds),
    (admin.from("referrals" as never) as any)
      .select("referrer_id")
      .in("referrer_id", userIds),
  ]);

  const referralCounts = new Map<string, number>();
  for (const row of (referralsResult.data ?? []) as Array<{ referrer_id?: string | null }>) {
    if (!row.referrer_id) continue;
    referralCounts.set(row.referrer_id, (referralCounts.get(row.referrer_id) ?? 0) + 1);
  }

  const profileMap = new Map(
    ((profilesResult.data ?? []) as Array<Record<string, unknown>>).map((profile) => [
      String(profile.id),
      profile,
    ])
  );

  return userIds.map((userId) => {
    const profile = profileMap.get(userId) ?? {};
    const accountStatus = Array.isArray(profile.account_status)
      ? profile.account_status[0]
      : profile.account_status;

    const assignment = (assignmentRows as Array<{ user_id: string; assigned_at: string | null }>).find(
      (row) => row.user_id === userId
    );

    return {
      id: userId,
      full_name: typeof profile.full_name === "string" ? profile.full_name : null,
      email: typeof profile.email === "string" ? profile.email : null,
      phone: typeof profile.phone === "string" ? profile.phone : null,
      is_activated: Boolean(
        accountStatus && typeof accountStatus === "object" && "is_activated" in accountStatus
          ? (accountStatus as Record<string, unknown>).is_activated
          : false
      ),
      referral_count: referralCounts.get(userId) ?? 0,
      assigned_at: assignment?.assigned_at ?? null,
    };
  });
}
