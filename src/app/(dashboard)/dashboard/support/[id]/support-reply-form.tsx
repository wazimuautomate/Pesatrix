"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";

type SupportReplyFormProps = {
  ticketId: string;
  disabled?: boolean;
};

export function SupportReplyForm({ ticketId, disabled = false }: SupportReplyFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/support/tickets/${ticketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload.error?.message || "Could not send reply.");
        return;
      }

      setMessage("");
      toast.success("Reply sent.");
      router.refresh();
    } catch {
      toast.error("Could not send reply.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <textarea
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        rows={4}
        disabled={disabled || submitting}
        placeholder={disabled ? "This ticket is closed." : "Write a reply..."}
        className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
      />
      <Button type="submit" disabled={disabled || submitting || !message.trim()}>
        {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
        Send reply
      </Button>
    </form>
  );
}
