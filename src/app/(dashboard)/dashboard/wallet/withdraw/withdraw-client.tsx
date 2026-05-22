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
import { motion } from "framer-motion";

type Limits = {
  allowedPhone: string | null;
  availableBalance: number;
  minWithdrawal: number | null;
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

  // New state variables for withdrawals toggle and polling
  const [withdrawalsEnabled, setWithdrawalsEnabled] = useState<boolean | null>(null);
  const [withdrawalErrorReason, setWithdrawalErrorReason] = useState<"disabled" | "configuration_error" | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [polledAmount, setPolledAmount] = useState<number | null>(null);
  const [polledPhone, setPolledPhone] = useState<string | null>(null);

  const configuredMinWithdrawal = limits?.minWithdrawal ?? null;
  const maxWithdrawal = limits?.maxWithdrawal ?? 100000;

  const schema = z.object({
    amount: z
      .number({ required_error: "Enter an amount" })
      .int("Must be a whole number")
      .max(maxWithdrawal, `Maximum withdrawal is KSh ${maxWithdrawal.toLocaleString()}`),
    phone: z
      .string()
      .regex(/^(\+?254|0)[17]\d{8}$/, "Enter a valid Kenyan M-Pesa number starting with 254, 07, or 01"),
  }).superRefine((data, context) => {
    if (configuredMinWithdrawal === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amount"],
        message: "Withdrawals are currently unavailable.",
      });
      return;
    }

    if (data.amount < configuredMinWithdrawal) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amount"],
        message: `Minimum withdrawal is KSh ${configuredMinWithdrawal}`,
      });
    }
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
  const balanceBelowMinimum =
    configuredMinWithdrawal !== null &&
    (limits?.availableBalance ?? 0) < configuredMinWithdrawal;
  const canSubmitWithdrawal =
    !limitsLoading &&
    configuredMinWithdrawal !== null &&
    !balanceBelowMinimum &&
    requestedAmount >= configuredMinWithdrawal &&
    requestedAmount <= (limits?.availableBalance ?? 0) &&
    projectedReceive > 0 &&
    withdrawalsEnabled !== false;

  // 1. FETCH MINIMUM AMOUNT & platform_settings + LIMITS
  useEffect(() => {
    async function fetchLimitsAndSettings() {
      try {
        const [limitsRes, settingsRes] = await Promise.all([
          fetch("/api/wallet/limits"),
          fetch("/api/settings/withdrawal")
        ]);

        const limitsData = await limitsRes.json();
        const settingsData = await settingsRes.json();

        if (settingsRes.ok) {
          setWithdrawalsEnabled(settingsData.withdrawalsEnabled);
          setWithdrawalErrorReason(settingsData.reason || null);
        }

        if (limitsRes.ok) {
          const finalMin =
            typeof limitsData.minWithdrawal === "number" ? limitsData.minWithdrawal : null;
          const mergedLimits = {
            ...limitsData,
            minWithdrawal: finalMin,
          };
          setLimits(mergedLimits);
          if (finalMin === null) {
            setWithdrawalErrorReason("configuration_error");
          }
          
          if (limitsData.allowedPhone) {
            let formattedPhone = limitsData.allowedPhone;
            if (formattedPhone.startsWith("+254")) {
              formattedPhone = formattedPhone.slice(1);
            } else if (formattedPhone.startsWith("0")) {
              formattedPhone = "254" + formattedPhone.slice(1);
            }
            setValue("phone", formattedPhone, { shouldValidate: true });
          }
        }
      } catch (err) {
        console.error("Failed to fetch limits", err);
      } finally {
        setLimitsLoading(false);
      }
    }
    
    fetchLimitsAndSettings();
  }, [setValue]);

  // 4. DUPLICATE WITHDRAWAL LOCK — UI LAYER (CHECK PENDING & POLL ON MOUNT)
  useEffect(() => {
    let activeInterval: NodeJS.Timeout | null = null;

    async function checkPendingStatus() {
      try {
        const res = await fetch("/api/wallet/withdrawals/status");
        const data = await res.json();
        
        if (res.ok && data.hasPending) {
          setIsProcessing(true);
          setProcessingStatus("processing");
          setPolledAmount(data.amount);
          setPolledPhone(data.phone);
          
          activeInterval = setInterval(async () => {
            try {
              const statusRes = await fetch("/api/wallet/withdrawals/status");
              const statusData = await statusRes.json();
              if (statusRes.ok) {
                if (statusData.status === "sent") {
                  clearInterval(activeInterval!);
                  setIsProcessing(false);
                  setProcessingStatus(null);
                  toast.success(`KSh ${statusData.amount} sent to ${statusData.phone}. Check your M-Pesa.`);
                  router.refresh();
                } else if (statusData.status === "failed") {
                  clearInterval(activeInterval!);
                  setIsProcessing(false);
                  setProcessingStatus(null);
                  toast.error("Withdrawal failed. Your balance has been restored.");
                  router.refresh();
                }
              }
            } catch (err) {
              console.error("Polling error", err);
            }
          }, 10000);
        }
      } catch (err) {
        console.error("Failed to check pending withdrawals", err);
      }
    }

    checkPendingStatus();

    return () => {
      if (activeInterval) clearInterval(activeInterval);
    };
  }, [router]);

  async function onSubmit(data: FormData) {
    // 4. DUPLICATE WITHDRAWAL LOCK — DISABLE BUTTON IMMEDIATELY & SHOW STATE
    setIsProcessing(true);
    setProcessingStatus("processing");
    setPolledAmount(data.amount);

    let phoneToSubmit = data.phone.trim();
    if (phoneToSubmit.startsWith("0")) {
      phoneToSubmit = "254" + phoneToSubmit.slice(1);
    }
    setPolledPhone(phoneToSubmit);

    try {
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: data.amount,
          phone: phoneToSubmit,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setIsProcessing(false);
        setProcessingStatus(null);
        toast.error(json.error?.message || json.message || "Withdrawal failed. Please try again.");
        return;
      }

      setWithdrawalId(json.withdrawalId);
      setSuccessSummary({
        amountRequested: Number(json.amountRequested ?? data.amount),
        fee: Number(json.fee ?? limits?.withdrawalFee ?? 0),
        amountToReceive: Number(json.amountToReceive ?? 0),
      });

      toast.success("Withdrawal initiated. Processing payment...");

      // Start polling status every 10 seconds
      const activeInterval = setInterval(async () => {
        try {
          const statusRes = await fetch("/api/wallet/withdrawals/status");
          const statusData = await statusRes.json();
          if (statusRes.ok) {
            if (statusData.status === "sent") {
              clearInterval(activeInterval);
              setIsProcessing(false);
              setProcessingStatus(null);
              toast.success(`KSh ${statusData.amount} sent to ${statusData.phone}. Check your M-Pesa.`);
              router.refresh();
              setStep("success");
            } else if (statusData.status === "failed") {
              clearInterval(activeInterval);
              setIsProcessing(false);
              setProcessingStatus(null);
              toast.error("Withdrawal failed. Your balance has been restored.");
              router.refresh();
            }
          }
        } catch (err) {
          console.error("Polling error", err);
        }
      }, 10000);

    } catch {
      setIsProcessing(false);
      setProcessingStatus(null);
      toast.error("Something went wrong. Please try again.");
    }
  }

  // 2. BLOCK UI IF NOT CONFIGURED OR EXPLICITLY DISABLED
  if (!limitsLoading && (!limits || withdrawalsEnabled === false || withdrawalErrorReason !== null || limits.minWithdrawal === null)) {
    const isConfigError = withdrawalErrorReason === "configuration_error" || !limits || limits.minWithdrawal === null;
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

        <Card className="border-destructive/20 bg-destructive/5 text-destructive">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <Info className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <p className="font-semibold text-navy">
                {isConfigError ? "Withdrawals Unavailable" : "Withdrawals Temporarily Disabled"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                {isConfigError
                  ? "Withdrawals are currently unavailable. Please contact support."
                  : "Due to high traffic on our servers, withdrawal has been disabled. Try again later."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Processing screen for Polling State
  if (isProcessing) {
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

        <Card className="border-primary/20 bg-accent animate-pulse">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div>
              <p className="font-semibold text-navy">Withdrawal Processing</p>
              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                Withdrawal processing... You will receive M-Pesa confirmation shortly.
              </p>
              {polledAmount !== null && (
                <p className="mt-2 text-xs font-semibold text-navy">
                  Amount: KSh {polledAmount.toLocaleString("en-KE")} {polledPhone && `to ${formatPhone(polledPhone)}`}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
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
              Minimum withdrawal: KSh {configuredMinWithdrawal?.toLocaleString() ?? "N/A"} | Processing fee: KSh {limits?.withdrawalFee?.toLocaleString() ?? 30}
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
                  {configuredMinWithdrawal !== null && (
                    <span className="text-xs text-muted-foreground">
                      Minimum: KSh {configuredMinWithdrawal.toLocaleString()}
                    </span>
                  )}
                </div>
                <Input
                  id="withdraw-amount"
                  type="number"
                  placeholder={limitsLoading ? "Loading..." : `Min ${configuredMinWithdrawal ?? ""}`}
                  min={configuredMinWithdrawal ?? undefined}
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
                    placeholder="Enter M-Pesa phone number"
                    disabled={limitsLoading}
                    {...register("phone", {
                      onChange: (e) => {
                        let val = e.target.value.trim();
                        if (val.startsWith("0") && val.length >= 10) {
                          val = "254" + val.slice(1);
                          setValue("phone", val, { shouldValidate: true });
                        }
                      }
                    })}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Use format: 254XXXXXXXXX, 07XXXXXXXX, or 01XXXXXXXX (07 or 01 will auto-format to 254)
                </p>
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
              </div>

              {limits && (
                <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Available balance</span>
                    <span className="font-semibold text-navy">KSh {limits.availableBalance.toLocaleString("en-KE")}</span>
                  </div>
                  {balanceBelowMinimum ? (
                    <p className="mt-2 text-xs font-medium text-destructive">
                      Your available balance must reach KSh {configuredMinWithdrawal?.toLocaleString("en-KE")} before you can withdraw.
                    </p>
                  ) : null}
                </div>
              )}

              {/* 6. LOADING STATE WITH FRAMER MOTION whileTap */}
              <motion.div whileTap={{ scale: 0.97 }}>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting || isProcessing || !canSubmitWithdrawal}
                >
                  {isSubmitting || isProcessing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUpRight className="mr-2 h-4 w-4" />
                  )}
                  Request Withdrawal
                </Button>
              </motion.div>
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
