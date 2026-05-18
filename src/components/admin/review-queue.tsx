"use client";

import { useState, useEffect } from "react";
import { Loader2, Check, X, Eye } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ACTION_LABELS, PLATFORM_COLORS, PLATFORM_LABELS, normalizeSocialAction, normalizeSocialPlatform } from "@/lib/social-engagement";

type Submission = {
  id: string;
  task_id: string;
  user_id: string;
  submitted_at: string;
  answers: Record<string, unknown>;
  status: string;
  ai_score: number | null;
  ai_reasoning: string | null;
  grading_detail: Record<string, unknown> | null;
  screenshot_url: string | null;
  screenshot_signed_url: string | null;
  task: {
    title: string;
    category: string;
    payout_ksh: number;
    instructions: string;
    task_data?: Record<string, unknown> | null;
  };
  profile: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  };
  user_verification?: {
    risk_score: number | null;
    flags?: Record<string, unknown> | null;
  } | null;
  account_status?: {
    activated_at: string | null;
  } | null;
};

export function ReviewQueue() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("flagged");
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchSubmissions();
  }, [statusFilter]);

  async function fetchSubmissions() {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/tasks-new/review?status=${statusFilter}`);
      const data = await response.json();
      if (response.ok) {
        setSubmissions(data.submissions ?? []);
        setSelectedIds(new Set());
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(submissionId: string, decision: "approved" | "declined") {
    if (decision === "declined" && !reviewNote.trim()) {
      toast.error("Decline reason is required");
      return;
    }
    setReviewing(true);
    try {
      const response = await fetch(`/api/admin/tasks-new/review/${submissionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: reviewNote || null }),
      });

      if (!response.ok) {
        toast.error("Failed to process decision");
        return;
      }

      toast.success(decision === "approved" ? "Submission approved" : "Submission declined");
      setReviewNote("");
      setSelectedSubmission(null);
      fetchSubmissions();
    } finally {
      setReviewing(false);
    }
  }

  async function handleBulkDecision(decision: "approved" | "declined") {
    if (selectedIds.size === 0) return;
    if (decision === "declined" && !reviewNote.trim()) {
      toast.error("Decline reason is required for bulk decline");
      return;
    }

    setReviewing(true);
    try {
      for (const submissionId of selectedIds) {
        const response = await fetch(`/api/admin/tasks-new/review/${submissionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, note: reviewNote || null }),
        });
        if (!response.ok) {
          toast.error(`Failed to process ${submissionId}`);
          return;
        }
      }
      toast.success(decision === "approved" ? "Selected submissions approved" : "Selected submissions declined");
      setReviewNote("");
      setSelectedIds(new Set());
      fetchSubmissions();
    } finally {
      setReviewing(false);
    }
  }

  async function handleReviewAction(submissionId: string, action: "ban_task" | "flag_fraud") {
    setReviewing(true);
    try {
      const response = await fetch(`/api/admin/tasks-new/review/${submissionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: reviewNote || null }),
      });

      if (!response.ok) {
        toast.error(action === "ban_task" ? "Failed to ban user from task" : "Failed to flag account");
        return;
      }

      toast.success(action === "ban_task" ? "User banned from task" : "Account flagged for fraud review");
      setReviewNote("");
      setSelectedSubmission(null);
      fetchSubmissions();
    } finally {
      setReviewing(false);
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Label>Filter by status</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="flagged">Flagged</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="ai_reviewing">AI Reviewing</SelectItem>
            <SelectItem value="admin_reviewed">Admin Reviewed</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {submissions.length} submissions
        </span>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Button size="sm" onClick={() => handleBulkDecision("approved")} disabled={reviewing}>
            Approve All
          </Button>
          <Button size="sm" variant="destructive" onClick={() => handleBulkDecision("declined")} disabled={reviewing}>
            Decline All
          </Button>
          <Textarea
            value={reviewNote}
            onChange={(event) => setReviewNote(event.target.value)}
            placeholder="Decline reason for selected submissions"
            rows={1}
            className="min-w-[240px] flex-1"
          />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-pesatrix-blue" />
        </div>
      ) : submissions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No submissions in this queue.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>User</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Proof</TableHead>
                <TableHead>AI Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell>
                    {sub.status === "flagged" && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(sub.id)}
                        onChange={() => toggleSelected(sub.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{sub.profile?.full_name ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{sub.profile?.email ?? ""}</p>
                      <p className="text-xs text-muted-foreground">Risk: {sub.user_verification?.risk_score ?? 0}</p>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {sub.task?.title}
                    {sub.task?.category === "social_engagement" && <SocialSubmissionBadges taskData={sub.task.task_data} />}
                  </TableCell>
                  <TableCell>
                    <Badge variant="muted">{sub.task?.category}</Badge>
                  </TableCell>
                  <TableCell>
                    {sub.screenshot_signed_url ? (
                      <button type="button" onClick={() => setSelectedSubmission(sub)}>
                        <img
                          src={sub.screenshot_signed_url}
                          alt="Proof"
                          className="h-12 w-12 rounded border object-cover"
                        />
                      </button>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {sub.ai_score != null ? (
                      <Badge
                        variant={sub.ai_score >= 70 ? "success" : sub.ai_score >= 40 ? "warning" : "destructive"}
                      >
                        {sub.ai_score}%
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        sub.status === "approved"
                          ? "success"
                          : sub.status === "declined"
                            ? "destructive"
                            : sub.status === "flagged"
                              ? "warning"
                              : "muted"
                      }
                    >
                      {sub.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(sub.submitted_at).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedSubmission(sub)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {sub.status === "flagged" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-teal"
                            onClick={() => handleDecision(sub.id, "approved")}
                            disabled={reviewing}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => handleDecision(sub.id, "declined")}
                            disabled={reviewing}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submission Details</DialogTitle>
          </DialogHeader>
          {selectedSubmission && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">User</Label>
                  <p>{selectedSubmission.profile?.full_name ?? "Unknown"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p>{selectedSubmission.profile?.email ?? "N/A"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Task</Label>
                  <p>{selectedSubmission.task?.title}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Payout</Label>
                  <p>KSh {selectedSubmission.task?.payout_ksh}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">AI Score</Label>
                  <p>{selectedSubmission.ai_score != null ? `${selectedSubmission.ai_score}%` : "N/A"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Submitted</Label>
                  <p>{new Date(selectedSubmission.submitted_at).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}</p>
                </div>
              </div>

              {selectedSubmission.ai_reasoning && (
                <div>
                  <Label className="text-muted-foreground">AI Reasoning</Label>
                  <p className="text-sm mt-1">{selectedSubmission.ai_reasoning}</p>
                </div>
              )}

              {selectedSubmission.task?.category === "social_engagement" && (
                <SocialEngagementReviewDetails submission={selectedSubmission} />
              )}

              <div>
                <Label className="text-muted-foreground">Answers</Label>
                <pre className="mt-2 rounded-lg bg-muted p-4 text-sm overflow-x-auto">
                  {JSON.stringify(selectedSubmission.answers, null, 2)}
                </pre>
              </div>

              {selectedSubmission.task?.category === "data_labeling" && (
                <DataLabelingReviewBreakdown submission={selectedSubmission} />
              )}

              {selectedSubmission.status === "flagged" && (
                <div className="space-y-2">
                  <Label htmlFor="note">Admin Note</Label>
                  <Textarea
                    id="note"
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Required when declining"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleDecision(selectedSubmission.id, "approved")}
                      disabled={reviewing}
                    >
                      <Check className="mr-2 h-4 w-4" /> Approve & Credit
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleDecision(selectedSubmission.id, "declined")}
                      disabled={reviewing}
                    >
                      <X className="mr-2 h-4 w-4" /> Decline
                    </Button>
                  </div>
                  {selectedSubmission.task?.category === "social_engagement" && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleReviewAction(selectedSubmission.id, "ban_task")}
                        disabled={reviewing}
                      >
                        Ban from Task
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleReviewAction(selectedSubmission.id, "flag_fraud")}
                        disabled={reviewing}
                      >
                        Flag Account
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DataLabelingReviewBreakdown({ submission }: { submission: Submission }) {
  const detail = submission.grading_detail ?? {};
  const itemResults = Array.isArray(detail.itemResults)
    ? detail.itemResults as Array<Record<string, unknown>>
    : [];
  const taskData = submission.task?.task_data ?? {};
  const items = Array.isArray(taskData.items) ? taskData.items as Array<Record<string, unknown>> : [];
  const correct = Number(detail.correct ?? itemResults.filter((item) => item.correct === true).length);
  const total = Number(detail.total ?? items.length);
  const score = Number(detail.score ?? submission.ai_score ?? 0);

  return (
    <div className="space-y-2">
      <Label className="text-muted-foreground">Labeling Breakdown</Label>
      <p className="text-sm font-medium">{correct}/{total} correct ({Math.round(score)}%)</p>
      <div className="overflow-x-auto rounded-lg border">
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
            {itemResults.map((result) => {
              const item = items.find((candidate) => candidate.id === result.id);
              const content = String(item?.content ?? "");
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
    </div>
  );
}

function SocialSubmissionBadges({ taskData }: { taskData?: Record<string, unknown> | null }) {
  const platform = normalizeSocialPlatform(taskData?.platform);
  const action = normalizeSocialAction(taskData?.action);

  return (
    <div className="mt-1 flex flex-wrap gap-1">
      <Badge
        style={{
          backgroundColor: PLATFORM_COLORS[platform],
          borderColor: PLATFORM_COLORS[platform],
          color: "white",
        }}
      >
        {PLATFORM_LABELS[platform]}
      </Badge>
      <Badge variant="outline">{ACTION_LABELS[action]}</Badge>
    </div>
  );
}

function SocialEngagementReviewDetails({ submission }: { submission: Submission }) {
  const taskData = submission.task?.task_data ?? {};
  const platform = normalizeSocialPlatform(taskData.platform);
  const action = normalizeSocialAction(taskData.action);
  const detail = submission.grading_detail ?? {};
  const checks = isRecord(detail.checks) ? detail.checks : {};
  const issues = Array.isArray(detail.issues) ? detail.issues.map(String) : [];

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap gap-2">
        <Badge
          style={{
            backgroundColor: PLATFORM_COLORS[platform],
            borderColor: PLATFORM_COLORS[platform],
            color: "white",
          }}
        >
          {PLATFORM_LABELS[platform]}
        </Badge>
        <Badge variant="outline">{ACTION_LABELS[action]}</Badge>
      </div>

      {submission.screenshot_signed_url && (
        <div>
          <Label className="text-muted-foreground">Screenshot</Label>
          <a href={submission.screenshot_signed_url} target="_blank" rel="noopener noreferrer">
            <img
              src={submission.screenshot_signed_url}
              alt="Submitted proof screenshot"
              className="mt-2 max-h-[520px] w-full rounded-lg border object-contain"
            />
          </a>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <ReviewField label="Username" value={String(submission.answers?.username ?? "Not provided")} />
        <ReviewField label="Comment / Review Text" value={String(submission.answers?.text_input ?? "Not provided")} />
        <ReviewField
          label="Activated"
          value={
            submission.account_status?.activated_at
              ? new Date(submission.account_status.activated_at).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })
              : "Unknown"
          }
        />
        <ReviewField label="Risk Score" value={String(submission.user_verification?.risk_score ?? 0)} />
      </div>

      <div>
        <Label className="text-muted-foreground">AI Checks</Label>
        <div className="mt-2 overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Check</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["Correct platform", checks.correct_platform],
                ["Target visible", checks.target_visible],
                ["Action completed", checks.action_completed],
                ["Looks authentic", checks.looks_authentic],
              ].map(([label, value]) => (
                <TableRow key={String(label)}>
                  <TableCell>{String(label)}</TableCell>
                  <TableCell>{value === true ? "Pass" : value === false ? "Fail" : "Unknown"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {issues.length > 0 && (
        <div>
          <Label className="text-muted-foreground">AI Issues</Label>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label className="text-muted-foreground">{label}</Label>
      <p className="text-sm">{value}</p>
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
