"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Loader2,
  Phone,
  ArrowUpRight,
  CheckCircle2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatPhone } from "@/lib/utils";

type Limits = {
  allowedPhone: string | null;
  availableBalance: number;
  minWithdrawal: number;
  maxWithdrawal: number;
  withdrawalFee: number;
  withdrawalHoldDays: number;
  withdrawalProcessingDays: number;
};

type FormData = {
  amount: number;
  phone: string;
};

export default function WithdrawClientPage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "success">("form");
  const [withdrawalId, setWithdrawalId] = useState<string | null>(null);
  const [successSummary, setSuccessSummary] = useState<{
    amountRequested: number;
    fee: number;
    amountToReceive: number;
  } | null>(null);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [limitsLoading, setLimitsLoading] = useState(true);

  const schema = z.object({
    amount: z
      .number({ required_error: "Enter an amount" })
      .int("Must be a whole number")
      .min(limits?.minWithdrawal ?? 200, `Minimum withdrawal is KSh ${limits?.minWithdrawal ?? 200}`)
      .max(limits?.maxWithdrawal ?? 100000, `Maximum withdrawal is KSh ${(limits?.maxWithdrawal ?? 100000).toLocaleString()}`),
    phone: z
      .string()
      .min(10)
      .regex(/^(?:\+?254|0)7\d{8}$/, "Enter a valid Kenyan M-Pesa number"),
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });
  const requestedAmount = Number(watch("amount") || 0);
  const projectedReceive = requestedAmount - (limits?.withdrawalFee ?? 0);
  const balanceBelowMinimum = (limits?.availableBalance ?? 0) < (limits?.minWithdrawal ?? 0);
  const canSubmitWithdrawal =
    !limitsLoading &&
    !balanceBelowMinimum &&
    Boolean(limits?.allowedPhone) &&
    requestedAmount >= (limits?.minWithdrawal ?? 0) &&
    requestedAmount <= (limits?.availableBalance ?? 0) &&
    projectedReceive > 0;

  useEffect(() => {
    async function fetchLimits() {
      try {
        const res = await fetch("/api/wallet/limits");
        const data = await res.json();
        if (res.ok && data.minWithdrawal) {
          setLimits(data);
          if (data.allowedPhone) {
            setValue("phone", data.allowedPhone, { shouldValidate: true });
          }
        }
      } catch (err) {
        console.error("Failed to fetch limits", err);
      } finally {
        setLimitsLoading(false);
      }
    }
    fetchLimits();
  }, [setValue]);

  async function onSubmit(data: FormData) {
    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (!res.ok) {
        if (json.error?.code === "BELOW_MINIMUM" && json.error?.minimum) {
          toast.error(`Minimum withdrawal is KSh ${json.error.minimum.toLocaleString()}`);
        } else if (json.error?.code === "PHONE_MISMATCH" || json.error?.code === "PHONE_NOT_CONFIGURED") {
          toast.error(json.error.message);
        } else {
          toast.error(json.error?.message || "Withdrawal failed. Please try again.");
        }
        return;
      }

      setWithdrawalId(json.withdrawalId);
      setSuccessSummary({
        amountRequested: Number(json.amountRequested ?? data.amount),
        fee: Number(json.fee ?? limits?.withdrawalFee ?? 0),
        amountToReceive: Number(json.amountToReceive ?? 0),
      });
      setStep("success");
      toast.success("Withdrawal request submitted successfully.");
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy">
          Withdraw to M-Pesa
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Withdraw your available earnings to your M-Pesa wallet
        </p>
      </div>

      {/* Info Banner */}
      <Card className="border-primary/20 bg-accent">
        <CardContent className="flex items-start gap-3 pb-4 pt-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div className="text-sm text-on-surface-variant">
            <p className="font-medium text-foreground">
              Withdrawals use your Available balance only.
            </p>
            <p className="mt-0.5">
              Pending earnings become available after a {limits?.withdrawalHoldDays ?? 7}-day hold. Processing
              typically takes {limits?.withdrawalProcessingDays ?? 3} days after approval.
            </p>
            <p className="mt-2 font-medium text-foreground">
              Minimum withdrawal: KSh {limits?.minWithdrawal?.toLocaleString() ?? 200} | Processing fee: KSh {limits?.withdrawalFee?.toLocaleString() ?? 30}
            </p>
          </div>
        </CardContent>
      </Card>

      {step === "form" && (
        <Card className="border-outline-variant/40">
          <CardHeader>
            <CardTitle className="text-base text-navy">
              Withdrawal Details
            </CardTitle>
            <CardDescription>
              Funds will be sent to your M-Pesa number
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="withdraw-amount">Amount (KSh)</Label>
                  {limits && (
                  <span className="text-xs text-muted-foreground">
                    Minimum: KSh {limits.minWithdrawal.toLocaleString()}
                  </span>
                  )}
                </div>
                <Input
                  id="withdraw-amount"
                  type="number"
                  placeholder={limitsLoading ? "Loading..." : `Min ${limits?.minWithdrawal ?? 200}`}
                  min={limits?.minWithdrawal ?? 200}
                  disabled={limitsLoading}
                  {...register("amount", { valueAsNumber: true })}
                />
                {errors.amount && (
                  <p className="text-xs text-destructive">
                    {errors.amount.message}
                  </p>
                )}
                {!errors.amount && requestedAmount > 0 ? (
                  <p className={projectedReceive > 0 ? "text-xs text-muted-foreground" : "text-xs text-destructive"}>
                    You&apos;ll receive KSh {Math.max(projectedReceive, 0).toLocaleString("en-KE")} after KSh {(limits?.withdrawalFee ?? 30).toLocaleString("en-KE")} processing fee
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="withdraw-phone">M-Pesa Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="withdraw-phone"
                    className="pl-10"
                    placeholder={limits?.allowedPhone ? formatPhone(limits.allowedPhone) : "Set phone on profile first"}
                    readOnly
                    disabled={limitsLoading || !limits?.allowedPhone}
                    {...register("phone")}
                  />
                </div>
                {errors.phone && (
                  <p className="text-xs text-destructive">
                    {errors.phone.message}
                  </p>
                )}
                {!errors.phone && limits?.allowedPhone ? (
                  <p className="text-xs text-muted-foreground">
                    Withdrawals are only allowed to your saved profile number: {formatPhone(limits.allowedPhone)}
                  </p>
                ) : null}
                {!errors.phone && !limitsLoading && !limits?.allowedPhone ? (
                  <p className="text-xs text-destructive">
                    Add a valid Safaricom M-Pesa number on your profile before requesting a withdrawal.
                  </p>
                ) : null}
              </div>

              {limits && (
                <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Available balance</span>
                    <span className="font-semibold text-navy">KSh {limits.availableBalance.toLocaleString("en-KE")}</span>
                  </div>
                  {balanceBelowMinimum ? (
                    <p className="mt-2 text-xs font-medium text-destructive">
                      Your available balance must reach KSh {limits.minWithdrawal.toLocaleString("en-KE")} before you can withdraw.
                    </p>
                  ) : null}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || !canSubmitWithdrawal}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                )}
                Request Withdrawal
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {step === "success" && (
        <Card className="border-teal/30 bg-teal/5">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal/10">
              <CheckCircle2 className="h-8 w-8 text-teal" />
            </div>
            <div>
              <p className="font-semibold text-navy">Withdrawal Requested</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Reference: {withdrawalId?.slice(0, 8).toUpperCase()}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Request recorded for KSh {successSummary?.amountRequested.toLocaleString("en-KE") ?? 0}.
              </p>
              {successSummary ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  You&apos;ll receive KSh {successSummary.amountToReceive.toLocaleString("en-KE")} after KSh {successSummary.fee.toLocaleString("en-KE")} processing fee.
                </p>
              ) : null}
              <p className="mt-2 text-sm text-muted-foreground">
                Processing typically takes {limits?.withdrawalProcessingDays ?? 3} days.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard/wallet")}
            >
              Back to Wallet
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
