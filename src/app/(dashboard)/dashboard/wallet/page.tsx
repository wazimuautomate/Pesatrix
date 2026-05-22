import { createServerSupabaseClient } from "@/lib/supabase/server";
import { formatKSh } from "@/lib/utils";
import { getWithdrawalHoldDays } from "@/lib/platform-settings";
import { getMinWithdrawalAmount, getWithdrawalFeeAmount } from "@/lib/withdrawals";
import { getWalletSummaryForUser, getWalletTransactionsForUser } from "@/lib/wallet";
import {
  Wallet as WalletIcon,
  ArrowUpRight,
  Clock,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import TransactionHistory from "./transaction-history";

export const metadata = { title: "Wallet" };

export default async function WalletPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [wallet, withdrawalHoldDays, minWithdrawal, withdrawalFee, initialTransactions] = await Promise.all([
    getWalletSummaryForUser(user!.id),
    getWithdrawalHoldDays(),
    getMinWithdrawalAmount(),
    getWithdrawalFeeAmount(),
    getWalletTransactionsForUser(user!.id),
  ]);
  const canWithdraw = minWithdrawal !== null && wallet.available >= minWithdrawal;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy">
            Wallet
          </h1>
          <p className="text-sm text-muted-foreground">
            Your earnings and transaction history
          </p>
        </div>
        {canWithdraw ? (
          <Button asChild>
            <Link href="/dashboard/wallet/withdraw">
              Withdraw to M-Pesa
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <Button disabled>
            Withdraw to M-Pesa
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm text-muted-foreground">
        Minimum withdrawal: {minWithdrawal !== null ? formatKSh(minWithdrawal) : "Unavailable (Contact Support)"} | Processing fee: {formatKSh(withdrawalFee)}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-primary/20 bg-accent">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <WalletIcon className="h-4 w-4 text-primary" />
              Available Balance
            </div>
            <p className="mt-2 text-3xl font-bold tabular-nums text-navy">
              {formatKSh(wallet.available)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Available (withdrawable)
            </p>
          </CardContent>
        </Card>

        <Card className="border-outline-variant/40">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 text-on-surface-variant" />
              Pending Balance
            </div>
            <p className="mt-2 text-3xl font-bold tabular-nums text-navy">
              {formatKSh(wallet.pending)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pending (held)
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Pending funds are held for {withdrawalHoldDays} days before becoming withdrawable.
            </p>
          </CardContent>
        </Card>

        <Card className="border-outline-variant/40">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowUpRight className="h-4 w-4 text-teal" />
              Total Earned
            </div>
            <p className="mt-2 text-3xl font-bold tabular-nums text-navy">
              {formatKSh(wallet.totalEarned)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Lifetime earnings
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-outline-variant/40">
        <CardHeader>
          <CardTitle className="text-base text-navy">
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionHistory
            initialItems={initialTransactions.items}
            initialHasMore={initialTransactions.hasMore}
            initialTotal={initialTransactions.total}
          />
        </CardContent>
      </Card>
    </div>
  );
}
