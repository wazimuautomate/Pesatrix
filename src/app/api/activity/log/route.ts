import { NextResponse } from "next/server";
import { z } from "zod";

import { getRequestIp, rateLimitedResponse } from "@/lib/api";
import { logActivity } from "@/lib/activity/logActivity";
import { checkRateLimit } from "@/lib/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({
  eventType: z.enum(["page_view", "task_started", "task_submitted", "withdrawal_requested", "login", "referral_shared"]),
  pagePath: z.string().trim().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getRequestIp(request);
  const limit = await checkRateLimit(`activity_log:${user.id}:${ip}`, 60, 60);
  if (!limit.allowed) {
    return rateLimitedResponse("Too many activity events. Please wait before trying again.");
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message ?? "Invalid activity event" } },
      { status: 422 }
    );
  }

  await logActivity({
    userId: user.id,
    eventType: parsed.data.eventType,
    pagePath: parsed.data.pagePath,
    metadata: parsed.data.metadata,
    request,
  });

  return NextResponse.json({ ok: true });
}
