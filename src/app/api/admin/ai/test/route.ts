import { NextResponse } from "next/server";

import { requireAdmin } from "@/app/api/admin/_lib";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const PRIMARY_MODEL = "qwen/qwen2.5-vl-72b-instruct:free";
const AI_TEST_TIMEOUT_MS = 25000;
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
        model: PRIMARY_MODEL,
        status: "error",
        latency_ms: 0,
        response_preview: "",
        error: "AI test cooldown active. Try again in a few seconds.",
      },
      { status: 429 }
    );
  }
  lastTestAt = now;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      model: PRIMARY_MODEL,
      status: "error",
      latency_ms: 0,
      response_preview: "",
      error: "OPENROUTER_API_KEY is not configured.",
    });
  }

  const start = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_TEST_TIMEOUT_MS);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://pesatrix.com",
        "X-Title": "Pesatrix",
      },
      body: JSON.stringify({
        model: PRIMARY_MODEL,
        messages: [
          {
            role: "user",
            content: "Rate the quality of this answer on a scale of 0-100. Answer: 'The sky is blue.' Return JSON: {score: number, reasoning: string}",
          },
        ],
        temperature: 0.2,
        max_tokens: 300,
        stream: false,
      }),
      signal: controller.signal,
    });

    const latency = Date.now() - start;
    const text = await response.text();
    if (!response.ok) {
      return NextResponse.json({
        model: PRIMARY_MODEL,
        status: "error",
        latency_ms: latency,
        response_preview: text.slice(0, 500),
        error: `OpenRouter returned ${response.status}`,
      });
    }

    return NextResponse.json({
      model: PRIMARY_MODEL,
      status: "ok",
      latency_ms: latency,
      response_preview: text.slice(0, 500),
      error: null,
    });
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === "AbortError";
    return NextResponse.json({
      model: PRIMARY_MODEL,
      status: isTimeout ? "timeout" : "error",
      latency_ms: Date.now() - start,
      response_preview: "",
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
