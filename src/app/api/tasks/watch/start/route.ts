import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getTrainingProgramSnapshotForUser } from "@/lib/training";

const startWatchSchema = z.object({
  task_id: z.string().uuid(),
});

const DEFAULT_WATCH_VIDEO_BUCKET = "task-videos";

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await getTrainingProgramSnapshotForUser(user.id);
  if (!access.activated || !access.canStartTasks) {
    return NextResponse.json(
      { error: access.gateMessage ?? "Account not activated" },
      { status: 403 }
    );
  }

  const parsed = startWatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.errors[0]?.message } },
      { status: 422 }
    );
  }

  const admin = createAdminSupabaseClient();
  const { data: task } = await admin
    .from("tasks")
    .select("id, status, slots_remaining, task_data, category")
    .eq("id", parsed.data.task_id)
    .single();

  if (!task || task.category !== "watch_respond" || task.status !== "active" || Number(task.slots_remaining ?? 0) <= 0) {
    return NextResponse.json(
      { error: "This task is no longer available" },
      { status: 409 }
    );
  }

  const { data: existingSubmission } = await admin
    .from("task_submissions")
    .select("id")
    .eq("task_id", task.id)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (existingSubmission) {
    return NextResponse.json(
      { error: "You have already submitted this task" },
      { status: 409 }
    );
  }

  const { data: existingSession } = await admin
    .from("watch_sessions")
    .select("id, started_at, cheat_strikes, status")
    .eq("task_id", task.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingSession?.status === "invalidated") {
    return NextResponse.json(
      { error: { code: "WATCH_SESSION_FORFEITED", message: "Task forfeited due to repeated cheating" } },
      { status: 403 }
    );
  }

  if (existingSession?.status === "completed") {
    return NextResponse.json(
      { error: "You have already completed this watch session" },
      { status: 409 }
    );
  }

  const contentUrl = await getServerIssuedContentUrl(admin, task.task_data as Record<string, unknown>);
  if (!contentUrl) {
    return NextResponse.json(
      { error: { code: "INVALID_CONTENT_URL", message: "Watch content URL is missing or invalid." } },
      { status: 422 }
    );
  }

  const session = existingSession ?? (await admin
    .from("watch_sessions")
    .insert({
      user_id: user.id,
      task_id: task.id,
      status: "active",
    })
    .select("id, started_at, cheat_strikes, status")
    .single()).data;

  if (!session) {
    return NextResponse.json(
      { error: "Could not start watch session" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    // FIXED: Server-issued watch session token backs the client countdown and final submission validation.
    session_token: session.id,
    started_at: session.started_at,
    min_watch_seconds: Number((task.task_data as Record<string, unknown>).min_watch_seconds ?? 60),
    cheat_strikes: Number(session.cheat_strikes ?? 0),
    content_url: contentUrl,
  });
}

async function getServerIssuedContentUrl(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  taskData: Record<string, unknown>
) {
  const contentType = String(taskData.content_type ?? "youtube");
  const rawUrl = String(taskData.content_url ?? taskData.video_url ?? "").trim();

  if (!rawUrl) return null;

  if (contentType !== "supabase_video") {
    // VERIFIED: OK - YouTube and external URLs are passed through only after URL parsing.
    return isValidHttpUrl(rawUrl) ? rawUrl : null;
  }

  const parsed = parseSupabaseStoragePath(rawUrl);
  if (!parsed) return null;

  // FIXED: Private Supabase videos are converted to a signed URL server-side.
  const { data, error } = await admin.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, 60 * 60);

  if (error || !data?.signedUrl) {
    console.error("[WatchStart] Failed to create signed video URL:", error);
    return null;
  }

  return data.signedUrl;
}

function parseSupabaseStoragePath(value: string) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl && value.startsWith(supabaseUrl)) {
      const url = new URL(value);
      const parts = url.pathname.split("/").filter(Boolean);
      const objectIndex = parts.findIndex((part) => part === "object");
      if (objectIndex === -1) return null;
      const next = parts[objectIndex + 1];
      const bucketIndex = ["public", "sign", "authenticated"].includes(next) ? objectIndex + 2 : objectIndex + 1;
      const bucket = parts[bucketIndex];
      const path = parts.slice(bucketIndex + 1).join("/");
      if (!bucket || !path) return null;
      return { bucket, path: decodeURIComponent(path) };
    }
  } catch {
    return null;
  }

  if (/^https?:\/\//i.test(value) || value.includes("..")) return null;
  const clean = value.replace(/^\/+/, "");
  const [maybeBucket, ...pathParts] = clean.split("/");
  if (pathParts.length > 0) {
    return { bucket: maybeBucket, path: pathParts.join("/") };
  }
  return { bucket: DEFAULT_WATCH_VIDEO_BUCKET, path: clean };
}

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
