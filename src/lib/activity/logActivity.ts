import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type ActivityEventType =
  | "page_view"
  | "task_started"
  | "task_submitted"
  | "withdrawal_requested"
  | "login"
  | "referral_shared";

export async function logActivity({
  userId,
  eventType,
  pagePath,
  metadata,
  request,
}: {
  userId: string;
  eventType: ActivityEventType;
  pagePath?: string;
  metadata?: Record<string, unknown>;
  request: Request;
}): Promise<void> {
  try {
    const admin = createAdminSupabaseClient();
    const { error } = await admin.from("user_activity_logs").insert({
      user_id: userId,
      event_type: eventType,
      page_path: pagePath ?? null,
      metadata: scrubMetadata(metadata ?? {}),
      ip_address: getClientIp(request),
      user_agent: request.headers.get("user-agent"),
    });

    if (error) {
      console.error("[Activity] Failed to log activity", error);
    }
  } catch (error) {
    console.error("[Activity] Unexpected logging failure", error);
  }
}

function getClientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip")
  );
}

function scrubMetadata(metadata: Record<string, unknown>) {
  const sensitivePattern = /password|secret|token|card|cvv|pin/i;
  return Object.fromEntries(
    Object.entries(metadata).filter(([key, value]) => {
      if (sensitivePattern.test(key)) return false;
      if (typeof value === "string" && sensitivePattern.test(value)) return false;
      return true;
    })
  );
}
