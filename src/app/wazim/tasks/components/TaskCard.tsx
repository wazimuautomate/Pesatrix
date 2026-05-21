"use client";

import { motion } from "framer-motion";
import { Loader2, Pause, Pencil, Play, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  type TaskCategory,
  type TaskDifficulty,
  type TaskStatus,
  type TaskVisibilityMode,
} from "@/lib/task-types";
import { cn } from "@/lib/utils";

export type TaskRow = {
  id: string;
  title: string;
  category: TaskCategory;
  task_data?: Record<string, unknown> | null;
  description: string | null;
  instructions: string;
  payout_ksh: number;
  total_slots: number;
  slots_remaining: number;
  difficulty: TaskDifficulty;
  status: TaskStatus;
  publish_at: string | null;
  expires_at: string | null;
  ai_grading_enabled: boolean;
  ai_rubric: string | null;
  visibility_mode?: TaskVisibilityMode | null;
  min_referrals_required?: number | null;
  assigned_users?: Array<{
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    is_activated: boolean;
    referral_count?: number;
    assigned_at?: string | null;
  }> | null;
  requires_screenshot: boolean;
  requires_url: boolean;
  min_word_count: number;
  created_at: string;
  updated_at: string;
};

type TaskItemProps = {
  task: TaskRow;
  onEdit: (task: TaskRow) => void;
  onStatusChange: (id: string, newStatus: TaskStatus) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  actionLoading?: "status" | "delete" | null;
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  active: "bg-green-100 text-green-700 border-green-200",
  paused: "bg-amber-100 text-amber-700 border-amber-200",
  completed: "bg-purple-100 text-purple-700 border-purple-200",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-KE", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getVisibilityLabel(task: TaskRow) {
  if (task.visibility_mode === "referral_gated") {
    return `${Math.max(3, Number(task.min_referrals_required ?? 0))}+ referrals`;
  }

  if (task.visibility_mode === "assigned_only") {
    return "Assigned only";
  }

  if (task.visibility_mode === "proof_tier") {
    return "Proof tier";
  }

  return "All users";
}

function getTaskActionState(task: TaskRow, actionLoading?: "status" | "delete" | null) {
  const nextStatus: TaskStatus | null =
    task.status === "active"
      ? "paused"
      : task.status === "paused"
        ? "active"
        : task.status === "draft"
          ? "active"
          : null;

  return {
    nextStatus,
    statusActionLabel:
      task.status === "active"
        ? "Pause"
        : task.status === "paused"
          ? "Activate"
          : "Publish",
    StatusIcon: task.status === "active" ? Pause : Play,
    statusDisabled: !nextStatus || actionLoading === "delete",
    slotsUsed: task.total_slots - task.slots_remaining,
  };
}

