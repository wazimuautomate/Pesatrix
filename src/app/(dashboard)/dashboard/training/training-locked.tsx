import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TrainingLocked() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-outline-variant/40 bg-white p-8 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Lock className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-2xl font-bold text-navy">Training Complete</h2>
      <p className="mt-3 max-w-md text-muted-foreground">
        You have already completed the training. This section is no longer accessible.
      </p>
      <Button asChild className="mt-8">
        <Link href="/dashboard">Back to Dashboard</Link>
      </Button>
    </div>
  );
}