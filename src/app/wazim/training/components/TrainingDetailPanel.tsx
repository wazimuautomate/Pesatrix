"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCircle, Eye, Loader2, Lock, RotateCcw, Save, Unlock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type DayBreakdown = {
  day: number;
  is_completed: boolean;
  is_current: boolean;
  is_locked: boolean;
  stages: { stage: number; attempts: number }[];
};

type DetailData = {
  profile: { full_name: string | null; phone: string | null; email: string | null } | null;
  training_progress: {
    status: "not_started" | "in_progress" | "awaiting_test" | "completed";
    current_day: number;
    current_stage: number;
    stage_attempt: number;
    completed_days: number[];
    failed_stage_attempts: Record<string, number>;
    next_day_unlock_at: string | null;
    last_completed_at: string | null;
    completed_at: string | null;
    reward_transaction_id: string | null;
    created_at: string;
    updated_at: string;
  } | null;
  day_breakdown: DayBreakdown[];
  reward_transaction: { id: string; amount: number; status: string; created_at: string } | null;
};

type EditFormState = {
  status: "not_started" | "in_progress" | "awaiting_test" | "completed";
  currentDay: string;
  currentStage: string;
  stageAttempt: string;
};

export function TrainingDetailPanel({ userId, adminRole }: { userId: string; adminRole: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [form, setForm] = useState<EditFormState>({
    status: "not_started",
    currentDay: "1",
    currentStage: "1",
    stageAttempt: "1",
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [countdown, setCountdown] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/training/${userId}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load training detail");
      }
      setData(payload);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load training detail");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (open) {
      void fetchData();
    } else {
      setData(null);
      setCountdown(null);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [fetchData, open]);

  useEffect(() => {
    const tp = data?.training_progress;
    if (!tp) return;

    setForm({
      status: tp.status,
      currentDay: String(tp.current_day ?? 1),
      currentStage: String(tp.current_stage ?? 1),
      stageAttempt: String(tp.stage_attempt ?? 1),
    });
  }, [data]);

  useEffect(() => {
    const unlockAt = data?.training_progress?.next_day_unlock_at;
    if (!unlockAt || !open) return;

    const target = new Date(unlockAt);
    if (target <= new Date()) {
      setCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const diff = target.getTime() - Date.now();
      if (diff <= 0) {
        setCountdown(null);
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setCountdown(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateCountdown();
    intervalRef.current = setInterval(updateCountdown, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [data?.training_progress?.next_day_unlock_at, open]);

  const tp = data?.training_progress;
  const profile = data?.profile;
  const displayName = profile?.full_name ?? profile?.email ?? userId.slice(0, 8);
  const completedDays = useMemo(
    () => (Array.isArray(tp?.completed_days) ? [...tp.completed_days].sort((a, b) => a - b) : []),
    [tp?.completed_days]
  );
  const progressPercent = Math.min((completedDays.length / 7) * 100, 100);
  const isTimeLocked = tp?.next_day_unlock_at ? new Date(tp.next_day_unlock_at) > new Date() : false;

  async function handlePatch(body: Record<string, unknown>, successMessage: string) {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/training/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? payload?.error ?? "Training update failed");
      }
      toast.success(successMessage);
      await fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Training update failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleUnlock() {
    setUnlocking(true);
    try {
      const response = await fetch(`/api/admin/training/${userId}/unlock`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to unlock next day");
      }
      toast.success("Next day unlocked");
      await fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unlock next day");
    } finally {
      setUnlocking(false);
    }
  }

  function saveProgress() {
    void handlePatch(
      {
        action: "adjust_progress",
        status: form.status,
        currentDay: Number(form.currentDay),
        currentStage: Number(form.currentStage),
        stageAttempt: Number(form.stageAttempt),
        reason: "Admin manual training progress adjustment",
      },
      "Training progress updated"
    );
  }

  function resetProgress() {
    if (!window.confirm(`Reset training progress for ${displayName}?`)) return;
    void handlePatch(
      {
        action: "reset_progress",
        reason: "Admin reset training progress",
      },
      "Training progress reset"
    );
  }

  function markCompleted() {
    if (!window.confirm(`Mark training completed for ${displayName} and credit any missing reward?`)) return;
    void handlePatch(
      {
        action: "mark_completed",
        reason: "Admin marked training completed",
      },
      "Training marked as completed"
    );
  }

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} title="View detail">
        <Eye className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : data ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{displayName}</DialogTitle>
                <DialogDescription className="space-y-1">
                  {profile?.phone && <p>{profile.phone}</p>}
                  {profile?.email && <p className="text-xs">{profile.email}</p>}
                  {tp && (
                    <div className="mt-2 flex items-center gap-2">
                      <StatusBadge status={tp.status} />
                      <span className="text-xs text-muted-foreground">
                        Last activity: {formatDate(tp.last_completed_at || tp.updated_at)}
                      </span>
                    </div>
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <div className="rounded-lg border bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Progress</p>
                      <p className="text-2xl font-bold text-navy">{completedDays.length} of 7 days completed</p>
                    </div>
                    <p className="text-3xl font-bold text-pesatrix-blue">{Math.round(progressPercent)}%</p>
                  </div>
                  <Progress value={progressPercent} className="mt-3 h-3" />
                  {completedDays.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Completed days: {completedDays.join(", ")}
                    </p>
                  )}
                  {isTimeLocked && (
                    <div className="mt-3 flex items-center gap-2 text-amber-700">
                      <Lock className="h-4 w-4" />
                      <span className="text-sm">
                        Unlock pending until {formatDate(tp?.next_day_unlock_at ?? "")}
                        {countdown ? ` (${countdown})` : ""}
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid gap-4 rounded-lg border bg-white p-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={form.status}
                      onValueChange={(value: EditFormState["status"]) =>
                        setForm((current) => ({ ...current, status: value }))
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_started">Not Started</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="awaiting_test">Awaiting Test</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Current Day</Label>
                    <Input
                      type="number"
                      min={1}
                      max={7}
                      value={form.currentDay}
                      onChange={(event) => setForm((current) => ({ ...current, currentDay: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Current Stage</Label>
                    <Input
                      type="number"
                      min={1}
                      max={3}
                      value={form.currentStage}
                      onChange={(event) => setForm((current) => ({ ...current, currentStage: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Attempt</Label>
                    <Input
                      type="number"
                      min={1}
                      max={50}
                      value={form.stageAttempt}
                      onChange={(event) => setForm((current) => ({ ...current, stageAttempt: event.target.value }))}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={saveProgress} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save progress
                  </Button>
                  <Button size="sm" variant="outline" onClick={resetProgress} disabled={saving}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset
                  </Button>
                  {tp?.status !== "completed" && (
                    <Button size="sm" variant="default" onClick={markCompleted} disabled={saving}>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Mark completed
                    </Button>
                  )}
                  {isTimeLocked && (
                    <Button size="sm" variant="outline" onClick={handleUnlock} disabled={unlocking}>
                      {unlocking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unlock className="mr-2 h-4 w-4" />}
                      Unlock next day
                    </Button>
                  )}
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-semibold text-navy">Day-by-day breakdown</h3>
                  <div className="space-y-2">
                    {data.day_breakdown.map((day) => (
                      <DayCard key={day.day} day={day} />
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/30 p-4">
                  <h3 className="mb-2 text-sm font-semibold text-navy">Reward</h3>
                  {tp?.reward_transaction_id && data.reward_transaction ? (
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>
                          Credited on {formatDate(data.reward_transaction.created_at)} - KSh {data.reward_transaction.amount}
                        </span>
                      </div>
                      <p className="pl-6 text-xs text-muted-foreground">
                        Transaction ID: {tp.reward_transaction_id}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No reward transaction linked yet.</p>
                  )}
                </div>
              </div>

              <DialogFooter className="pt-4">
                <DialogClose asChild>
                  <Button variant="outline" size="sm">Close</Button>
                </DialogClose>
              </DialogFooter>
            </>
          ) : (
            <div className="py-8 text-center text-muted-foreground">Failed to load training detail.</div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function DayCard({ day }: { day: DayBreakdown }) {
  const [expanded, setExpanded] = useState(day.is_current);

  return (
    <div
      className={`rounded-lg border p-3 ${
        day.is_current
          ? "border-pesatrix-blue bg-pesatrix-blue/5"
          : day.is_completed
            ? "border-green-200 bg-green-50/50"
            : "border-outline-variant/40"
      }`}
    >
      <button className="flex w-full items-center justify-between text-left" onClick={() => setExpanded((current) => !current)}>
        <div className="flex items-center gap-2">
          {day.is_completed ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : day.is_locked ? (
            <Lock className="h-4 w-4 text-muted-foreground" />
          ) : (
            <span className="inline-flex h-4 w-4 rounded-full bg-pesatrix-blue" />
          )}
          <span className={`text-sm font-medium ${day.is_current ? "text-pesatrix-blue" : ""}`}>Day {day.day}</span>
          {day.is_completed && <span className="text-xs text-green-600">Completed</span>}
          {day.is_current && <span className="text-xs text-pesatrix-blue">Current</span>}
          {day.is_locked && <span className="text-xs text-muted-foreground">Locked</span>}
        </div>
        <span className="text-xs text-muted-foreground">{expanded ? "-" : "+"}</span>
      </button>
      {expanded && (
        <div className="mt-2 ml-6 space-y-1">
          {day.stages.map((stage) => (
            <div key={stage.stage} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Stage {stage.stage}</span>
              {stage.attempts > 0 ? (
                <Badge variant="destructive">{stage.attempts} failed attempt{stage.attempts > 1 ? "s" : ""}</Badge>
              ) : (
                <span className="text-muted-foreground">No failures</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { variant: "muted" | "warning" | "success"; className?: string }> = {
    not_started: { variant: "muted" },
    in_progress: { variant: "muted", className: "bg-pesatrix-blue text-white border-transparent" },
    awaiting_test: { variant: "warning" },
    completed: { variant: "success" },
  };

  const style = styles[status] ?? { variant: "muted" as const };

  return (
    <Badge variant={style.variant} className={style.className}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

function formatDate(value: string) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
  }).format(date);
}
