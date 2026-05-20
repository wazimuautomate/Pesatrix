import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/app/api/admin/_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type SupabaseErrorLike = {
  message?: string;
  code?: string;
};

function supabaseErrorResponse(context: string, error: SupabaseErrorLike) {
  console.error(`[${context}]`, {
    message: error.message,
    code: error.code,
  });

  return NextResponse.json(
    {
      error: error.message ?? "Supabase request failed",
      code: error.code ?? null,
    },
    { status: 500 }
  );
}

export async function GET(request: Request, { params }: RouteContext) {
  const { error } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });
  if (error) return error;

  const { id } = await params;
  const admin = createAdminSupabaseClient();

  const { data: submission, error: submissionError } = await admin
    .from("task_submissions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (submissionError) {
    return supabaseErrorResponse("Admin submission detail fetch", submissionError);
  }

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const [{ data: task, error: taskError }, { data: profile, error: profileError }] = await Promise.all([
    admin
      .from("tasks")
      .select("id, title, category, payout_ksh, instructions, ai_grading_enabled, ai_rubric, task_data")
      .eq("id", submission.task_id)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("id, full_name, email, phone")
      .eq("id", submission.user_id)
      .maybeSingle(),
  ]);

  if (taskError) {
    return supabaseErrorResponse("Admin submission detail task fetch", taskError);
  }

  if (profileError) {
    return supabaseErrorResponse("Admin submission detail profile fetch", profileError);
  }

  return NextResponse.json({
    submission: {
      ...submission,
      tasks: task ?? null,
      profiles: profile ?? null,
    },
  });
}
