"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarRange,
  Loader2,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Bot,
  Eye,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";

import { AdminPageShell, StatusBadge } from "@/components/admin/admin-native";
import { cn } from "@/lib/utils";
import { TableSkeleton } from "@/components/ui/skeleton-loaders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function money(value: unknown) {
  const amount = Number(value ?? 0);
  return `KSh ${amount.toLocaleString("en-KE")}`;
}

function shortDate(value: unknown) {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
  }).format(date);
}

type SubmissionItem = {
  id: string;
  task_id: string;
  user_id: string;
  submitted_at: string;
  answers: Record<string, unknown>;
  screenshot_url: string | null;
  submitted_url: string | null;
  status: string;
  ai_score: number | null;
  ai_reasoning: string | null;
  ai_reviewed_at: string | null;
  grading_detail: Record<string, unknown> | null;
  admin_decision: string | null;
  admin_note: string | null;
  admin_reviewed_at: string | null;
  payout_credited: boolean;
  tasks: {
    id: string;
    title: string;
    category: string;
    payout_ksh: number;
    ai_grading_enabled?: boolean;
    ai_rubric?: string | null;
  } | null;
  profiles: {
    id?: string;
    full_name: string | null;
    email?: string | null;
    phone: string | null;
  } | null;
};

type SubmissionDetail = SubmissionItem & {
  tasks: {
    id: string;
    title: string;
    category: string;
    payout_ksh: number;
    ai_grading_enabled: boolean;
    ai_rubric: string | null;
    instructions: string | null;
    task_data: Record<string, unknown> | null;
  } | null;
  profiles: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

type Counts = {
  pending: number;
  ai_reviewing: number;
  approved: number;
  declined: number;
  flagged: number;
  admin_reviewed: number;
  payout_credited: number;
};

const CATEGORIES = [
  "survey",
  "data_labeling",
  "social_engagement",
  "verification",
  "content_creation",
  "watch_respond",
];

const PAGE_SIZE = 50;
const DATE_RANGE_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
] as const;

export default function SubmissionsPage() {
  return (
    <AdminPageShell
      admin={{ userId: "", email: null, role: "admin", adminUserId: "" }}
      title="Submissions"
      description=""
    >
      <SubmissionsContent />
    </AdminPageShell>
  );
}

function SubmissionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<SubmissionItem[]>([]);
  const [counts, setCounts] = useState<Counts>({
    pending: 0,
    ai_reviewing: 0,
    approved: 0,
    declined: 0,
    flagged: 0,
    admin_reviewed: 0,
    payout_credited: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [dateRange, setDateRange] = useState<(typeof DATE_RANGE_OPTIONS)[number]["value"]>("all");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const statusFilter = searchParams.get("status") ?? "all";
  const categoryFilter = searchParams.get("category") ?? "all";
  const search = searchParams.get("search") ?? "";

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(PAGE_SIZE));
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/admin/submissions?${params}`);
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const message = payload?.error ?? "Failed to load submissions";
        const displayMessage = payload?.code ? `${message} (${payload.code})` : message;
        setLoadError(displayMessage);
        toast.error(message);
        return;
      }
      const data = await res.json();
      setItems(data.items ?? []);
      setCounts(data.counts ?? counts);
      setTotal(data.total ?? 0);
    } catch {
      const message = "Network error loading submissions";
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, categoryFilter, search]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  function setFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    params.delete("page");
    router.push(`/wazim/submissions?${params.toString()}`);
  }

  function clearFilters() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("status");
    params.delete("category");
    params.delete("page");
    setDateRange("all");
    router.push(`/wazim/submissions?${params.toString()}`);
  }

  const filteredItems = items.filter((item) => matchesDateRange(item.submitted_at, dateRange));
  const activeFilterBadges = [
    statusFilter !== "all" ? { key: "status", label: statusFilter.replaceAll("_", " ") } : null,
    categoryFilter !== "all" ? { key: "category", label: categoryFilter.replaceAll("_", " ") } : null,
    dateRange !== "all" ? { key: "dateRange", label: dateRangeLabel(dateRange) } : null,
  ].filter(Boolean) as Array<{ key: string; label: string }>;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricBox label="Pending" value={counts.pending} tone="amber" />
        <MetricBox label="AI Reviewing" value={counts.ai_reviewing} tone="blue" />
        <MetricBox label="Approved" value={counts.approved} tone="teal" />
        <MetricBox label="Declined" value={counts.declined} tone="red" />
        <MetricBox label="Flagged" value={counts.flagged} tone="red" />
        <MetricBox label="Payout Credited" value={counts.payout_credited} tone="teal" />
      </section>

      <Card className="border border-outline-variant/40 shadow-sm">
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-lg text-navy">Submission Queue</CardTitle>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="w-full md:max-w-xs">
                <SearchInput />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {/* Category Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Category:</span>
                  <Select value={categoryFilter} onValueChange={(val) => setFilter("category", val)}>
                    <SelectTrigger className="h-9 w-[150px] text-xs">
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category.replaceAll("_", " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Range Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Date:</span>
                  <Select value={dateRange} onValueChange={(val) => setDateRange(val as any)}>
                    <SelectTrigger className="h-9 w-[130px] text-xs">
                      <SelectValue placeholder="All time" />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_RANGE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Inline Status Filter Tabs */}
            <div className="flex flex-wrap gap-1.5 border-b border-outline-variant/30 pb-2">
              {["all", "pending", "ai_reviewing", "approved", "declined", "flagged"].map((status) => {
                const isActive = statusFilter === status;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setFilter("status", status)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                      isActive
                        ? "bg-pesatrix-blue/10 text-pesatrix-blue"
                        : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    )}
                  >
                    {status === "all" ? "All Submissions" : status.replaceAll("_", " ")}
                  </button>
                );
              })}
            </div>

            {activeFilterBadges.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {activeFilterBadges.map((badge) => (
                  <Badge key={badge.key} variant="secondary" className="rounded-full px-3 py-1 text-xs capitalize">
                    {badge.label}
                  </Badge>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={clearFilters}
                >
                  Clear filters
                </Button>
              </div>
            ) : null}
          </div>
        </CardHeader>

        <CardContent>
          {loadError && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{loadError}</span>
            </div>
          )}

          {loading ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>AI Score</TableHead>
                    <TableHead>Payout</TableHead>
                    <TableHead>Credited</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableSkeleton rows={8} columns={9} />
                </TableBody>
              </Table>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-outline-variant/70 bg-white p-8 text-center text-sm text-muted-foreground">
              No submissions found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>AI Score</TableHead>
                    <TableHead>Payout</TableHead>
                    <TableHead>Credited</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((sub) => (
                    <SubmissionRow key={sub.id} sub={sub} onView={() => openDetail(sub.id)} />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages} ({total} total)
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set("page", String(page - 1));
                    router.push(`/wazim/submissions?${params.toString()}`);
                  }}
                >
                  <ChevronLeft className="h-3 w-3" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set("page", String(page + 1));
                    router.push(`/wazim/submissions?${params.toString()}`);
                  }}
                >
                  Next
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <DetailDrawer />
    </div>
  );
}

function SearchInput() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("search") ?? "");

  useEffect(() => {
    setValue(searchParams.get("search") ?? "");
  }, [searchParams]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) {
      params.set("search", value.trim());
    } else {
      params.delete("search");
    }
    params.delete("page");
    router.push(`/wazim/submissions?${params.toString()}`);
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-sm">
      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Search name or phone..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="pl-9 h-9 w-full text-xs border-outline-variant/60 focus:border-pesatrix-blue focus:ring-1 focus:ring-pesatrix-blue/20"
      />
    </form>
  );
}

function dateRangeLabel(value: (typeof DATE_RANGE_OPTIONS)[number]["value"]) {
  return DATE_RANGE_OPTIONS.find((option) => option.value === value)?.label ?? "All time";
}

function matchesDateRange(value: string, range: (typeof DATE_RANGE_OPTIONS)[number]["value"]) {
  if (range === "all") return true;
  const submittedAt = new Date(value);
  if (Number.isNaN(submittedAt.getTime())) return false;

  const now = Date.now();
  const hours =
    range === "24h"
      ? 24
      : range === "7d"
        ? 24 * 7
        : 24 * 30;

  return now - submittedAt.getTime() <= hours * 60 * 60 * 1000;
}

function MetricBox({ label, value, tone = "blue" }: { label: string; value: number; tone?: "blue" | "teal" | "amber" | "red" }) {
  const toneClass = {
    blue: "border-pesatrix-blue/30 bg-pesatrix-blue/5",
    teal: "border-teal/30 bg-teal/5",
    amber: "border-amber-500/30 bg-amber-500/5",
    red: "border-destructive/30 bg-destructive/5",
  }[tone];

  return (
    <Card className={`border ${toneClass} shadow-sm`}>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-bold text-navy">{value}</p>
      </CardContent>
    </Card>
  );
}

function SubmissionRow({ sub, onView }: { sub: SubmissionItem; onView: () => void }) {
  const task = sub.tasks;
  const profile = sub.profiles;

  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell>
        <span className="font-medium text-navy">{profile?.full_name ?? "(deleted)"}</span>
        <p className="text-xs text-muted-foreground">{profile?.phone ?? ""}</p>
      </TableCell>
      <TableCell className="font-medium">{task?.title ?? "(deleted)"}</TableCell>
      <TableCell>
        <Badge variant="outline" className="text-[10px]">{task?.category ?? "(deleted)"}</Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{shortDate(sub.submitted_at)}</TableCell>
      <TableCell><StatusBadge status={sub.status} /></TableCell>
      <TableCell>
        {sub.ai_score != null ? (
          <Badge
            variant={sub.ai_score >= 70 ? "success" : sub.ai_score >= 40 ? "warning" : "destructive"}
          >
            {Math.round(sub.ai_score)}%
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-sm">{task ? money(task.payout_ksh) : "—"}</TableCell>
      <TableCell>
        {sub.payout_credited ? (
          <Badge variant="success" className="text-[10px]">Yes</Badge>
        ) : (
          <Badge variant="muted" className="text-[10px]">No</Badge>
        )}
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={onView}>
          <Eye className="h-3 w-3" />
          View
        </Button>
      </TableCell>
    </TableRow>
  );
}

function DataLabelingBreakdown({ detail }: { detail: SubmissionDetail }) {
  const gradingDetail = detail.grading_detail ?? {};
  const results = Array.isArray(gradingDetail.itemResults)
    ? gradingDetail.itemResults as Array<Record<string, unknown>>
    : [];
  const taskItems = Array.isArray(detail.tasks?.task_data?.items)
    ? detail.tasks.task_data.items as Array<Record<string, unknown>>
    : [];
  const correct = Number(gradingDetail.correct ?? results.filter((item) => item.correct === true).length);
  const total = Number(gradingDetail.total ?? taskItems.length);
  const score = Number(gradingDetail.score ?? detail.ai_score ?? 0);

  if (results.length === 0) return null;

  return (
    <section className="rounded-lg border border-outline-variant/40 bg-white p-4">
      <h3 className="text-sm font-semibold text-navy mb-3">Data Labeling Review</h3>
      <p className="mb-3 text-sm font-medium">{correct}/{total} correct ({Math.round(score)}%)</p>
      <div className="overflow-x-auto rounded-lg border border-outline-variant/40">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Content</TableHead>
              <TableHead>User Answer</TableHead>
              <TableHead>Correct Label</TableHead>
              <TableHead>Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((result) => {
              const sourceItem = taskItems.find((item) => item.id === result.id);
              const content = String(sourceItem?.content ?? "");
              return (
                <TableRow key={String(result.id)}>
                  <TableCell className="font-mono text-xs">{String(result.id)}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{content}</TableCell>
                  <TableCell>{String(result.user_answer ?? "")}</TableCell>
                  <TableCell>{String(result.correct_label ?? "")}</TableCell>
                  <TableCell>{result.correct ? "Yes" : "No"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

let detailId: string | null = null;
let onDetailRefresh: (() => void) | null = null;

function openDetail(id: string) {
  detailId = id;
  window.dispatchEvent(new CustomEvent("submission-detail-open", { detail: id }));
}

function DetailDrawer() {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [approveConfirm, setApproveConfirm] = useState(false);
  const [declineModal, setDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [flagModal, setFlagModal] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    function handleOpen(e: Event) {
      const id = (e as CustomEvent<string>).detail;
      if (id) {
        setOpen(true);
        fetchDetail(id);
      }
    }
    window.addEventListener("submission-detail-open", handleOpen);
    return () => window.removeEventListener("submission-detail-open", handleOpen);
  }, []);

  async function fetchDetail(id: string) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/submissions/${id}`);
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        toast.error(payload?.error ?? "Failed to load submission detail");
        return;
      }
      const data = await res.json();
      setDetail(data.submission ?? null);
    } catch {
      toast.error("Network error");
    } finally {
      setDetailLoading(false);
    }
  }

  async function doApprove() {
    if (!detail) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/submissions/${detail.id}/approve`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to approve");
        return;
      }
      toast.success("Submission approved and wallet credited");
      setApproveConfirm(false);
      await fetchDetail(detail.id);
      onDetailRefresh?.();
    } catch {
      toast.error("Network error");
    } finally {
      setActionLoading(false);
    }
  }

  async function doDecline() {
    if (!detail) return;
    if (!declineReason.trim() || declineReason.trim().length < 2) {
      toast.error("Reason must be at least 2 characters");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/submissions/${detail.id}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: declineReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to decline");
        return;
      }
      toast.success("Submission declined");
      setDeclineModal(false);
      setDeclineReason("");
      await fetchDetail(detail.id);
      onDetailRefresh?.();
    } catch {
      toast.error("Network error");
    } finally {
      setActionLoading(false);
    }
  }

  async function doFlag() {
    if (!detail) return;
    if (!flagReason.trim() || flagReason.trim().length < 2) {
      toast.error("Reason must be at least 2 characters");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/submissions/${detail.id}/flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: flagReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to flag");
        return;
      }
      toast.success("Submission flagged");
      setFlagModal(false);
      setFlagReason("");
      await fetchDetail(detail.id);
      onDetailRefresh?.();
    } catch {
      toast.error("Network error");
    } finally {
      setActionLoading(false);
    }
  }

  async function doAiReview() {
    if (!detail) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/submissions/${detail.id}/ai-review`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "AI review failed");
        return;
      }
      toast.success(`AI review complete — Score: ${data.ai_score}%, Recommendation: ${data.recommendation}`);
      await fetchDetail(detail.id);
      onDetailRefresh?.();
    } catch {
      toast.error("Network error");
    } finally {
      setActionLoading(false);
    }
  }

  const task = detail?.tasks;
  const profile = detail?.profiles;
  const answers = detail?.answers as Record<string, unknown> | null;
  const isApproved = detail?.status === "approved";
  const isDeclined = detail?.status === "declined";
  const isFlagged = detail?.status === "flagged";
  const isAiReviewing = detail?.status === "ai_reviewing";
  const canApprove = !isApproved && !isDeclined;
  const canDecline = !isApproved && !isDeclined;
  const canFlag = !isApproved && !isDeclined;
  const canAiReview = task?.ai_grading_enabled && !isApproved && !isDeclined && !isAiReviewing;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) { setOpen(false); setDetail(null); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg text-navy">Submission Detail</DialogTitle>
            <DialogDescription>Review submission answers, user info, and take action.</DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-pesatrix-blue" />
            </div>
          ) : detail ? (
            <div className="space-y-6">
              {/* Task Info */}
              <section className="rounded-lg border border-outline-variant/40 bg-white p-4">
                <h3 className="text-sm font-semibold text-navy mb-3">Task Information</h3>
                <div className="grid gap-2 sm:grid-cols-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Title</span>
                    <p className="font-medium">{task?.title ?? "(deleted)"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Category</span>
                    <p className="font-medium">{task?.category ?? "(deleted)"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Payout</span>
                    <p className="font-medium">{task ? money(task.payout_ksh) : "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">AI Grading</span>
                    <p className="font-medium">{task?.ai_grading_enabled ? "Enabled" : "Disabled"}</p>
                  </div>
                </div>
                {task?.ai_rubric && (
                  <div className="mt-3">
                    <span className="text-muted-foreground text-xs">AI Rubric</span>
                    <p className="text-sm mt-1 text-on-surface-variant whitespace-pre-wrap">{task.ai_rubric}</p>
                  </div>
                )}
              </section>

              {/* User Info */}
              <section className="rounded-lg border border-outline-variant/40 bg-white p-4">
                <h3 className="text-sm font-semibold text-navy mb-3">User Information</h3>
                <div className="grid gap-2 sm:grid-cols-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Name</span>
                    <p className="font-medium">{profile?.full_name ?? "(deleted)"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Phone</span>
                    <p className="font-mono">{profile?.phone ?? "—"}</p>
                  </div>
                  {profile?.email && (
                    <div>
                      <span className="text-muted-foreground">Email</span>
                      <p className="font-medium">{profile.email}</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Screenshot */}
              {detail.screenshot_url && (
                <section className="rounded-lg border border-outline-variant/40 bg-white p-4">
                  <h3 className="text-sm font-semibold text-navy mb-3">Screenshot</h3>
                  <img
                    src={detail.screenshot_url}
                    alt="Submission screenshot"
                    className="max-h-64 rounded-lg border border-outline-variant/30 object-contain bg-muted"
                  />
                </section>
              )}

              {/* Submitted Answers */}
              <section className="rounded-lg border border-outline-variant/40 bg-white p-4">
                <h3 className="text-sm font-semibold text-navy mb-3">Submitted Answers</h3>
                {answers && Object.keys(answers).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(answers).map(([key, val]) => (
                      <div key={key} className="rounded-md bg-muted p-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{key}</p>
                        <p className="mt-1 text-sm text-on-surface whitespace-pre-wrap">
                          {typeof val === "object" ? JSON.stringify(val, null, 2) : String(val ?? "")}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No answers submitted.</p>
                )}
              </section>

              {task?.category === "data_labeling" && (
                <DataLabelingBreakdown detail={detail} />
              )}

              {/* AI Review Info */}
              {(detail.ai_score != null || detail.ai_reasoning) && (
                <section className="rounded-lg border border-outline-variant/40 bg-white p-4">
                  <h3 className="text-sm font-semibold text-navy mb-3">AI Review</h3>
                  <div className="grid gap-2 sm:grid-cols-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">AI Score</span>
                      <p className="font-medium">
                        {detail.ai_score != null ? (
                          <Badge variant={detail.ai_score >= 70 ? "success" : detail.ai_score >= 40 ? "warning" : "destructive"}>
                            {Math.round(detail.ai_score)}%
                          </Badge>
                        ) : "—"}
                      </p>
                    </div>
                  </div>
                  {detail.ai_reasoning && (
                    <div className="mt-2">
                      <span className="text-muted-foreground text-xs">Reasoning</span>
                      <p className="text-sm mt-1 text-on-surface-variant whitespace-pre-wrap">{detail.ai_reasoning}</p>
                    </div>
                  )}
                </section>
              )}

              {/* Admin Decision */}
              {detail.admin_decision && (
                <section className="rounded-lg border border-outline-variant/40 bg-white p-4">
                  <h3 className="text-sm font-semibold text-navy mb-3">Admin Decision</h3>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={detail.admin_decision} />
                    {detail.admin_note && (
                      <p className="text-sm text-muted-foreground ml-2">{detail.admin_note}</p>
                    )}
                  </div>
                </section>
              )}

              {/* Status & Payout */}
              <section className="rounded-lg border border-outline-variant/40 bg-white p-4">
                <h3 className="text-sm font-semibold text-navy mb-3">Status</h3>
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Status</span>
                    <p><StatusBadge status={detail.status} /></p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Payout Credited</span>
                    <p>{detail.payout_credited ? <Badge variant="success">Yes</Badge> : <Badge variant="muted">No</Badge>}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Submitted</span>
                    <p className="font-medium">{shortDate(detail.submitted_at)}</p>
                  </div>
                </div>
              </section>

              {/* Action Buttons */}
              <section className="flex flex-wrap gap-2">
                {canApprove && (
                  <Button
                    size="sm"
                    className="gap-1 bg-teal text-white hover:bg-teal/90"
                    onClick={() => setApproveConfirm(true)}
                    disabled={actionLoading}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Approve
                  </Button>
                )}
                {canDecline && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1"
                    onClick={() => setDeclineModal(true)}
                    disabled={actionLoading}
                  >
                    <XCircle className="h-3 w-3" />
                    Decline
                  </Button>
                )}
                {canFlag && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 border-amber-500 text-amber-700 hover:bg-amber-50"
                    onClick={() => setFlagModal(true)}
                    disabled={actionLoading}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    Flag
                  </Button>
                )}
                {canAiReview && (
                  <Button
                    size="sm"
                    className="gap-1 bg-pesatrix-blue text-white hover:bg-pesatrix-blue/90"
                    onClick={() => doAiReview()}
                    disabled={actionLoading}
                  >
                    <Bot className="h-3 w-3" />
                    Trigger AI Review
                  </Button>
                )}
                {isAiReviewing && (
                  <Badge variant="muted" className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    AI Reviewing...
                  </Badge>
                )}
                {(isApproved || isDeclined) && (
                  <p className="text-xs text-muted-foreground self-center">
                    This submission has been {isApproved ? "approved" : "declined"}.
                  </p>
                )}
              </section>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">No submission data.</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Confirmation */}
      <Dialog open={approveConfirm} onOpenChange={(v) => !v && setApproveConfirm(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-teal" />
              Confirm Approval
            </DialogTitle>
            <DialogDescription>
              This will approve the submission and credit {detail?.tasks ? money(detail.tasks.payout_ksh) : "the payout"} to the user&apos;s wallet. The configured hold period applies before funds become withdrawable.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>This action cannot be undone. Verify the submission details before confirming.</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveConfirm(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button onClick={doApprove} disabled={actionLoading} className="bg-teal hover:bg-teal/90">
              {actionLoading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Confirm & Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline Modal */}
      <Dialog open={declineModal} onOpenChange={(v) => { if (!v) { setDeclineModal(false); setDeclineReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <XCircle className="h-4 w-4" />
              Decline Submission
            </DialogTitle>
            <DialogDescription>
              Provide a reason for declining this submission. No wallet credit will be issued.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="decline-reason">Reason</Label>
            <Textarea
              id="decline-reason"
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="e.g. Answers are incomplete, does not meet quality standards..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeclineModal(false); setDeclineReason(""); }} disabled={actionLoading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={doDecline} disabled={actionLoading}>
              {actionLoading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Confirm Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flag Modal */}
      <Dialog open={flagModal} onOpenChange={(v) => { if (!v) { setFlagModal(false); setFlagReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Flag Submission
            </DialogTitle>
            <DialogDescription>
              Flag this submission for further investigation. Provide a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="flag-reason">Reason</Label>
            <Textarea
              id="flag-reason"
              value={flagReason}
              onChange={(e) => setFlagReason(e.target.value)}
              placeholder="e.g. Suspicious pattern, possible fraud, needs manual review..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFlagModal(false); setFlagReason(""); }} disabled={actionLoading}>
              Cancel
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={doFlag}
              disabled={actionLoading}
            >
              {actionLoading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Confirm Flag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
