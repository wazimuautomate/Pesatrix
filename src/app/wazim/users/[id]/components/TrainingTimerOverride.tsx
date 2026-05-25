"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type TrainingProgress = {
  status?: string | null;
  current_day?: number | null;
  current_stage?: number | null;
  task_unlock_at?: string | null;
  next_day_unlock_at?: string | null;
};

type EditableField = "task_unlock_at" | "next_day_unlock_at";

export function TrainingTimerOverride({
  userId,
  training,
}: {
  userId: string;
  training: TrainingProgress | null;
}) {
  const router = useRouter();
  const [field, setField] = useState<EditableField | null>(null);
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  function openOverride(nextField: EditableField) {
    setField(nextField);
    setValue(toDatetimeLocal(training?.[nextField] ?? null));
    setReason("");
  }

  function applyOffset(hours: number) {
    setValue(toDatetimeLocal(new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()));
  }

  async function submit(nextValue?: string | null) {
    if (!field) return;
    if (reason.trim().length < 10) {
      toast.error("Reason must be at least 10 characters");
      return;
    }

    setLoading(true);
    try {
      const payloadValue = nextValue === null ? null : new Date(nextValue ?? value).toISOString();
      const response = await fetch(`/api/admin/users/${userId}/training`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [field]: payloadValue,
          reason: reason.trim(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.error?.message ?? payload?.error ?? "Failed to update timer");
        return;
      }

      toast.success("Training timer updated");
      setField(null);
      router.refresh();
    } catch {
      toast.error("Unable to update training timer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Card className="border border-outline-variant/40 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-navy">
            <Clock className="h-5 w-5" />
            Training Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <StatusRow label="Status" value={training?.status ?? "Not started"} />
          <StatusRow label="Current Day" value={training?.current_day ?? "Not set"} />
          <StatusRow label="Current Stage" value={training?.current_stage ?? "Not set"} />
          <TimerRow
            label="Task Unlock"
            value={training?.task_unlock_at}
            emptyLabel="Already Unlocked"
            onOverride={() => openOverride("task_unlock_at")}
            disabled={!training}
          />
          <TimerRow
            label="Next Day Unlock"
            value={training?.next_day_unlock_at}
            emptyLabel="Available Now"
            onOverride={() => openOverride("next_day_unlock_at")}
            disabled={!training}
          />
        </CardContent>
      </Card>

      <Dialog open={Boolean(field)} onOpenChange={(open) => !open && setField(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Training Timer</DialogTitle>
            <DialogDescription>
              This changes the selected user&apos;s timer immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Date and time</Label>
              <Input type="datetime-local" value={value} onChange={(event) => setValue(event.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => applyOffset(0)}>Unlock Now</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => applyOffset(1)}>+1 Hour</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => applyOffset(6)}>+6 Hours</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => applyOffset(24)}>+24 Hours</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => applyOffset(-12)}>-12 Hours</Button>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain why this user's training timer is being changed"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setField(null)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => submit(null)} disabled={loading || !field}>
              Set Available Now
            </Button>
            <Button onClick={() => submit()} disabled={loading || !value || reason.trim().length < 10}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TimerRow({
  disabled,
  emptyLabel,
  label,
  onOverride,
  value,
}: {
  disabled?: boolean;
  emptyLabel: string;
  label: string;
  onOverride: () => void;
  value?: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-outline-variant/30 pb-2">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2 text-right">
        <span className="font-medium text-navy">{value ? new Date(value).toLocaleString() : emptyLabel}</span>
        <Button size="sm" variant="outline" onClick={onOverride} disabled={disabled}>
          Override
        </Button>
      </div>
    </div>
  );
}

function StatusRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex justify-between gap-4 border-b border-outline-variant/30 pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-navy">{String(value ?? "Not set")}</span>
    </div>
  );
}

function toDatetimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
