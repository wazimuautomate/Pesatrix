import { NextResponse } from "next/server";

import { requireAdmin } from "@/app/api/admin/_lib";
import { callTextModelWithFallback } from "@/lib/ai/modelRouter";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const AI_TEST_COOLDOWN_MS = 10000;

let lastTestAt = 0;

export async function POST(request: Request) {
  const { error, adminUser } = await requireAdmin({ request });
  if (error) return error;
  if (!adminUser || !["admin", "super_admin"].includes(adminUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = Date.now();
  if (now - lastTestAt < AI_TEST_COOLDOWN_MS) {
    return NextResponse.json(
      {
        provider: null,
        model: null,
        status: "error",
        latency_ms: 0,
        response_preview: "",
        error: "AI test cooldown active. Try again in a few seconds.",
        errors: [],
      },
      { status: 429 }
    );
  }
  lastTestAt = now;

  const result = await callTextModelWithFallback({
    admin: createAdminSupabaseClient(),
    messages: [
      {
        role: "user",
        content:
          "Rate the quality of this answer on a scale of 0-100. Answer: 'The sky is blue.' Return JSON: {score: number, reasoning: string}",
      },
    ],
    maxTokens: 300,
    temperature: 0.2,
  });

  return NextResponse.json({
    provider: result.provider ?? null,
    model: result.model ?? null,
    status: result.ok ? "ok" : "error",
    latency_ms: result.latencyMs,
    response_preview: result.content.slice(0, 500),
    error: result.ok
      ? null
      : result.errors[0]?.error ?? "No configured AI provider or fallback model returned a response.",
    errors: result.errors.slice(0, 8),
  });
}
