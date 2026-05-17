import Link from "next/link";
import { ArrowRight, CheckCircle2, ClipboardList, Clock, ShieldCheck, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = {
  title: "Task Preview",
};

const previewTasks = [
  {
    title: "Survey response quality check",
    category: "Survey",
    payout: "KSh 35",
    time: "6 min",
    body: "Answer a short partner survey and submit the completion evidence requested in the task brief.",
  },
  {
    title: "Product listing verification",
    category: "Verification",
    payout: "KSh 45",
    time: "8 min",
    body: "Compare listing details against instructions and submit notes only after checking each required field.",
  },
  {
    title: "Content review summary",
    category: "Review",
    payout: "KSh 60",
    time: "12 min",
    body: "Read a short content sample, summarize it clearly, and attach the requested proof before submission.",
  },
];

const rules = [
  "Tasks unlock after required setup, activation, and training checks.",
  "Each active task shows payout, category, difficulty, slots, and evidence requirements.",
  "Approved work can credit the wallet; rejected or incomplete work does not qualify.",
];

export default function TaskPreviewPage() {
  return (
    <div className="min-h-screen bg-surface-container-lowest px-4 py-8 text-navy sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col gap-5 rounded-[8px] bg-white p-6 shadow-sm sm:p-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge variant="outline" className="mb-4">Preview</Badge>
            <h1 className="font-display text-4xl font-black leading-tight tracking-normal text-navy sm:text-5xl">
              See how Pesatrix tasks work.
            </h1>
            <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-on-surface-variant">
              This preview shows the task structure users see after completing the required account and training steps.
            </p>
          </div>
          <Button asChild className="rounded-full bg-navy px-6 font-black">
            <Link href="/tasks">
              Open available tasks
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {previewTasks.map((task) => (
            <Card key={task.title} className="border-outline-variant/40">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="secondary">{task.category}</Badge>
                  <span className="font-bold text-secondary">{task.payout}</span>
                </div>
                <CardTitle className="text-xl text-navy">{task.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium leading-relaxed text-on-surface-variant">
                  {task.body}
                </p>
                <div className="mt-5 flex items-center gap-2 text-sm font-bold text-on-surface-variant">
                  <Clock className="h-4 w-4 text-secondary" />
                  {task.time}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="border-outline-variant/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-navy">
                <ShieldCheck className="h-5 w-5 text-secondary" />
                Task access rules
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {rules.map((rule) => (
                <div key={rule} className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
                  <p className="text-sm font-medium leading-relaxed text-on-surface-variant">
                    {rule}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-outline-variant/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-navy">
                <ClipboardList className="h-5 w-5 text-secondary" />
                Submission flow
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-[8px] bg-accent p-4">
                  <ClipboardList className="h-5 w-5 text-pesatrix-blue" />
                  <p className="mt-3 text-sm font-black text-navy">Read</p>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-on-surface-variant">
                    Review requirements before starting.
                  </p>
                </div>
                <div className="rounded-[8px] bg-teal-container p-4">
                  <CheckCircle2 className="h-5 w-5 text-secondary" />
                  <p className="mt-3 text-sm font-black text-navy">Submit</p>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-on-surface-variant">
                    Attach evidence and complete fields.
                  </p>
                </div>
                <div className="rounded-[8px] bg-surface-container-low p-4">
                  <Wallet className="h-5 w-5 text-navy" />
                  <p className="mt-3 text-sm font-black text-navy">Earn</p>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-on-surface-variant">
                    Approved work can credit wallet.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
