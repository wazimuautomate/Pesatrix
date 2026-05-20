import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getRequestIp, lookupIpIntelligence } from "@/lib/fraud/ipIntelligence";
import { updateRiskScore } from "@/lib/fraud/riskScorer";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const fingerprintSchema = z.object({
  visitorId: z.string().trim().min(8).max(512),
  userAgent: z.string().trim().max(1024).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = fingerprintSchema.safeParse(await request.json());

    if (!payload.success) {
      return NextResponse.json({ error: "Invalid fingerprint payload" }, { status: 400 });
    }

    const ipAddress = getRequestIp(request);
    const ipIntel = await lookupIpIntelligence(ipAddress);
    const userAgent =
      payload.data.userAgent || request.headers.get("user-agent") || null;
    const admin = createAdminSupabaseClient();

    const { error: insertError } = await admin.from("device_sessions").insert({
      user_id: user.id,
      fingerprint_hash: payload.data.visitorId,
      ip_address: ipAddress,
      ip_country: ipIntel.country,
      ip_city: ipIntel.city,
      ip_is_vpn: ipIntel.isVpn,
      ip_is_datacenter: ipIntel.isDatacenter,
      user_agent: userAgent,
    });

    if (insertError) {
      throw insertError;
    }

    await updateRiskScore(user.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api:fraud:fingerprint] Failed to record fingerprint", error);
    return NextResponse.json({ ok: true });
  }
}
