import { NextResponse } from "next/server";
import { releasePendingCredits } from "@/lib/referral";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const headerToken = request.headers.get("x-cron-secret");

  return bearerToken === secret || headerToken === secret;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid job token" } },
      { status: 401 }
    );
  }

  const result = await releasePendingCredits();

  return NextResponse.json({
    ok: true,
    releasedTransactions: result.releasedTransactions,
    releasedBonuses: result.releasedBonuses,
  });
}
