import { z } from "zod";

import { buildRegisterSignUpInput, mapRegisterErrorMessage } from "@/lib/auth/register";
import {
  errorResponse,
  getRequestIp,
  internalErrorResponse,
  rateLimitedResponse,
  validationErrorResponse,
} from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const registerSchema = z
  .object({
    fullName: z.string().trim().min(2).max(100),
    phone: z
      .string()
      .trim()
      .regex(/^(?:\+?254|0)(?:7\d{8}|1\d{8})$/, "Enter a valid Kenyan phone number"),
    county: z.string().trim().min(2).max(80),
    email: z.string().trim().email().max(255),
    password: z
      .string()
      .min(8)
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[0-9]/, "Include at least one number"),
    referralCode: z.string().trim().max(32).optional(),
    confirmHuman: z.literal(true, {
      errorMap: () => ({ message: "Please verify that you are human" }),
    }),
  })
  .transform(({ confirmHuman, ...rest }) => ({
    ...rest,
    humanVerified: confirmHuman,
  }));

export async function POST(request: Request) {
  try {
    const parsed = registerSchema.safeParse(await request.json());
    if (!parsed.success) {
      return validationErrorResponse(parsed.error.errors[0]?.message ?? "Invalid registration");
    }

    const ip = getRequestIp(request);
    const ipLimit = await checkRateLimit(`auth_register:ip:${ip}`, 3, 60 * 60);
    if (!ipLimit.allowed) {
      return rateLimitedResponse("Too many registration attempts. Please try again later.");
    }

    const supabase = await createServerSupabaseClient();
    const payload = buildRegisterSignUpInput(parsed.data, new URL(request.url).origin);
    const { error, data } = await supabase.auth.signUp(payload);

    if (error) {
      return errorResponse(422, "REGISTRATION_FAILED", mapRegisterErrorMessage(error.message));
    }

    if (data.session) {
      await supabase.auth.signOut();
    }

    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/auth/register] error:", error);
    return internalErrorResponse("Failed to create account");
  }
}
