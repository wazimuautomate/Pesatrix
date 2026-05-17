import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizeKenyanPhone } from "@/lib/auth/register";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const phonePattern = /^(0[17]|254[17]|\+254[17])[0-9]{8}$/;
const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim().length === 0 ? undefined : value;

const profileSecuritySchema = z
  .object({
    fullName: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(2, "Name is too short").max(120).optional()
    ),
    email: z.preprocess(
      emptyToUndefined,
      z.string().trim().email("Enter a valid email").optional()
    ),
    phone: z.preprocess(
      emptyToUndefined,
      z.string().trim().regex(phonePattern, "Enter a valid Kenyan phone number").optional()
    ),
    password: z.preprocess(
      emptyToUndefined,
      z.string().min(8, "Password must be at least 8 characters").optional()
    ),
    avatarPath: z.preprocess(
      emptyToUndefined,
      z.string().trim().max(500).optional()
    ),
  })
  .refine((value) => Object.values(value).some((item) => typeof item === "string" && item.length > 0), {
    message: "Provide at least one profile change",
  });

function errorResponse(message: string, code: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function mergeMetadata(current: unknown, avatarPath?: string) {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? { ...(current as Record<string, unknown>) }
      : {};

  if (avatarPath) {
    base.avatar_path = avatarPath;
  }

  return base;
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }

    const body = await request.json().catch(() => ({}));
    const parsed = profileSecuritySchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(parsed.error.errors[0].message, "VALIDATION_ERROR", 422);
    }

    const { fullName, email, phone, password, avatarPath } = parsed.data;
    if (avatarPath && !avatarPath.startsWith(`${user.id}/`)) {
      return errorResponse("Invalid profile image path", "INVALID_AVATAR_PATH", 422);
    }

    if (email || password) {
      const { error: authError } = await supabase.auth.updateUser({
        ...(email ? { email: email.toLowerCase() } : {}),
        ...(password ? { password } : {}),
      });

      if (authError) {
        return errorResponse(authError.message, "AUTH_UPDATE_FAILED", 422);
      }
    }

    const admin = createAdminSupabaseClient();
    const { data: currentProfile, error: profileReadError } = await (admin.from("profiles" as never) as any)
      .select("metadata")
      .eq("id", user.id)
      .maybeSingle();

    if (profileReadError) {
      throw profileReadError;
    }

    const profilePatch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (fullName) profilePatch.full_name = fullName;
    if (email) profilePatch.email = email.toLowerCase();
    if (phone) profilePatch.phone = normalizeKenyanPhone(phone);
    if (avatarPath) profilePatch.metadata = mergeMetadata(currentProfile?.metadata, avatarPath);

    const { error: profileError } = await (admin.from("profiles" as never) as any)
      .update(profilePatch)
      .eq("id", user.id);

    if (profileError) {
      throw profileError;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PATCH /api/profile/security]", error);
    return errorResponse("Failed to update profile", "INTERNAL_ERROR", 500);
  }
}
