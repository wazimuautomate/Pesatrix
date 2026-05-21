"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Loader2, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageTransition } from "@/components/ui/PageTransition";
import { formatKSh } from "@/lib/utils";

const schema = z.object({
  phone: z
    .string()
    .min(10, "Enter a valid phone number")
    .regex(/^(?:\+?254|0)[17]\d{8}$/, "Enter a valid Kenyan M-Pesa number"),
});

type FormData = z.infer<typeof schema>;

type ActivateClientPageProps = {
  activationFeeKsh: number;
  defaultPhone?: string;
  isLoggedIn: boolean;
};

type Notice = {
  tone: "info" | "error";
  message: string;
};

const COUNTDOWN_SECONDS = 90;

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

export default function ActivateClientPage({
  activationFeeKsh,
  defaultPhone = "",
  isLoggedIn,
}: ActivateClientPageProps) {
  const router = useRouter();
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(COUNTDOWN_SECONDS);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      phone: defaultPhone,
    },
  });

  function resetPendingState() {
    setPendingOpen(false);
    setPaymentId(null);
    setTimeLeft(COUNTDOWN_SECONDS);
    setPollError(null);
  }

  function cancelPendingPayment(reason: "cancelled" | "timeout") {
    resetPendingState();
    setNotice({
      tone: "error",
      message:
        reason === "timeout"
          ? "Payment timed out. Please try again."
          : "Payment cancelled. You can try again.",
    });
  }

  useEffect(() => {
    if (!pendingOpen) {
      return;
    }

    const timer = window.setInterval(() => {
      setTimeLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [pendingOpen]);

  useEffect(() => {
    if (!pendingOpen || !paymentId) {
      return;
    }

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/payments/activation/${paymentId}/status`, {
          cache: "no-store",
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload?.error ?? "Could not verify payment status.");
        }

        if (payload.status === "paid" || payload.status === "completed") {
          resetPendingState();
          toast.success("Activation successful.");
          router.push("/dashboard");
          router.refresh();
          return;
        }

        if (payload.status === "failed" || payload.status === "cancelled" || payload.status === "expired") {
          resetPendingState();
          setNotice({
            tone: "error",
            message: "Payment cancelled. You can try again.",
          });
        }
      } catch (error) {
        setPollError(error instanceof Error ? error.message : "Could not verify payment status.");
      }
    };

    const interval = window.setInterval(() => {
      void pollStatus();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [paymentId, pendingOpen, router]);

  useEffect(() => {
    if (pendingOpen && timeLeft === 0) {
      cancelPendingPayment("timeout");
    }
  }, [pendingOpen, timeLeft]);

  async function onSubmit(data: FormData) {
    setNotice(null);
    setPollError(null);

    try {
      const response = await fetch("/api/payments/activation/stk-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: data.phone }),
      });

      const payload = await response.json();

      if (!response.ok) {
        if (payload.alreadyActivated) {
          toast.success("Account is already active.");
          router.push("/dashboard");
          router.refresh();
          return;
        }

        toast.error(payload?.error?.message || "Could not complete activation right now");
        return;
      }

      setPaymentId(payload.paymentId);
      setTimeLeft(COUNTDOWN_SECONDS);
      setPendingOpen(true);
      toast.success(payload.message || "Check your phone for the M-Pesa prompt");
    } catch {
      toast.error("Could not complete activation right now");
    }
  }

  if (!isLoggedIn) {
    return (
      <PageTransition className="mx-auto max-w-sm px-4 py-10">
        <div className="space-y-4 rounded-3xl border border-outline-variant/40 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-navy">One Payment. Lifetime Access.</h1>
          <p className="text-sm text-muted-foreground">Sign in first so we can attach your activation to the right account.</p>
          <motion.div whileTap={{ scale: 0.97 }}>
            <Button asChild className="w-full">
              <Link href="/login">Go to Login</Link>
            </Button>
          </motion.div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="mx-auto max-w-sm px-4 py-8 sm:py-12">
      <div className="space-y-6">
        <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Activate earnings</p>
          <h1 className="mt-3 text-3xl font-bold leading-tight text-navy">One Payment. Lifetime Access.</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Unlock live tasks, wallet payouts, and referrals with a one-time activation fee of {formatKSh(activationFeeKsh)}.
          </p>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className="rounded-3xl border border-outline-variant/40 bg-white p-6 shadow-sm"
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="activate-phone">M-Pesa phone number</Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="activate-phone"
                  className="w-full pl-10"
                  placeholder="07XX XXX XXX"
                  {...register("phone")}
                />
              </div>
              {errors.phone ? <p className="text-xs text-destructive">{errors.phone.message}</p> : null}
            </div>

            {notice ? (
              <div
                className={`rounded-2xl px-4 py-3 text-sm ${
                  notice.tone === "error" ? "bg-red-50 text-red-700" : "bg-accent text-foreground"
                }`}
              >
                {notice.message}
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground">
              Enter the number that will receive the M-Pesa STK push.
            </p>

            <motion.div whileTap={{ scale: 0.97 }}>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Trigger STK Push
              </Button>
            </motion.div>
          </form>
        </motion.section>
      </div>

      <Dialog
        open={pendingOpen}
        onOpenChange={(open) => {
          if (!open) {
            cancelPendingPayment("cancelled");
          }
        }}
      >
        <DialogContent className="max-h-[80vh] max-w-sm overflow-y-auto p-6">
          <DialogHeader className="text-left">
            <DialogTitle>Waiting for payment</DialogTitle>
            <DialogDescription>
              Waiting for payment... {formatCountdown(timeLeft)} remaining
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-2xl bg-accent px-4 py-4 text-sm text-muted-foreground">
            Confirm the STK push on your phone. We check payment status every 5 seconds and will close this automatically after 90 seconds.
          </div>

          {pollError ? <p className="text-sm text-destructive">{pollError}</p> : null}

          <DialogFooter className="gap-2 sm:flex-col">
            <motion.div whileTap={{ scale: 0.97 }} className="w-full">
              <Button variant="outline" className="w-full" onClick={() => cancelPendingPayment("cancelled")}>
                Cancel
              </Button>
            </motion.div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
