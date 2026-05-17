"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminPageShell, EmptyState, StatusBadge } from "@/components/admin/admin-native";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Loader2,
  Send,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

function money(value: unknown) {
  const amount = Number(value ?? 0);
  return `KSh ${amount.toLocaleString("en-KE")}`;
}

function shortDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
  }).format(date);
}

type Withdrawal = {
  id: string;
  user_id: string;
  amount: number;
  phone: string;
  status: string;
  mpesa_txn_id: string | null;
  failure_reason: string | null;
  b2c_conversation_id: string | null;
  b2c_originator_id: string | null;
  created_at: string;
  processed_at: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

type Counts = Record<string, { count: number; total: number }>;

export default function WithdrawalsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "all";

  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);

  const [b2cModal, setB2cModal] = useState<Withdrawal | null>(null);
  const [sendModal, setSendModal] = useState<Withdrawal | null>(null);
  const [failModal, setFailModal] = useState<Withdrawal | null>(null);
  const [retryModal, setRetryModal] = useState<Withdrawal | null>(null);

  const [mpesaTxnId, setMpesaTxnId] = useState("");
  const [sendReason, setSendReason] = useState("");
  const [failReason, setFailReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  async function fetchWithdrawals() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/withdrawals?status=${tab}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setWithdrawals(data.withdrawals ?? []);
      setCounts(data.counts ?? null);
    } catch {
      toast.error("Failed to load withdrawals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWithdrawals();
  }, [tab]);

  function setTab(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.push(`/wazim/withdrawals?${params.toString()}`);
  }

  async function triggerB2C(withdrawal: Withdrawal) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/withdrawals/${withdrawal.id}/b2c`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "B2C initiation failed");
        return;
      }
      toast.success(`B2C initiated — Conversation: ${data.conversationId}`);
      setB2cModal(null);
      fetchWithdrawals();
    } catch {
      toast.error("Network error");
    } finally {
      setActionLoading(false);
    }
  }

  async function markSent(withdrawal: Withdrawal) {
    if (!mpesaTxnId.trim()) {
      toast.error("M-Pesa transaction ID required");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/withdrawals/${withdrawal.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mpesaTxnId: mpesaTxnId.trim(), reason: sendReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to mark as sent");
        return;
      }
      toast.success("Withdrawal marked as sent");
      setSendModal(null);
      setMpesaTxnId("");
      setSendReason("");
      fetchWithdrawals();
    } catch {
      toast.error("Network error");
    } finally {
      setActionLoading(false);
    }
  }

  async function failWithdrawal(withdrawal: Withdrawal) {
    if (!failReason.trim() || failReason.trim().length < 5) {
      toast.error("Reason must be at least 5 characters");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/withdrawals/${withdrawal.id}/fail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: failReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to fail withdrawal");
        return;
      }
      toast.success("Withdrawal failed and amount reversed");
      setFailModal(null);
      setFailReason("");
      fetchWithdrawals();
    } catch {
      toast.error("Network error");
    } finally {
      setActionLoading(false);
    }
  }

  async function retryWithdrawal(withdrawal: Withdrawal) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/withdrawals/${withdrawal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "requested", reason: "Retry after failure" }),
      });
      if (!res.ok) {
        toast.error("Failed to retry withdrawal");
        return;
      }
      toast.success("Withdrawal reset to requested");
      setRetryModal(null);
      fetchWithdrawals();
    } catch {
      toast.error("Network error");
    } finally {
      setActionLoading(false);
    }
  }

  function openSendModal(w: Withdrawal) {
    setSendModal(w);
    setMpesaTxnId("");
    setSendReason("");
  }

  function openFailModal(w: Withdrawal) {
    setFailModal(w);
    setFailReason("");
  }

  function openB2cModal(w: Withdrawal) {
    setB2cModal(w);
  }

  function openRetryModal(w: Withdrawal) {
    setRetryModal(w);
  }

  const tabs = [
    { key: "all", label: "All" },
    { key: "requested", label: "Requested" },
    { key: "processing", label: "Processing" },
    { key: "sent", label: "Sent" },
    { key: "failed", label: "Failed" },
    { key: "held", label: "Held" },
  ];

  return (
    <AdminPageShell
      admin={{
        userId: "",
        email: null,
        role: "admin",
        adminUserId: "",
      }}
      title="Withdrawals"
      description="Review and process withdrawal requests. Trigger M-Pesa B2C payouts, mark as sent manually, or fail and reverse."
    >
      {counts && (
        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricBox
            label="Total Requested"
            value={`${counts.requested.count}`}
            detail={money(counts.requested.total)}
            tone="blue"
          />
          <MetricBox
            label="Processing"
            value={`${counts.processing.count}`}
            detail={money(counts.processing.total)}
            tone="amber"
          />
          <MetricBox
            label="Paid Out"
            value={`${counts.sent.count}`}
            detail={money(counts.sent.total)}
            tone="teal"
          />
          <MetricBox
            label="Failed"
            value={`${counts.failed.count}`}
            detail={money(counts.failed.total)}
            tone="red"
          />
          <MetricBox
            label="Held"
            value={`${counts.held.count}`}
            detail={money(counts.held.total)}
            tone="red"
          />
        </section>
      )}

      <Card className="border border-outline-variant/40 shadow-sm">
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-lg text-navy">Withdrawal Queue</CardTitle>
            <div className="flex flex-wrap gap-1">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    tab === t.key
                      ? "bg-pesatrix-blue text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {t.label}
                  {counts && counts[t.key] && counts[t.key].count > 0 && (
                    <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">
                      {counts[t.key].count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : withdrawals.length === 0 ? (
            <EmptyState>No withdrawals in this category.</EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Processed</TableHead>
                  <TableHead>M-Pesa TXN</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell>
                      <span className="font-medium text-navy">
                        {w.profiles?.full_name ?? "Unknown"}
                      </span>
                      <p className="text-xs text-muted-foreground">{w.profiles?.email ?? ""}</p>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{w.phone}</TableCell>
                    <TableCell className="font-semibold">{money(w.amount)}</TableCell>
                    <TableCell>
                      <StatusBadge status={w.status} />
                      {w.b2c_conversation_id && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          B2C: {w.b2c_conversation_id.slice(0, 16)}...
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{shortDate(w.created_at)}</TableCell>
                    <TableCell className="text-sm">{shortDate(w.processed_at)}</TableCell>
                    <TableCell>
                      {w.mpesa_txn_id ? (
                        <Badge variant="outline" className="font-mono text-xs">
                          {w.mpesa_txn_id}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-1">
                        {w.status === "requested" && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              className="gap-1 bg-pesatrix-blue text-xs"
                              onClick={() => openB2cModal(w)}
                            >
                              <Send className="h-3 w-3" />
                              Send via B2C
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-xs"
                              onClick={() => openSendModal(w)}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Mark Sent
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="gap-1 text-xs"
                              onClick={() => openFailModal(w)}
                            >
                              <XCircle className="h-3 w-3" />
                              Fail
                            </Button>
                          </>
                        )}
                        {w.status === "processing" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-xs"
                              onClick={() => openSendModal(w)}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Mark Sent
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="gap-1 text-xs"
                              onClick={() => openFailModal(w)}
                            >
                              <XCircle className="h-3 w-3" />
                              Fail
                            </Button>
                          </>
                        )}
                        {w.status === "held" && (
                          <>
                            <Button
                              size="sm"
                              variant="default"
                              className="gap-1 bg-pesatrix-blue text-xs"
                              onClick={() => openB2cModal(w)}
                            >
                              <Send className="h-3 w-3" />
                              Send via B2C
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-xs"
                              onClick={() => openSendModal(w)}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Mark Sent
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="gap-1 text-xs"
                              onClick={() => openFailModal(w)}
                            >
                              <XCircle className="h-3 w-3" />
                              Fail
                            </Button>
                          </>
                        )}
                        {w.status === "sent" && (
                          <span className="text-xs text-muted-foreground">Completed</span>
                        )}
                        {w.status === "failed" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-xs"
                              onClick={() => openRetryModal(w)}
                            >
                              <RefreshCw className="h-3 w-3" />
                              Retry
                            </Button>
                            {w.failure_reason && (
                              <Badge variant="destructive" className="text-[10px]">
                                {w.failure_reason.slice(0, 30)}
                                {w.failure_reason.length > 30 ? "..." : ""}
                              </Badge>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* B2C Confirmation Modal */}
      <Dialog open={!!b2cModal} onOpenChange={(open) => !open && setB2cModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4 text-pesatrix-blue" />
              Confirm B2C Payout
            </DialogTitle>
            <DialogDescription>
              This will trigger an M-Pesa B2C payout via the Daraja API.
            </DialogDescription>
          </DialogHeader>
          {b2cModal && (
            <div className="space-y-3 rounded-lg bg-muted p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">User</span>
                <span className="font-medium">{b2cModal.profiles?.full_name ?? "Unknown"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Phone</span>
                <span className="font-mono">{b2cModal.phone}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-bold text-navy">{money(b2cModal.amount)}</span>
              </div>
            </div>
          )}
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              This action cannot be undone. Ensure the phone number and amount are correct before confirming.
            </span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setB2cModal(null)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button
              onClick={() => b2cModal && triggerB2C(b2cModal)}
              disabled={actionLoading}
              className="bg-pesatrix-blue"
            >
              {actionLoading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Confirm & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Mark Sent Modal */}
      <Dialog open={!!sendModal} onOpenChange={(open) => !open && setSendModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-teal" />
              Mark Withdrawal as Sent
            </DialogTitle>
            <DialogDescription>
              Enter the M-Pesa transaction ID to confirm this withdrawal was sent manually.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mpesa-txn-id">M-Pesa Transaction ID</Label>
              <Input
                id="mpesa-txn-id"
                value={mpesaTxnId}
                onChange={(e) => setMpesaTxnId(e.target.value)}
                placeholder="e.g. QAR1234567"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="send-reason">Reason (optional)</Label>
              <Textarea
                id="send-reason"
                value={sendReason}
                onChange={(e) => setSendReason(e.target.value)}
                placeholder="e.g. Manual B2C via M-Pesa portal"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendModal(null)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button
              onClick={() => sendModal && markSent(sendModal)}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Confirm Sent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fail & Reverse Modal */}
      <Dialog open={!!failModal} onOpenChange={(open) => !open && setFailModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4" />
              Fail & Reverse Withdrawal
            </DialogTitle>
            <DialogDescription>
              This will mark the withdrawal as failed and reverse the debit in the ledger.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="fail-reason">Reason</Label>
            <Textarea
              id="fail-reason"
              value={failReason}
              onChange={(e) => setFailReason(e.target.value)}
              placeholder="e.g. Invalid phone number, insufficient float..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFailModal(null)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => failModal && failWithdrawal(failModal)}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Confirm Fail
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Retry Modal */}
      <Dialog open={!!retryModal} onOpenChange={(open) => !open && setRetryModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry Withdrawal
            </DialogTitle>
            <DialogDescription>
              This will reset the withdrawal status to "requested" so it can be processed again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRetryModal(null)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button
              onClick={() => retryModal && retryWithdrawal(retryModal)}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Confirm Retry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  );
}

function MetricBox({
  label,
  value,
  detail,
  tone = "blue",
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: "blue" | "teal" | "amber" | "red";
}) {
  const toneClass = {
    blue: "border-pesatrix-blue/30 bg-pesatrix-blue/5",
    teal: "border-teal/30 bg-teal/5",
    amber: "border-amber-500/30 bg-amber-500/5",
    red: "border-destructive/30 bg-destructive/5",
  }[tone];

  return (
    <Card className={`border ${toneClass} shadow-sm`}>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-bold text-navy">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
