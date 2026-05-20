import { NextResponse } from "next/server";

import { auditLog, requireAdmin } from "@/app/api/admin/_lib";
import { runAIFraudScan } from "@/lib/fraud/aiScorer";

type RouteContext = {
  params: Promise<{ userId: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const { userId: targetUserId } = await params;
  const { error, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["super_admin", "fraud"],
  });
  if (error) return error;
  if (!userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const result = await runAIFraudScan(targetUserId);

    await auditLog({
      adminId: userId,
      action: "ai_fraud_manual_scan",
      entityType: "user_verification",
      entityId: targetUserId,
      after: result,
      reason: "Manual AI fraud scan",
      ip: requestMeta?.ip ?? undefined,
      userAgent: requestMeta?.userAgent ?? undefined,
    });

    return NextResponse.json({ result });
  } catch (scanError) {
    console.error("[POST /api/admin/fraud/review]", scanError);
    return NextResponse.json({ error: "AI fraud scan failed" }, { status: 500 });
  }
}
