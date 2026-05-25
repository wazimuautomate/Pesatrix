"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type AiTestResult = {
  model: string;
  status: "ok" | "timeout" | "error";
  latency_ms: number;
  response_preview: string;
  error: string | null;
};

export function AiHealthPanel({ initialStuckCount }: { initialStuckCount: number }) {
  const [result, setResult] = useState<AiTestResult | null>(null);
  const [stuckCount, setStuckCount] = useState(initialStuckCount);
  const [testing, setTesting] = useState(false);
  const [flushing, setFlushing] = useState(false);

  async function runTest() {
    setTesting(true);
    try {
      const response = await fetch("/api/admin/ai/test", { method: "POST" });
      const payload = await response.json();
      setResult(payload);
      if (!response.ok) {
        toast.error(payload?.error ?? "AI test failed");
      }
    } catch {
      toast.error("Unable to run AI grading test");
    } finally {
      setTesting(false);
    }
  }

  async function flushStuck() {
    setFlushing(true);
    try {
      const response = await fetch("/api/admin/ai/flush-stuck", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        toast.error(payload?.error ?? "Failed to flush submissions");
        return;
      }
      setStuckCount(Math.max(0, stuckCount - Number(payload.count ?? 0)));
      toast.success(`Flushed ${Number(payload.count ?? 0)} stuck submission(s)`);
    } catch {
      toast.error("Unable to flush stuck submissions");
    } finally {
      setFlushing(false);
    }
  }

  const healthy = result?.status === "ok";

  return (
    <Card className="mt-6 border border-outline-variant/40 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3 text-lg text-navy">
          AI Grading Status
          <Badge variant={stuckCount > 0 ? "warning" : "success"}>
            {stuckCount} stuck
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={runTest} disabled={testing}>
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Run Test
          </Button>
          <Button variant="outline" onClick={flushStuck} disabled={flushing || stuckCount === 0}>
            {flushing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Flush Stuck Submissions
          </Button>
        </div>

        {result ? (
          <div className="rounded-md border border-outline-variant/40 bg-white p-4 text-sm">
            <div className="flex items-center gap-2 font-semibold text-navy">
              {healthy ? <CheckCircle2 className="h-4 w-4 text-teal" /> : <XCircle className="h-4 w-4 text-destructive" />}
              {result.status.toUpperCase()} - {result.latency_ms.toLocaleString()} ms
            </div>
            <p className="mt-2 font-mono text-xs text-muted-foreground">{result.model}</p>
            {result.error ? <p className="mt-2 text-destructive">{result.error}</p> : null}
            {result.response_preview ? (
              <pre className="mt-3 max-h-32 overflow-auto rounded bg-muted p-3 text-xs text-muted-foreground">
                {result.response_preview}
              </pre>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Run a live OpenRouter request to measure current grading latency.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
