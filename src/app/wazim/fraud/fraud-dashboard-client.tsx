"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, Loader2, ShieldCheck, ShieldOff } from "lucide-react";

import { EmptyState, StatusBadge } from "@/components/admin/admin-native";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type FraudMode = "auto" | "manual" | "disabled";

export type FraudDashboardUser = {
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: string | null;
  riskScore: number;
  aiScore: number | null;
  aiReasoning: string | null;
  aiScannedAt: string | null;
  flags: Record<string, unknown>;
  phoneVerified: boolean;
  kycStatus: string;
  status: string;
  suspensionReason: string | null;
  suspendedAt: string | null;
  updatedAt: string | null;
  devices: Array<{
    ip_address?: string | null;
    ip_country?: string | null;
    ip_is_vpn?: boolean | null;
    ip_is_datacenter?: boolean | null;
    created_at?: string | null;
  }>;
  submissions: Array<{
    id: string;
    status: string;
    ai_score: number | null;
    ai_reasoning: string | null;
    submitted_at: string | null;
  }>;
  heldWithdrawals: Array<{
    id: string;
    amount: number;
    status: string;
    created_at: string | null;
  }>;
};

type Filter = "all" | "pending" | "auto_suspended" | "cleared";
type DecisionAction = "confirm_suspend" | "lift_suspend" | "clear_flags";

