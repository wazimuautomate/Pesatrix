import Link from "next/link";
import { BookOpen, CheckCircle2, Clock, PlayCircle, Trophy } from "lucide-react";

import { AdminPageShell, EmptyState } from "@/components/admin/admin-native";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrainingDetailPanel } from "./components/TrainingDetailPanel";
import { requireWazimAdmin } from "@/lib/wazim-admin";
import { fetchAdminTrainingList } from "@/lib/admin-training";

const PAGE_SIZE = 50;

type SearchParams = Promise<{ search?: string; status?: string; page?: string }>;

export default async function AdminTrainingPage(props: { searchParams: SearchParams }) {
  const adminSession = await requireWazimAdmin();
  const params = await props.searchParams;
  const search = params.search?.trim() ?? "";
  const statusFilter = params.status ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1", 10));

  try {
    const { counts, items, totalPages } = await fetchAdminTrainingList({
      page,
      limit: PAGE_SIZE,
      search,
      status: statusFilter,
    });

    const cardItems = [
      { label: "Not Started", value: counts.not_started, icon: BookOpen, color: "gray" as const, detail: "Users who haven't started training" },
      { label: "In Progress", value: counts.in_progress, icon: PlayCircle, color: "blue" as const, detail: "Actively working through training" },
      { label: "Awaiting Test", value: counts.awaiting_test, icon: Clock, color: "amber" as const, detail: "Waiting for stage test completion" },
      { label: "Completed", value: counts.completed, icon: CheckCircle2, color: "green" as const, detail: "Finished the full training program" },
      { label: "Reward Linked", value: counts.reward_paid, icon: Trophy, color: "teal" as const, detail: "Completion reward transaction recorded" },
    ];

    return (
      <AdminPageShell
        admin={adminSession}
        title="Training"
        description="Monitor real training progress records, search learners, and adjust user progress when support intervention is required."
      >
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {cardItems.map((card) => (
            <SummaryCard key={card.label} {...card} />
          ))}
        </section>

        <Card className="mt-6 border border-outline-variant/40 shadow-sm">
          <CardContent className="p-5">
            <form className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Input
                  name="search"
                  placeholder="Search by name, phone, email, or user ID..."
                  defaultValue={search}
                  className="w-full"
                />
              </div>
              <select
                name="status"
                defaultValue={statusFilter}
                className="flex h-10 w-44 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="">All Statuses</option>
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="awaiting_test">Awaiting Test</option>
                <option value="completed">Completed</option>
              </select>
              <Button type="submit" size="sm">Filter</Button>
              {(search || statusFilter) && (
                <Button asChild size="sm" variant="outline">
                  <Link href="/wazim/training">Clear</Link>
                </Button>
              )}
            </form>

            {items.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Current Day</TableHead>
                        <TableHead>Current Stage</TableHead>
                        <TableHead>Completed Days</TableHead>
                        <TableHead>Attempts</TableHead>
                        <TableHead>Reward</TableHead>
                        <TableHead>Last Activity</TableHead>
                        <TableHead>Completed At</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((row) => (
                        <TableRow key={row.user_id}>
                          <TableCell>
                            <div className="space-y-1">
                              <Link
                                className="font-semibold text-pesatrix-blue hover:underline"
                                href={`/wazim/users/${row.user_id}`}
                              >
                                {row.profile?.full_name ?? row.profile?.email ?? row.user_id.slice(0, 8)}
                              </Link>
                              <div className="text-xs text-muted-foreground">
                                {row.profile?.phone ?? row.profile?.email ?? row.user_id}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <TrainingStatusBadge status={row.status} />
                          </TableCell>
                          <TableCell className="text-sm font-medium">{row.current_day}</TableCell>
                          <TableCell className="text-sm font-medium">{row.current_stage}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.completed_days_count > 0 ? row.completed_days.join(", ") : "—"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{row.stage_attempt}</TableCell>
                          <TableCell>
                            <Badge variant={row.is_reward_paid ? "success" : "muted"}>
                              {row.is_reward_paid ? "Credited" : "Pending"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.last_completed_at ? formatDate(row.last_completed_at) : formatDate(row.updated_at)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.completed_at ? formatDate(row.completed_at) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <TrainingDetailPanel userId={row.user_id} adminRole={adminSession.role} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Pagination page={page} totalPages={totalPages} search={search} status={statusFilter} />
              </>
            ) : (
              <EmptyState>No training progress records match your filters.</EmptyState>
            )}
          </CardContent>
        </Card>
      </AdminPageShell>
    );
  } catch (error) {
    console.error("[AdminTrainingPage]", error);

    return (
      <AdminPageShell
        admin={adminSession}
        title="Training"
        description="Monitor real training progress records, search learners, and adjust user progress when support intervention is required."
      >
        <Card className="border border-destructive/30 shadow-sm">
          <CardContent className="p-5 text-sm text-muted-foreground">
            Failed to load training progress records. Refresh the page or inspect the training tables and policies.
          </CardContent>
        </Card>
      </AdminPageShell>
    );
  }
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
  detail,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: "gray" | "blue" | "amber" | "green" | "teal";
  detail: string;
}) {
  const colorMap = {
    gray: { bar: "bg-gray-400", icon: "text-gray-400", text: "text-gray-700" },
    blue: { bar: "bg-pesatrix-blue", icon: "text-pesatrix-blue", text: "text-pesatrix-blue" },
    amber: { bar: "bg-amber-500", icon: "text-amber-500", text: "text-amber-700" },
    green: { bar: "bg-green-500", icon: "text-green-500", text: "text-green-700" },
    teal: { bar: "bg-teal", icon: "text-teal", text: "text-teal" },
  };

  const colors = colorMap[color];

  return (
    <Card className="border border-outline-variant/40 shadow-sm">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className={`h-2 w-14 rounded-full ${colors.bar}`} />
          <Icon className={`h-5 w-5 ${colors.icon}`} />
        </div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className={`mt-2 text-3xl font-bold ${colors.text}`}>{value.toLocaleString()}</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function TrainingStatusBadge({ status }: { status: string }) {
  const styles: Record<string, { variant: "muted" | "warning" | "success"; className?: string }> = {
    not_started: { variant: "muted" },
    in_progress: { variant: "muted", className: "bg-pesatrix-blue text-white border-transparent" },
    awaiting_test: { variant: "warning" },
    completed: { variant: "success" },
  };

  const style = styles[status] ?? { variant: "muted" as const };

  return (
    <Badge variant={style.variant} className={style.className}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

function Pagination({
  page,
  totalPages,
  search,
  status,
}: {
  page: number;
  totalPages: number;
  search: string;
  status: string;
}) {
  if (totalPages <= 1) return null;

  const qs = new URLSearchParams();
  if (search) qs.set("search", search);
  if (status) qs.set("status", status);

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
      <span>Page {page} of {totalPages}</span>
      <div className="flex gap-2">
        {page > 1 && (
          <Button asChild size="sm" variant="outline">
            <Link href={`/wazim/training?${qs.toString()}&page=${page - 1}`}>Previous</Link>
          </Button>
        )}
        {page < totalPages && (
          <Button asChild size="sm" variant="outline">
            <Link href={`/wazim/training?${qs.toString()}&page=${page + 1}`}>Next</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi",
  }).format(date);
}
