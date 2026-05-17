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
  const [form, setForm] = useState({ referrerId: "", refereeId: "", level: "1", source: "admin" });
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/admin/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, level: Number(form.level), reason: "Created from Wazim referrals page" }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.error?.message ?? payload?.error ?? "Failed to create referral");
        return;
      }
      toast.success("Referral created");
      setForm({ referrerId: "", refereeId: "", level: "1", source: "admin" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="grid gap-4 md:grid-cols-[1fr_1fr_110px_130px_auto]" onSubmit={onSubmit}>
      <Field label="Referrer user ID" value={form.referrerId} onChange={(value) => setForm((current) => ({ ...current, referrerId: value }))} />
      <Field label="Referee user ID" value={form.refereeId} onChange={(value) => setForm((current) => ({ ...current, refereeId: value }))} />
      <div className="space-y-2">
        <Label>Level</Label>
        <Select value={form.level} onValueChange={(value) => setForm((current) => ({ ...current, level: value }))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{["1", "2", "3"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
        </Select>
      </div>
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

export function ReferralRowActions({ referralId, level, source }: { referralId: string; level: number; source: string }) {
  const router = useRouter();
  const [nextLevel, setNextLevel] = useState(String(level));
  const [nextSource, setNextSource] = useState(source);
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/referrals/${referralId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: Number(nextLevel), source: nextSource, reason: "Referral update" }),
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
      <Select value={nextLevel} onValueChange={setNextLevel}>
        <SelectTrigger className="h-9 w-20"><SelectValue /></SelectTrigger>
        <SelectContent>{["1", "2", "3"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={nextSource} onValueChange={setNextSource}>
        <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
        <SelectContent>{["admin", "signup", "import"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
      </Select>
      <Button size="sm" variant="outline" onClick={save} disabled={loading}><Save className="h-4 w-4" /></Button>
      <Button size="sm" variant="destructive" onClick={remove} disabled={loading}><Trash2 className="h-4 w-4" /></Button>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
