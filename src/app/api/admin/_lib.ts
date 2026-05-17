import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const ADMIN_ROLES = [
  "super_admin",
  "admin",
  "support",
  "finance",
  "fraud",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

const ROLE_SET = new Set<string>(ADMIN_ROLES);

type RequireAdminOptions = {
  request?: Request;
  allowedRoles?: AdminRole[];
};

type AdminUserRecord = {
  id: string;
  user_id: string;
  role: AdminRole;
  status: "active" | "disabled";
};

/** Verify caller is an admin and optionally enforce endpoint-specific roles. */
export async function requireAdmin(options: RequireAdminOptions = {}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      adminUser: null,
      userId: null,
    };
  }

  const admin = createAdminSupabaseClient();
  const { data: adminUser } = await admin
    .from("admin_users")
    .select("id, user_id, role, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  const normalizedAdminUser = normalizeAdminUser(adminUser);

  if (!normalizedAdminUser) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      adminUser: null,
      userId: null,
    };
  }

  if (
    options.allowedRoles?.length &&
    !options.allowedRoles.includes(normalizedAdminUser.role)
  ) {
    return {
      error: NextResponse.json(
        { error: "Forbidden", code: "INSUFFICIENT_ROLE" },
        { status: 403 }
      ),
      adminUser: null,
      userId: user.id,
    };
  }

  return {
    error: null,
    adminUser: normalizedAdminUser,
    userId: user.id,
    requestMeta: getRequestMeta(options.request),
  };
}

/** Write an audit log entry */
export async function auditLog({
  adminId,
  action,
  entityType,
  entityId,
  before,
  after,
  reason,
  ip,
  userAgent,
}: {
  adminId: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  ip?: string;
  userAgent?: string;
}) {
  const admin = createAdminSupabaseClient();
  const auditEntry = {
    admin_id: adminId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    before_json: before ?? null,
    after_json: after ?? null,
    reason: reason ?? null,
    ip: ip ?? null,
    user_agent: userAgent ?? null,
  };

  await (admin.from("audit_log" as never) as any).insert(auditEntry);
}

export function getRequestMeta(request?: Request) {
  return {
    ip:
      request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request?.headers.get("x-real-ip") ??
      null,
    userAgent: request?.headers.get("user-agent") ?? null,
  };
}

function normalizeAdminUser(value: unknown): AdminUserRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const role = typeof candidate.role === "string" ? candidate.role : null;

  if (
    !role ||
    !ROLE_SET.has(role) ||
    typeof candidate.id !== "string" ||
    typeof candidate.user_id !== "string"
  ) {
    return null;
  }

  return {
    id: candidate.id,
    user_id: candidate.user_id,
    role: role as AdminRole,
    status:
      candidate.status === "disabled" ? "disabled" : "active",
  };
}
