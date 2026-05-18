"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { Loader2, Clock, Users, CheckCircle, Search, Lock, ChevronRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORY_LABELS, CATEGORY_COLORS, DIFFICULTY_COLORS, type TaskCategory } from "@/lib/task-types";
import {
  ACTION_LABELS,
  PLATFORM_COLORS,
  PLATFORM_LABELS,
  normalizeSocialAction,
  normalizeSocialPlatform,
  socialEstimatedTime,
} from "@/lib/social-engagement";

type Task = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  instructions: string;
  payoutKsh: number;
  slotsRemaining: number;
  difficulty: string;
  expiresAt: string | null;
  taskData: Record<string, unknown>;
  requiresScreenshot: boolean;
  requiresUrl: boolean;
  minWordCount: number;
};

const CATEGORIES: TaskCategory[] = [
  "survey",
  "data_labeling",
  "social_engagement",
  "verification",
  "content_creation",
  "watch_respond",
];

const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "payout_high", label: "Highest Payout" },
  { value: "expiry_soon", label: "Expiring Soon" },
];

function formatCategory(category: string): string {
  return CATEGORY_LABELS[category as TaskCategory] ?? category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function categoryClass(category: string): string {
  return CATEGORY_COLORS[category as TaskCategory] ?? "bg-slate-100 text-slate-800 border-slate-200";
}

function difficultyClass(difficulty: string): string {
  return DIFFICULTY_COLORS[difficulty as keyof typeof DIFFICULTY_COLORS] ?? "bg-slate-100 text-slate-700 border-slate-200";
}

function formatSubtype(value: unknown): string {
  return String(value ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatEstimatedTime(batchSize: number): string {
  const minutes = Math.max(1, Math.ceil((batchSize * 15) / 60));
  return `~${minutes} min`;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

function LockBanner({
  unlockAt,
  mode = "taskUnlock",
}: {
  unlockAt?: string;
  mode?: "taskUnlock" | "training";
}) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const updateCountdown = () => {
      if (!unlockAt) {
        setTimeLeft(0);
        return;
      }

      const unlockTime = new Date(unlockAt).getTime();
      const remainingSeconds = Math.max(0, Math.ceil((unlockTime - Date.now()) / 1000));
      setTimeLeft(Number.isFinite(remainingSeconds) ? remainingSeconds : 0);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [unlockAt]);

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;
  const pad = (value: number) => value.toString().padStart(2, "0");
  const isTaskUnlock = mode === "taskUnlock";

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Card className="relative overflow-hidden border border-outline-variant/50 bg-white shadow-xl shadow-surface-dim/20">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-amber-500" />
        <CardContent className="flex flex-col items-center px-6 py-10 text-center sm:px-12 sm:py-12">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 ring-8 ring-amber-50/60">
            <Lock className="h-8 w-8 text-amber-600" strokeWidth={2.5} />
          </div>

          <h2 className="text-2xl font-bold leading-tight text-navy sm:text-3xl">
            Task starts are currently locked
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-on-surface-variant sm:text-base">
            {isTaskUnlock
              ? "Refer a friend who activates to cut your wait in half."
              : "Complete the remaining training steps to unlock live tasks."}
          </p>

          {isTaskUnlock && (
            <div className="my-10 flex w-full items-center justify-center gap-2 sm:gap-5">
              <TimeBlock value={pad(hours)} label="Hours" />
              <span className="pb-8 text-3xl font-light text-outline-variant sm:text-4xl">:</span>
              <TimeBlock value={pad(minutes)} label="Mins" />
              <span className="pb-8 text-3xl font-light text-outline-variant sm:text-4xl">:</span>
              <TimeBlock value={pad(seconds)} label="Secs" />
            </div>
          )}

          <Button asChild size="lg" className="group min-w-[240px] rounded-full px-8 shadow-lg shadow-pesatrix-blue/20">
            <Link href={isTaskUnlock ? "/dashboard/referrals" : "/dashboard/training"}>
              {isTaskUnlock ? <Users className="mr-2 h-5 w-5" /> : <Lock className="mr-2 h-5 w-5" />}
              {isTaskUnlock ? "Go to Referrals" : "Go to Training"}
              <ChevronRight className="ml-1 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function TimeBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center sm:flex-none">
      <div className="flex aspect-square w-full max-w-24 items-center justify-center rounded-lg border border-outline-variant/40 bg-surface text-navy shadow-inner sm:w-24">
        <span className="font-mono text-3xl font-bold tabular-nums leading-none sm:text-5xl">
          {value}
        </span>
      </div>
      <span className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function TaskCard({
  task,
  isSubmitted,
  tasksLocked,
}: {
  task: Task;
  isSubmitted: boolean;
  tasksLocked: boolean;
}) {
  const expiresAt = task.expiresAt ? new Date(task.expiresAt) : null;
  const now = new Date();
  const isLowSlots = task.slotsRemaining <= 10;
  const isCriticalSlots = task.slotsRemaining <= 3;
  const isExpiringSoon = expiresAt && expiresAt.getTime() - now.getTime() < 24 * 60 * 60 * 1000;
  const isDataLabeling = task.category === "data_labeling";
  const isSocialEngagement = task.category === "social_engagement";
  const batchSize = Number(task.taskData?.batch_size ?? ((task.taskData?.items as unknown[]) ?? []).length ?? 0);
  const socialPlatform = normalizeSocialPlatform(task.taskData?.platform);
  const socialAction = normalizeSocialAction(task.taskData?.action);

  const summary = isSocialEngagement
    ? `${ACTION_LABELS[socialAction]} ${String(task.taskData?.target_identifier || task.taskData?.target_name || task.title)} on ${PLATFORM_LABELS[socialPlatform]}`
    : task.description || task.instructions;
  const truncatedSummary =
    summary.length > 120
      ? `${summary.slice(0, 120)}...`
      : summary;

  return (
    <Card
      className={`border shadow-sm transition-shadow hover:shadow-md ${
        isLowSlots ? "border-amber-300" : ""
      }`}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-navy">{task.title}</h3>
            {isDataLabeling && (
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                {formatSubtype(task.taskData?.subtype)} - {batchSize} items
              </p>
            )}
            {isSocialEngagement && (
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                {ACTION_LABELS[socialAction]} {String(task.taskData?.target_identifier || task.taskData?.target_name)} on {PLATFORM_LABELS[socialPlatform]}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {isSocialEngagement ? (
                <>
                  <Badge
                    style={{
                      backgroundColor: PLATFORM_COLORS[socialPlatform],
                      borderColor: PLATFORM_COLORS[socialPlatform],
                      color: "white",
                    }}
                  >
                    {PLATFORM_LABELS[socialPlatform]}
                  </Badge>
                  <Badge variant="outline">{ACTION_LABELS[socialAction]}</Badge>
                </>
              ) : (
                <Badge className={categoryClass(task.category)}>
                  {formatCategory(task.category)}
                </Badge>
              )}
              <Badge className={difficultyClass(task.difficulty)}>
                {task.difficulty}
              </Badge>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-pesatrix-blue">KSh {task.payoutKsh}</p>
          </div>
        </div>

        <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{truncatedSummary}</p>

        <div className="mt-3 flex items-center justify-between text-sm">
          <span
            className={`flex items-center gap-1 ${
              isCriticalSlots
                ? "text-red-600 font-medium"
                : isLowSlots
                  ? "text-amber-600 font-medium"
                  : "text-muted-foreground"
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            {task.slotsRemaining} spots left
          </span>
          {expiresAt && (
            <span className={`flex items-center gap-1 ${isExpiringSoon ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
              <Clock className="h-3.5 w-3.5" />
              Expires {expiresAt.toLocaleDateString()}
            </span>
          )}
          {!expiresAt && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {isDataLabeling ? formatEstimatedTime(batchSize) : isSocialEngagement ? socialEstimatedTime(socialAction) : "No expiry"}
            </span>
          )}
        </div>

        <div className="mt-4">
          {isSubmitted ? (
            <div className="flex items-center justify-center gap-2 rounded-md bg-green-100 py-2 text-sm font-medium text-green-800">
              <CheckCircle className="h-4 w-4" />
              Submitted
            </div>
          ) : tasksLocked ? (
            <Button disabled className="w-full">
              <Lock className="mr-2 h-4 w-4" />
              Locked
            </Button>
          ) : (
            <Link href={`/tasks/${task.id}`} className="block">
              <Button className="w-full">Start Task</Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonCard() {
  return (
    <Card className="animate-pulse">
      <CardContent className="p-5">
        <div className="h-5 w-3/4 rounded bg-gray-200" />
        <div className="mt-3 flex gap-2">
          <div className="h-5 w-20 rounded bg-gray-200" />
          <div className="h-5 w-16 rounded bg-gray-200" />
        </div>
        <div className="mt-4 h-4 w-full rounded bg-gray-200" />
        <div className="mt-3 h-4 w-2/3 rounded bg-gray-200" />
        <div className="mt-4 h-10 w-full rounded bg-gray-200" />
      </CardContent>
    </Card>
  );
}

export function TaskListClient({ userId }: { userId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submittedTaskIds, setSubmittedTaskIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tasksLocked, setTasksLocked] = useState(false);
  const [isActivated, setIsActivated] = useState(true);
  const [unlockAt, setUnlockAt] = useState<string | undefined>(undefined);
  const [trainingIncomplete, setTrainingIncomplete] = useState(false);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
  const [dailySubmissionCount, setDailySubmissionCount] = useState<number | null>(null);
  const [dailyTaskLimit, setDailyTaskLimit] = useState<number | null>(null);

  const [selectedCategories, setSelectedCategories] = useState<TaskCategory[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("newest");
  const [searchQuery, setSearchQuery] = useState("");

  const debouncedSearch = useDebounce(searchQuery, 400);

  const fetchTasks = useCallback(
    async (category?: string, difficulty?: string, sort?: string, search?: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/tasks");
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Failed to fetch tasks");
          return;
        }

        setIsActivated(data.isActivated !== false);
        setTasksLocked(Boolean(data.tasksLocked));
        setUnlockAt(data.taskUnlockAt ?? undefined);
        setTrainingIncomplete(data.isActivated !== false && data.trainingStatus !== "completed");
        setTasks(data.tasks ?? []);
        setSubmittedTaskIds(data.submittedTaskIds ?? []);
        setDailySubmissionCount(data.dailySubmissionCount ?? 0);
        setDailyTaskLimit(data.dailyTaskLimit ?? null);
      } catch {
        setError("Failed to fetch tasks");
      } finally {
        setLoading(false);
        setHasFetchedOnce(true);
      }
    },
    []
  );

  useEffect(() => {
    const categoryParam = selectedCategories.length > 0 ? selectedCategories.join(",") : undefined;
    fetchTasks(categoryParam ?? undefined, selectedDifficulty ?? undefined, sortBy, debouncedSearch);
  }, [selectedCategories, selectedDifficulty, sortBy, debouncedSearch, fetchTasks]);

  const handleCategoryToggle = (category: TaskCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedDifficulty(null);
    setSearchQuery("");
  };

  const filteredTasks = useMemo(() => {
    let filtered = tasks;

    if (selectedCategories.length > 0) {
      filtered = filtered.filter((t) => selectedCategories.includes(t.category as TaskCategory));
    }

    if (selectedDifficulty) {
      filtered = filtered.filter((t) => t.difficulty === selectedDifficulty);
    }

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      filtered = filtered.filter((t) =>
        `${t.title} ${t.category} ${t.description ?? ""} ${t.instructions}`
          .toLowerCase()
          .includes(query)
      );
    }

    const sorted = [...filtered];
    if (sortBy === "payout_high") {
      sorted.sort((a, b) => b.payoutKsh - a.payoutKsh);
    } else if (sortBy === "expiry_soon") {
      sorted.sort((a, b) => {
        if (!a.expiresAt && !b.expiresAt) return 0;
        if (!a.expiresAt) return 1;
        if (!b.expiresAt) return -1;
        return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
      });
      }
    return sorted;
  }, [tasks, selectedCategories, selectedDifficulty, searchQuery, sortBy]);

  const hasActiveFilters = selectedCategories.length > 0 || selectedDifficulty || searchQuery.trim().length > 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap gap-3 rounded-lg border bg-card p-3">
          <div className="h-9 w-32 animate-pulse rounded-md bg-muted" />
          <div className="h-9 w-24 animate-pulse rounded-md bg-muted" />
          <div className="h-9 w-36 animate-pulse rounded-md bg-muted" />
          <div className="h-9 flex-1 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!isActivated) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Lock className="mx-auto h-10 w-10 text-amber-600" />
          <h3 className="mt-4 text-lg font-semibold text-navy">Activate your account to access tasks.</h3>
          <Button asChild className="mt-4">
            <Link href="/dashboard/activate">Activate Account</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (trainingIncomplete) {
    return (
      <div className="space-y-6">
        <LockBanner mode="training" />
      </div>
    );
  }

  if (tasksLocked) {
    return (
      <div className="space-y-6">
        <LockBanner unlockAt={unlockAt} mode="taskUnlock" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-red-600">{error}</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => fetchTasks(undefined, undefined, sortBy, debouncedSearch)}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {dailySubmissionCount !== null && dailyTaskLimit !== null && (
        <div className="flex items-center justify-between rounded-lg border border-pesatrix-blue/20 bg-pesatrix-blue/5 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-navy">Tasks today</p>
            <p className="text-xs text-muted-foreground">Daily submission limit resets at midnight UTC.</p>
          </div>
          <Badge variant={dailySubmissionCount >= dailyTaskLimit ? "warning" : "success"}>
            {dailySubmissionCount} / {dailyTaskLimit}
          </Badge>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          value={selectedDifficulty ?? ""}
          onChange={(e) => setSelectedDifficulty(e.target.value || null)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="">All Difficulties</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {selectedCategories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedCategories.map((cat) => (
            <Badge
              key={cat}
              variant="secondary"
              className="cursor-pointer pr-1"
              onClick={() => handleCategoryToggle(cat)}
            >
              {CATEGORY_LABELS[cat]}
              <button className="ml-1 hover:text-destructive">×</button>
            </Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear all
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <Button
            key={cat}
            variant={selectedCategories.includes(cat) ? "default" : "outline"}
            size="sm"
            onClick={() => handleCategoryToggle(cat)}
          >
            {CATEGORY_LABELS[cat]}
          </Button>
        ))}
      </div>

      {filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-semibold text-navy">
              {hasActiveFilters ? "No tasks match your filters" : "No tasks available right now"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {hasActiveFilters
                ? "Try clearing your filters to see more tasks."
                : "Check back soon for new tasks."}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" className="mt-4" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isSubmitted={submittedTaskIds.includes(task.id)}
              tasksLocked={tasksLocked}
            />
          ))}
        </div>
      )}
    </div>
  );
}