export function TaskTableRow({
  task,
  onEdit,
  onStatusChange,
  onDelete,
  canDelete,
  selected,
  onToggleSelect,
  actionLoading,
}: TaskItemProps) {
  const { nextStatus, statusActionLabel, StatusIcon, statusDisabled, slotsUsed } =
    getTaskActionState(task, actionLoading);

  return (
    <tr className="group">
      <td className="p-4">
        <input
          type="checkbox"
          checked={selected ?? false}
          onChange={onToggleSelect}
          className="h-4 w-4 rounded border-gray-300"
        />
      </td>
      <td className="p-4">
        <button
          onClick={() => onEdit(task)}
          className="text-left font-medium text-navy hover:text-pesatrix-blue underline-offset-2 hover:underline"
        >
          {task.title}
        </button>
      </td>
      <td className="p-4">
        <Badge variant="outline" className="border-outline-variant/60">
          {getVisibilityLabel(task)}
        </Badge>
      </td>
      <td className="p-4">
        <Badge
          variant="outline"
          className={cn("border", CATEGORY_COLORS[task.category] ?? "")}
        >
          {CATEGORY_LABELS[task.category] ?? task.category}
        </Badge>
      </td>
      <td className="p-4 font-mono text-sm">
        KSh {Number(task.payout_ksh).toLocaleString("en-KE")}
      </td>
      <td className="p-4 text-sm">
        <span className="font-medium">{task.slots_remaining}</span>
        <span className="text-muted-foreground">/{task.total_slots}</span>
        {task.slots_remaining === 0 ? (
          <Badge variant="outline" className="ml-2 border-purple-200 bg-purple-50 text-purple-700">
            filled
          </Badge>
        ) : null}
        {slotsUsed > 0 ? (
          <span className="ml-1 text-xs text-muted-foreground">
            ({slotsUsed} taken)
          </span>
        ) : null}
      </td>
      <td className="p-4">
        <Badge
          variant="outline"
          className={cn("border", STATUS_COLORS[task.status] ?? "")}
        >
          {task.status}
        </Badge>
      </td>
      <td className="p-4">
        <Switch
          checked={task.ai_grading_enabled}
          onCheckedChange={() => {
            onStatusChange(task.id, task.status);
          }}
          disabled
        />
      </td>
      <td className="p-4 text-sm text-muted-foreground">
        {formatDate(task.created_at)}
      </td>
      <td className="p-4">
        <div className="flex items-center gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
          <motion.div whileTap={{ scale: 0.9 }}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(task)}
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.9 }}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                if (nextStatus) onStatusChange(task.id, nextStatus);
              }}
              disabled={statusDisabled}
              title={statusActionLabel}
            >
              {actionLoading === "status" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <StatusIcon className="h-4 w-4" />
              )}
            </Button>
          </motion.div>
          {canDelete ? (
            <motion.div whileTap={{ scale: 0.9 }}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => onDelete(task.id)}
                disabled={actionLoading === "status"}
                title="Delete"
              >
                {actionLoading === "delete" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </motion.div>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

export function TaskMobileCard({
  task,
  onEdit,
  onStatusChange,
  onDelete,
  canDelete,
  selected,
  onToggleSelect,
  actionLoading,
}: TaskItemProps) {
  const { nextStatus, statusActionLabel, StatusIcon, statusDisabled } =
    getTaskActionState(task, actionLoading);

  return (
    <div className="rounded-2xl border border-outline-variant/40 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected ?? false}
          onChange={onToggleSelect}
          className="mt-1 h-4 w-4 rounded border-gray-300"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <button
              onClick={() => onEdit(task)}
              className="min-w-0 text-left font-semibold text-navy"
            >
              <span className="line-clamp-2">{task.title}</span>
            </button>
            <Badge
              variant="outline"
              className={cn("shrink-0 border", STATUS_COLORS[task.status] ?? "")}
            >
              {task.status}
            </Badge>
          </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn("border", CATEGORY_COLORS[task.category] ?? "")}
              >
                {CATEGORY_LABELS[task.category] ?? task.category}
              </Badge>
              <Badge variant="outline" className="border-outline-variant/60">
                {getVisibilityLabel(task)}
              </Badge>
              <Badge variant="outline" className="border-outline-variant/60">
                KSh {Number(task.payout_ksh).toLocaleString("en-KE")}
              </Badge>
            <Badge variant="outline" className="border-outline-variant/60">
              {task.slots_remaining}/{task.total_slots} slots
            </Badge>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Created</p>
              <p className="mt-1 font-medium text-navy">{formatDate(task.created_at)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">AI Grading</p>
              <p className="mt-1 font-medium text-navy">
                {task.ai_grading_enabled ? "Enabled" : "Disabled"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <motion.div whileTap={{ scale: 0.9 }}>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => onEdit(task)}
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </motion.div>
            <motion.div whileTap={{ scale: 0.9 }}>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => {
                  if (nextStatus) onStatusChange(task.id, nextStatus);
                }}
                disabled={statusDisabled}
                title={statusActionLabel}
              >
                {actionLoading === "status" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <StatusIcon className="h-4 w-4" />
                )}
              </Button>
            </motion.div>
            {canDelete ? (
              <motion.div whileTap={{ scale: 0.9 }}>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 border-destructive/20 text-destructive hover:text-destructive"
                  onClick={() => onDelete(task.id)}
                  disabled={actionLoading === "status"}
                  title="Delete"
                >
                  {actionLoading === "delete" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </motion.div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
