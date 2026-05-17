import { NextResponse } from "next/server";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function errorResponse(message: string, code: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function avatarExtension(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

function mergeMetadata(current: unknown, avatarPath: string) {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? { ...(current as Record<string, unknown>) }
      : {};

  return {
    ...base,
    avatar_path: avatarPath,
  };
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errorResponse("Authentication required", "UNAUTHORIZED", 401);
    }

    const formData = await request.formData();
    const file = formData.get("avatar");

    if (!(file instanceof File)) {
      return errorResponse("Choose a profile image to upload.", "MISSING_FILE", 422);
    }

    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      return errorResponse("Profile picture must be a JPEG, PNG, or WebP image.", "INVALID_FILE_TYPE", 422);
    }

    if (file.size > MAX_AVATAR_SIZE) {
      return errorResponse("Profile picture must be 5MB or smaller.", "FILE_TOO_LARGE", 422);
    }

    const admin = createAdminSupabaseClient();
    const path = `${user.id}/profile/avatar-${Date.now()}.${avatarExtension(file.type)}`;
    const bytes = await file.arrayBuffer();

    const { error: uploadError } = await admin.storage
      .from("kyc-documents")
      .upload(path, bytes, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: currentProfile, error: profileReadError } = await (admin.from("profiles" as never) as any)
      .select("metadata")
      .eq("id", user.id)
      .maybeSingle();

    if (profileReadError) {
      throw profileReadError;
    }

    const { error: profileError } = await (admin.from("profiles" as never) as any)
      .update({
        metadata: mergeMetadata(currentProfile?.metadata, path),
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (profileError) {
      throw profileError;
    }

    const { data: signed, error: signedError } = await admin.storage
      .from("kyc-documents")
      .createSignedUrl(path, 60 * 60);

    if (signedError) {
      throw signedError;
    }

    return NextResponse.json({
      avatarPath: path,
      avatarUrl: signed.signedUrl,
    });
  } catch (error) {
    console.error("[POST /api/profile/avatar]", error);
    return errorResponse("Profile picture upload failed.", "INTERNAL_ERROR", 500);
  }
}
