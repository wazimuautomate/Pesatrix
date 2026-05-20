import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const cheatStrikeSchema = z.object({
  session_token: z.string().uuid(),
  reason: z.enum(["tab_hidden", "window_blur"]),
});

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = cheatStrikeSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message } },
      { status: 422 }
    );
  }

  const admin = createAdminSupabaseClient();
  const { data: session } = await admin
    .from("watch_sessions")
    .select("id, user_id, cheat_strikes, status")
    .eq("id", parsed.data.session_token)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!session) {
    return NextResponse.json(
      { error: { code: "INVALID_WATCH_SESSION", message: "Invalid watch session." } },
      { status: 422 }
    );
  }

  if (session.status === "completed") {
    return NextResponse.json({
      invalidated: false,
      strikes: Number(session.cheat_strikes ?? 0),
    });
  }

  const strikes = Math.min(3, Number(session.cheat_strikes ?? 0) + 1);
  const invalidated = strikes >= 3;

  // FIXED: Cheat strikes are persisted server-side and invalidate the session at 3 strikes.
  const { error } = await admin
    .from("watch_sessions")
    .update({
      cheat_strikes: strikes,
      status: invalidated ? "invalidated" : "active",
    })
    .eq("id", session.id)
    .eq("user_id", user.id);

  if (error) {
    console.error("[WatchCheatStrike] Failed to update strike:", error);
    return NextResponse.json(
      { error: "Could not record watch strike" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    invalidated,
    strikes,
    reason: parsed.data.reason,
  });
}
