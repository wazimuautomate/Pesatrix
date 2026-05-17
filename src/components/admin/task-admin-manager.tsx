"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type AdminTaskRow = {
  id: string;
  slug: string;
  title: string;
  source: "general" | "partner";
  provider: string | null;
  category: string;
  payout: number;
  estimated_time: string;
  difficulty: "Easy" | "Medium" | "Hard";
  summary: string;
  admin_note: string | null;
  status: "draft" | "active" | "paused" | "archived";
};

function money(value: unknown) {
  return `KSh ${Number(value ?? 0).toLocaleString("en-KE")}`;
}

const emptyForm = {
  slug: "",
  title: "",
  source: "general",
  provider: "",
  category: "",
  payout: "0",
  estimatedTime: "15 min",
  difficulty: "Easy",
  summary: "",
  adminNote: "",
  status: "active",
};

export function TaskAdminManager({ tasks }: { tasks: AdminTaskRow[] }) {
  const router = useRouter();
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);

  async function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/admin/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, payout: Number(form.payout) }),
      });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.error?.message ?? payload?.error ?? "Failed to create task");
        return;
      }
      toast.success("Task created");
      setForm(emptyForm);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border border-outline-variant/40 shadow-sm">
        <CardContent className="p-5">
          <form className="grid gap-4 lg:grid-cols-4" onSubmit={createTask}>
            <Field label="Slug" value={form.slug} onChange={(value) => setForm((current) => ({ ...current, slug: value }))} />
            <Field label="Title" value={form.title} onChange={(value) => setForm((current) => ({ ...current, title: value }))} />
            <Field label="Category" value={form.category} onChange={(value) => setForm((current) => ({ ...current, category: value }))} />
            <Field label="Payout" type="number" value={form.payout} onChange={(value) => setForm((current) => ({ ...current, payout: value }))} />
            <Field label="Estimated time" value={form.estimatedTime} onChange={(value) => setForm((current) => ({ ...current, estimatedTime: value }))} />
            <SelectField label="Source" value={form.source} values={["general", "partner"]} onChange={(value) => setForm((current) => ({ ...current, source: value }))} />
            <SelectField label="Difficulty" value={form.difficulty} values={["Easy", "Medium", "Hard"]} onChange={(value) => setForm((current) => ({ ...current, difficulty: value }))} />
            <SelectField label="Status" value={form.status} values={["draft", "active", "paused", "archived"]} onChange={(value) => setForm((current) => ({ ...current, status: value }))} />
            <Field label="Provider" value={form.provider} onChange={(value) => setForm((current) => ({ ...current, provider: value }))} />
            <div className="lg:col-span-3">
              <Field label="Summary" value={form.summary} onChange={(value) => setForm((current) => ({ ...current, summary: value }))} />
            </div>
            <div className="lg:col-span-4">
              <Field label="Admin note" value={form.adminNote} onChange={(value) => setForm((current) => ({ ...current, adminNote: value }))} />
            </div>
            <div className="lg:col-span-4">
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Create task
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}

function TaskCard({ task }: { task: AdminTaskRow }) {
  const router = useRouter();
  const [form, setForm] = useState({
    title: task.title,
    source: task.source,
    provider: task.provider ?? "",
    category: task.category,
    payout: String(task.payout),
    estimatedTime: task.estimated_time,
    difficulty: task.difficulty,
    summary: task.summary,
    adminNote: task.admin_note ?? "",
    status: task.status,
  });
  const [loading, setLoading] = useState(false);

  async function save() {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, payout: Number(form.payout) }),
      });
      if (!response.ok) {
        toast.error("Failed to update task");
        return;
      }
      toast.success("Task updated");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    if (!window.confirm("Delete this task?")) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/tasks/${task.id}`, { method: "DELETE" });
      if (!response.ok) {
        toast.error("Failed to delete task");
        return;
      }
      toast.success("Task deleted");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border border-outline-variant/40 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-navy">{task.slug}</p>
            <p className="text-xs text-muted-foreground">{task.source} • {money(task.payout)}</p>
          </div>
          <Badge variant={task.status === "active" ? "success" : "warning"}>{task.status}</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title" value={form.title} onChange={(value) => setForm((current) => ({ ...current, title: value }))} />
          <Field label="Category" value={form.category} onChange={(value) => setForm((current) => ({ ...current, category: value }))} />
          <Field label="Payout" type="number" value={form.payout} onChange={(value) => setForm((current) => ({ ...current, payout: value }))} />
          <Field label="Estimated time" value={form.estimatedTime} onChange={(value) => setForm((current) => ({ ...current, estimatedTime: value }))} />
          <SelectField label="Source" value={form.source} values={["general", "partner"]} onChange={(value) => setForm((current) => ({ ...current, source: value as "general" | "partner" }))} />
          <SelectField label="Difficulty" value={form.difficulty} values={["Easy", "Medium", "Hard"]} onChange={(value) => setForm((current) => ({ ...current, difficulty: value as "Easy" | "Medium" | "Hard" }))} />
          <SelectField label="Status" value={form.status} values={["draft", "active", "paused", "archived"]} onChange={(value) => setForm((current) => ({ ...current, status: value as AdminTaskRow["status"] }))} />
          <Field label="Provider" value={form.provider} onChange={(value) => setForm((current) => ({ ...current, provider: value }))} />
        </div>
        <Field label="Summary" value={form.summary} onChange={(value) => setForm((current) => ({ ...current, summary: value }))} />
        <Field label="Admin note" value={form.adminNote} onChange={(value) => setForm((current) => ({ ...current, adminNote: value }))} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={loading}><Save className="mr-2 h-4 w-4" />Save</Button>
          <Button variant="destructive" onClick={remove} disabled={loading}><Trash2 className="mr-2 h-4 w-4" />Delete</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function SelectField({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {values.map((entry) => <SelectItem key={entry} value={entry}>{entry}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
