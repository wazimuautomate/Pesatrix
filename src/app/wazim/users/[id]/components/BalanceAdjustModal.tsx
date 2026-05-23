"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import { Textarea } from "@/components/ui/textarea";

export function BalanceAdjustModal({
  userId,
  currentAvailableBalance,
  open,
  onOpenChange,
}: {
  userId: string;
  currentAvailableBalance: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [internalOpen, setInternalOpen] = useState(false);
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  useEffect(() => {
    if (searchParams.get("adjust") === "1") {
      setOpen(true);
    }
  }, [searchParams, setOpen]);

  async function submit() {
    const parsedAmount = Number(amount);
    if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter a whole KSh amount");
      return;
    }
    if (reason.trim().length < 10) {
      toast.error("Reason must be at least 10 characters");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/adjust-balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction, amount: parsedAmount, reason: reason.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message ?? data.error ?? "Adjustment failed");
      }

      toast.success("Balance adjusted");
      setOpen(false);
      setAmount("");
      setReason("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Adjustment failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Balance</DialogTitle>
          <DialogDescription>
            Current available balance: KSh {currentAvailableBalance.toLocaleString("en-KE")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={direction === "credit" ? "default" : "outline"} onClick={() => setDirection("credit")}>
              Credit
            </Button>
            <Button type="button" variant={direction === "debit" ? "default" : "outline"} onClick={() => setDirection("debit")}>
              Debit
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="adjust-amount">Amount</Label>
            <Input id="adjust-amount" type="number" min="1" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="adjust-reason">Reason</Label>
            <Textarea id="adjust-reason" rows={4} value={reason} onChange={(event) => setReason(event.target.value)} />
            <p className="text-xs text-muted-foreground">{reason.length}/500 characters, minimum 10.</p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
