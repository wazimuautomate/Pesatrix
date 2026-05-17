import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Badge } from "@/components/ui/badge";
import { AdminPageShell, EmptyState } from "@/components/admin/admin-native";
import { TrainingDetailPanel } from "./components/TrainingDetailPanel";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireWazimAdmin } from "@/lib/wazim-admin";
import { BookOpen, PlayCircle, Clock, CheckCircle2 } from "lucide-react";

const PAGE_SIZE = 50;

type SearchParams = Promise<{ search?: string; status?: string; page?: string }>;

export default async function AdminTrainingPage(props: { searchParams: SearchParams }) {
  const adminSession = await requireWazimAdmin();
  const params = await props.searchParams;
  const search = params.search?.trim() ?? "";
  const statusFilter = params.status ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1", 10));

  const admin = createAdminSupabaseClient();

  const [{ data: countRows }, { data: allData }] = await Promise.all([
    admin
      .from("training_progress")
      .select("status, reward_transaction_id, next_day_unlock_at"),
    (() => {
      let query = admin
        .from("training_progress")
        .select(
          "user_id, status, current_day, current_stage, completed_days, failed_stage_attempts, next_day_unlock_at, last_completed_at, completed_at, reward_transaction_id, updated_at, profiles(full_name, phone, email)"
        )
        .order("updated_at", { ascending: false });

      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }

      return query;
    })(),
  ]);

  const now = new Date();

  const counts = {
    not_started: countRows?.filter((r: any) => r.status === "not_started").length ?? 0,
    in_progress: countRows?.filter((r: any) => r.status === "in_progress").length ?? 0,
    awaiting_test: countRows?.filter((r: any) => r.status === "awaiting_test").length ?? 0,
    completed: countRows?.filter((r: any) => r.status === "completed").length ?? 0,
  };

  const allRows = allData ?? [];
  let filtered = allRows;

  if (search) {
    const lower = search.toLowerCase();
    filtered = filtered.filter((r: any) => {
      const name = (r.profiles?.full_name ?? "").toLowerCase();
      const phone = (r.profiles?.phone ?? "").toLowerCase();
      return name.includes(lower) || phone.includes(lower);
    });
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const start = (page - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  const cardItems = [
    { label: "Not Started", value: counts.not_started, icon: BookOpen, color: "gray" as const, detail: "Users who haven't started the training program" },
    { label: "In Progress", value: counts.in_progress, icon: PlayCircle, color: "blue" as const, detail: "Actively working through training days" },
    { label: "Awaiting Test", value: counts.awaiting_test, icon: Clock, color: "amber" as const, detail: "Waiting for stage test review" },
    { label: "Completed", value: counts.completed, icon: CheckCircle2, color: "green" as const, detail: "Finished all 7 days successfully" },
  ];

  return (
    <AdminPageShell
      admin={adminSession}
      title="Training"
      description="Monitor the 7-day training program, review learner progress, and manage user training state."
    >
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cardItems.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </section>

      <Card className="mt-6 border border-outline-variant/40 shadow-sm">
        <CardContent className="p-5">
          <form className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] flex-1">
              <Input
                name="search"
                placeholder="Search by name or phone..."
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

          {pageItems.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Current Day</TableHead>
                      <TableHead>Current Stage</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead>Completed At</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageItems.map((row: any) => (
                      <TableRow key={row.user_id}>
                        <TableCell>
                          <Link
                            className="font-semibold text-pesatrix-blue hover:underline"
                            href={`/wazim/users/${row.user_id}`}
                          >
                            {row.profiles?.full_name ?? row.profiles?.email ?? row.user_id.slice(0, 8)}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.profiles?.phone ?? "—"}
                        </TableCell>
                        <TableCell>
                          <TrainingStatusBadge status={row.status} />
                        </TableCell>
                        <TableCell>
                          {row.status === "completed" ? (
                            <span className="text-sm text-muted-foreground">—</span>
                          ) : (
                            <span className="text-sm font-medium">{row.current_day ?? 1}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.status === "completed" ? (
                            <span className="text-sm text-muted-foreground">—</span>
                          ) : (
                            <span className="text-sm font-medium">{row.current_stage ?? 1}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.last_completed_at
                            ? formatDate(row.last_completed_at)
                            : row.updated_at
                              ? formatDate(row.updated_at)
                              : "—"}
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
  color: "gray" | "blue" | "amber" | "green";
  detail: string;
}) {
  const colorMap = {
    gray: { bar: "bg-gray-400", icon: "text-gray-400", text: "text-gray-700" },
    blue: { bar: "bg-pesatrix-blue", icon: "text-pesatrix-blue", text: "text-pesatrix-blue" },
    amber: { bar: "bg-amber-500", icon: "text-amber-500", text: "text-amber-700" },
    green: { bar: "bg-green-500", icon: "text-green-500", text: "text-green-700" },
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
        <p className={`mt-2 text-3xl font-bold ${colors.text}`}>
          {value.toLocaleString()}
        </p>
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
