import { StatusBadge } from "@/components/admin/admin-native";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { money, shortDate } from "@/lib/wazim-admin";

export function TaskHistory({ submissions }: { submissions: any[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-outline-variant/40 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Task</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Payout</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>AI Score</TableHead>
            <TableHead>Submitted</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((submission) => {
            const task = Array.isArray(submission.tasks) ? submission.tasks[0] : submission.tasks;
            return (
              <TableRow key={submission.id}>
                <TableCell className="font-medium">{task?.title ?? "Unknown task"}</TableCell>
                <TableCell>{task?.category ?? "Not set"}</TableCell>
                <TableCell className="text-right font-semibold">{money(task?.payout_ksh ?? 0)}</TableCell>
                <TableCell><StatusBadge status={submission.status} /></TableCell>
                <TableCell>{submission.ai_score ?? "Not scored"}</TableCell>
                <TableCell>{shortDate(submission.submitted_at)}</TableCell>
              </TableRow>
            );
          })}
          {!submissions.length && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                No task submissions found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
