"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function SupportAdminActions({
  ticketId,
  initialStatus,
  initialPriority,
}: {
  ticketId: string;
  initialStatus: string;
  initialPriority: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [priority, setPriority] = useState(initialPriority);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function updateTicket() {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/support/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, priority, reason: "Support ticket update" }),
      });
      if (!response.ok) {
        toast.error("Failed to update ticket");
        return;
      }
      toast.success("Ticket updated");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function sendReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/support/${ticketId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!response.ok) {
        toast.error("Failed to send reply");
        return;
      }
      setMessage("");
      toast.success("Reply sent");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function deleteTicket() {
    if (!window.confirm("Delete this support ticket?")) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/support/${ticketId}`, { method: "DELETE" });
      if (!response.ok) {
        toast.error("Failed to delete ticket");
        return;
      }
      toast.success("Ticket deleted");
      router.push("/wazim/support");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["open", "in_progress", "waiting_on_user", "resolved", "closed"].map((value) => (
                <SelectItem key={value} value={value}>{value.replaceAll("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["low", "medium", "high"].map((value) => (
                <SelectItem key={value} value={value}>{value}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={updateTicket} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save ticket
        </Button>
        <Button variant="destructive" onClick={deleteTicket} disabled={loading}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete ticket
        </Button>
      </div>
      <form className="space-y-3" onSubmit={sendReply}>
        <Label htmlFor="admin-reply">Reply as admin</Label>
        <textarea
          id="admin-reply"
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          rows={4}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Write a support reply..."
        />
        <Button type="submit" disabled={loading || !message.trim()}>
          <Send className="mr-2 h-4 w-4" />
          Send reply
        </Button>
      </form>
    </div>
  );
}
