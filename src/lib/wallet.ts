import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getWithdrawalHoldDays } from "@/lib/platform-settings";
import { computeWalletSummary, type WalletSummary } from "@/lib/wallet-math";

export const ACTIVATION_FEE_AMOUNT = 500;
export const MIN_WITHDRAWAL_AMOUNT = 200;
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

export type WalletTransactionsQuery = {
  direction?: "credit" | "debit";
  limit?: number;
  page?: number;
  type?: string;
};

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

export async function getWalletTransactionsForUser(
  userId: string,
  { direction, limit = 20, page = 1, type }: WalletTransactionsQuery = {}
) {
  const admin = createAdminSupabaseClient();
  const offset = Math.max(0, page - 1) * limit;

  let query = admin
    .from("wallet_transactions")
    .select(
      "id, type, direction, amount, status, bucket, description, available_at, created_at, reference_table, reference_id",
      { count: "exact" }
    )
    .eq("user_id", userId);

  if (direction) {
    query = query.eq("direction", direction);
  }

  if (type) {
    query = query.eq("type", type);
  }

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  const items = (data ?? []).map(mapWalletTransactionForApi);
  const total = count ?? items.length;

  return {
    items,
    total,
    page,
    hasMore: offset + items.length < total,
  };
}

export async function getWalletSummaryForUser(userId: string) {
  return getWalletSummary(userId);
}

export async function getWalletSummary(userId: string) {
  const admin = createAdminSupabaseClient();
  const [{ data: wallet, error: walletError }, { data: ledgerRows, error: ledgerError }] =
    await Promise.all([
      admin
        .from("wallets")
        .select("available_balance, pending_balance, total_earned")
        .eq("user_id", userId)
        .maybeSingle(),
      admin
        .from("wallet_transactions")
        .select("amount, direction, status, bucket")
        .eq("user_id", userId),
    ]);

  if (walletError) {
    throw walletError;
  }

  if (ledgerError) {
    throw ledgerError;
  }

  const ledgerSummary = computeWalletSummary((ledgerRows ?? []) as WalletLedgerRow[]);

  if ((ledgerRows?.length ?? 0) > 0) {
    if (
      wallet &&
      (Number(wallet.available_balance ?? 0) !== ledgerSummary.available ||
        Number(wallet.pending_balance ?? 0) !== ledgerSummary.pending ||
        Number(wallet.total_earned ?? 0) !== ledgerSummary.totalEarned)
    ) {
      console.warn("[Wallet] wallets table is out of sync with ledger", {
        userId,
        wallet,
        ledgerSummary,
      });
    }

    return ledgerSummary;
  }

  if (wallet) {
    const available = Number(wallet.available_balance ?? 0);
    return {
      available: Math.max(0, available),
      pending: Number(wallet.pending_balance ?? 0),
      total: Number(wallet.total_earned ?? 0),
      totalEarned: Number(wallet.total_earned ?? 0),
    };
  }

  return ledgerSummary;
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
