import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/app/api/admin/_lib";

const testSchema = z.object({
  provider: z.enum(["nvidia", "openrouter", "groq", "ollama"]),
  modelId: z.string().trim().min(1),
  apiKey: z.string().min(1),
  baseUrl: z.string().url(),
  maxTokens: z.coerce.number().int().min(1).max(200000).default(512),
  temperature: z.coerce.number().min(0).max(2).default(0.1),
});

export async function POST(request: Request) {
  const authResult = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });
  if (authResult.error) return authResult.error;

  const parsed = testSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Validation error" },
      { status: 422 }
    );
  }

  const { modelId, apiKey, baseUrl, maxTokens, temperature } = parsed.data;

  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: "user",
            content: "Reply with one short sentence confirming this Pesatrix AI provider connection works.",
          },
        ],
        temperature,
        max_tokens: Math.min(maxTokens, 512),
        stream: false,
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: `Provider returned ${response.status}`,
          preview: text.slice(0, 500),
        },
        { status: 400 }
      );
    }

    let preview = text.slice(0, 500);
    try {
      const payload = JSON.parse(text);
      preview = String(payload?.choices?.[0]?.message?.content ?? preview).slice(0, 500);
    } catch {
      // Keep the raw preview when a provider returns non-JSON despite a 200 response.
    }

    return NextResponse.json({ ok: true, preview });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Connection test failed";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
