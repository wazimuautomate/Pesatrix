"use client";

import { useState } from "react";
import { Loader2, RefreshCw, Eye, EyeOff, Copy, ExternalLink, CheckCircle, AlertCircle, Globe } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function CronSettingsForm({ appUrl }: { appUrl: string }) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncedJob, setSyncedJob] = useState<{ jobId: number; action: string } | null>(null);

  const targetUrl = `${appUrl.endsWith("/") ? appUrl.slice(0, -1) : appUrl}/api/cron/release-tasks`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(targetUrl);
      toast.success("Target URL copied to clipboard");
    } catch {
      toast.error("Failed to copy URL");
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!apiKey.trim()) {
      toast.error("Please enter your cron-job.org API Key.");
      return;
    }

    setLoading(true);
    setSyncedJob(null);

    try {
      const response = await fetch("/api/admin/cron-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data?.error ?? "Failed to sync with cron-job.org");
        return;
      }

      setSyncedJob({
        jobId: data.jobId,
        action: data.action,
      });

      toast.success(
        `Cron job successfully ${data.action === "created" ? "registered" : "updated"} on cron-job.org!`
      );
    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred while setting up the cron job.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="mt-6 border border-outline-variant/40 shadow-sm transition-all duration-300 hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-lg text-navy flex items-center gap-2">
            <Globe className="h-5 w-5 text-indigo-500 animate-pulse" />
            cron-job.org Task Release Automation
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Migrate task release trigger from Vercel Crons to cron-job.org to avoid Hobby account limits.
          </p>
        </div>
        <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">
          Hourly Trigger
        </Badge>
      </CardHeader>
      <CardContent className="mt-4 space-y-6">
        {/* Dynamic target url display */}
        <div className="rounded-lg border border-indigo-100 bg-gradient-to-r from-indigo-50/30 to-blue-50/20 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-800">
              Target Cron Endpoint
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100/50"
                onClick={handleCopy}
                type="button"
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy
              </Button>
              <a
                href="https://console.cron-job.org"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                Console <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </div>
          </div>
          <code className="block select-all break-all rounded border border-indigo-100/50 bg-white p-2.5 text-xs text-navy font-mono">
            {targetUrl}
          </code>
          <p className="text-xs text-muted-foreground">
            This endpoint handles hourly releasing of Day 2-6 starter tasks. It validates invocations using the{" "}
            <span className="font-mono text-navy bg-slate-100 px-1 rounded">x-cron-secret</span> header.
          </p>
        </div>

        {/* Sync Status Feedback */}
        {syncedJob && (
          <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 animate-fadeIn">
            <CheckCircle className="mt-0.5 h-5 w-5 text-emerald-600 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-emerald-800">
                Cron job successfully synchronized!
              </p>
              <p className="text-xs text-emerald-700">
                Job ID on cron-job.org is <span className="font-mono font-bold">{syncedJob.jobId}</span> (Status:{" "}
                {syncedJob.action === "created" ? "Newly Created" : "Updated/Synced"}).
                The system will now run this job at minute 0 of every hour.
              </p>
            </div>
          </div>
        )}

        {/* Action Form */}
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cron-job-api-key" className="text-navy font-medium">
              cron-job.org API Key
            </Label>
            <div className="relative">
              <Input
                id="cron-job-api-key"
                placeholder="Enter zaX78aqK..."
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="pr-10 border-outline-variant/60 focus:border-indigo-400"
                disabled={loading}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-navy"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-amber-500" />
              Your API key is used strictly on demand to configure the cron job and is never saved permanently.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm transition-all duration-200"
              disabled={loading}
              type="submit"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Synchronizing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Register & Sync Cron Job
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
