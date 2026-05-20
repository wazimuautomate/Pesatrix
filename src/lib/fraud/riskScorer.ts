import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const SYSTEM_ADMIN_ID =
  process.env.SYSTEM_ADMIN_UUID ?? "9b16c6d7-9567-4db3-9e24-4d3f9bdb7f31";

type RiskFlags = Record<string, unknown>;

type DeviceSession = {
  id: string;
  user_id: string;
  fingerprint_hash: string;
  ip_address: string | null;
  ip_country: string | null;
  ip_city: string | null;
  ip_is_vpn: boolean | null;
  ip_is_datacenter: boolean | null;
  user_agent: string | null;
  created_at: string;
};

export async function addRiskPoints(
  userId: string,
  delta: number,
  _reason: Record<string, unknown>
) {
  if (delta === 0) return;

  const supabaseAdmin = createAdminSupabaseClient();

  const { data } = await supabaseAdmin
    .from("user_verification")
    .select("risk_score")
    .eq("user_id", userId)
    .maybeSingle();

  const nextRiskScore = Math.max(0, Number(data?.risk_score ?? 0) + delta);
  await supabaseAdmin
    .from("user_verification")
    .upsert({
      user_id: userId,
      risk_score: nextRiskScore,
      updated_at: new Date().toISOString(),
    });
}

export type ReferralPairValidationResult = {
  valid: boolean;
  reason?: "shared_device" | "shared_registration_ip" | "no_device_data";
};

