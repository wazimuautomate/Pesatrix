/**
 * Referral chain utilities.
 * All writes happen server-side via Supabase service role.
 */
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { sendReferralBonusEmail } from "@/lib/notifications";
import { ACTIVATION_FEE_AMOUNT } from "@/lib/wallet";

const BONUS_RATES: Record<number, number> = {
  1: 0.2,
  2: 0.1,
  3: 0.05,
};

type AccountStatusRow = {
  state?: string | null;
  is_activated?: boolean | null;
  activated_at?: string | null;
};

type ReferralBonusRow = {
  id: string;
};

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

async function hasActivated(userId: string) {
  const supabase = createAdminSupabaseClient();

  const [{ data: accountStatus, error: accountStatusError }, { data: activationPayment }] = await Promise.all([
    supabase
      .from("account_status")
      .select("state, is_activated, activated_at")
      .eq("user_id", userId)
      .maybeSingle(),
    (supabase.from("activation_payments" as never) as any)
      .select("id, status")
      .eq("user_id", userId)
      .eq("status", "paid")
      .maybeSingle(),
  ]);

  if (accountStatusError) {
    throw accountStatusError;
  }

  const accountActivated = Boolean(
    accountStatus?.is_activated ||
      accountStatus?.activated_at ||
      accountStatus?.state === "activated" ||
      accountStatus?.state === "active"
  );

  const paymentActivated = Boolean(activationPayment?.status === "paid");

  return accountActivated || paymentActivated;
}

async function queueReferralActivationNotification(args: {
  recipient: NotificationRecipient;
  activatedUser: NotificationRecipient;
  bonusAmount: number;
  level: number;
}) {
  const { recipient, activatedUser, bonusAmount, level } = args;
  if (!recipient.email) return;

  const supabase = createAdminSupabaseClient();
  const payload = {
    beneficiary_name: recipient.full_name,
    activated_user_name: activatedUser.full_name,
    amount: bonusAmount,
    level,
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
    level,
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
 * Walk up to 3 levels of the referral chain for a given activated user and
 * create available wallet_transactions + referral_bonuses for each referrer.
 *
 * Called once after activation succeeds. Safe to call repeatedly.
 */
export async function creditReferralChain(activatedUserId: string): Promise<void> {
  const supabase = createAdminSupabaseClient();

  if (!await hasActivated(activatedUserId)) {
    return;
  }

  const { data: activatedProfile, error: activatedProfileError } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", activatedUserId)
    .maybeSingle();

  if (activatedProfileError) {
    throw activatedProfileError;
  }

  const { data: directRef, error: directRefError } = await supabase
    .from("referrals")
    .select("referrer_id")
    .eq("referee_id", activatedUserId)
    .eq("level", 1)
    .maybeSingle();

  if (directRefError) {
    throw directRefError;
  }

  if (!directRef?.referrer_id) return;

  const chain: { referrerId: string; level: number }[] = [];
  const seen = new Set<string>([activatedUserId]);
  let currentId: string | null = directRef.referrer_id;

  for (let level = 1; level <= 3; level++) {
    if (!currentId || seen.has(currentId)) break;

    chain.push({ referrerId: currentId, level });
    seen.add(currentId);

    const { data: parent, error: parentError } = await supabase
      .from("referrals")
      .select("referrer_id")
      .eq("referee_id", currentId)
      .eq("level", 1)
      .maybeSingle();

    if (parentError) {
      throw parentError;
    }

    currentId = parent?.referrer_id ?? null;
  }

  const recipientIds = chain.map((entry) => entry.referrerId);
  const { data: recipientRows, error: recipientError } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", recipientIds);

  if (recipientError) {
    throw recipientError;
  }

  const recipients = (recipientRows ?? []) as NotificationRecipient[];
  const recipientMap = new Map(
    recipients.map((row) => [
      row.id,
      {
        id: row.id,
        full_name: row.full_name,
        email: row.email,
      } satisfies NotificationRecipient,
    ])
  );

  for (const { referrerId, level } of chain) {
    const amount = Math.round(ACTIVATION_FEE_AMOUNT * BONUS_RATES[level]);

    const { data: referralRow, error: referralRowError } = await supabase
      .from("referrals")
      .upsert(
        {
          referrer_id: referrerId,
          referee_id: activatedUserId,
          level,
          source: "signup",
        },
        { onConflict: "referee_id,level" }
      )
      .select("id")
      .single();

    if (referralRowError || !referralRow) {
      throw referralRowError;
    }

    const { data: bonus, error: bonusError } = await supabase
      .from("referral_bonuses")
      .upsert(
        {
          referrer_id: referrerId,
          referee_id: activatedUserId,
          level,
          amount,
          status: "available",
          available_at: new Date().toISOString(),
        },
        { onConflict: "referrer_id,referee_id,level" }
      )
      .select("id")
      .single();

    if (bonusError || !bonus) {
      throw bonusError;
    }

    const bonusRow = bonus as ReferralBonusRow;

    const { data: existingWalletTxn, error: walletLookupError } = await supabase
      .from("wallet_transactions")
      .select("id")
      .eq("reference_table", "referral_bonuses")
      .eq("reference_id", bonusRow.id)
      .maybeSingle();

    if (walletLookupError) {
      throw walletLookupError;
    }

    if (!existingWalletTxn) {
      const { error: walletInsertError } = await supabase.from("wallet_transactions").insert({
        user_id: referrerId,
        type: "referral_bonus",
        direction: "credit",
        amount,
        status: "available",
        bucket: "available",
        description: `Level ${level} referral activation bonus`,
        reference_table: "referral_bonuses",
        reference_id: bonusRow.id,
        available_at: new Date().toISOString(),
      });

      if (walletInsertError) {
        throw walletInsertError;
      }

      const recipient = recipientMap.get(referrerId);
      if (recipient && activatedProfile) {
        await queueReferralActivationNotification({
          recipient,
          activatedUser: {
            id: activatedProfile.id,
            full_name: activatedProfile.full_name,
            email: activatedProfile.email,
          },
          bonusAmount: amount,
          level,
        });
      }
    }
  }
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
