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

export function WalletLedger({ transactions }: { transactions: any[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-outline-variant/40 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Direction</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Available At</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((txn) => (
            <TableRow key={txn.id}>
              <TableCell className="font-medium">{formatType(txn.type)}</TableCell>
              <TableCell className={txn.direction === "credit" ? "text-teal" : "text-destructive"}>
                {txn.direction}
              </TableCell>
              <TableCell className="text-right font-semibold">{money(txn.amount)}</TableCell>
              <TableCell><StatusBadge status={txn.status} /></TableCell>
              <TableCell>{shortDate(txn.available_at)}</TableCell>
              <TableCell>{shortDate(txn.created_at)}</TableCell>
              <TableCell className="max-w-[280px] truncate text-muted-foreground">
                {txn.description ?? "Not set"}
              </TableCell>
            </TableRow>
          ))}
          {!transactions.length && (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                No wallet transactions found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function formatType(value: unknown) {
  return String(value ?? "unknown").replaceAll("_", " ");
}
