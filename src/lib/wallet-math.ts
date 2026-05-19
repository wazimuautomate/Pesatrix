export type WalletLedgerMathRow = {
  amount: number;
  bucket?: string | null;
  direction?: string | null;
  status?: string | null;
};

export type WalletSummary = {
  pending: number;
  available: number;
  total: number;
  totalEarned: number;
};

export function computeWalletSummary(rows: WalletLedgerMathRow[]): WalletSummary {
  const pending = rows
    .filter((row) => row.status === "pending" && row.bucket === "pending")
    .reduce((sum, row) => sum + (row.direction === "debit" ? -row.amount : row.amount), 0);

  const availableCredits = rows
    .filter((row) => row.direction === "credit" && row.status === "available")
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

  const reservedDebits = rows
    .filter(
      (row) =>
        row.direction === "debit" &&
        (row.status === "locked" || row.status === "available")
    )
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

  const availableRaw = availableCredits - reservedDebits;
  const totalEarned = rows
    .filter((row) => row.direction === "credit" && row.status === row.bucket)
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);

  return {
    pending,
    available: Math.max(0, availableRaw),
    total: totalEarned,
    totalEarned,
  };
}
