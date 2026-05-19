import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TrainingProgramSnapshot } from "@/lib/training";
import type { TaskCatalogEntry } from "@/lib/tasks";

type TaskGatePanelProps = {
  task: TaskCatalogEntry;
  access: TrainingProgramSnapshot;
};

export function TaskGatePanel({ task, access }: TaskGatePanelProps) {
  const isTaskPreparation = access.gateReason === "tasks_locked";

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-3xl items-center justify-center px-4 py-10">
      <Card className="w-full border-outline-variant/40">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Badge variant="muted">{task.category}</Badge>
            <Badge
              variant={
                task.difficulty === "Easy"
                  ? "success"
                  : task.difficulty === "Medium"
                    ? "warning"
                    : "destructive"
              }
            >
              {task.difficulty}
            </Badge>
          </div>
          <CardTitle className="text-2xl text-navy">{task.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">{task.summary}</p>

          <div className="rounded-3xl border border-amber-500/25 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-5 w-5 text-amber-600" />
              <div>
                <p className="font-semibold text-amber-900">
                  {isTaskPreparation ? "Your personalized tasks are being prepared" : "Your task dashboard is not ready yet"}
                </p>
                <p className="mt-1 text-sm text-amber-800">
                  {access.gateMessage}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 rounded-3xl border border-outline-variant/40 bg-surface-container-low p-5 text-sm text-muted-foreground sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Estimated time
              </p>
              <p className="mt-2 text-base font-semibold text-foreground">
                {task.estimatedTime}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Potential payout
              </p>
              <p className="mt-2 text-base font-semibold text-foreground">
                KSh {task.payout}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button asChild className="flex-1">
              <Link
                href={
                  !access.activated
                    ? "/dashboard/activate"
                    : isTaskPreparation
                      ? "/dashboard/referrals"
                      : "/dashboard/training"
                }
              >
                {!access.activated
                  ? "Activate account"
                  : isTaskPreparation
                    ? "View referrals"
                    : "Finish training"}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/dashboard/tasks">Back to tasks</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
