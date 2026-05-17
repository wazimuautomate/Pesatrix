import { NextResponse } from "next/server";
import { requireAdmin } from "../_lib";

/** Simple admin verification endpoint used by admin login page */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  return NextResponse.json({ ok: true });
}
