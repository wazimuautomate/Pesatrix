import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/app/api/admin/_lib";
import { gradeSubmission } from "@/lib/ai/grading";

const gradingRequestSchema = z.object({
  submissionId: z.string().uuid(),
});

export async function POST(request: Request) {
  const { error } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });
  if (error) return error;

  const parsed = gradingRequestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Missing or invalid submissionId" },
      { status: 400 }
    );
  }

  await gradeSubmission(parsed.data.submissionId);

  return NextResponse.json({ ok: true });
}
