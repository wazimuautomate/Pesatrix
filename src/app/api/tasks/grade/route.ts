import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const NVIDIA_NIM_API_KEY = process.env.NVIDIA_NIM_API_KEY;
const NVIDIA_NIM_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions";

type GradingRequest = {
  submissionId: string;
  taskId: string;
  userId: string;
};

type GradingResponse = {
  decision: "approved" | "declined" | "flagged";
  score: number;
  reasoning: string;
  issues: string[];
};

export async function POST(request: Request) {
  if (!NVIDIA_NIM_API_KEY) {
    return NextResponse.json(
      { error: "AI grading not configured" },
      { status: 503 }
    );
  }

  const body = await request.json() as GradingRequest;
  const { submissionId, taskId, userId } = body;

  if (!submissionId || !taskId) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const admin = createAdminSupabaseClient();

  const [{ data: task }, { data: submission }] = await Promise.all([
    admin.from("tasks").select("*").eq("id", taskId).maybeSingle(),
    admin
      .from("task_submissions")
      .select("*")
      .eq("id", submissionId)
      .maybeSingle(),
  ]);

  if (!task || !submission) {
    return NextResponse.json(
      { error: "Task or submission not found" },
      { status: 404 }
    );
  }

  if (submission.status !== "ai_reviewing") {
    return NextResponse.json(
      { error: "Submission not in ai_reviewing status" },
      { status: 400 }
    );
  }

  const prompt = buildGradingPrompt(task, submission);

  try {
    const aiResponse = await callNvidiaAPI(prompt);
    const grading = parseGradingResponse(aiResponse);

    await processGradingDecision(admin, submission, task, grading);

    return NextResponse.json({ grading });
  } catch (error) {
    await admin
      .from("task_submissions")
      .update({
        status: "flagged",
        ai_reasoning: "AI grading unavailable — manual review required",
      })
      .eq("id", submissionId);

    return NextResponse.json(
      { error: "AI grading failed, flagged for manual review" },
      { status: 500 }
    );
  }
}

function buildGradingPrompt(
  task: Record<string, unknown>,
  submission: Record<string, unknown>
): string {
  const taskData = task as {
    title: string;
    instructions: string;
    ai_rubric: string | null;
    min_word_count: number;
  };

  const answers = submission.answers as Record<string, unknown>;

  return `You are a strict but fair task submission reviewer for Pesatrix, a Kenyan earning platform.

TASK TITLE: ${taskData.title}
TASK INSTRUCTIONS: ${taskData.instructions}
GRADING RUBRIC: ${taskData.ai_rubric || "Approve if all required questions are answered coherently and meet minimum word counts."}
MIN WORD COUNT: ${taskData.min_word_count}

USER SUBMISSION:
${JSON.stringify(answers, null, 2)}

Evaluate this submission. Respond ONLY in this JSON format:
{
  "decision": "approved" | "declined" | "flagged",
  "score": 0-100,
  "reasoning": "Brief explanation of your decision",
  "issues": ["list of specific problems if declined or flagged"]
}

Rules:
- "approved": answers are coherent, meet word counts, genuinely attempt all required questions
- "declined": gibberish, copy-paste filler, too short, off-topic, clearly bot-generated
- "flagged": borderline quality, suspicious pattern, needs human review
- Never approve submissions that are identical or near-identical to each other
- Accept Swahili, Sheng, or English answers as valid`;
}

async function callNvidiaAPI(prompt: string): Promise<string> {
  const response = await fetch(NVIDIA_NIM_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${NVIDIA_NIM_API_KEY}`,
    },
    body: JSON.stringify({
      model: "qwen/qwen3-235b-a22b",
      messages: [
        {
          role: "system",
          content: "You are a strict but fair task submission reviewer. Always respond with valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`NVIDIA API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  return data.choices[0]?.message?.content ?? "";
}

function parseGradingResponse(aiContent: string): GradingResponse {
  const cleaned = aiContent
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as GradingResponse;
    return {
      decision: ["approved", "declined", "flagged"].includes(parsed.decision)
        ? parsed.decision
        : "flagged",
      score: Math.max(0, Math.min(100, parsed.score ?? 0)),
      reasoning: parsed.reasoning ?? "No reasoning provided",
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
    };
  } catch {
    return {
      decision: "flagged",
      score: 50,
      reasoning: "AI response could not be parsed — manual review required",
      issues: ["AI parsing error"],
    };
  }
}

async function processGradingDecision(
  admin: ReturnType<typeof createAdminSupabaseClient>,
  submission: Record<string, unknown>,
  task: Record<string, unknown>,
  grading: GradingResponse
) {
  const now = new Date().toISOString();

  if (grading.decision === "approved") {
    const payoutKsh = Number(task.payout_ksh);
    const availableAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await Promise.all([
      admin
        .from("task_submissions")
        .update({
          status: "approved",
          ai_score: grading.score,
          ai_reasoning: grading.reasoning,
          ai_reviewed_at: now,
          payout_credited: true,
          payout_credited_at: now,
        })
        .eq("id", submission.id),

      admin.rpc("exec_sql", {
        query: `
          UPDATE public.tasks
          SET slots_remaining = slots_remaining - 1
          WHERE id = '${task.id}' AND slots_remaining > 0;
          
          UPDATE public.tasks
          SET status = 'completed'
          WHERE id = '${task.id}' AND slots_remaining <= 1;
        `,
      }).catch(() => {}),

      admin
        .from("wallet_transactions")
        .insert({
          user_id: submission.user_id,
          type: "task_earning",
          direction: "credit",
          amount: payoutKsh,
          status: "pending",
          bucket: "pending",
          description: `Task earning: ${task.title}`,
          reference_table: "task_submissions",
          reference_id: submission.id,
          available_at: availableAt,
        }),
    ]);
  } else if (grading.decision === "declined") {
    await admin
      .from("task_submissions")
      .update({
        status: "declined",
        ai_score: grading.score,
        ai_reasoning: grading.reasoning,
        ai_reviewed_at: now,
      })
      .eq("id", submission.id);
  } else {
    await admin
      .from("task_submissions")
      .update({
        status: "flagged",
        ai_score: grading.score,
        ai_reasoning: grading.reasoning,
        ai_reviewed_at: now,
      })
      .eq("id", submission.id);
  }
}
