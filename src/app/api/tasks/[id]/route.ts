import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: task, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .eq("status", "active")
    .gt("slots_remaining", 0)
    .or("publish_at.is.null,publish_at.lte.now()")
    .or("expires_at.is.null,expires_at.gt.now()")
    .maybeSingle();

  if (error || !task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const { data: existingSubmission } = await supabase
    .from("task_submissions")
    .select("id, status")
    .eq("task_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingSubmission) {
    return NextResponse.json({
      task,
      existingSubmission,
    });
  }

  return NextResponse.json({ task });
}
