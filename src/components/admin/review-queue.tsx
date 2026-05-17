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

type Submission = {
  id: string;
  task_id: string;
  user_id: string;
  submitted_at: string;
  answers: Record<string, unknown>;
  status: string;
  ai_score: number | null;
  ai_reasoning: string | null;
  task: {
    title: string;
    category: string;
    payout_ksh: number;
    instructions: string;
  };
  profile: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  };
};

export function ReviewQueue() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("flagged");
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewing, setReviewing] = useState(false);

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
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDecision(submissionId: string, decision: "approved" | "declined") {
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
                <TableHead>User</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Category</TableHead>
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
                    <div>
                      <p className="font-medium">{sub.profile?.full_name ?? "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{sub.profile?.email ?? ""}</p>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{sub.task?.title}</TableCell>
                  <TableCell>
                    <Badge variant="muted">{sub.task?.category}</Badge>
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

              <div>
                <Label className="text-muted-foreground">Answers</Label>
                <pre className="mt-2 rounded-lg bg-muted p-4 text-sm overflow-x-auto">
                  {JSON.stringify(selectedSubmission.answers, null, 2)}
                </pre>
              </div>

              {selectedSubmission.status === "flagged" && (
                <div className="space-y-2">
                  <Label htmlFor="note">Admin Note</Label>
                  <Textarea
                    id="note"
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Optional note to user"
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
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