export function FraudDashboardClient({
  initialMode,
  initialLastCronRun,
  initialUsers,
}: {
  initialMode: FraudMode;
  initialLastCronRun: string | null;
  initialUsers: FraudDashboardUser[];
}) {
  const [mode, setMode] = useState<FraudMode>(initialMode);
  const [lastCronRun, setLastCronRun] = useState<string | null>(initialLastCronRun);
  const [users, setUsers] = useState(initialUsers);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const selectedUser = users.find((user) => user.userId === selectedUserId) ?? null;

  const filteredUsers = useMemo(() => users.filter((user) => matchesFilter(user, filter)), [users, filter]);
  const counts = useMemo(
    () => ({
      all: users.length,
      pending: users.filter((user) => matchesFilter(user, "pending")).length,
      auto_suspended: users.filter((user) => matchesFilter(user, "auto_suspended")).length,
      cleared: users.filter((user) => matchesFilter(user, "cleared")).length,
    }),
    [users]
  );

  async function refreshUsers(nextFilter = filter) {
    const response = await fetch(`/api/admin/fraud/users?filter=${nextFilter}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Failed to refresh fraud users");
    setUsers(data.users ?? []);
  }

  async function updateMode(nextMode: FraudMode) {
    setBusy(`mode:${nextMode}`);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/fraud/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: nextMode }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to update mode");
      setMode(data.mode);
      setMessage(`AI mode set to ${data.mode}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update AI mode.");
    } finally {
      setBusy(null);
    }
  }

  async function runScan(userId: string) {
    setBusy(`scan:${userId}`);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/fraud/review/${userId}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "AI scan failed");
      await refreshUsers();
      setMessage("AI scan completed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI scan failed.");
    } finally {
      setBusy(null);
    }
  }

  async function submitDecision(action: DecisionAction, userId: string) {
    if (!reason.trim()) {
      setMessage("Reason is required.");
      return;
    }

    setBusy(`${action}:${userId}`);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/fraud/decision/${userId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Decision failed");
      await refreshUsers();
      setReason("");
      setMessage(data.warning ?? "Decision saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Decision failed.");
    } finally {
      setBusy(null);
    }
  }

  const modeOptions: Array<{ value: FraudMode; label: string }> = [
    { value: "auto", label: "Auto" },
    { value: "manual", label: "Manual" },
    { value: "disabled", label: "Disabled" },
  ];

  return (
    <div className="space-y-6">
      <Card className="border border-outline-variant/40 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-navy">AI scoring mode</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Current mode: <span className="font-semibold capitalize text-on-surface">{mode}</span>. Last cron run:{" "}
              {formatDate(lastCronRun)}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {modeOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={mode === option.value ? "default" : "outline"}
                disabled={busy?.startsWith("mode:")}
                onClick={() => updateMode(option.value)}
              >
                {busy === `mode:${option.value}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {option.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {message ? (
        <div className="rounded-lg border border-outline-variant/50 bg-white px-4 py-3 text-sm text-on-surface">
          {message}
        </div>
      ) : null}

      <Card className="border border-outline-variant/40 shadow-sm">
        <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle className="text-lg text-navy">Flagged Users</CardTitle>
          <div className="flex flex-wrap gap-2">
            {([
              ["all", "All Flagged", counts.all],
              ["pending", "Pending Review", counts.pending],
              ["auto_suspended", "Auto-Suspended", counts.auto_suspended],
              ["cleared", "Cleared", counts.cleared],
            ] as Array<[Filter, string, number]>).map(([value, label, count]) => (
              <Button
                key={value}
                type="button"
                variant={filter === value ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(value)}
              >
                {label} ({count})
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {filteredUsers.length ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Risk Score</TableHead>
                    <TableHead>AI Score</TableHead>
                    <TableHead>Flags</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow
                      key={user.userId}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedUserId(user.userId);
                        setReason("");
                      }}
                    >
                      <TableCell>
                        <div className="font-semibold text-navy">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{user.email ?? user.userId}</div>
                      </TableCell>
                      <TableCell>{user.phone ?? "Not set"}</TableCell>
                      <TableCell>
                        <ScorePill score={user.riskScore} />
                      </TableCell>
                      <TableCell>
                        {user.aiScore === null ? (
                          <span className="text-sm text-muted-foreground">Not scanned</span>
                        ) : (
                          <ScorePill score={user.aiScore} />
                        )}
                      </TableCell>
                      <TableCell>
                        <FlagBadges flags={user.flags} />
                      </TableCell>
                      <TableCell><StatusBadge status={user.status} /></TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={mode === "disabled" || busy === `scan:${user.userId}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            runScan(user.userId);
                          }}
                        >
                          {busy === `scan:${user.userId}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
                          Scan
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState>No users match this fraud filter.</EmptyState>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedUser)} onOpenChange={(open) => !open && setSelectedUserId(null)}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          {selectedUser ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedUser.name}</DialogTitle>
                <DialogDescription>
                  {selectedUser.phone ?? "No phone"} • Joined {formatDate(selectedUser.createdAt)} • KYC {selectedUser.kycStatus}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 lg:grid-cols-3">
                <DetailMetric label="Rule risk" value={<ScorePill score={selectedUser.riskScore} />} />
                <DetailMetric
                  label="AI risk"
                  value={selectedUser.aiScore === null ? "Not scanned" : <ScorePill score={selectedUser.aiScore} />}
                />
                <DetailMetric label="Account status" value={<StatusBadge status={selectedUser.status} />} />
              </div>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-navy">Flags</h3>
                <FlagBadges flags={selectedUser.flags} expanded />
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-navy">AI Reasoning</h3>
                <div className="rounded-lg border border-outline-variant/50 bg-muted/30 p-3 text-sm leading-6 text-on-surface">
                  {selectedUser.aiReasoning ?? "No AI scan has been run for this user."}
                </div>
              </section>

              {selectedUser.heldWithdrawals.length ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4" />
                  This user has {selectedUser.heldWithdrawals.length} held withdrawal
                  {selectedUser.heldWithdrawals.length === 1 ? "" : "s"}. Lifting suspension will not release funds.
                </div>
              ) : null}

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-navy">Device Sessions</h3>
                <CompactTable
                  headers={["IP", "Country", "VPN", "Date"]}
                  rows={selectedUser.devices.map((device) => [
                    device.ip_address ?? "Hidden",
                    device.ip_country ?? "Unknown",
                    device.ip_is_vpn ? "Yes" : "No",
                    formatDate(device.created_at),
                  ])}
                  empty="No device sessions found."
                />
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-navy">Task Submissions</h3>
                <CompactTable
                  headers={["Status", "AI Score", "Date", "Reasoning"]}
                  rows={selectedUser.submissions.map((submission) => [
                    submission.status,
                    submission.ai_score ?? "Not scored",
                    formatDate(submission.submitted_at),
                    submission.ai_reasoning ?? "No reasoning",
                  ])}
                  empty="No submissions found."
                />
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-navy">Decision Reason</h3>
                <Input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Required for suspension decisions and flag clearing"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={mode === "disabled" || busy === `scan:${selectedUser.userId}`}
                    onClick={() => runScan(selectedUser.userId)}
                  >
                    <Bot className="mr-2 h-4 w-4" />
                    Run AI Scan
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={busy === `confirm_suspend:${selectedUser.userId}`}
                    onClick={() => submitDecision("confirm_suspend", selectedUser.userId)}
                  >
                    <ShieldOff className="mr-2 h-4 w-4" />
                    Confirm Suspension
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy === `lift_suspend:${selectedUser.userId}`}
                    onClick={() => submitDecision("lift_suspend", selectedUser.userId)}
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Lift Suspension
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy === `clear_flags:${selectedUser.userId}`}
                    onClick={() => submitDecision("clear_flags", selectedUser.userId)}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Clear Flags
                  </Button>
                </div>
              </section>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-outline-variant/50 bg-white p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm font-semibold text-navy">{value}</div>
    </div>
  );
}

function ScorePill({ score }: { score: number }) {
  return (
    <Badge variant="outline" className={cn("border-transparent", scoreTone(score))}>
      {score}
    </Badge>
  );
}

function FlagBadges({ flags, expanded = false }: { flags: Record<string, unknown>; expanded?: boolean }) {
  const labels = readableFlags(flags);
  if (!labels.length) return <span className="text-sm text-muted-foreground">No flags</span>;

  return (
    <div className="flex max-w-xl flex-wrap gap-1.5">
      {(expanded ? labels : labels.slice(0, 3)).map((label) => (
        <Badge key={label} variant="outline" className="border-outline-variant/60 bg-white">
          {label}
        </Badge>
      ))}
      {!expanded && labels.length > 3 ? <Badge variant="muted">+{labels.length - 3}</Badge> : null}
    </div>
  );
}

function CompactTable({ headers, rows, empty }: { headers: string[]; rows: Array<Array<ReactNode>>; empty: string }) {
  if (!rows.length) return <EmptyState>{empty}</EmptyState>;

  return (
    <div className="overflow-x-auto rounded-lg border border-outline-variant/50">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((header) => <TableHead key={header}>{header}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>
              {row.map((cell, cellIndex) => <TableCell key={cellIndex}>{cell}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function matchesFilter(user: FraudDashboardUser, filter: Filter) {
  if (filter === "pending") return isFlagged(user) && !user.aiScannedAt && user.status !== "suspended";
  if (filter === "auto_suspended") {
    return user.status === "suspended" && String(user.suspensionReason ?? "").toLowerCase().includes("auto");
  }
  if (filter === "cleared") return user.aiScannedAt !== null && user.riskScore === 0 && (user.aiScore ?? 0) < 40;
  return isFlagged(user);
}

function isFlagged(user: FraudDashboardUser) {
  return user.riskScore >= 40 || (user.aiScore ?? 0) >= 40 || user.status === "suspended" || Object.keys(user.flags).length > 0;
}

function readableFlags(flags: Record<string, unknown>) {
  return Object.entries(flags)
    .filter(([, value]) => value !== false && value !== null && value !== undefined)
    .map(([key, value]) => {
      const label = key
        .replace(/^ip_/, "IP ")
        .replaceAll("_", " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());

      if (value === true) return label;
      if (Array.isArray(value)) return `${label}: ${value.length} linked`;
      if (typeof value === "string" || typeof value === "number") return `${label}: ${value}`;
      return label;
    });
}

function scoreTone(score: number) {
  if (score >= 100) return "bg-red-100 text-red-800";
  if (score >= 70) return "bg-orange-100 text-orange-800";
  if (score >= 40) return "bg-yellow-100 text-yellow-800";
  return "bg-green-100 text-green-800";
}

function formatDate(value: unknown) {
  if (!value) return "Not set";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
  }).format(date);
}
