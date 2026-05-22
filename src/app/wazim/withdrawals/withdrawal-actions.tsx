"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function WithdrawalActions({ withdrawalId }: { withdrawalId: string }) {
  const router = useRouter();
  const [openSent, setOpenSent] = useState(false);
  const [openFail, setOpenFail] = useState(false);
  const [failReason, setFailReason] = useState("");
  const [loading, setLoading] = useState(false);

  async function approveWithdrawal() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/withdrawals/${withdrawalId}/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Failed to approve withdrawal");
        return;
      }
      toast.success("Withdrawal approved and payout request sent");
      setOpenSent(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function markFailed() {
    if (failReason.trim().length < 5) { toast.error("Reason must be at least 5 characters"); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/withdrawals/${withdrawalId}/fail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: failReason.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(data.error ?? "Action failed"); return; }
      toast.success("Withdrawal declined and amount reversed");
      setOpenFail(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2 justify-end">
      {/* Approve and initiate B2C */}
      <Dialog open={openSent} onOpenChange={setOpenSent}>
        <DialogTrigger asChild>
          <Button size="sm" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Approve
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Withdrawal</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will send the payout request to M-Pesa B2C immediately.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenSent(false)}>Cancel</Button>
            <Button onClick={approveWithdrawal} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Confirm Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Failed */}
      <Dialog open={openFail} onOpenChange={setOpenFail}>
        <DialogTrigger asChild>
          <Button size="sm" variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" />
            Fail
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Withdrawal</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="fail-reason">Reason</Label>
            <Input
              id="fail-reason"
              value={failReason}
              onChange={(e) => setFailReason(e.target.value)}
              placeholder="e.g. Incorrect phone number"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenFail(false)}>Cancel</Button>
            <Button variant="destructive" onClick={markFailed} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Confirm Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function WithdrawalEditActions({
  withdrawalId,
  initialAmount,
  initialPhone,
  initialStatus,
}: {
  withdrawalId: string;
  initialAmount: number;
  initialPhone: string;
  initialStatus: string;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(initialAmount));
  const [phone, setPhone] = useState(initialPhone);
  const [status, setStatus] = useState(["requested", "held"].includes(initialStatus) ? initialStatus : "");
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/withdrawals/${withdrawalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          phone,
          ...(status ? { status } : {}),
          reason: "Withdrawal admin update",
        }),
      });
      if (!res.ok) {
        toast.error("Failed to update withdrawal");
        return;
      }
      toast.success("Withdrawal updated");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this withdrawal request?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/withdrawals/${withdrawalId}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to delete withdrawal");
        return;
      }
      toast.success("Withdrawal deleted");
      router.push("/wazim/withdrawals");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr_auto_auto] md:items-end">
      <div className="space-y-2">
        <Label htmlFor="withdrawal-amount">Amount</Label>
        <Input id="withdrawal-amount" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="withdrawal-phone">Phone</Label>
        <Input id="withdrawal-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue placeholder={initialStatus} /></SelectTrigger>
          <SelectContent>
            {["requested", "held"].map((value) => (
              <SelectItem key={value} value={value}>{value}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button onClick={save} disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Save
      </Button>
      <Button variant="destructive" onClick={remove} disabled={loading}>
        <Trash2 className="mr-2 h-4 w-4" />
        Delete
      </Button>
    </div>
  );
}
