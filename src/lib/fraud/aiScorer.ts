import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SYSTEM_ADMIN_ID } from "@/lib/fraud/riskScorer";

export type FraudRecommendation = "clear" | "flag" | "suspend";

export type AIFraudScanResult = {
  score: number | null;
  reasoning: string;
  recommendation: FraudRecommendation;
  keySignals?: string[];
};

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const OPENROUTER_TEXT_MODELS = [
  "qwen/qwen3-235b-a22b:free",
  "mistralai/mistral-7b-instruct:free",
] as const;

type PromptPayload = {
  riskScore: number;
  flags: Record<string, unknown>;
  devices: Array<{
    ip_country: string | null;
    ip_is_vpn: boolean | null;
    ip_is_datacenter: boolean | null;
    created_at: string;
  }>;
  submissions: {
    total: number;
    flagged: number;
    avg_score: number | null;
  };
  referrals: {
    count: number;
  };
  accountAgeDays: number | null;
  phoneVerified: boolean;
};

export async function runAIFraudScan(userId: string): Promise<AIFraudScanResult> {
  const supabase = createAdminSupabaseClient();

  const { data: adminUser } = await (supabase.from("admin_users" as never) as any)
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (adminUser) {
    return {
      score: null,
      reasoning: "AI fraud scan skipped because this account is an admin user.",
      recommendation: "clear",
      keySignals: ["admin_account_skipped"],
    };
  }

  const [profileResult, verificationResult, devicesResult, submissionsResult, referralsResult] =
    await Promise.all([
      (supabase.from("profiles" as never) as any)
        .select("id, created_at")
        .eq("id", userId)
        .maybeSingle(),
      (supabase.from("user_verification" as never) as any)
        .select("user_id, risk_score, flags, phone_verified")
        .eq("user_id", userId)
        .maybeSingle(),
      (supabase.from("device_sessions" as never) as any)
        .select("ip_country, ip_is_vpn, ip_is_datacenter, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
      (supabase.from("task_submissions" as never) as any)
        .select("status, ai_score")
        .eq("user_id", userId)
        .limit(500),
      (supabase.from("referral_bonuses" as never) as any)
        .select("id", { count: "exact", head: true })
        .eq("referrer_id", userId)
        .eq("level", 1),
    ]);

  if (profileResult.error) throw profileResult.error;
  if (verificationResult.error) throw verificationResult.error;
  if (devicesResult.error) throw devicesResult.error;
  if (submissionsResult.error) throw submissionsResult.error;
  if (referralsResult.error) throw referralsResult.error;

  const verification = verificationResult.data;
  const submissions = Array.isArray(submissionsResult.data) ? submissionsResult.data : [];
  const scoredSubmissions = submissions
    .map((submission: { ai_score?: unknown }) => Number(submission.ai_score))
    .filter((score: number) => Number.isFinite(score));

  const payload: PromptPayload = {
    riskScore: Number(verification?.risk_score ?? 0),
    flags: isPlainObject(verification?.flags) ? verification.flags : {},
    devices: Array.isArray(devicesResult.data) ? devicesResult.data : [],
    submissions: {
      total: submissions.length,
      flagged: submissions.filter((submission: { status?: unknown }) => submission.status === "flagged").length,
      avg_score: scoredSubmissions.length
        ? Math.round(
            scoredSubmissions.reduce((sum: number, score: number) => sum + score, 0) /
              scoredSubmissions.length
          )
        : null,
    },
    referrals: {
      count: Number(referralsResult.count ?? 0),
    },
    accountAgeDays: daysSince(profileResult.data?.created_at),
    phoneVerified: verification?.phone_verified === true,
  };

  const prompt = buildPrompt(payload);
  const aiResult = await callOpenRouterFraudModel(prompt);

  const scannedAt = new Date().toISOString();
  const updatePayload =
    aiResult.score === null
      ? {
          ai_fraud_score: null,
          ai_fraud_reasoning: aiResult.reasoning,
          ai_fraud_scanned_at: scannedAt,
        }
      : {
          ai_fraud_score: aiResult.score,
          ai_fraud_reasoning: aiResult.reasoning,
          ai_fraud_scanned_at: scannedAt,
        };

  const { error: updateError } = await (supabase.from("user_verification" as never) as any)
    .update(updatePayload)
    .eq("user_id", userId);

  if (updateError) throw updateError;

  if (aiResult.recommendation === "suspend" && payload.riskScore >= 70 && aiResult.score !== null) {
    await autoSuspendFromAIScan(supabase, userId, payload.riskScore, aiResult);
  }

  return aiResult;
}

function buildPrompt(payload: PromptPayload) {
  const countries = Array.from(
    new Set(payload.devices.map((device) => device.ip_country).filter(Boolean))
  ).join(", ");

  return `You are a fraud detection system for Pesatrix, a Kenyan task platform.
Analyze this user and return ONLY valid JSON.

USER SIGNALS:
- Risk score (rule-based): ${payload.riskScore}
- Flags: ${JSON.stringify(payload.flags)}
- Devices used: ${payload.devices.length} (countries: ${countries || "unknown"})
- VPN detected: ${payload.devices.some((device) => device.ip_is_vpn)}
- Datacenter IP detected: ${payload.devices.some((device) => device.ip_is_datacenter)}
- Total task submissions: ${payload.submissions.total}
- Flagged submissions: ${payload.submissions.flagged}
- Average AI task score: ${payload.submissions.avg_score ?? "not available"}
- Referrals made: ${payload.referrals.count}
- Account age days: ${payload.accountAgeDays ?? "not available"}
- Phone verified: ${payload.phoneVerified}

Return JSON only, no markdown, no explanation outside JSON:
{
  "fraud_score": <0-100 integer>,
  "reasoning": "<2-3 sentence explanation>",
  "recommendation": "<clear|flag|suspend>",
  "key_signals": ["<signal1>", "<signal2>"]
}`;
}

async function callOpenRouterFraudModel(prompt: string): Promise<AIFraudScanResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return {
      score: null,
      reasoning: "AI fraud scan failed: missing OPENROUTER_API_KEY.",
      recommendation: "flag",
      keySignals: ["ai_error"],
    };
  }

  let lastError = "OpenRouter request failed.";

  for (const model of OPENROUTER_TEXT_MODELS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://pesatrix.vercel.app",
          "X-Title": "Pesatrix Fraud Scoring",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 300,
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        lastError = `OpenRouter ${model} failed with ${response.status}: ${(await response.text()).slice(0, 300)}`;
        continue;
      }

      const data = await response.json();
      const content = String(data?.choices?.[0]?.message?.content ?? "").trim();
      return parseFraudJson(content);
    } catch (error) {
      lastError =
        error instanceof Error && error.name === "AbortError"
          ? `OpenRouter ${model} timed out after 15 seconds.`
          : error instanceof Error
            ? error.message
            : "OpenRouter request failed.";
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    score: null,
    reasoning: `AI fraud scan failed: ${lastError}`,
    recommendation: "flag",
    keySignals: ["ai_error"],
  };
}

