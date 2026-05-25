"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, MessageSquareText, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SmsTestResult = {
  status: "ok" | "error";
  phone: string | null;
  message_id: string | null;
  error: string | null;
};

export function SmsHealthPanel({ adminPhone }: { adminPhone?: string | null }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<SmsTestResult | null>(null);

  async function runTest() {
    setTesting(true);
    try {
      const response = await fetch("/api/admin/sms/test", { method: "POST" });
      const payload = await response.json();
      setResult(payload);
      if (!response.ok || payload.status !== "ok") {
        toast.error(payload?.error ?? "SMS test failed");
        return;
      }
      toast.success("SMS test sent");
    } catch {
      toast.error("Unable to run SMS test");
    } finally {
      setTesting(false);
    }
  }

  const healthy = result?.status === "ok";

  return (
    <Card className="mt-6 border border-outline-variant/40 shadow-sm">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-lg text-navy">
          SMS Notifications
          <Badge variant={adminPhone ? "success" : "warning"}>
            {adminPhone ? "Phone configured" : "Phone missing"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={runTest} disabled={testing}>
            {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquareText className="mr-2 h-4 w-4" />}
            Send SMS Test
          </Button>
          {adminPhone ? (
            <span className="font-mono text-xs text-muted-foreground">{adminPhone}</span>
          ) : (
            <span className="text-sm text-muted-foreground">Set admin_sms_phone in the General settings group.</span>
          )}
        </div>

        {result ? (
          <div className="rounded-md border border-outline-variant/40 bg-white p-4 text-sm">
            <div className="flex items-center gap-2 font-semibold text-navy">
              {healthy ? <CheckCircle2 className="h-4 w-4 text-teal" /> : <XCircle className="h-4 w-4 text-destructive" />}
              {result.status.toUpperCase()}
            </div>
            {result.phone ? <p className="mt-2 font-mono text-xs text-muted-foreground">{result.phone}</p> : null}
            {result.message_id ? <p className="mt-2 text-xs text-muted-foreground">Message ID: {result.message_id}</p> : null}
            {result.error ? <p className="mt-2 text-destructive">{result.error}</p> : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Sends a real BlazeTech SCOPE message using the same path as task-review and withdrawal alerts.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
