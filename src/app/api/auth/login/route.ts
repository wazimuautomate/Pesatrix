import { NextResponse } from "next/server";
import { z } from "zod";

import { normalizeKenyanPhone } from "@/lib/auth/register";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const resolveLoginSchema = z.object({
  identifier: z.string().trim().min(3, "Email or phone is required"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = resolveLoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.errors[0]?.message ?? "Invalid login details",
          },
        },
        { status: 422 }
      );
    }

    const identifier = parsed.data.identifier.toLowerCase();

    if (identifier.includes("@")) {
      return NextResponse.json({ email: identifier });
    }

    const phone = normalizeKenyanPhone(parsed.data.identifier);
    const admin = createAdminSupabaseClient();

    const { data: profile, error } = await (admin.from("profiles" as never) as any)
      .select("email")
      .eq("phone", phone)
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
    console.error("[POST /api/auth/login]", error);

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Unable to resolve login credentials",
        },
      },
      { status: 500 }
    );
  }
}
