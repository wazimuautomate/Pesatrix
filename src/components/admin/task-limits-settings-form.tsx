"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DAILY_TASK_LIMIT_KEY } from "@/lib/platform-setting-keys";

export function TaskLimitsSettingsForm({ initialDailyLimit }: { initialDailyLimit: number }) {
  const [dailyLimit, setDailyLimit] = useState(String(initialDailyLimit));
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedLimit = Number(dailyLimit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      toast.error("Daily task limit must be a whole number between 1 and 100.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: DAILY_TASK_LIMIT_KEY, value: parsedLimit }),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error ?? "Unable to save task limit");
        return;
      }

      setDailyLimit(String(payload.setting?.value ?? parsedLimit));
      toast.success("Daily task limit updated");
    } catch {
      toast.error("Unable to save task limit");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="grid gap-4 sm:grid-cols-[1fr_auto]" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="daily-task-limit">Daily task limit per user</Label>
        <Input
          id="daily-task-limit"
          min={1}
          max={100}
          step={1}
          type="number"
          value={dailyLimit}
          onChange={(event) => setDailyLimit(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Maximum task submissions each user can make per UTC calendar day.
        </p>
      </div>
      <Button className="self-end" disabled={loading} type="submit">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Save
      </Button>
    </form>
  );
}
