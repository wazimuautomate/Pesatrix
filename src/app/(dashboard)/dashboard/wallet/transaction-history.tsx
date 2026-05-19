"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { ArrowDownRight, ArrowUpRight, Loader2, RefreshCw } from "lucide-react";
import { formatKSh } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Transaction = {
  id: string;
  type: string;
  direction: "credit" | "debit";
  amount: number;
  status: string;
  bucket: string;
  description: string | null;
  availableAt: string | null;
  createdAt: string;
};

type TransactionHistoryProps = {
  initialHasMore: boolean;
  initialItems: Transaction[];
  initialTotal: number;
};

const typeLabel: Record<string, string> = {
  task_earning: "Task Earning",
  referral_bonus: "Referral Bonus",
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  admin_adjustment: "Adjustment",
  activation_fee: "Activation",
  reward: "Reward",
  reversal: "Reversal",
};

const statusVariant: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  available: "success",
  pending: "warning",
  locked: "secondary",
  reversed: "destructive",
};

type FilterType = "all" | "credit" | "debit";

export default function TransactionHistory({
  initialHasMore,
  initialItems,
  initialTotal,
}: TransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>(initialItems);
  const [loading, setLoading] = useState(initialItems.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [total, setTotal] = useState(initialTotal);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");

  const fetchTransactions = useCallback(async (pageNum: number, isLoadMore = false) => {
    try {
      setError(null);
      const params = new URLSearchParams({ page: pageNum.toString() });
      if (filter !== "all") {
        params.set("direction", filter);
      }

      const res = await fetch(`/api/wallet/transactions?${params}`);
      const data = await res.json();

      if (!res.ok) throw new Error(data.error?.message);

      if (isLoadMore) {
        setTransactions((prev) => [...prev, ...data.items]);
      } else {
        setTransactions(data.items);
      }
      setHasMore(data.hasMore);
      setTotal(data.total);
      setPage(pageNum);
    } catch (err) {
      console.error("Failed to fetch transactions", err);
      setError("Unable to load transaction history right now.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetchTransactions(1, false);
  }, [fetchTransactions]);

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    fetchTransactions(page + 1, true);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-muted" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-3 w-32 bg-muted rounded" />
            </div>
            <div className="h-5 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["all", "credit", "debit"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : f === "credit" ? "Money In" : "Money Out"}
          </Button>
        ))}
      </div>

      {error ? (
        <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <span className="text-destructive">{error}</span>
          <Button variant="outline" size="sm" onClick={() => {
            setLoading(true);
            fetchTransactions(1, false);
          }}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      ) : null}

      {transactions.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No transactions found for this filter.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      tx.direction === "credit"
                        ? "bg-teal/10 text-teal"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {tx.direction === "credit" ? (
                      <ArrowUpRight className="h-4 w-4" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-navy">
                      {typeLabel[tx.type] || tx.type}
                    </p>
                    {tx.description ? (
                      <p className="text-xs text-muted-foreground">{tx.description}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(tx.createdAt), "MMM d, yyyy h:mm a")}
                    </p>
                    {tx.direction === "credit" && tx.status === "pending" && tx.availableAt && (
                      <p className="text-xs text-amber-600">
                        Available {format(new Date(tx.availableAt), "MMM d, yyyy")}
                      </p>
                    )}
                    {tx.direction === "debit" && tx.status === "locked" ? (
                      <p className="text-xs text-muted-foreground">
                        Reserved while withdrawal is being processed
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`font-semibold tabular-nums ${
                      tx.direction === "credit" ? "text-teal" : "text-destructive"
                    }`}
                  >
                    {tx.direction === "credit" ? "+" : "-"}
                    {formatKSh(tx.amount)}
                  </p>
                  <Badge variant={statusVariant[tx.status]} className="text-xs">
                    {tx.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Load more
              </Button>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground">
            Showing {transactions.length} of {total} transactions
          </p>
        </>
      )}
    </div>
  );
}
