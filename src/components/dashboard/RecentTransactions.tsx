"use client";

import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatKSh } from "@/lib/utils";

type RecentTransaction = {
  id: string;
  type: string | null;
  direction: string | null;
  amount: number;
  status: string | null;
  created_at: string;
};

function formatTransactionLabel(type: string | null) {
  if (!type) {
    return "Wallet transaction";
  }

  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusClass(status: string | null) {
  switch (status) {
    case "completed":
    case "paid":
      return "bg-green-100 text-green-700";
    case "pending":
      return "bg-yellow-100 text-yellow-700";
    case "failed":
    case "declined":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export function RecentTransactions({ transactions }: { transactions: RecentTransaction[] }) {
  if (!transactions.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No transactions yet. Complete your first task to start earning.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((transaction, index) => {
        const isCredit = transaction.direction === "credit" || transaction.amount > 0;

        return (
          <motion.div
            key={transaction.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: index * 0.05 }}
            className="flex items-center justify-between gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container-low px-3 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  isCredit ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600"
                }`}
              >
                {isCredit ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-navy">{formatTransactionLabel(transaction.type)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge className={statusClass(transaction.status)}>
                    {(transaction.status ?? "unknown").replace(/_/g, " ")}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(transaction.created_at).toLocaleDateString("en-KE", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
            </div>
            <span className={`shrink-0 text-sm font-bold tabular-nums ${isCredit ? "text-green-600" : "text-red-600"}`}>
              {isCredit ? "+" : "-"}
              {formatKSh(Math.abs(transaction.amount))}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
