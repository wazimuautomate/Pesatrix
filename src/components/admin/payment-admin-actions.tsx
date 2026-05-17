"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function PaymentAdminActions({
  paymentId,
  initialStatus,
  initialReceipt,
}: {
  paymentId: string;
  initialStatus: string;
  initialReceipt?: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [mpesaReceipt, setMpesaReceipt] = useState(initialReceipt ?? "");
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, mpesaReceipt, reason: "Payment status update" }),
      });
      if (!response.ok) {
        toast.error("Failed to update payment");
        return;
      }
      toast.success("Payment updated");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this payment record?")) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/payments/${paymentId}`, { method: "DELETE" });
      if (!response.ok) {
        toast.error("Failed to delete payment");
        return;
      }
      toast.success("Payment deleted");
      router.push("/wazim/payments");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {["pending", "paid", "failed", "reversed"].map((value) => (
              <SelectItem key={value} value={value}>{value}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="mpesa-receipt">M-Pesa receipt</Label>
        <Input id="mpesa-receipt" value={mpesaReceipt} onChange={(event) => setMpesaReceipt(event.target.value)} />
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
