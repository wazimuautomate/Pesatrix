import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { auditLog, requireAdmin } from "@/app/api/admin/_lib";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

export async function POST(request: Request, { params }: RouteContext) {
  const authResult = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "admin"],
  });
  if (authResult.error) return authResult.error;
  if (!authResult.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { userId, requestMeta } = authResult;

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI grading is not configured. Set ANTHROPIC_API_KEY." },
      { status: 501 }
    );
  }

  const admin = createAdminSupabaseClient();

  const { data: submission, error: fetchError } = await admin
    .from("task_submissions")
    .select("*, tasks!task_submissions_task_id_fkey(id, title, ai_rubric, ai_grading_enabled, payout_ksh)")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  const sub = submission as Record<string, unknown>;
  const taskData = sub.tasks as Record<string, unknown> | null;

  if (!taskData?.ai_grading_enabled) {
    return NextResponse.json(
      { error: "AI grading is not enabled for this task" },
      { status: 400 }
    );
  }

  if (sub.status === "approved" || sub.status === "declined") {
    return NextResponse.json(
      { error: `Cannot run AI review on a submission that is already ${sub.status}` },
      { status: 409 }
    );
  }

  const previousStatus = sub.status as string;

  const { error: statusUpdateError } = await admin
    .from("task_submissions")
    .update({ status: "ai_reviewing" })
    .eq("id", id);

  if (statusUpdateError) {
    return NextResponse.json(
      { error: "Failed to set AI reviewing status" },
      { status: 500 }
    );
  }

  const aiRubric = (taskData.ai_rubric as string) || "Grade this submission based on completeness, accuracy, and quality.";
  const answers = sub.answers as Record<string, unknown> | null;
  const screenshotUrl = sub.screenshot_url as string | null;

  const systemPrompt = `You are a task grading assistant. Grade this submission against the rubric. Return JSON only: { "score": 0-100, "reasoning": "string", "recommendation": "approve"|"decline"|"flag" }.`;

  let userMessage = `Rubric: ${aiRubric}\n\n`;
  userMessage += `Submission answers:\n${JSON.stringify(answers, null, 2)}\n\n`;
  if (screenshotUrl) {
    userMessage += `Screenshot URL: ${screenshotUrl}\n\n`;
  }
  userMessage += `Task payout: ${taskData.payout_ksh} KSH`;

  try {
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorBody = await aiResponse.text().catch(() => "");
      throw new Error(`Anthropic API error: ${aiResponse.status} ${errorBody}`);
    }

    const aiData = await aiResponse.json();
    const contentBlock = aiData.content?.[0];
    const aiText = contentBlock?.type === "text" ? contentBlock.text : "";

    let parsed: { score: number; reasoning: string; recommendation: string };
    try {
      const jsonMatch = aiText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in AI response");
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      throw new Error(`Failed to parse AI response: ${aiText.slice(0, 200)}`);
    }

    const aiScore = Math.max(0, Math.min(100, Number(parsed.score) || 0));
    const aiReasoning = parsed.reasoning || "";
    const recommendation = parsed.recommendation || "flag";

    let newStatus: string;
    let shouldCreditWallet = false;

    if (aiScore >= 70 && recommendation === "approve") {
      newStatus = "approved";
      shouldCreditWallet = true;
    } else {
      newStatus = "flagged";
    }

    const now = new Date().toISOString();

    if (shouldCreditWallet && sub.payout_credited !== true) {
      const payoutKsh = Math.round(Number(taskData.payout_ksh ?? 0));
      const availableAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const { error: updateError } = await admin
        .from("task_submissions")
        .update({
          status: newStatus,
          ai_score: aiScore,
          ai_reasoning: aiReasoning,
          ai_reviewed_at: now,
          admin_decision: "approved",
          admin_reviewed_at: now,
          payout_credited: true,
          payout_credited_at: now,
        })
        .eq("id", id);

      if (updateError) {
        throw new Error("Failed to update submission after AI approval");
      }

      const { error: walletError } = await admin
        .from("wallet_transactions")
        .insert({
          user_id: sub.user_id,
          type: "task_earning",
          direction: "credit",
          amount: payoutKsh,
          status: "pending",
          bucket: "pending",
          description: `Task earning (AI auto-approved): ${taskData.title ?? "Task"}`,
          reference_table: "task_submissions",
          reference_id: id,
          available_at: availableAt,
        });

      if (walletError) {
        await admin
          .from("task_submissions")
          .update({
            payout_credited: false,
            payout_credited_at: null,
            status: "flagged",
          })
          .eq("id", id);
      }
    } else if (shouldCreditWallet && sub.payout_credited === true) {
      const { error: updateError } = await admin
        .from("task_submissions")
        .update({
          status: newStatus,
          ai_score: aiScore,
          ai_reasoning: aiReasoning,
          ai_reviewed_at: now,
          admin_decision: "approved",
          admin_reviewed_at: now,
        })
        .eq("id", id);

      if (updateError) {
        throw new Error("Failed to update submission after AI approval");
      }
    } else {
      const { error: updateError } = await admin
        .from("task_submissions")
        .update({
          status: newStatus,
          ai_score: aiScore,
          ai_reasoning: aiReasoning,
          ai_reviewed_at: now,
        })
        .eq("id", id);

      if (updateError) {
        throw new Error("Failed to update submission after AI review");
      }
    }

    await auditLog({
      adminId: userId,
      action: "ai_review_triggered",
      entityType: "task_submissions",
      entityId: id,
      before: { status: previousStatus },
      after: {
        status: newStatus,
        ai_score: aiScore,
        ai_reasoning: aiReasoning,
        recommendation,
        payout_credited: shouldCreditWallet,
      },
      reason: `AI review: score=${aiScore}, recommendation=${recommendation}`,
      ip: requestMeta?.ip ?? undefined,
      userAgent: requestMeta?.userAgent ?? undefined,
    });

    return NextResponse.json({
      ok: true,
      ai_score: aiScore,
      ai_reasoning: aiReasoning,
      recommendation,
      new_status: newStatus,
      payout_credited: shouldCreditWallet,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await admin
      .from("task_submissions")
      .update({ status: previousStatus })
      .eq("id", id);

    await auditLog({
      adminId: userId,
      action: "ai_review_failed",
      entityType: "task_submissions",
      entityId: id,
      before: { status: "ai_reviewing" },
      after: { status: previousStatus, error: errorMessage },
      reason: `AI review failed, reverted to ${previousStatus}`,
      ip: requestMeta?.ip ?? undefined,
      userAgent: requestMeta?.userAgent ?? undefined,
    });

    return NextResponse.json(
      { error: `AI review failed: ${errorMessage}` },
      { status: 500 }
    );
  }
}
