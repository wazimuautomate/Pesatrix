import { NextResponse } from "next/server";
import { z } from "zod";

import {
  TRAINING_UNLOCK_SETTING_KEY,
  getTrainingDayUnlockMinutes,
  upsertPlatformSetting,
} from "@/lib/platform-settings";
import { auditLog, requireAdmin } from "../../_lib";

const schema = z.object({
  unlockMinutes: z.number().int().min(1).max(10080),
});

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  return NextResponse.json({
    unlockMinutes: await getTrainingDayUnlockMinutes(),
  });
}

export async function POST(request: Request) {
  const { error, userId, requestMeta } = await requireAdmin({
    request,
    allowedRoles: ["admin"],
  });
  if (error) return error;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.errors[0]?.message ?? "Invalid training setting",
        },
      },
      { status: 422 }
    );
  }

  const setting = await upsertPlatformSetting({
    key: TRAINING_UNLOCK_SETTING_KEY,
    value: String(parsed.data.unlockMinutes),
    description: "Minutes users must wait before the next training step unlocks.",
    updatedBy: userId,
  });

  if (userId) {
    await auditLog({
      adminId: userId,
      action: "training_unlock_minutes_update",
      entityType: "platform_settings",
      entityId: "00000000-0000-0000-0000-000000000000",
      after: setting,
      reason: `Set training unlock minutes to ${parsed.data.unlockMinutes}`,
      ip: requestMeta?.ip ?? undefined,
      userAgent: requestMeta?.userAgent ?? undefined,
    });
  }

  return NextResponse.json({ unlockMinutes: parsed.data.unlockMinutes });
}
