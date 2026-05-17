import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { formatKSh } from "@/lib/utils";
import {
  Download,
  TrendingUp,
  Receipt,
  Hash,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";

const PAGE_SIZE = 20;

type MiniSiteSale = {
  id: string;
  description: string | null;
  customer_phone: string | null;
  amount: number | null;
  commission: number | null;
  status: string | null;
  receipt: string | null;
  created_at: string;
};

type Filters = {
  status: string;
  date_from: string;
  date_to: string;
  customer_phone: string;
  page: number;
};

function parseFilters(searchParams: URLSearchParams): Filters {
  return {
    status: searchParams.get("status") || "all",
    date_from: searchParams.get("date_from") || "",
    date_to: searchParams.get("date_to") || "",
    customer_phone: searchParams.get("customer_phone") || "",
    page: Math.max(1, parseInt(searchParams.get("page") || "1", 10)),
  };
}

async function fetchMiniSiteSales(supabase: any, agentId: string): Promise<MiniSiteSale[]> {
  const { data } = await supabase
    .from("mini_site_sales")
    .select(`
      id,
      customer_phone,
      amount,
      commission,
      status,
      payment_id,
      package_id,
      created_at
    `)
    .eq("agent_id", agentId);

  if (!data || data.length === 0) return [];

  const packageIds = [...new Set(data.map((r: any) => r.package_id).filter(Boolean))];
  const paymentIds = [...new Set(data.map((r: any) => r.payment_id).filter(Boolean))];

  let packages: any[] = [];
  let payments: any[] = [];

  if (packageIds.length > 0) {
    const { data: pkgData } = await supabase
      .from("data_packages")
      .select("id, name")
      .in("id", packageIds);
    packages = pkgData || [];
  }

  if (paymentIds.length > 0) {
    const { data: payData } = await supabase
      .from("payments")
      .select("id, receipt")
      .in("id", paymentIds);
    payments = payData || [];
  }

  const pkgMap = new Map(packages.map((p: any) => [p.id, p.name]));
  const payMap = new Map(payments.map((p: any) => [p.id, p.receipt]));

  return data.map((row: any) => ({
    id: row.id,
    description: pkgMap.get(row.package_id) || null,
    customer_phone: row.customer_phone || null,
    amount: row.amount ? Number(row.amount) : null,
    commission: row.commission ? Number(row.commission) : null,
    status: row.status || null,
    receipt: payMap.get(row.payment_id) || null,
    created_at: row.created_at,
  }));
}

function applyFilters(rows: MiniSiteSale[], filters: Filters): MiniSiteSale[] {
  let filtered = [...rows];

  if (filters.status !== "all") {
    filtered = filtered.filter((r) => r.status === filters.status);
  }

  if (filters.date_from) {
    const from = new Date(filters.date_from);
    filtered = filtered.filter((r) => new Date(r.created_at) >= from);
  }

  if (filters.date_to) {
    const to = new Date(filters.date_to);
    to.setHours(23, 59, 59, 999);
    filtered = filtered.filter((r) => new Date(r.created_at) <= to);
  }

  if (filters.customer_phone) {
    const phone = filters.customer_phone.toLowerCase();
    filtered = filtered.filter(
      (r) => r.customer_phone && r.customer_phone.toLowerCase().includes(phone)
    );
  }

  return filtered;
}

function computeSummary(rows: MiniSiteSale[]) {
  const completedRows = rows.filter((r) => r.status === "completed");

  const totalRevenue = completedRows.reduce(
    (sum, r) => sum + (r.amount || 0),
    0
  );

  const totalCommission = completedRows.reduce(
    (sum, r) => sum + (r.commission || 0),
    0
  );

  const totalTransactions = rows.length;

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const monthRows = rows.filter((r) => {
    const d = new Date(r.created_at);
    return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });

  const thisMonthCount = monthRows.length;
  const thisMonthRevenue = monthRows
    .filter((r) => r.status === "completed")
    .reduce((sum, r) => sum + (r.amount || 0), 0);

  return {
    totalRevenue,
    totalCommission,
    totalTransactions,
    thisMonthCount,
    thisMonthRevenue,
  };
}

function statusBadgeVariant(status: string | null) {
  switch (status) {
    case "completed":
      return "success";
    case "pending":
      return "outline";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

function buildCsvRows(rows: MiniSiteSale[]): string {
  const header = "Date,Description,Customer Phone,Amount (KES),Commission (KES),Status,Receipt";
  const csvRows = rows.map((r) => {
    const date = new Date(r.created_at).toLocaleDateString("en-KE");
    const desc = (r.description || "").replace(/"/g, '""');
    const phone = r.customer_phone || "";
    const amount = r.amount != null ? r.amount.toString() : "";
    const commission = r.commission != null ? r.commission.toString() : "";
    const status = r.status || "";
    const receipt = r.receipt || "";
    return `"${date}","${desc}","${phone}","${amount}","${commission}","${status}","${receipt}"`;
  });
  return [header, ...csvRows].join("\n");
}

export default async function MiniSiteSalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const rawParams = await searchParams;
  const urlSearchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(rawParams)) {
    if (typeof value === "string") {
      urlSearchParams.set(key, value);
    }
  }

  const filters = parseFilters(urlSearchParams);

  const allRows = await fetchMiniSiteSales(supabase, user.id);
  const summary = computeSummary(allRows);

  const filteredRows = applyFilters(allRows, filters);
  const sortedRows = filteredRows.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const currentPage = Math.min(filters.page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = sortedRows.slice(start, start + PAGE_SIZE);

  const today = new Date().toISOString().split("T")[0];
  const csvFilename = `bingwazone-minisite-sales-${today}.csv`;
  const csvContent = buildCsvRows(filteredRows);

  const filterParams = (overrides: Record<string, string>) => {
    const params = new URLSearchParams(urlSearchParams);
    for (const [key, value] of Object.entries(overrides)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    params.delete("page");
    return params.toString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy">
            Mini-Site Sales
          </h1>
          <p className="text-sm text-muted-foreground">
            Sales from your mini-site data packages
          </p>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-outline-variant/40 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </p>
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-navy">
            {formatKSh(summary.totalRevenue)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Completed sales
          </p>
        </div>

        <div className="rounded-xl border border-outline-variant/40 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              Total Commission
            </p>
            <Receipt className="h-4 w-4 text-teal" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-navy">
            {formatKSh(summary.totalCommission)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Earned commission
          </p>
        </div>

        <div className="rounded-xl border border-outline-variant/40 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              Total Sales
            </p>
            <Hash className="h-4 w-4 text-on-surface-variant" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-navy">
            {summary.totalTransactions}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            All statuses
          </p>
        </div>

        <div className="rounded-xl border border-outline-variant/40 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              This Month
            </p>
            <Calendar className="h-4 w-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-navy">
            {summary.thisMonthCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatKSh(summary.thisMonthRevenue)} revenue
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-outline-variant/40 bg-white">
        <div className="p-4">
          <div className="flex items-center gap-2 lg:hidden">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Filters</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Status
              </label>
              <Select defaultValue={filters.status}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Date From
              </label>
              <Input type="date" defaultValue={filters.date_from} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Date To
              </label>
              <Input type="date" defaultValue={filters.date_to} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Customer Phone
              </label>
              <Input
                type="text"
                placeholder="Search phone..."
                defaultValue={filters.customer_phone}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-outline-variant/40 bg-white">
        <div className="flex flex-col gap-3 border-b border-outline-variant/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-base font-bold text-navy">Sales</h2>
          <Button variant="outline" size="sm" asChild>
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(csvContent)}`}
              download={csvFilename}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </a>
          </Button>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-white">Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Customer Phone</TableHead>
                <TableHead className="text-right">Amount (KES)</TableHead>
                <TableHead className="text-right">Commission (KES)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Receipt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                    No mini-site sales found. Adjust your filters or make your first sale.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="sticky left-0 z-10 bg-white whitespace-nowrap">
                      {new Date(row.created_at).toLocaleDateString("en-KE", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {row.description || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {row.customer_phone || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums font-medium">
                      {row.amount != null ? formatKSh(row.amount) : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                      {row.commission != null ? formatKSh(row.commission) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(row.status) as any}>
                        {row.status || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {row.receipt || "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {sortedRows.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-outline-variant/40 p-4">
            <p className="text-sm text-muted-foreground">
              Showing {start + 1}–{Math.min(start + PAGE_SIZE, sortedRows.length)} of{" "}
              {sortedRows.length}
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                asChild
              >
                <Link href={`?${filterParams({ page: String(currentPage - 1) })}`}>
                  <ChevronLeft className="h-4 w-4" />
                </Link>
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => {
                  if (totalPages <= 7) return true;
                  if (p === 1 || p === totalPages) return true;
                  if (Math.abs(p - currentPage) <= 1) return true;
                  return false;
                })
                .map((p, idx, arr) => {
                  const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                  return (
                    <span key={p} className="flex items-center gap-1">
                      {showEllipsis && (
                        <span className="px-1 text-sm text-muted-foreground">...</span>
                      )}
                      <Button
                        variant={p === currentPage ? "default" : "outline"}
                        size="sm"
                        asChild
                      >
                        <Link href={`?${filterParams({ page: String(p) })}`}>
                          {p}
                        </Link>
                      </Button>
                    </span>
                  );
                })}
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                asChild
              >
                <Link href={`?${filterParams({ page: String(currentPage + 1) })}`}>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
