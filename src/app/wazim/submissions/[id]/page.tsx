"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Check, X, Flag, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { AdminPageShell } from "@/components/admin/admin-native";

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

type Submission = {
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
  admin_decision: string | null;
  admin_note: string | null;
  payout_credited: boolean;
  task: {
    title: string;
    category: string;
    payout_ksh: number;
    instructions: string;
    task_data: Record<string, unknown> | null;
  };
  profile: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  };
};

export default function SubmissionDetailPage() {
  return (
    <AdminPageShell
      admin={{ userId: "", email: null, role: "", adminUserId: "" }}
      title="Submission Detail"
      description="Review submission details, AI grading, and take admin action."
    >
      <SubmissionDetail />
    </AdminPageShell>
  );
}

function SubmissionDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionDialog, setActionDialog] = useState<"approve" | "decline" | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetchSubmission() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/submissions/${id}`);
        if (!res.ok) {
          toast.error("Failed to load submission");
          return;
        }
        const data = await res.json();
        setSubmission(data.submission);
      } finally {
        setLoading(false);
      }
    }
    fetchSubmission();
  }, [id]);

  async function handleDecision(decision: "approved" | "declined") {
    if (decision === "declined" && !reason.trim()) {
      toast.error("Reason is required when declining");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/submissions/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reason: reason.trim() || null }),
      });

      if (!res.ok) {
        const err = await res.json();
        if (err.error?.code === "ALREADY_CREDITED") {
          toast.error("This submission has already been credited");
        } else {
          toast.error(err.error?.message ?? "Failed to process decision");
        }
        return;
      }

      toast.success(`Submission ${decision}`);
      setActionDialog(null);
      setReason("");

      const refreshed = await fetch(`/api/admin/submissions/${id}`);
      if (refreshed.ok) {
        const data = await refreshed.json();
        setSubmission(data.submission);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-pesatrix-blue" />
      </div>
    );
  }

  if (!submission) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Submission not found.
        </CardContent>
      </Card>
    );
  }

  const isProcessed = submission.status === "admin_reviewed" || submission.payout_credited;

  function renderAnswers(answers: Record<string, unknown>) {
    if (!answers || typeof answers !== "object") {
      return (
        <pre className="mt-2 rounded-lg bg-muted p-4 text-sm overflow-x-auto">
          {JSON.stringify(answers, null, 2)}
        </pre>
      );
    }

    const entries = Object.entries(answers);
    if (entries.length === 0) {
      return <p className="text-sm text-muted-foreground mt-2">No answers provided.</p>;
    }

    return (
      <div className="mt-2 space-y-3">
        {entries.map(([key, value]) => (
          <div key={key} className="rounded-lg border border-outline-variant/40 bg-white p-3">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {key}
            </Label>
            <p className="mt-1 text-sm whitespace-pre-wrap">
              {typeof value === "string"
                ? value
                : typeof value === "object" && value !== null
                  ? JSON.stringify(value, null, 2)
                  : String(value)}
            </p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/wazim/submissions")}
        className="mb-2"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Submissions
      </Button>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-6 space-y-6">
            <div>
              <h2 className="text-lg font-bold text-navy">{submission.task?.title}</h2>
              <div className="mt-1 flex flex-wrap gap-2">
                <Badge variant="muted">{submission.task?.category}</Badge>
                <Badge variant="outline">{money(submission.task?.payout_ksh)}</Badge>
                {submission.payout_credited && <Badge variant="success">Paid</Badge>}
                {submission.ai_score === null && submission.status === "pending" && (
                  <Badge variant="warning">Pending AI</Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <Label className="text-muted-foreground">User</Label>
                <p className="font-medium">{submission.profile?.full_name ?? "Unknown"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Phone</Label>
                <p className="font-medium">{submission.profile?.phone ?? "N/A"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Email</Label>
                <p className="font-medium">{submission.profile?.email ?? "N/A"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Submitted</Label>
                <p className="font-medium">{shortDate(submission.submitted_at)}</p>
              </div>
            </div>

            {submission.ai_score != null && (
              <div>
                <Label className="text-muted-foreground">AI Score</Label>
                <div className="mt-2">
                  <div className="flex items-center gap-3">
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${
                          submission.ai_score >= 70
                            ? "bg-teal"
                            : submission.ai_score >= 40
                              ? "bg-amber-500"
                              : "bg-destructive"
                        }`}
                        style={{ width: `${submission.ai_score}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-navy">{submission.ai_score}%</span>
                  </div>
                </div>
              </div>
            )}

            {submission.ai_reasoning && (
              <div>
                <Label className="text-muted-foreground">AI Reasoning</Label>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {submission.ai_reasoning}
                </p>
              </div>
            )}

            {submission.screenshot_url && (
              <div>
                <Label className="text-muted-foreground">Screenshot</Label>
                <div className="mt-2">
                  <a
                    href={submission.screenshot_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-pesatrix-blue hover:underline"
                  >
                    <ImageIcon className="h-4 w-4" />
                    View Screenshot
                  </a>
                </div>
              </div>
            )}

            {submission.submitted_url && (
              <div>
                <Label className="text-muted-foreground">Submitted URL</Label>
                <div className="mt-2">
                  <a
                    href={submission.submitted_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-pesatrix-blue hover:underline"
                  >
                    {submission.submitted_url}
                  </a>
                </div>
              </div>
            )}

            <div>
              <Label className="text-muted-foreground">Answers</Label>
              {renderAnswers(submission.answers ?? {})}
            </div>

            {submission.admin_note && (
              <div>
                <Label className="text-muted-foreground">Admin Note</Label>
                <p className="mt-1 text-sm text-muted-foreground">{submission.admin_note}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h3 className="text-sm font-bold text-navy">Status</h3>
              <Badge
                variant={
                  submission.status === "approved"
                    ? "success"
                    : submission.status === "declined"
                      ? "destructive"
                      : submission.status === "flagged"
                        ? "warning"
                        : submission.status === "admin_reviewed"
                          ? "muted"
                          : "warning"
                }
              >
                {submission.status.replace("_", " ")}
              </Badge>

              {submission.admin_decision && (
                <div className="text-sm">
                  <Label className="text-muted-foreground">Admin Decision</Label>
                  <p className="font-medium capitalize">{submission.admin_decision}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {!isProcessed && (
            <Card>
              <CardContent className="p-6 space-y-3">
                <h3 className="text-sm font-bold text-navy">Actions</h3>
                <Button
                  className="w-full"
                  onClick={() => setActionDialog("approve")}
                >
                  <Check className="mr-2 h-4 w-4" /> Approve & Credit
                </Button>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => setActionDialog("decline")}
                >
                  <X className="mr-2 h-4 w-4" /> Decline
                </Button>
              </CardContent>
            </Card>
          )}

          {isProcessed && (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                {submission.payout_credited
                  ? "This submission has been paid. No further actions available."
                  : "This submission has already been reviewed."}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={!!actionDialog} onOpenChange={(open) => { if (!open) { setActionDialog(null); setReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog === "approve" ? "Approve Submission" : "Decline Submission"}
            </DialogTitle>
            <DialogDescription>
              {actionDialog === "approve"
                ? "This will credit the user's wallet with the task payout. The funds will be available after 7 days."
                : "Provide a reason for declining this submission."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <Label htmlFor="reason">
              {actionDialog === "decline" ? "Reason (required)" : "Note (optional)"}
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                actionDialog === "decline"
                  ? "Explain why this submission is being declined..."
                  : "Add an optional note..."
              }
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionDialog(null); setReason(""); }}>
              Cancel
            </Button>
            <Button
              variant={actionDialog === "decline" ? "destructive" : "default"}
              onClick={() => handleDecision(actionDialog === "approve" ? "approved" : "declined")}
              disabled={submitting || (actionDialog === "decline" && !reason.trim())}
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : actionDialog === "approve" ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <X className="mr-2 h-4 w-4" />
              )}
              {actionDialog === "approve" ? "Approve" : "Decline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
