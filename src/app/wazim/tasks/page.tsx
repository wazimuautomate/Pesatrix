"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertCircle, FileEdit, FileUp, Loader2, Plus, Search, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { AdminPageShell, MetricCard } from "@/components/admin/admin-native";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { type TaskStatus } from "@/lib/task-types";
import { TaskMobileCard, TaskTableRow, type TaskRow } from "./components/TaskCard";
import { TaskForm } from "./components/TaskForm";
import { TaskImportPanel } from "./components/TaskImportPanel";

type Counts = {
  total: number;
  draft: number;
  active: number;
  paused: number;
  completed: number;
  scheduled: number;
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [counts, setCounts] = useState<Counts>({
    total: 0,
    draft: 0,
    active: 0,
    paused: 0,
    completed: 0,
    scheduled: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showNewTask, setShowNewTask] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskRow | null>(null);
  const [editingTaskLoading, setEditingTaskLoading] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [rowActionLoading, setRowActionLoading] = useState<Record<string, "status" | "delete" | null>>({});

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setFilterError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (categoryFilter && categoryFilter !== "all") params.set("category", categoryFilter);
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/admin/tasks?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        const message = data?.error ?? "Failed to fetch tasks";
        setTasks([]);
        setFilterError(message);
        if (res.status !== 400) toast.error(message);
        return;
      }

      setTasks(data.items ?? data.tasks ?? []);
      setCounts(data.counts ?? { total: 0, draft: 0, active: 0, paused: 0, completed: 0, scheduled: 0 });
    } catch {
      setTasks([]);
      setFilterError("Network error");
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, statusFilter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  async function handleSave(payload: Record<string, unknown>, publish: boolean) {
    const method = payload.id ? "PATCH" : "POST";
    const url = payload.id
      ? `/api/admin/tasks/${payload.id}`
      : "/api/admin/tasks";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    if (!res.ok) {
      if (res.status === 409) {
        toast.error(result?.error ?? "A task with this title and category already exists");
      } else {
        toast.error(result?.error?.message ?? result?.error ?? "Failed to save task");
      }
      return;
    }

    toast.success(publish ? "Task published!" : "Task saved as draft");
    setShowNewTask(false);
    setEditingTask(null);
    fetchTasks();
  }

  async function handleStatusChange(id: string, newStatus: TaskStatus) {
    setRowActionLoading((current) => ({ ...current, [id]: "status" }));
    try {
      const res = await fetch(`/api/admin/tasks/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const result = await res.json();
      if (!res.ok) {
        toast.error(result?.error ?? "Failed to change status");
        return;
      }

      toast.success(`Task ${newStatus}`);
      fetchTasks();
    } finally {
      setRowActionLoading((current) => ({ ...current, [id]: null }));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this draft task? This cannot be undone.")) return;
    setRowActionLoading((current) => ({ ...current, [id]: "delete" }));
    try {
      const res = await fetch(`/api/admin/tasks/${id}`, {
        method: "DELETE",
      });

      const result = await res.json();
      if (!res.ok) {
        toast.error(result?.error ?? "Failed to delete task");
        return;
      }

      toast.success("Task deleted");
      fetchTasks();
    } finally {
      setRowActionLoading((current) => ({ ...current, [id]: null }));
    }
  }

  async function handleBulkAction(action: "delete" | "publish" | "draft") {
    if (selectedTasks.size === 0) return;

    const count = selectedTasks.size;
    const confirmMessages = {
      delete: `Delete ${count} draft task(s)? This cannot be undone.`,
      publish: `Publish ${count} task(s)? They will become active immediately.`,
      draft: `Revert ${count} task(s) to draft?`,
    };

    if (!confirm(confirmMessages[action])) return;

    setBulkActionLoading(true);
    try {
      const res = await fetch("/api/admin/tasks/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, taskIds: Array.from(selectedTasks) }),
      });

      const result = await res.json();
      if (!res.ok) {
        toast.error(result?.error ?? `Failed to ${action} tasks`);
        return;
      }

      toast.success(
        action === "delete"
          ? `Deleted ${result.deleted} task(s)`
          : action === "publish"
            ? `Published ${result.published} task(s)`
            : `Reverted ${result.reverted} task(s) to draft`
      );

      setSelectedTasks(new Set());
      fetchTasks();
    } catch {
      toast.error("Failed to perform bulk action");
    } finally {
      setBulkActionLoading(false);
    }
  }

  function toggleSelectAll() {
    if (selectedTasks.size === tasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(tasks.map((t) => t.id)));
    }
  }

  function toggleSelect(id: string) {
    const newSelected = new Set(selectedTasks);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTasks(newSelected);
  }

  async function handleEdit(taskId: string) {
    setEditingTaskLoading(true);
    try {
      const res = await fetch(`/api/admin/tasks/${taskId}`);
      const result = await res.json();
      if (!res.ok) {
        toast.error(result?.error ?? "Failed to load task");
        return;
      }

      setEditingTask(result.task ?? null);
    } catch {
      toast.error("Failed to load task");
    } finally {
      setEditingTaskLoading(false);
    }
  }

  return (
    <AdminPageShell
      admin={{
        role: "admin",
        userId: "",
        email: "",
        adminUserId: "",
      }}
      title="Tasks"
      description="Manage the task catalog: create, import, edit, and publish tasks for users."
      headerVariant="logoOnly"
      actions={
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="sm" onClick={() => setShowNewTask(true)}>
            <Plus className="mr-1 h-4 w-4" /> New Task
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            <FileUp className="mr-1 h-4 w-4" /> Import
          </Button>
        </div>
      }
    >
      <section className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Total" value={counts.total} detail="All tasks" tone="blue" />
        <MetricCard label="Active" value={counts.active} detail="Live and accepting" tone="teal" />
        <MetricCard label="Drafts" value={counts.draft} detail="Not yet published" tone="amber" />
        <MetricCard label="Scheduled" value={counts.scheduled} detail="Pending publish" tone="blue" />
        <MetricCard label="Paused" value={counts.paused} detail="Temporarily stopped" tone="amber" />
        <MetricCard label="Completed" value={counts.completed} detail="Finished or expired" tone="blue" />
      </section>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
             <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="survey">Survey</SelectItem>
            <SelectItem value="data_labeling">Data Labeling</SelectItem>
            <SelectItem value="social_engagement">Social Engagement</SelectItem>
            <SelectItem value="verification">Verification</SelectItem>
            <SelectItem value="content_creation">Content Creation</SelectItem>
            <SelectItem value="watch_respond">Watch & Respond</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
             <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={statusFilter === "draft" ? "default" : "outline"}
          size="sm"
          onClick={() =>
            setStatusFilter(statusFilter === "draft" ? "all" : "draft")
          }
        >
          Drafts
          {counts.draft > 0 && (
            <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
              {counts.draft}
            </Badge>
          )}
        </Button>

        {(search || (categoryFilter && categoryFilter !== "all") || (statusFilter && statusFilter !== "all")) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch("");
              setCategoryFilter("all");
              setStatusFilter("all");
            }}
          >
            <X className="mr-1 h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>

      {selectedTasks.size > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2">
          <span className="text-sm font-medium text-primary">
            {selectedTasks.size} selected
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction("publish")}
              disabled={bulkActionLoading}
            >
              <Send className="mr-1 h-3.5 w-3.5" />
              Publish
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction("draft")}
              disabled={bulkActionLoading}
            >
              <FileEdit className="mr-1 h-3.5 w-3.5" />
              Draft
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => handleBulkAction("delete")}
              disabled={bulkActionLoading}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => setSelectedTasks(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      {filterError && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{filterError}</span>
        </div>
      )}

      <div className="mt-4 space-y-3 md:hidden">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-2xl border border-outline-variant/40 bg-white" />
          ))
        ) : tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-outline-variant/70 bg-white p-8 text-center text-sm text-muted-foreground">
            {search || (categoryFilter && categoryFilter !== "all") || (statusFilter && statusFilter !== "all")
              ? "No tasks found"
              : "No tasks yet. Create one or import from JSON."}
          </div>
        ) : (
          tasks.map((task) => (
            <TaskMobileCard
              key={task.id}
              task={task}
              onEdit={(row) => handleEdit(row.id)}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              canDelete={task.status === "draft"}
              selected={selectedTasks.has(task.id)}
              onToggleSelect={() => toggleSelect(task.id)}
              actionLoading={rowActionLoading[task.id] ?? null}
            />
          ))
        )}
      </div>

      <div className="mt-4 hidden rounded-lg border bg-white md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <input
                  type="checkbox"
                  checked={tasks.length > 0 && selectedTasks.size === tasks.length}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-gray-300"
                />
              </TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Access</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Payout (KSh)</TableHead>
              <TableHead>Slots</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>AI</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-[120px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <td colSpan={10} className="p-8 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                </td>
              </TableRow>
            ) : tasks.length === 0 ? (
              <TableRow>
                <td colSpan={10} className="p-8 text-center text-muted-foreground">
                  {search || (categoryFilter && categoryFilter !== "all") || (statusFilter && statusFilter !== "all")
                    ? "No tasks found"
                    : "No tasks yet. Create one or import from JSON."}
                </td>
              </TableRow>
            ) : (
              tasks.map((task) => (
                <TaskTableRow
                  key={task.id}
                  task={task}
                  onEdit={(row) => handleEdit(row.id)}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                  canDelete={task.status === "draft"}
                  selected={selectedTasks.has(task.id)}
                  onToggleSelect={() => toggleSelect(task.id)}
                  actionLoading={rowActionLoading[task.id] ?? null}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showNewTask} onOpenChange={setShowNewTask}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogTitle>New Task</DialogTitle>
          <TaskForm
            onSave={handleSave}
            onCancel={() => setShowNewTask(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={editingTaskLoading || !!editingTask}
        onOpenChange={(open) => {
          if (!open) {
            setEditingTask(null);
            setEditingTaskLoading(false);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogTitle>Edit Task</DialogTitle>
          {editingTaskLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : editingTask ? (
            <TaskForm
              task={editingTask}
              onSave={handleSave}
              onCancel={() => setEditingTask(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {showImport && (
        <TaskImportPanel
          onClose={() => setShowImport(false)}
          onImported={fetchTasks}
        />
      )}
    </AdminPageShell>
  );
}
