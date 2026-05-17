import { NextRequest, NextResponse } from "next/server";

import { createCpxSecureHash, normalizeCpxSurveys } from "@/lib/cpx";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getTrainingProgramSnapshotForUser } from "@/lib/training";

export const dynamic = "force-dynamic";

function errorResponse(message: string, code: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }

    const access = await getTrainingProgramSnapshotForUser(user.id);

    if (!access.canStartTasks) {
      return errorResponse(access.gateMessage ?? "Task access is locked.", "TASK_ACCESS_LOCKED", 403);
    }

    const appId = process.env.CPX_APP_ID;
    const secureHashBase = process.env.CPX_SECURE_HASH;

    if (!appId || !secureHashBase) {
      return errorResponse("CPX Research is not configured yet.", "CPX_NOT_CONFIGURED", 503);
    }

    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const userIp = forwardedFor || request.headers.get("x-real-ip") || "127.0.0.1";
    const userAgent = request.headers.get("user-agent") || "";
    const secureHash = createCpxSecureHash(user.id, secureHashBase);
    const url = new URL("https://live-api.cpx-research.com/api/get-surveys.php");

    url.searchParams.set("app_id", appId);
    url.searchParams.set("ext_user_id", user.id);
    url.searchParams.set("output_method", "api");
    url.searchParams.set("ip_user", userIp);
    url.searchParams.set("user_agent", userAgent);
    url.searchParams.set("secure_hash", secureHash);
    url.searchParams.set("limit", request.nextUrl.searchParams.get("limit") ?? "12");

    const response = await fetch(url.toString(), {
      headers: { accept: "application/json" },
      next: { revalidate: 120 },
    });

    if (!response.ok) {
      return errorResponse("Could not fetch CPX surveys right now.", "CPX_FETCH_FAILED", 502);
    }

    const payload = await response.json();
    return NextResponse.json({
      provider: "cpx",
      surveys: normalizeCpxSurveys(payload),
    });
  } catch (error) {
    console.error("[GET /api/offers/cpx]", error);
    return errorResponse("Could not fetch CPX surveys right now.", "INTERNAL_ERROR", 500);
  }
}
