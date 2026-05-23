/**
 * Referral bonus utilities.
 * All writes happen server-side via Supabase service role.
 */
import { hasPaidActivationPayment } from "@/lib/activation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { sendReferralBonusEmail } from "@/lib/notifications";
import { DEFAULT_REFERRAL_REWARD_KSH } from "@/lib/referral-program-utils";
import { accelerateTaskUnlockForReferral } from "@/lib/training";
import { SYSTEM_ADMIN_ID, validateReferralPair } from "@/lib/fraud/riskScorer";

type NotificationRecipient = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type ReleasableTransactionRow = {
  id: string;
  reference_table: string | null;
  reference_id: string | null;
};

type VerificationRow = {
  risk_score?: number | null;
  flags?: Record<string, unknown> | null;
};

async function hasActivated(userId: string) {
  const supabase = createAdminSupabaseClient();

  return hasPaidActivationPayment(supabase, userId);
}

async function queueReferralActivationNotification(args: {
  recipient: NotificationRecipient;
  activatedUser: NotificationRecipient;
  bonusAmount: number;
}) {
  const { recipient, activatedUser, bonusAmount } = args;
  if (!recipient.email) return;

  const supabase = createAdminSupabaseClient();
  const payload = {
    beneficiary_name: recipient.full_name,
    activated_user_name: activatedUser.full_name,
    amount: bonusAmount,
  };

  const { data: outboxRow, error: outboxError } = await supabase
    .from("notification_outbox")
    .insert({
      channel: "email",
      event_type: "referral_bonus_unlocked",
      recipient_user_id: recipient.id,
      recipient_email: recipient.email,
      payload,
      status: "pending",
      provider: "resend",
      external_id: null,
      error_message: null,
      sent_at: null,
    })
    .select("id")
    .single();

  if (outboxError) {
    throw outboxError;
  }

  const delivered = await sendReferralBonusEmail({
    to: recipient.email,
    beneficiaryName: recipient.full_name,
    activatedUserName: activatedUser.full_name,
    amount: bonusAmount,
  });

  if (!outboxRow?.id) {
    return;
  }

  await supabase
    .from("notification_outbox")
    .update(
      delivered
        ? {
            status: "sent",
            provider: "resend",
            sent_at: new Date().toISOString(),
            error_message: null,
          }
        : {
            status: "pending",
            error_message:
              "Immediate referral bonus email delivery was not available. Leave queued for retry after provider setup.",
          }
    )
    .eq("id", outboxRow.id);
}

/**
 * Credit the direct referrer for a given activated user.
 *
 * Called once after activation succeeds. Safe to call repeatedly.
 */
export async function creditDirectReferralBonus(activatedUserId: string): Promise<void> {
  const supabase = createAdminSupabaseClient();

  if (!await hasActivated(activatedUserId)) {
    return;
  }

  const { data: accountStatus, error: accountStatusError } = await (supabase.from("account_status" as never) as any)
    .select("is_setup_complete")
    .eq("user_id", activatedUserId)
    .maybeSingle();

  if (accountStatusError) {
    throw accountStatusError;
  }

  if (accountStatus?.is_setup_complete !== true) {
    return;
  }

  const { data: activatedProfile, error: activatedProfileError } = await supabase
    .from("profiles")
    .select("id, full_name, email, referred_by")
    .eq("id", activatedUserId)
    .maybeSingle();

  if (activatedProfileError) {
    throw activatedProfileError;
  }

  const referrerId = activatedProfile?.referred_by ?? null;
  if (!referrerId || referrerId === activatedUserId) return;

  const { data: recipientRows, error: recipientError } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", referrerId);

  if (recipientError) {
    throw recipientError;
  }

  const recipient = (recipientRows?.[0] ?? null) as NotificationRecipient | null;
  if (!recipient) return;

  const { error: referralRowError } = await supabase
    .from("referrals")
    .insert({
      referrer_id: referrerId,
      referee_id: activatedUserId,
      level: 1,
      source: "signup",
    })
    .select("id")
    .single();

  if (referralRowError && referralRowError.code !== "23505") {
    throw referralRowError;
  }

  const { data: existingBonus, error: existingBonusError } = await supabase
    .from("referral_bonuses")
    .select("id")
    .eq("referrer_id", referrerId)
    .eq("referee_id", activatedUserId)
    .eq("level", 1)
    .maybeSingle();

  if (existingBonusError) {
    throw existingBonusError;
  }

  if (existingBonus?.id) return;

  const validation = await safeValidateReferralPair(referrerId, activatedUserId);

  if (validation.reason === "no_device_data") {
    await flagReferralCheckSkipped(supabase, referrerId, activatedUserId);
  }

  if (!validation.valid) {
    await handleBlockedReferralBonus({
      supabase,
      referrerId,
      refereeId: activatedUserId,
      amount: DEFAULT_REFERRAL_REWARD_KSH,
      reason: validation.reason ?? "referral_pair_invalid",
    });
    return;
  }

  await accelerateTaskUnlockForReferral(referrerId);

  const availableAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: bonus, error: bonusError } = await supabase
    .from("referral_bonuses")
    .insert({
      referrer_id: referrerId,
      referee_id: activatedUserId,
      level: 1,
      amount: DEFAULT_REFERRAL_REWARD_KSH,
      status: "pending",
      available_at: availableAt,
    })
    .select("id")
    .single();

  if (bonusError || !bonus) {
    if (bonusError?.code === "23505") return;
    throw bonusError;
  }

  const { error: walletInsertError } = await supabase.from("wallet_transactions").insert({
    user_id: referrerId,
    type: "referral_bonus",
    direction: "credit",
    amount: DEFAULT_REFERRAL_REWARD_KSH,
    status: "pending",
    bucket: "pending",
    description: "Referral activation bonus",
    reference_table: "referral_bonuses",
    reference_id: bonus.id,
    available_at: availableAt,
  });

  if (walletInsertError) {
    throw walletInsertError;
  }

  if (activatedProfile) {
    await queueReferralActivationNotification({
      recipient,
      activatedUser: {
        id: activatedProfile.id,
        full_name: activatedProfile.full_name,
        email: activatedProfile.email,
      },
      bonusAmount: DEFAULT_REFERRAL_REWARD_KSH,
    });
  }
}

