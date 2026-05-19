"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function ReferralCreateForm() {
  const router = useRouter();
  const [form, setForm] = useState({ referrerIdentifier: "", refereeIdentifier: "", source: "admin" });
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/admin/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, reason: "Created from Wazim referrals page" }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.error?.message ?? payload?.error ?? "Failed to create referral");
        return;
      }
      toast.success("Referral created");
      setForm({ referrerIdentifier: "", refereeIdentifier: "", source: "admin" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="grid gap-4 md:grid-cols-[1.2fr_1.2fr_160px_auto]" onSubmit={onSubmit}>
      <Field
        label="Referrer"
        hint="User ID, referral code, email, or phone"
        value={form.referrerIdentifier}
        onChange={(value) => setForm((current) => ({ ...current, referrerIdentifier: value }))}
      />
      <Field
        label="Referee"
        hint="User ID, referral code, email, or phone"
        value={form.refereeIdentifier}
        onChange={(value) => setForm((current) => ({ ...current, refereeIdentifier: value }))}
      />
      <div className="space-y-2">
        <Label>Source</Label>
        <Select value={form.source} onValueChange={(value) => setForm((current) => ({ ...current, source: value }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{["admin", "signup", "import"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Button className="self-end" type="submit" disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
        Add
      </Button>
    </form>
  );
}

export function ReferralRowActions({ referralId, source }: { referralId: string; source: string }) {
  const router = useRouter();
  const [nextSource, setNextSource] = useState(source);
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/referrals/${referralId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: nextSource, reason: "Referral source update" }),
      });
      if (!response.ok) {
        toast.error("Failed to update referral");
        return;
      }
      toast.success("Referral updated");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this referral?")) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/referrals/${referralId}`, { method: "DELETE" });
      if (!response.ok) {
        toast.error("Failed to delete referral");
        return;
      }
      toast.success("Referral deleted");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Select value={nextSource} onValueChange={setNextSource}>
        <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
        <SelectContent>{["admin", "signup", "import"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
      </Select>
      <Button size="sm" variant="outline" onClick={save} disabled={loading}><Save className="h-4 w-4" /></Button>
      <Button size="sm" variant="destructive" onClick={remove} disabled={loading}><Trash2 className="h-4 w-4" /></Button>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
