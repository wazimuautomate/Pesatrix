import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizeKenyanPhone } from "@/lib/auth/register";
import { getRequestIp, internalErrorResponse, rateLimitedResponse, validationErrorResponse } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/activity/logActivity";

const resolveLoginSchema = z.object({
  identifier: z.string().trim().min(3, "Email or phone is required"),
});

export async function POST(request: Request) {
  try {
    const parsed = resolveLoginSchema.safeParse(await request.json());

    if (!parsed.success) {
      return validationErrorResponse(parsed.error.errors[0]?.message ?? "Invalid login details");
    }

    const identifier = parsed.data.identifier.toLowerCase();
    const ip = getRequestIp(request);
    const normalizedIdentifier = identifier.includes("@")
      ? identifier
      : normalizeKenyanPhone(parsed.data.identifier);
    const [ipLimit, identifierLimit] = await Promise.all([
      checkRateLimit(`auth_login:ip:${ip}`, 5, 15 * 60),
      checkRateLimit(`auth_login:identifier:${normalizedIdentifier}`, 5, 15 * 60),
    ]);

    if (!ipLimit.allowed || !identifierLimit.allowed) {
      return rateLimitedResponse("Too many login attempts. Please wait before trying again.");
    }

    const admin = createAdminSupabaseClient();

    if (identifier.includes("@")) {
      const { data: profile } = await (admin.from("profiles" as never) as any)
        .select("id")
        .eq("email", identifier)
        .maybeSingle();
      if (profile?.id) {
        void logActivity({
          userId: profile.id,
          eventType: "login",
          pagePath: "/login",
          metadata: { method: "email" },
          request,
        });
      }
      return NextResponse.json({ email: identifier });
    }

    const { data: profile, error } = await (admin.from("profiles" as never) as any)
      .select("id, email")
      .eq("phone", normalizedIdentifier)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!profile?.email) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_LOGIN",
            message: "Invalid email/phone or password",
          },
        },
        { status: 404 }
      );
    }

    void logActivity({
      userId: profile.id,
      eventType: "login",
      pagePath: "/login",
      metadata: { method: "phone" },
      request,
    });

    return NextResponse.json({ email: String(profile.email).toLowerCase() });
  } catch (error) {
    console.error("[POST /api/auth/login] error:", error);
    return internalErrorResponse("Unable to resolve login credentials");
  }
}
