import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { buildReferralLink } from "@/lib/app-url";
import { getReferralProgramSettings, getReferralRewardForLevel } from "@/lib/referral-program";

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
  level: 1 | 2 | 3;
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
  level: 1 | 2 | 3;
  createdAt: string;
  bonusAmount: number | null;
  bonusStatus: "pending" | "available" | "revoked" | null;
};

export type UserReferralBonusHistoryEntry = {
  id: string;
  refereeId: string;
  referredUser: string;
  referredEmail: string | null;
  level: 1 | 2 | 3;
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
  levelCounts: Record<1 | 2 | 3, number>;
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

  const [{ data: profileRow, error: profileError }, level1Profiles, { data: bonusRows, error: bonusError }] = await Promise.all([
    (admin.from("profiles" as never) as any)
      .select("id, full_name, email, phone, referral_code, referred_by, created_at")
      .eq("id", userId)
      .maybeSingle(),
    getProfilesByReferrers([userId]),
    (admin.from("referral_bonuses" as never) as any)
      .select("id, referrer_id, referee_id, level, amount, status, available_at, created_at")
      .eq("referrer_id", userId)
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

  const level1 = level1Profiles;
  const level2 = rules.maxLevels >= 2 ? await getProfilesByReferrers(level1.map((row) => row.id)) : [];
  const level3 = rules.maxLevels >= 3 ? await getProfilesByReferrers(level2.map((row) => row.id)) : [];
  const bonuses = (bonusRows ?? []) as ReferralBonusRow[];

  const bonusByKey = new Map(
    bonuses.map((row) => [`${row.referee_id}:${row.level}`, row] as const)
  );

  const network: UserReferralNetworkEntry[] = [
    ...level1.map((row) => {
      const bonus = bonusByKey.get(`${row.id}:1`);
      return {
        id: `${row.id}:1`,
        referredId: row.id,
        referredName: labelForProfile(row),
        referredEmail: row.email,
        referredPhone: row.phone,
        level: 1 as const,
        createdAt: row.created_at,
        bonusAmount: bonus ? Number(bonus.amount ?? 0) : null,
        bonusStatus: bonus?.status ?? null,
      };
    }),
    ...level2.map((row) => {
      const bonus = bonusByKey.get(`${row.id}:2`);
      return {
        id: `${row.id}:2`,
        referredId: row.id,
        referredName: labelForProfile(row),
        referredEmail: row.email,
        referredPhone: row.phone,
        level: 2 as const,
        createdAt: row.created_at,
        bonusAmount: bonus ? Number(bonus.amount ?? 0) : null,
        bonusStatus: bonus?.status ?? null,
      };
    }),
    ...level3.map((row) => {
      const bonus = bonusByKey.get(`${row.id}:3`);
      return {
        id: `${row.id}:3`,
        referredId: row.id,
        referredName: labelForProfile(row),
        referredEmail: row.email,
        referredPhone: row.phone,
        level: 3 as const,
        createdAt: row.created_at,
        bonusAmount: bonus ? Number(bonus.amount ?? 0) : null,
        bonusStatus: bonus?.status ?? null,
      };
    }),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const bonusKey = new Set(bonuses.filter((row) => row.status !== "revoked").map((row) => `${row.referee_id}:${row.level}`));
  const availableEarned = bonuses
    .filter((row) => row.status === "available")
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const pendingEarned = network.reduce((sum, row) => {
    if (bonusKey.has(`${row.referredId}:${row.level}`)) {
      return sum;
    }
    return sum + getReferralRewardForLevel(rules, row.level);
  }, 0);

  const profilesById = new Map<string, ReferralProfileRow>(
    [...level1, ...level2, ...level3].map((row) => [row.id, row])
  );

  const latestBonuses = bonuses.slice(0, 8).map((row) => {
    const referredProfile = profilesById.get(row.referee_id);
    return {
      id: row.id,
      refereeId: row.referee_id,
      referredUser: referredProfile ? labelForProfile(referredProfile) : row.referee_id,
      referredEmail: referredProfile?.email ?? null,
      level: row.level,
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
    pendingDirectActivations: level1.filter((row) => !bonusKey.has(`${row.id}:1`)).length,
    levelCounts: {
      1: level1.length,
      2: level2.length,
      3: level3.length,
    },
    rules,
    network,
    latestBonuses,
  };
}
