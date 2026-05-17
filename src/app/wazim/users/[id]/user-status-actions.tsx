"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldAlert, ShieldCheck, ShieldX, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ActionOption = {
  value: "suspended" | "banned" | "active";
  label: string;
  icon: React.ReactNode;
  variant: "destructive" | "outline" | "default";
  description: string;
};

const ACTIONS: ActionOption[] = [
  {
    value: "suspended",
    label: "Suspend",
    icon: <ShieldAlert className="h-4 w-4" />,
    variant: "destructive",
    description: "Temporarily block user access and withdrawals",
  },
  {
    value: "banned",
    label: "Ban",
    icon: <ShieldX className="h-4 w-4" />,
    variant: "destructive",
    description: "Permanently ban user from the platform",
  },
  {
    value: "active",
    label: "Reactivate",
    icon: <ShieldCheck className="h-4 w-4" />,
    variant: "default",
    description: "Restore user access and remove restrictions",
  },
];

export function UserStatusActions({
  userId,
  currentStatus,
  variant = "default",
}: {
  userId: string;
  currentStatus: string;
  variant?: "default" | "danger";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ActionOption | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const isSuspended = currentStatus === "suspended";
  const isBanned = currentStatus === "banned";
  const isRestricted = isSuspended || isBanned;

  function openAction(action: ActionOption) {
    setSelectedAction(action);
    setReason("");
    setOpen(true);
  }

  async function handleSubmit() {
    if (!selectedAction) return;
    if (!reason.trim()) {
      toast.error("A reason is required for the audit log");
      return;
    }
    if (reason.trim().length < 5) {
      toast.error("Reason must be at least 5 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: selectedAction.value, reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Action failed");
        return;
      }
      toast.success(`User ${selectedAction.label.toLowerCase()}ed successfully`);
      setOpen(false);
      setSelectedAction(null);
      setReason("");
      router.refresh();
    } catch {
      toast.error("Network error — try again");
    } finally {
      setLoading(false);
    }
  }

  if (variant === "danger") {
    return (
      <div className="flex flex-wrap gap-2">
        {!isRestricted && (
          <>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => openAction(ACTIONS[0])}
            >
              <ShieldAlert className="mr-1 h-4 w-4" />
              Suspend
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => openAction(ACTIONS[1])}
            >
              <ShieldX className="mr-1 h-4 w-4" />
              Ban
            </Button>
          </>
        )}
        {isRestricted && (
          <Button
            variant="default"
            size="sm"
            onClick={() => openAction(ACTIONS[2])}
          >
            <ShieldCheck className="mr-1 h-4 w-4" />
            Reactivate
          </Button>
        )}
        <ActionDialog
          open={open}
          onOpenChange={setOpen}
          action={selectedAction}
          reason={reason}
          onReasonChange={setReason}
          onSubmit={handleSubmit}
          loading={loading}
        />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-1">
        {!isRestricted && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => openAction(ACTIONS[0])}
          >
            <ShieldAlert className="mr-1 h-4 w-4" />
            Suspend
          </Button>
        )}
        {isRestricted && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => openAction(ACTIONS[2])}
          >
            <ShieldCheck className="mr-1 h-4 w-4" />
            Reactivate
          </Button>
        )}
      </div>
      <ActionDialog
        open={open}
        onOpenChange={setOpen}
        action={selectedAction}
        reason={reason}
        onReasonChange={setReason}
        onSubmit={handleSubmit}
        loading={loading}
      />
    </>
  );
}

function ActionDialog({
  open,
  onOpenChange,
  action,
  reason,
  onReasonChange,
  onSubmit,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: ActionOption | null;
  reason: string;
  onReasonChange: (reason: string) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {action?.icon}
            {action ? `${action.label} User` : "User Action"}
          </DialogTitle>
          <DialogDescription>
            {action?.description ?? "Select an action below."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Reason (required for audit log)</Label>
            <Textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="e.g. Fraud risk: duplicate devices and suspicious login patterns"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              {reason.length}/500 characters (min 5)
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={action?.value === "active" ? "default" : "destructive"}
            onClick={onSubmit}
            disabled={loading || !reason.trim() || reason.trim().length < 5}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm {action?.label ?? "Action"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
