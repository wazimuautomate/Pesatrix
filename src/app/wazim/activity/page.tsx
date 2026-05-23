import { AdminPageShell, StatusBadge } from "@/components/admin/admin-native";
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
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireWazimAdmin, shortDate } from "@/lib/wazim-admin";

type PageProps = {
  searchParams: Promise<{ user_id?: string; event_type?: string; from?: string; to?: string }>;
};

export default async function ActivityPage({ searchParams }: PageProps) {
  const adminSession = await requireWazimAdmin();
  const params = await searchParams;
  const admin = createAdminSupabaseClient();
  let query = (admin.from("user_activity_logs" as never) as any)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (params.user_id) query = query.eq("user_id", params.user_id);
  if (params.event_type) query = query.eq("event_type", params.event_type);
  if (params.from) query = query.gte("created_at", params.from);
  if (params.to) query = query.lte("created_at", params.to);

  const { data: logs } = await query;
  const userIds = [...new Set((logs ?? []).map((row: any) => row.user_id).filter(Boolean))];
  const { data: profiles } = userIds.length
    ? await (admin.from("profiles" as never) as any).select("id, full_name, phone").in("id", userIds)
    : { data: [] };
  const profileById = new Map<string, any>((profiles ?? []).map((row: any) => [row.id, row]));

  return (
    <AdminPageShell admin={adminSession} title="Activity" description="Recent user activity events for fraud and support review.">
      <Card className="mb-6 border border-outline-variant/40 shadow-sm">
        <CardContent className="p-4">
          <form className="grid gap-3 md:grid-cols-4">
            <Input name="user_id" defaultValue={params.user_id ?? ""} placeholder="User ID" />
            <Input name="event_type" defaultValue={params.event_type ?? ""} placeholder="Event type" />
            <Input name="from" type="date" defaultValue={params.from ?? ""} />
            <Input name="to" type="date" defaultValue={params.to ?? ""} />
            <button className="rounded-md bg-pesatrix-blue px-4 py-2 text-sm font-semibold text-white md:col-span-4">
              Filter
            </button>
          </form>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-lg border border-outline-variant/40 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Page</TableHead>
              <TableHead>Metadata</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(logs ?? []).map((log: any) => {
              const profile = profileById.get(log.user_id);
              return (
                <TableRow key={log.id}>
                  <TableCell>{shortDate(log.created_at)}</TableCell>
                  <TableCell>
                    <div className="font-medium">{profile?.full_name ?? log.user_id}</div>
                    <div className="text-xs text-muted-foreground">{profile?.phone ?? ""}</div>
                  </TableCell>
                  <TableCell><StatusBadge status={log.event_type} /></TableCell>
                  <TableCell>{log.page_path ?? "Not set"}</TableCell>
                  <TableCell>
                    <details>
                      <summary className="cursor-pointer text-sm text-pesatrix-blue">View JSON</summary>
                      <pre className="mt-2 max-w-md overflow-auto rounded-md bg-muted p-2 text-xs">
                        {JSON.stringify(log.metadata ?? {}, null, 2)}
                      </pre>
                    </details>
                  </TableCell>
                  <TableCell>{log.ip_address ?? "Hidden"}</TableCell>
                </TableRow>
              );
            })}
            {!(logs ?? []).length && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  No activity logs found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AdminPageShell>
  );
}
