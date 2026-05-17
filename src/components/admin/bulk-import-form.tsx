"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { bulkImportSchema, type BulkImportTask, CATEGORY_LABELS } from "@/lib/task-types";

export function BulkImportForm() {
  const router = useRouter();
  const [jsonInput, setJsonInput] = useState("");
  const [validatedTasks, setValidatedTasks] = useState<{ task: BulkImportTask; valid: boolean; errors: string[] }[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [globalPublishAt, setGlobalPublishAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"input" | "review" | "done">("input");

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setJsonInput(text);
    };
    reader.readAsText(file);
  }

  function validate() {
    try {
      const parsed = JSON.parse(jsonInput);
      const result = bulkImportSchema.safeParse(parsed);
      if (!result.success) {
        toast.error(result.error.errors.map((e) => e.message).join(", "));
        return;
      }
      const tasks = result.data.map((task) => ({
        task,
        valid: true,
        errors: [] as string[],
      }));
      setValidatedTasks(tasks);
      setSelected(new Set(tasks.map((_, i) => i)));
      setStep("review");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Invalid JSON");
    }
  }

  async function importSelected() {
    setLoading(true);
    try {
      const tasksToImport = Array.from(selected).map((i) => {
        const t = validatedTasks[i].task;
        return {
          ...t,
          publish_at: globalPublishAt || t.publish_at || null,
        };
      });

      const response = await fetch("/api/admin/tasks-new/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tasksToImport),
      });

      const result = await response.json();
      if (!response.ok) {
        toast.error(result?.error?.message ?? "Import failed");
        return;
      }

      toast.success(`${result.count} tasks imported successfully`);
      setStep("done");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function updateTaskField(index: number, field: string, value: unknown) {
    setValidatedTasks((prev) =>
      prev.map((t, i) =>
        i === index ? { ...t, task: { ...t.task, [field]: value } } : t
      )
    );
  }

  if (step === "done") {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-teal" />
          <h3 className="mt-4 text-lg font-semibold text-navy">Import Complete</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Tasks have been imported successfully.
          </p>
          <Button className="mt-4" onClick={() => router.push("/wazim/tasks")}>
            View Tasks
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {step === "input" && (
        <Card>
          <CardHeader>
            <CardTitle>Paste JSON or Upload File</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='[{"title": "Task 1", "category": "survey", ...}]'
              rows={12}
              className="font-mono text-sm"
            />
            <div className="flex items-center gap-4">
              <Label className="cursor-pointer">
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-outline-variant px-4 py-2 text-sm text-muted-foreground hover:bg-muted">
                  <Upload className="h-4 w-4" />
                  Upload .json file
                </div>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </Label>
              <Button onClick={validate} disabled={!jsonInput.trim()}>
                Validate JSON
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "review" && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {validatedTasks.length} tasks parsed. {selected.size} selected for import.
            </p>
            <div className="flex items-center gap-4">
              <div>
                <Label className="text-xs">Global Publish At (optional)</Label>
                <Input
                  type="datetime-local"
                  value={globalPublishAt}
                  onChange={(e) => setGlobalPublishAt(e.target.value)}
                  className="w-48"
                />
              </div>
              <Button onClick={importSelected} disabled={loading || selected.size === 0}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Import {selected.size} Tasks
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {validatedTasks.map(({ task, errors }, index) => (
              <Card key={index} className={selected.has(index) ? "" : "opacity-50"}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <Switch
                      checked={selected.has(index)}
                      onCheckedChange={() => toggleSelect(index)}
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={task.title}
                          onChange={(e) => updateTaskField(index, "title", e.target.value)}
                          className="font-semibold"
                        />
                        <Badge>{CATEGORY_LABELS[task.category]}</Badge>
                        <Badge variant="outline">KSh {task.payout_ksh}</Badge>
                        <Badge variant="outline">{task.total_slots} slots</Badge>
                        {task.publish_at ? (
                          <Badge variant="warning">Scheduled</Badge>
                        ) : (
                          <Badge variant="muted">Draft</Badge>
                        )}
                      </div>
                      <Input
                        value={task.description ?? ""}
                        onChange={(e) => updateTaskField(index, "description", e.target.value)}
                        placeholder="Description"
                      />
                      {errors.length > 0 && (
                        <div className="flex items-center gap-1 text-sm text-destructive">
                          <XCircle className="h-3 w-3" />
                          {errors.join(", ")}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
