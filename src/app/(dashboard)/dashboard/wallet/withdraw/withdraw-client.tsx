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

type Limits = {
  minWithdrawal: number;
  maxWithdrawal: number;
};

type FormData = {
  amount: number;
  phone: string;
};

export default function WithdrawClientPage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "success">("form");
  const [withdrawalId, setWithdrawalId] = useState<string | null>(null);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [limitsLoading, setLimitsLoading] = useState(true);

  useEffect(() => {
    async function fetchLimits() {
      try {
        const res = await fetch("/api/wallet/limits");
        const data = await res.json();
        if (res.ok && data.minWithdrawal) {
          setLimits(data);
        }
      } catch (err) {
        console.error("Failed to fetch limits", err);
      } finally {
        setLimitsLoading(false);
      }
    }
    fetchLimits();
  }, []);

  const schema = z.object({
    amount: z
      .number({ required_error: "Enter an amount" })
      .int("Must be a whole number")
      .min(limits?.minWithdrawal ?? 100, `Minimum withdrawal is KSh ${limits?.minWithdrawal ?? 100}`)
      .max(limits?.maxWithdrawal ?? 100000, `Maximum withdrawal is KSh ${(limits?.maxWithdrawal ?? 100000).toLocaleString()}`),
    phone: z
      .string()
      .min(10)
      .regex(/^(?:\+?254|0)7\d{8}$/, "Enter a valid Kenyan M-Pesa number"),
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

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
        } else {
          toast.error(json.error?.message || "Withdrawal failed. Please try again.");
        }
        return;
      }

      setWithdrawalId(json.withdrawalId);
      setStep("success");
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
              Pending earnings become available after a 7-day hold. Processing
              typically takes 1-2 business days after approval.
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
                  placeholder={limitsLoading ? "Loading..." : `Min ${limits?.minWithdrawal ?? 100}`}
                  min={limits?.minWithdrawal ?? 100}
                  disabled={limitsLoading}
                  {...register("amount", { valueAsNumber: true })}
                />
                {errors.amount && (
                  <p className="text-xs text-destructive">
                    {errors.amount.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="withdraw-phone">M-Pesa Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="withdraw-phone"
                    className="pl-10"
                    placeholder="07XX XXX XXX"
                    {...register("phone")}
                  />
                </div>
                {errors.phone && (
                  <p className="text-xs text-destructive">
                    {errors.phone.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
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
                Our team will process your withdrawal within 1-2 business days.
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
