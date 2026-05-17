"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Phone, CheckCircle2, AlertCircle } from "lucide-react";
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

const schema = z.object({
  phone: z
    .string()
    .min(10, "Enter a valid phone number")
    .regex(/^(?:\+?254|0)7\d{8}$/, "Enter a valid Kenyan M-Pesa number"),
});

type FormData = z.infer<typeof schema>;

type Step = "form" | "pending" | "success" | "failed";

export default function ActivateClientPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    try {
      const res = await fetch("/api/payments/activation/stk-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: data.phone }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error?.message || "Failed to initiate payment");
        return;
      }

      setStep("success");
      toast.success("Activation completed successfully.");
      window.setTimeout(() => {
        startTransition(() => {
          router.push("/dashboard");
          router.refresh();
        });
      }, 1800);
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy">
          Activate Your Account
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pay a one-time KSh 500 activation fee via M-Pesa to start earning
        </p>
      </div>

      {/* Benefits */}
      <Card className="border-primary/20 bg-accent">
        <CardContent className="pt-6">
          <p className="mb-3 text-sm font-semibold text-foreground">
            What you get after activation:
          </p>
          <ul className="space-y-2 text-sm text-on-surface-variant">
            {[
              "Access to all available earning tasks",
              "3-level referral programme (earn from your network)",
              "Withdraw earnings to M-Pesa any time",
              "Priority support access",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-teal" />
                {item}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Step: Form */}
      {step === "form" && (
        <Card className="border-outline-variant/40">
          <CardHeader>
            <CardTitle className="text-base text-navy">
              M-Pesa Payment - KSh 500
            </CardTitle>
            <CardDescription>
              Enter the M-Pesa number to receive the payment prompt
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="activate-phone">M-Pesa Phone Number</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="activate-phone"
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

              <p className="text-xs text-muted-foreground">
                You will receive an M-Pesa STK push. Enter your PIN to confirm.
                Do not close this page.
              </p>

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Pay KSh 500 via M-Pesa
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Step: Pending */}
      {step === "pending" && (
        <Card className="border-outline-variant/40">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <div>
              <p className="font-semibold text-navy">
                Waiting for payment confirmation
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Check your phone for the M-Pesa prompt and enter your PIN
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Success */}
      {step === "success" && (
        <Card className="border-teal/30 bg-teal/5">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal/10">
              <CheckCircle2 className="h-8 w-8 text-teal" />
            </div>
            <div>
              <p className="font-semibold text-navy">Account activated!</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Redirecting you to your dashboard and training...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Failed */}
      {step === "failed" && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <p className="font-semibold text-navy">Payment failed</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The payment was not completed. Please try again.
              </p>
            </div>
            <Button onClick={() => setStep("form")} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
