"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type UserProfile = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  county?: string | null;
};

export function AdminUserEditForm({ user }: { user: UserProfile }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: user.full_name ?? "",
    email: user.email ?? "",
    phone: user.phone ?? "",
    county: user.county ?? "",
    reason: "Admin profile update",
  });

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.error?.message ?? payload?.error ?? "Failed to update user");
        return;
      }
      toast.success("User updated");
      router.refresh();
    } catch {
      toast.error("Failed to update user");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
      <Field label="Name" value={form.fullName} onChange={(value) => setForm((current) => ({ ...current, fullName: value }))} />
      <Field label="Email" type="email" value={form.email} onChange={(value) => setForm((current) => ({ ...current, email: value }))} />
      <Field label="Phone" value={form.phone} onChange={(value) => setForm((current) => ({ ...current, phone: value }))} />
      <Field label="County" value={form.county} onChange={(value) => setForm((current) => ({ ...current, county: value }))} />
      <div className="md:col-span-2">
        <Field label="Audit reason" value={form.reason} onChange={(value) => setForm((current) => ({ ...current, reason: value }))} />
      </div>
      <div className="md:col-span-2">
        <Button disabled={loading} type="submit">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save user
        </Button>
      </div>
    </form>
  );
}

export function AdminUserDeleteButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.error ?? "Failed to delete user");
        return;
      }
      toast.success("User deleted");
      setOpen(false);
      router.push("/wazim/users");
      router.refresh();
    } catch {
      toast.error("Failed to delete user");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete user account?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This deletes the Supabase Auth user. Related profile records should cascade according to the database constraints.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
          <Button variant="destructive" onClick={onDelete} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Delete user
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
