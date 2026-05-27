import { NextResponse } from "next/server";
import { requireAdmin, auditLog } from "../_lib";
import { getAppBaseUrl } from "@/lib/app-url";
import { createOrUpdateCronJob } from "@/lib/cron-job-org";

export async function POST(request: Request) {
  const { error, adminUser, userId: adminAuthId, requestMeta } = await requireAdmin({ request });
  if (error) return error;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return NextResponse.json(
      { error: "Invalid JSON request body" },
      { status: 400 }
    );
  }

  const { apiKey } = body;
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length === 0) {
    return NextResponse.json(
      { error: "API key is required and must be a non-empty string." },
      { status: 422 }
    );
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "System configuration error: CRON_SECRET is not configured on this server." },
      { status: 500 }
    );
  }

  // Retrieve the application host URL dynamically
  const appUrl = await getAppBaseUrl();

  // Call the cron-job.org REST API to create/update
  const result = await createOrUpdateCronJob(apiKey.trim(), appUrl, cronSecret);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error },
      { status: 400 }
    );
  }

  // Audit log the action
  await auditLog({
    adminId: adminAuthId!,
    action: "cron_setup_sync",
    entityType: "cron_job",
    entityId: String(result.jobId || "unknown"),
    reason: `Configured cron-job.org hourly task release (${result.action}) for URL: ${appUrl}/api/cron/release-tasks`,
    ip: requestMeta?.ip ?? undefined,
    userAgent: requestMeta?.userAgent ?? undefined,
  });

  return NextResponse.json({
    success: true,
    jobId: result.jobId,
    action: result.action,
    appUrl,
  });
}
