import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const TASK_SCREENSHOT_BUCKET = "task-screenshots";
export const MAX_TASK_SCREENSHOT_SIZE = 10 * 1024 * 1024;
export const ALLOWED_TASK_SCREENSHOT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function extensionForTaskScreenshotType(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

export async function ensurePublicTaskScreenshotBucket(
  admin: ReturnType<typeof createAdminSupabaseClient>
) {
  const bucket = await admin.storage.getBucket(TASK_SCREENSHOT_BUCKET);
  if (!bucket.data) {
    await admin.storage.createBucket(TASK_SCREENSHOT_BUCKET, {
      public: true,
      fileSizeLimit: MAX_TASK_SCREENSHOT_SIZE,
      allowedMimeTypes: Array.from(ALLOWED_TASK_SCREENSHOT_TYPES),
    });
    return;
  }

  if (bucket.data.public !== true) {
    const { error } = await admin.storage.updateBucket(TASK_SCREENSHOT_BUCKET, {
      public: true,
      fileSizeLimit: MAX_TASK_SCREENSHOT_SIZE,
      allowedMimeTypes: Array.from(ALLOWED_TASK_SCREENSHOT_TYPES),
    });

    if (error) throw error;
  }
}

export function getTaskScreenshotPublicUrl(path: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${TASK_SCREENSHOT_BUCKET}/${encodePath(path)}`;
}

export function getTaskScreenshotPublicUrlFromStoredUrl(value: string | null | undefined) {
  if (!value) return null;

  const parsed = parseTaskScreenshotUrl(value);
  if (!parsed) return value;

  return getTaskScreenshotPublicUrl(parsed.path) ?? value;
}

export function parseTaskScreenshotUrl(value: string) {
  try {
    const url = new URL(value);
    const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    if (url.origin !== supabaseUrl.origin) return null;

    const publicPrefix = `/storage/v1/object/public/${TASK_SCREENSHOT_BUCKET}/`;
    const privatePrefix = `/storage/v1/object/${TASK_SCREENSHOT_BUCKET}/`;
    const prefix = url.pathname.startsWith(publicPrefix)
      ? publicPrefix
      : url.pathname.startsWith(privatePrefix)
        ? privatePrefix
        : null;

    if (!prefix) return null;

    const path = decodeURIComponent(url.pathname.slice(prefix.length));
    if (!path || path.includes("..")) return null;

    const ext = path.split(".").pop()?.toLowerCase();
    const mediaType =
      ext === "png"
        ? "image/png"
        : ext === "webp"
          ? "image/webp"
          : "image/jpeg";

    return { path, mediaType };
  } catch {
    return null;
  }
}

function encodePath(path: string) {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}
