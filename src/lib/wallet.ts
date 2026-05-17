import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getWithdrawalHoldDays } from "@/lib/platform-settings";

export const ACTIVATION_FEE_AMOUNT = 500;
export const MIN_WITHDRAWAL_AMOUNT = 100;
export const MAX_WITHDRAWAL_AMOUNT = 100000;

export type WalletLedgerRow = {
  id?: string;
  user_id?: string;
  type?: string | null;
  direction?: string | null;
  amount: number;
  status?: string | null;
  bucket?: string | null;
  description?: string | null;
  reference_table?: string | null;
  reference_id?: string | null;
  available_at?: string | null;
  created_at?: string | null;
};

export type WalletSummary = {
  pending: number;
  available: number;
  total: number;
  totalEarned: number;
};

function signedAmount(transaction: Pick<WalletLedgerRow, "amount" | "direction">) {
  return transaction.direction === "debit" ? -transaction.amount : transaction.amount;
}

export function computeWalletSummary(rows: WalletLedgerRow[]): WalletSummary {
  const pending = rows
    .filter((row) => row.status === "pending" && row.bucket === "pending")
    .reduce((sum, row) => sum + signedAmount(row), 0);

  const availableRaw = rows
    .filter((row) => row.status === "available" && row.bucket === "available")
    .reduce((sum, row) => sum + signedAmount(row), 0);
  const totalEarned = rows
    .filter((row) => row.direction === "credit" && row.status === row.bucket)
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

  if (availableRaw < 0) {
    console.error("[Wallet] available balance calculated below zero from ledger", { availableRaw });
  }

  return {
    pending,
    available: Math.max(0, availableRaw),
    total: totalEarned,
    totalEarned,
  };
}

export function mapWalletTransactionForApi(row: WalletLedgerRow) {
  return {
    id: row.id,
    type: row.type,
    direction: row.direction,
    amount: row.amount,
    status: row.status,
    availableAt: row.available_at,
    createdAt: row.created_at,
    description: row.description,
    referenceTable: row.reference_table,
    referenceId: row.reference_id,
  };
}

export async function getWalletSummaryForUser(userId: string) {
  return getWalletSummary(userId);
}

export async function getWalletSummary(userId: string) {
  const admin = createAdminSupabaseClient();
  const { data: wallet, error } = await admin
    .from("wallets")
    .select("available_balance, pending_balance, total_earned")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (wallet) {
    const available = Number(wallet.available_balance ?? 0);
    if (available < 0) {
      console.error("[Wallet] available_balance is below zero", { userId, available });
    }

    return {
      available: Math.max(0, available),
      pending: Number(wallet.pending_balance ?? 0),
      total: Number(wallet.total_earned ?? 0),
      totalEarned: Number(wallet.total_earned ?? 0),
    };
  }

  return { available: 0, pending: 0, total: 0, totalEarned: 0 };
}

export async function creditTaskEarning(
  userId: string,
  submissionId: string,
  amount: number,
  taskTitle: string
) {
  const admin = createAdminSupabaseClient();
  const holdDays = await getWithdrawalHoldDays();
  const availableAt = new Date(
    Date.now() + holdDays * 24 * 60 * 60 * 1000
  ).toISOString();
  const walletState = holdDays === 0 ? "available" : "pending";

  const { data, error } = await admin
    .from("wallet_transactions")
    .insert({
      user_id: userId,
      type: "task_earning",
      direction: "credit",
      amount,
      status: walletState,
      bucket: walletState,
      description: `Task earning: ${taskTitle}`,
      reference_table: "task_submissions",
      reference_id: submissionId,
      available_at: availableAt,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return {
    transaction: data,
    availableAt,
    holdDays,
  };
}

export async function getWithdrawalVerification(userId: string) {
  const admin = createAdminSupabaseClient();

  const [{ data: profile, error: profileError }, { data: verification, error: verificationError }] =
    await Promise.all([
      admin.from("profiles").select("*").eq("id", userId).maybeSingle(),
      admin.from("user_verification").select("*").eq("user_id", userId).maybeSingle(),
    ]);

  if (profileError) {
    throw profileError;
  }

  if (verificationError) {
    throw verificationError;
  }

  const phoneVerified = Boolean(
    profile?.phone_verified ??
      verification?.phone_verified ??
      profile?.is_phone_verified ??
      verification?.is_phone_verified
  );

  const emailVerified = Boolean(
    profile?.email_verified ??
      verification?.email_verified ??
      profile?.is_email_verified ??
      verification?.is_email_verified
  );

  return {
    phoneVerified,
    emailVerified,
  };
}
