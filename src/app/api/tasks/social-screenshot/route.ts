import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const BUCKET = "task-screenshots";
const MAX_SCREENSHOT_SIZE = 10 * 1024 * 1024;
const MIN_SCREENSHOT_SIZE = 50 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function errorResponse(message: string, code: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

function extensionForType(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

async function ensureBucket(admin: ReturnType<typeof createAdminSupabaseClient>) {
  const { data } = await admin.storage.getBucket(BUCKET);
  if (data) return;

  await admin.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_SCREENSHOT_SIZE,
    allowedMimeTypes: Array.from(ALLOWED_TYPES),
  });
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
    const file = formData.get("screenshot");
    const taskId = String(formData.get("taskId") ?? "");

    if (!(file instanceof File)) {
      return errorResponse("Please upload an image file (JPG, PNG)", "MISSING_FILE", 422);
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(taskId)) {
      return errorResponse("Invalid task ID", "INVALID_TASK", 422);
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      return errorResponse("Please upload an image file (JPG, PNG)", "INVALID_FILE_TYPE", 422);
    }

    if (file.size > MAX_SCREENSHOT_SIZE) {
      return errorResponse("Screenshot must be 10MB or smaller.", "FILE_TOO_LARGE", 422);
    }

    const admin = createAdminSupabaseClient();
    await ensureBucket(admin);

    const ext = extensionForType(file.type);
    const path = `${user.id}/${taskId}/${randomUUID()}.${ext}`;
    const bytes = await file.arrayBuffer();

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: signed } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 30);

    const storageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`;

    return NextResponse.json({
      storageUrl,
      path,
      previewUrl: signed?.signedUrl ?? null,
      warning:
        file.size < MIN_SCREENSHOT_SIZE
          ? "Screenshot looks too small to be real. Please upload a full screenshot."
          : null,
    });
  } catch (error) {
    console.error("[POST /api/tasks/social-screenshot]", error);
    return errorResponse("Screenshot upload failed.", "INTERNAL_ERROR", 500);
  }
}
