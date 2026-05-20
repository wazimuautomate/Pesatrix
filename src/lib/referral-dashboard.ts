import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { buildReferralLink } from "@/lib/app-url";
import { getReferralProgramSettings } from "@/lib/referral-program";

type ReferralProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  referral_code: string;
  referred_by: string | null;
  created_at: string;
};

type ReferralBonusRow = {
  id: string;
  referrer_id: string;
  referee_id: string;
  level: 1;
  amount: number;
  status: "pending" | "available" | "revoked";
  available_at: string | null;
  created_at: string;
};

export type UserReferralNetworkEntry = {
  id: string;
  referredId: string;
  referredName: string;
  referredEmail: string | null;
  referredPhone: string | null;
  createdAt: string;
  bonusAmount: number | null;
  bonusStatus: "pending" | "available" | "revoked" | null;
};

export type UserReferralBonusHistoryEntry = {
  id: string;
  refereeId: string;
  referredUser: string;
  referredEmail: string | null;
  amount: number;
  status: "pending" | "available" | "revoked";
  availableAt: string | null;
  createdAt: string;
};

export type UserReferralDashboardData = {
  referralCode: string;
  referralLink: string;
  availableEarned: number;
  pendingEarned: number;
  pendingDirectActivations: number;
  referralCount: number;
  rules: Awaited<ReturnType<typeof getReferralProgramSettings>>;
  network: UserReferralNetworkEntry[];
  latestBonuses: UserReferralBonusHistoryEntry[];
};

function labelForProfile(profile: Pick<ReferralProfileRow, "full_name" | "email" | "phone" | "id">) {
  return profile.full_name?.trim() || profile.email?.trim() || profile.phone?.trim() || profile.id;
}

async function getProfilesByReferrers(referrerIds: string[]) {
  if (referrerIds.length === 0) return [];

  const admin = createAdminSupabaseClient();
  const { data, error } = await (admin.from("profiles" as never) as any)
    .select("id, full_name, email, phone, referral_code, referred_by, created_at")
    .in("referred_by", referrerIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as ReferralProfileRow[];
}

export async function getUserReferralDashboardData(userId: string, appBaseUrl: string): Promise<UserReferralDashboardData> {
  const admin = createAdminSupabaseClient();
  const rules = await getReferralProgramSettings();

  const [{ data: profileRow, error: profileError }, directProfiles, { data: bonusRows, error: bonusError }] = await Promise.all([
    (admin.from("profiles" as never) as any)
      .select("id, full_name, email, phone, referral_code, referred_by, created_at")
      .eq("id", userId)
      .maybeSingle(),
    getProfilesByReferrers([userId]),
    (admin.from("referral_bonuses" as never) as any)
      .select("id, referrer_id, referee_id, level, amount, status, available_at, created_at")
      .eq("referrer_id", userId)
      .eq("level", 1)
      .order("created_at", { ascending: false }),
  ]);

  if (profileError) {
    throw profileError;
  }

  if (bonusError) {
    throw bonusError;
  }

  if (!profileRow?.referral_code) {
    throw new Error("Referral code not found for user profile.");
  }

  const bonuses = (bonusRows ?? []) as ReferralBonusRow[];
  const bonusByReferee = new Map(bonuses.map((row) => [row.referee_id, row] as const));

  const network = directProfiles
    .map((row) => {
      const bonus = bonusByReferee.get(row.id);
      return {
        id: row.id,
        referredId: row.id,
        referredName: labelForProfile(row),
        referredEmail: row.email,
        referredPhone: row.phone,
        createdAt: row.created_at,
        bonusAmount: bonus ? Number(bonus.amount ?? 0) : null,
        bonusStatus: bonus?.status ?? null,
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const creditedRefereeIds = new Set(bonuses.filter((row) => row.status !== "revoked").map((row) => row.referee_id));
  const availableEarned = bonuses
    .filter((row) => row.status === "available")
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const pendingEarned = network.reduce((sum, row) => {
    if (creditedRefereeIds.has(row.referredId)) {
      return sum;
    }
    return sum + rules.rewardAmount;
  }, 0);

  const profilesById = new Map<string, ReferralProfileRow>(directProfiles.map((row) => [row.id, row]));

  const latestBonuses = bonuses.slice(0, 8).map((row) => {
    const referredProfile = profilesById.get(row.referee_id);
    return {
      id: row.id,
      refereeId: row.referee_id,
      referredUser: referredProfile ? labelForProfile(referredProfile) : row.referee_id,
      referredEmail: referredProfile?.email ?? null,
      amount: Number(row.amount ?? 0),
      status: row.status,
      availableAt: row.available_at,
      createdAt: row.created_at,
    };
  });

  return {
    referralCode: profileRow.referral_code,
    referralLink: buildReferralLink(appBaseUrl, profileRow.referral_code),
    availableEarned,
    pendingEarned,
    pendingDirectActivations: directProfiles.filter((row) => !creditedRefereeIds.has(row.id)).length,
    referralCount: directProfiles.length,
    rules,
    network,
    latestBonuses,
  };
}
