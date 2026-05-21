"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Filter,
  FileSearch,
  Loader2,
  Search,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageTransition } from "@/components/ui/PageTransition";
import Skeleton from "react-loading-skeleton";
import { CardSkeleton } from "@/components/ui/skeleton-loaders";
import { CATEGORY_COLORS, CATEGORY_LABELS, type TaskCategory } from "@/lib/task-types";
import { cn, formatKSh } from "@/lib/utils";

const PAGE_SIZE = 20;

type SubmissionStatus =
  | "all"
  | "pending"
  | "ai_reviewing"
  | "approved"
  | "declined"
  | "flagged"
  | "admin_reviewed";

type TaskSummary = {
  id: string;
  title: string;
  category: string;
  payout_ksh: number;
};

type Submission = {
  id: string;
  submitted_at: string;
  status: Exclude<SubmissionStatus, "all">;
  ai_score: number | null;
  ai_reasoning: string | null;
  ai_reviewed_at: string | null;
  admin_decision: string | null;
  admin_note: string | null;
  admin_reviewed_at: string | null;
  payout_credited: boolean;
  payout_credited_at: string | null;
  screenshot_url: string | null;
  submitted_url: string | null;
  tasks: TaskSummary | TaskSummary[] | null;
};

type SubmissionsResponse = {
  items?: Submission[];
  total?: number;
  hasMore?: boolean;
  error?: string;
};

const FILTERS: Array<{ value: SubmissionStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "ai_reviewing", label: "Under Review" },
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
  { value: "flagged", label: "Flagged" },
];

const STATUS_META: Record<
  Exclude<SubmissionStatus, "all">,
  { label: string; className: string; icon: typeof Clock3 }
> = {
  pending: {
    label: "Pending Review",
    className: "border-slate-200 bg-slate-100 text-slate-700",
    icon: Clock3,
  },
  ai_reviewing: {
    label: "Under AI Review",
    className: "border-blue-200 bg-blue-100 text-blue-800",
    icon: FileSearch,
  },
  approved: {
    label: "Approved",
    className: "border-green-200 bg-green-100 text-green-800",
    icon: CheckCircle2,
  },
  declined: {
    label: "Declined",
    className: "border-red-200 bg-red-100 text-red-800",
    icon: AlertCircle,
  },
  flagged: {
    label: "Flagged for Review",
    className: "border-orange-200 bg-orange-100 text-orange-800",
    icon: AlertCircle,
  },
  admin_reviewed: {
    label: "Admin Reviewed",
    className: "border-purple-200 bg-purple-100 text-purple-800",
    icon: FileSearch,
  },
};

function getTask(submission: Submission) {
  if (Array.isArray(submission.tasks)) {
    return submission.tasks[0] ?? null;
  }

  return submission.tasks;
}