function parseFraudJson(content: string): AIFraudScanResult {
  const stripped = content
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(stripped);
    const score = clampScore(parsed.fraud_score);
    const recommendation = normalizeRecommendation(parsed.recommendation);

    if (score === null || !recommendation) {
      throw new Error("Missing fraud_score or recommendation");
    }

    return {
      score,
      reasoning: String(parsed.reasoning ?? "AI scan completed without reasoning.").slice(0, 2000),
      recommendation,
      keySignals: Array.isArray(parsed.key_signals)
        ? parsed.key_signals.map((signal: unknown) => String(signal)).slice(0, 8)
        : [],
    };
  } catch {
    return {
      score: null,
      reasoning: `AI fraud scan returned malformed JSON. Raw response: ${content.slice(0, 2000)}`,
      recommendation: "flag",
      keySignals: ["malformed_ai_response"],
    };
  }
}

async function autoSuspendFromAIScan(
  supabase: any,
  userId: string,
  riskScore: number,
  result: AIFraudScanResult
) {
  const { data: accountStatus, error: fetchError } = await (supabase.from("account_status" as never) as any)
    .select("user_id, status, suspension_reason, suspended_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError || accountStatus?.status === "suspended" || accountStatus?.status === "banned") {
    return;
  }

  const now = new Date().toISOString();
  const after = {
    user_id: userId,
    status: "suspended",
    state: "suspended",
    suspension_reason: `Auto-suspended by AI fraud scan: ${result.reasoning.slice(0, 500)}`,
    suspended_at: now,
  };

  const { error: statusError } = await (supabase.from("account_status" as never) as any)
    .upsert(after, { onConflict: "user_id" });

  if (statusError) {
    console.error("[fraud:ai] Failed to auto-suspend user", statusError);
    return;
  }

  const { error: auditError } = await (supabase.from("audit_log" as never) as any).insert({
    admin_id: SYSTEM_ADMIN_ID,
    action: "ai_fraud_suspend",
    entity_type: "account_status",
    entity_id: userId,
    before_json: accountStatus ?? null,
    after_json: { ...after, ai_fraud_score: result.score },
    reason: `AI recommendation suspend with rule risk score ${riskScore}`,
  });

  if (auditError) {
    console.error("[fraud:ai] Failed to write auto-suspend audit log", auditError);
  }
}

function clampScore(value: unknown) {
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeRecommendation(value: unknown): FraudRecommendation | null {
  return value === "clear" || value === "flag" || value === "suspend" ? value : null;
}

function daysSince(value: unknown) {
  if (!value) return null;
  const time = new Date(String(value)).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / (24 * 60 * 60 * 1000)));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