async function safeValidateReferralPair(referrerId: string, refereeId: string) {
  try {
    return await validateReferralPair(referrerId, refereeId);
  } catch (error) {
    console.warn("[Referral] Device/IP referral validation skipped", {
      referrerId,
      refereeId,
      error,
    });
    return { valid: true, reason: "no_device_data" as const };
  }
}

async function flagReferralCheckSkipped(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  referrerId: string,
  refereeId: string
) {
  await Promise.allSettled([
    mergeVerificationFlags(supabase, referrerId, {
      referral_check_skipped: "no_device_data",
      referral_check_skipped_partner_user_id: refereeId,
    }),
    mergeVerificationFlags(supabase, refereeId, {
      referral_check_skipped: "no_device_data",
      referral_check_skipped_partner_user_id: referrerId,
    }),
  ]);
}

async function handleBlockedReferralBonus({
  supabase,
  referrerId,
  refereeId,
  amount,
  reason,
}: {
  supabase: ReturnType<typeof createAdminSupabaseClient>;
  referrerId: string;
  refereeId: string;
  amount: number;
  reason: string;
}) {
  await Promise.allSettled([
    updateReferralFraudRisk(supabase, referrerId, {
      referral_fraud_attempt: true,
      reason,
      partner_user_id: refereeId,
    }),
    updateReferralFraudRisk(supabase, refereeId, {
      referral_fraud_attempt: true,
      reason,
      partner_user_id: referrerId,
    }),
    (supabase.from("audit_log" as never) as any).insert({
      admin_id: SYSTEM_ADMIN_ID,
      action: "referral_fraud_blocked",
      entity_type: "referral",
      entity_id: refereeId,
      after_json: {
        referrer_id: referrerId,
        referee_id: refereeId,
        level: 1,
        amount,
        reason,
      },
      reason,
    }),
  ]);
}

async function updateReferralFraudRisk(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  userId: string,
  flag: Record<string, unknown>
) {
  const verification = await getVerificationRow(supabase, userId);
  await (supabase.from("user_verification" as never) as any).upsert({
    user_id: userId,
    risk_score: Math.max(0, Number(verification.risk_score ?? 0) + 25),
    flags: {
      ...verification.flags,
      ...flag,
    },
    updated_at: new Date().toISOString(),
  });
}

async function mergeVerificationFlags(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  userId: string,
  flag: Record<string, unknown>
) {
  const verification = await getVerificationRow(supabase, userId);
  await (supabase.from("user_verification" as never) as any).upsert({
    user_id: userId,
    flags: {
      ...verification.flags,
      ...flag,
    },
    updated_at: new Date().toISOString(),
  });
}

async function getVerificationRow(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  userId: string
): Promise<VerificationRow> {
  const { data } = await (supabase.from("user_verification" as never) as any)
    .select("risk_score, flags")
    .eq("user_id", userId)
    .maybeSingle();

  const flags = data?.flags && typeof data.flags === "object"
    ? data.flags as Record<string, unknown>
    : {};

  return {
    risk_score: data?.risk_score ?? 0,
    flags,
  };
}

/** Release pending transactions whose available_at has passed. Called by scheduled job. */
export async function releasePendingCredits(): Promise<{ releasedTransactions: number; releasedBonuses: number }> {
  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data: releasableTransactions, error: selectError } = await supabase
    .from("wallet_transactions")
    .select("id, reference_table, reference_id")
    .eq("status", "pending")
    .eq("direction", "credit")
    .lte("available_at", now);

  if (selectError) {
    throw selectError;
  }

  const rows = (releasableTransactions ?? []) as ReleasableTransactionRow[];
  const transactionIds = rows.map((row) => row.id);
  const referralBonusIds = rows
    .filter((row) => row.reference_table === "referral_bonuses" && row.reference_id)
    .map((row) => row.reference_id as string);

  if (transactionIds.length === 0) {
    return { releasedTransactions: 0, releasedBonuses: 0 };
  }

  const { data: updatedTransactions, error: updateError } = await supabase
    .from("wallet_transactions")
    .update({ status: "available", bucket: "available" })
    .in("id", transactionIds)
    .select("id");

  if (updateError) {
    throw updateError;
  }

  let releasedBonuses = 0;

  if (referralBonusIds.length > 0) {
    const { data: updatedBonuses, error: bonusUpdateError } = await supabase
      .from("referral_bonuses")
      .update({ status: "available" })
      .in("id", referralBonusIds)
      .select("id");

    if (bonusUpdateError) {
      throw bonusUpdateError;
    }

    releasedBonuses = updatedBonuses?.length ?? 0;
  }

  return {
    releasedTransactions: updatedTransactions?.length ?? 0,
    releasedBonuses,
  };
}