function formatCategory(category?: string) {
  if (!category) return "Task";
  return (
    CATEGORY_LABELS[category as TaskCategory] ??
    category.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

function categoryClass(category?: string) {
  if (!category) return "border-slate-200 bg-slate-100 text-slate-700";
  return CATEGORY_COLORS[category as TaskCategory] ?? "border-slate-200 bg-slate-100 text-slate-700";
}

function ScoreLine({ score }: { score: number | null }) {
  if (score === null) return null;

  return (
    <p className="text-sm font-medium text-navy">
      AI Score: <span className="font-mono tabular-nums">{score}/100</span>
    </p>
  );
}

function StatusDetails({ submission, payout }: { submission: Submission; payout: number }) {
  if (submission.status === "approved") {
    return (
      <div className="space-y-2 text-sm text-on-surface-variant">
        <ScoreLine score={submission.ai_score} />
        {submission.ai_reasoning ? <p>{submission.ai_reasoning}</p> : null}
        <p>
          Payout: {formatKSh(payout)} -{" "}
          {submission.payout_credited ? "Credited to wallet (pending hold)" : "Payout processing"}
        </p>
      </div>
    );
  }

  if (submission.status === "declined") {
    return (
      <div className="space-y-2 text-sm text-on-surface-variant">
        <ScoreLine score={submission.ai_score} />
        {submission.ai_reasoning ? <p>Reason: {submission.ai_reasoning}</p> : null}
        {submission.admin_note ? <p>Admin note: {submission.admin_note}</p> : null}
        <p>
          Your submission did not meet the required quality standard. Review the task instructions
          and try similar tasks.
        </p>
      </div>
    );
  }

  if (submission.status === "flagged") {
    return (
      <div className="space-y-2 text-sm text-on-surface-variant">
        <ScoreLine score={submission.ai_score} />
        <p>
          Your submission has been flagged for manual admin review. You will be notified of the
          outcome.
        </p>
        {submission.ai_reasoning ? <p>{submission.ai_reasoning}</p> : null}
      </div>
    );
  }

  if (submission.status === "admin_reviewed") {
    return (
      <div className="space-y-2 text-sm text-on-surface-variant">
        {submission.admin_decision ? <p>Admin decision: {submission.admin_decision}</p> : null}
        {submission.admin_note ? <p>{submission.admin_note}</p> : null}
        {submission.payout_credited ? <p>Payout credited: {formatKSh(payout)}</p> : null}
      </div>
    );
  }

  return (
    <p className="text-sm text-on-surface-variant">
      Your submission is being reviewed. This usually takes a few minutes.
    </p>
  );
}

function SubmissionCard({ submission }: { submission: Submission }) {
  const task = getTask(submission);
  const status = STATUS_META[submission.status] ?? STATUS_META.pending;
  const StatusIcon = status.icon;
  const payout = Number(task?.payout_ksh ?? 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
    <Card className="max-w-full border border-outline-variant/40 bg-white shadow-sm">
      <CardContent className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={cn("border", categoryClass(task?.category))}>
              {formatCategory(task?.category)}
            </Badge>
            <Badge className={cn("gap-1 border", status.className)}>
              <StatusIcon className="h-3.5 w-3.5" />
              {status.label}
            </Badge>
          </div>
          <time className="text-xs font-medium text-muted-foreground" dateTime={submission.submitted_at}>
            {format(new Date(submission.submitted_at), "MMM d, yyyy h:mm a")}
          </time>
        </div>

        <h2 className="mt-4 text-lg font-semibold leading-tight text-navy">
          {task?.title ?? "Task no longer available"}
        </h2>

        <div className="my-4 border-t border-outline-variant/40" />

        <p className="mb-4 text-sm font-semibold text-navy">
          Payout: {formatKSh(payout)}
        </p>

        <StatusDetails submission={submission} payout={payout} />

        {submission.payout_credited ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-800">
            <CheckCircle2 className="h-4 w-4" />
            Payout credited
            {submission.payout_credited_at ? (
              <span className="text-xs font-normal text-green-700">
                {format(new Date(submission.payout_credited_at), "MMM d, yyyy")}
              </span>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
    </motion.div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, item) => (
        <CardSkeleton key={item} />
      ))}
    </div>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <Card className="border border-outline-variant/40 bg-white">
      <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <ClipboardList className="h-8 w-8 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-navy">
            {filtered ? "No submissions match this filter." : "You have not submitted any tasks yet."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered ? "Try a different status tab." : "Browse available tasks and submit one when you are ready."}
          </p>
        </div>
        {!filtered ? (
          <Button asChild>
            <Link href="/tasks">Browse Tasks</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function SubmissionsClient() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [filter, setFilter] = useState<SubmissionStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);

  const fetchSubmissions = useCallback(async (offset: number, append = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams({
        offset: String(offset),
        limit: String(PAGE_SIZE),
      });
      const response = await fetch(`/api/tasks/submissions?${params}`, { cache: "no-store" });
      const payload = (await response.json()) as SubmissionsResponse;

      if (!response.ok) {
        throw new Error(payload.error || "Failed to load submissions");
      }

      setSubmissions((current) => (append ? [...current, ...(payload.items ?? [])] : payload.items ?? []));
      setHasMore(Boolean(payload.hasMore));
      setTotal(payload.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load submissions");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void fetchSubmissions(0, false);
  }, [fetchSubmissions]);

  const visibleSubmissions = useMemo(() => {
    const byFilter = filter === "all" ? submissions : submissions.filter((submission) => submission.status === filter);
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return byFilter;
    }

    return byFilter.filter((submission) => {
      const task = getTask(submission);
      return String(task?.title ?? "").toLowerCase().includes(query);
    });
  }, [filter, searchQuery, submissions]);

  const hasLoadedSubmissions = submissions.length > 0;
  const activeFilterLabel = FILTERS.find((item) => item.value === filter)?.label ?? "All";

  return (
    <PageTransition className="mx-auto w-full max-w-full space-y-6 overflow-x-hidden">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-navy">My Submissions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track the status of all tasks you have submitted.
        </p>
      </header>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search by task title"
            className="pl-9"
          />
        </div>
        <motion.div whileTap={{ scale: 0.97 }} className="shrink-0">
          <Button type="button" variant="outline" size="icon" onClick={() => setFilterOpen(true)}>
            <Filter className="h-4 w-4" />
          </Button>
        </motion.div>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="outline">Filter: {activeFilterLabel}</Badge>
        {searchQuery ? (
          <Badge variant="outline" className="gap-1">
            Search active
            <button type="button" onClick={() => setSearchQuery("")}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ) : null}
      </div>

      {error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Could not load submissions</p>
            <p>{error}</p>
            <motion.div whileTap={{ scale: 0.97 }} className="mt-3 inline-flex">
              <Button variant="outline" size="sm" onClick={() => fetchSubmissions(0, false)}>
                Retry
              </Button>
            </motion.div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <LoadingState />
      ) : visibleSubmissions.length > 0 ? (
        <div className="space-y-4">
          {visibleSubmissions.map((submission) => (
            <SubmissionCard key={submission.id} submission={submission} />
          ))}
        </div>
      ) : (
        <EmptyState filtered={hasLoadedSubmissions && filter !== "all"} />
      )}

      {!loading && hasLoadedSubmissions ? (
        <div className="flex flex-col items-center gap-3">
          {hasMore ? (
            <motion.div whileTap={{ scale: 0.97 }}>
              <Button
                variant="outline"
                onClick={() => fetchSubmissions(submissions.length, true)}
                disabled={loadingMore}
              >
                {loadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Load more
              </Button>
            </motion.div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Showing {submissions.length} of {total} submissions
          </p>
        </div>
      ) : null}

      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="max-h-[80vh] max-w-sm overflow-y-auto p-6">
          <DialogHeader className="text-left">
            <DialogTitle>Filter submissions</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((item) => (
              <motion.div key={item.value} whileTap={{ scale: 0.97 }}>
                <Button
                  type="button"
                  size="sm"
                  variant={filter === item.value ? "default" : "outline"}
                  onClick={() => {
                    setFilter(item.value);
                    setFilterOpen(false);
                  }}
                  className="rounded-full"
                >
                  {item.label}
                </Button>
              </motion.div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
