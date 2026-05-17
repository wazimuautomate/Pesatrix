import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/app/api/admin/_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const { error } = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "admin", "support"],
  });
  if (error) return error;

  const { id } = await params;
  const admin = createAdminSupabaseClient();

  const { data: submission } = await admin
    .from("task_submissions")
    .select(`
      *,
      tasks!task_submissions_task_id_fkey(id, title, category, payout_ksh, instructions, ai_grading_enabled, ai_rubric, task_data),
      profiles!task_submissions_user_id_fkey(full_name, email, phone)
    `)
    .eq("id", id)
    .maybeSingle();

  if (!submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  return NextResponse.json({ submission });
}
