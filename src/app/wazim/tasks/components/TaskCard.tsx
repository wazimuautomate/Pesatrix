"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  DIFFICULTY_COLORS,
  type TaskCategory,
  type TaskStatus,
  type TaskDifficulty,
} from "@/lib/task-types";
import { cn } from "@/lib/utils";
import { Pencil, Trash2, Power } from "lucide-react";
import { toast } from "sonner";

export type TaskRow = {
  id: string;
  title: string;
  category: TaskCategory;
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
  requires_screenshot: boolean;
  requires_url: boolean;
  min_word_count: number;
  created_at: string;
  updated_at: string;
};

const STATUS_COLORS: Record<TaskStatus, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  active: "bg-green-100 text-green-700 border-green-200",
  paused: "bg-amber-100 text-amber-700 border-amber-200",
  completed: "bg-purple-100 text-purple-700 border-purple-200",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-KE", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function TaskCard({
  task,
  onEdit,
  onStatusChange,
  onDelete,
  canDelete,
}: {
  task: TaskRow;
  onEdit: (task: TaskRow) => void;
  onStatusChange: (id: string, newStatus: TaskStatus) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
}) {
  const slotsUsed = task.total_slots - task.slots_remaining;

  return (
    <tr className="group">
      <td className="p-4">
        <button
          onClick={() => onEdit(task)}
          className="text-left font-medium text-navy hover:text-pesatrix-blue underline-offset-2 hover:underline"
        >
          {task.title}
        </button>
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
        {task.slots_remaining === 0 && (
          <Badge variant="outline" className="ml-2 border-purple-200 bg-purple-50 text-purple-700">
            filled
          </Badge>
        )}
        {slotsUsed > 0 && (
          <span className="ml-1 text-xs text-muted-foreground">
            ({slotsUsed} taken)
          </span>
        )}
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
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(task)}
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              const next =
                task.status === "active"
                  ? "paused"
                  : task.status === "paused"
                    ? "active"
                    : task.status === "draft"
                      ? "active"
                      : null;
              if (next) onStatusChange(task.id, next as TaskStatus);
            }}
            disabled={
              !["draft", "active", "paused"].includes(task.status)
            }
            title={
              task.status === "active"
                ? "Pause"
                : task.status === "paused"
                  ? "Activate"
                  : "Publish"
            }
          >
            <Power className="h-3.5 w-3.5" />
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onDelete(task.id)}
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
