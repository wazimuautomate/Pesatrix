import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Manual withdrawal completion is disabled. Approve the withdrawal to start the real payout process and wait for Daraja callback details.",
    },
    { status: 410 }
  );
}
