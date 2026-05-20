import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizeKenyanPhone } from "@/lib/auth/register";
import { getRequestIp, internalErrorResponse, rateLimitedResponse, validationErrorResponse } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

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

    if (identifier.includes("@")) {
      return NextResponse.json({ email: identifier });
    }

    const admin = createAdminSupabaseClient();

    const { data: profile, error } = await (admin.from("profiles" as never) as any)
      .select("email")
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

    return NextResponse.json({ email: String(profile.email).toLowerCase() });
  } catch (error) {
    console.error("[POST /api/auth/login] error:", error);
    return internalErrorResponse("Unable to resolve login credentials");
  }
}
