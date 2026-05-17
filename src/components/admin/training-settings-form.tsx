"use client";

import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TrainingSettingsForm({ initialMinutes }: { initialMinutes: number }) {
  const [minutes, setMinutes] = useState(String(initialMinutes));
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/admin/settings/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unlockMinutes: Number(minutes) }),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload?.error?.message ?? "Unable to save training settings");
        return;
      }

      setMinutes(String(payload.unlockMinutes));
      toast.success("Training time limit updated");
    } catch {
      toast.error("Unable to save training settings");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="grid gap-4 sm:grid-cols-[1fr_auto]" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="training-unlock-minutes">Next-day unlock time limit in minutes</Label>
        <Input
          id="training-unlock-minutes"
          min={1}
          max={10080}
          type="number"
          value={minutes}
          onChange={(event) => setMinutes(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          This controls how long a user waits after completing a training day or failed stage test.
        </p>
      </div>
      <Button className="self-end" disabled={loading} type="submit">
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Save
      </Button>
    </form>
  );
}