export async function validateReferralPair(
  referrerId: string,
  refereeId: string
): Promise<ReferralPairValidationResult> {
  const supabase = createAdminSupabaseClient();

  const { data: sharedDevice, error: sharedDeviceError } = await (supabase
    .from("device_sessions" as never) as any)
    .select("fingerprint_hash, user_id")
    .in("user_id", [referrerId, refereeId]);

  if (sharedDeviceError) {
    throw sharedDeviceError;
  }

  const sessions = (sharedDevice ?? []) as Array<{
    user_id: string;
    fingerprint_hash: string | null;
  }>;
  const hasReferrerDeviceData = sessions.some((session) => session.user_id === referrerId);
  const hasRefereeDeviceData = sessions.some((session) => session.user_id === refereeId);

  if (!hasReferrerDeviceData || !hasRefereeDeviceData) {
    return { valid: true, reason: "no_device_data" };
  }

  const referrerHashes = sessions
    .filter((session) => session.user_id === referrerId && session.fingerprint_hash)
    .map((session) => session.fingerprint_hash as string);

  const refereeHashes = new Set(
    sessions
      .filter((session) => session.user_id === refereeId && session.fingerprint_hash)
      .map((session) => session.fingerprint_hash as string)
  );

  const overlap = referrerHashes.filter((hash) => refereeHashes.has(hash));

  if (overlap.length > 0) {
    return { valid: false, reason: "shared_device" };
  }

  const [{ data: referrerFirst, error: referrerFirstError }, { data: refereeFirst, error: refereeFirstError }] =
    await Promise.all([
      (supabase.from("device_sessions" as never) as any)
        .select("ip_address")
        .eq("user_id", referrerId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      (supabase.from("device_sessions" as never) as any)
        .select("ip_address")
        .eq("user_id", refereeId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);

  if (referrerFirstError) {
    throw referrerFirstError;
  }

  if (refereeFirstError) {
    throw refereeFirstError;
  }

  const referrerIp = (referrerFirst as { ip_address?: string | null } | null)?.ip_address;
  const refereeIp = (refereeFirst as { ip_address?: string | null } | null)?.ip_address;

  if (
    referrerIp &&
    refereeIp &&
    referrerIp === refereeIp &&
    !isPrivateOrLocalIp(referrerIp)
  ) {
    return { valid: false, reason: "shared_registration_ip" };
  }

  return { valid: true };
}

export async function updateRiskScore(userId: string) {
  const supabase = createAdminSupabaseClient();

  const { data: latestSession, error: latestSessionError } = await supabase
    .from("device_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestSessionError) {
    throw latestSessionError;
  }

  const session = latestSession as DeviceSession | null;

  if (!session) {
    return;
  }

  let riskDelta = 0;
  const newFlags: RiskFlags = {};

  const { data: matchingDeviceRows, error: matchingDeviceError } = await supabase
    .from("device_sessions")
    .select("user_id")
    .eq("fingerprint_hash", session.fingerprint_hash)
    .neq("user_id", userId);

  if (matchingDeviceError) {
    throw matchingDeviceError;
  }

  const matchedUsers = uniqueStrings(
    (matchingDeviceRows ?? []).map((row: { user_id: string }) => row.user_id)
  );

  if (matchedUsers.length > 0) {
    riskDelta += 15;
    newFlags.duplicate_device = true;
    newFlags.matched_users = matchedUsers;
  }

  if (session.ip_address) {
    const { data: sharedIpRows, error: sharedIpError } = await supabase
      .from("device_sessions")
      .select("user_id")
      .eq("ip_address", session.ip_address)
      .neq("user_id", userId);

    if (sharedIpError) {
      throw sharedIpError;
    }

    const sharedIpUserIds = uniqueStrings(
      (sharedIpRows ?? []).map((row: { user_id: string }) => row.user_id)
    );
    const hasSharedRegistrationIp =
      sharedIpUserIds.length > 0 &&
      (await usersRegisteredWithin24Hours(supabase, userId, sharedIpUserIds));

    if (hasSharedRegistrationIp) {
      riskDelta += 10;
      newFlags.shared_ip_registration = true;
    }
  }

  if (session.ip_is_vpn) {
    riskDelta += 10;
    newFlags.vpn_detected = true;
    newFlags.ip_country = session.ip_country;
  }

  if (session.ip_is_datacenter) {
    riskDelta += 20;
    newFlags.datacenter_ip = true;
  }

  if (session.ip_country && session.ip_country !== "Kenya" && session.ip_country !== "LOCAL") {
    riskDelta += 10;
    newFlags.foreign_ip = true;
    newFlags.country = session.ip_country;
  }

  const { data: verification, error: verificationError } = await supabase
    .from("user_verification")
    .select("risk_score, flags")
    .eq("user_id", userId)
    .maybeSingle();

  if (verificationError) {
    throw verificationError;
  }

  const currentRiskScore =
    typeof verification?.risk_score === "number" ? verification.risk_score : 0;
  const existingFlags = isPlainObject(verification?.flags) ? verification.flags : {};
  const newScore = currentRiskScore + riskDelta;
  const mergedFlags = {
    ...existingFlags,
    ...newFlags,
    last_scored_at: new Date().toISOString(),
  };

  const { error: upsertError } = await supabase
    .from("user_verification")
    .upsert({
      user_id: userId,
      risk_score: newScore,
      flags: mergedFlags,
      last_ip: session.ip_address,
      ip_country: session.ip_country,
      ip_is_vpn: session.ip_is_vpn === true,
    });

  if (upsertError) {
    throw upsertError;
  }

  if (newScore >= 100) {
    await suspendForRiskThreshold(supabase, userId);
  }
}

async function suspendForRiskThreshold(supabase: any, userId: string) {
  const { data: accountStatus, error: accountStatusError } = await supabase
    .from("account_status")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();

  if (accountStatusError) {
    throw accountStatusError;
  }

  if (accountStatus?.status === "suspended") {
    return;
  }

  const before = { status: accountStatus?.status ?? "active" };
  const after = { status: "suspended" };

  const { error: statusError } = await supabase
    .from("account_status")
    .upsert({
      user_id: userId,
      status: "suspended",
      suspension_reason: "Auto-suspended: risk score threshold reached",
      suspended_at: new Date().toISOString(),
    });

  if (statusError) {
    throw statusError;
  }

  const { error: auditError } = await supabase.from("audit_log").insert({
    admin_id: SYSTEM_ADMIN_ID,
    action: "auto_suspend",
    entity_type: "user",
    entity_id: userId,
    reason: "risk_score >= 100",
    before_json: before,
    after_json: after,
  });

  if (auditError) {
    console.error("[fraud:risk] Failed to write auto-suspend audit log", auditError);
  }
}

async function usersRegisteredWithin24Hours(
  supabase: any,
  userId: string,
  otherUserIds: string[]
) {
  const { data: profiles, error } = await (supabase.from("profiles" as never) as any)
    .select("id, created_at")
    .in("id", [userId, ...otherUserIds]);

  if (error) {
    throw error;
  }

  const rows = (profiles ?? []) as Array<{ id: string; created_at: string | null }>;
  const currentCreatedAt = rows.find((row) => row.id === userId)?.created_at;

  if (!currentCreatedAt) {
    return false;
  }

  const currentTime = new Date(currentCreatedAt).getTime();

  if (!Number.isFinite(currentTime)) {
    return false;
  }

  return rows.some((row) => {
    if (row.id === userId || !row.created_at) return false;

    const otherTime = new Date(row.created_at).getTime();

    return (
      Number.isFinite(otherTime) &&
      Math.abs(currentTime - otherTime) <= 24 * 60 * 60 * 1000
    );
  });
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isPrivateOrLocalIp(ipAddress: string) {
  return (
    ipAddress.startsWith("192.168") ||
    ipAddress.startsWith("127.") ||
    ipAddress.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ipAddress) ||
    ipAddress === "::1" ||
    ipAddress.toLowerCase().startsWith("fc") ||
    ipAddress.toLowerCase().startsWith("fd")
  );
}
