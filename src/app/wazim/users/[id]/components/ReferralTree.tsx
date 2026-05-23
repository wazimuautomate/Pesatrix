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

export function ReferralTree({
  referralsMade,
  referralBonuses,
}: {
  referralsMade: any[];
  referralBonuses: any[];
}) {
  const bonusByRefereeId = new Map(referralBonuses.map((bonus) => [bonus.referee_id, bonus]));

  return (
    <div className="overflow-x-auto rounded-lg border border-outline-variant/40 bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Referee</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Level</TableHead>
            <TableHead className="text-right">Bonus</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {referralsMade.map((referral) => {
            const profile = Array.isArray(referral.profiles) ? referral.profiles[0] : referral.profiles;
            const bonus = bonusByRefereeId.get(referral.referee_id);
            return (
              <TableRow key={referral.id}>
                <TableCell className="font-medium">{profile?.full_name ?? referral.referee_id}</TableCell>
                <TableCell>{profile?.phone ?? "Not set"}</TableCell>
                <TableCell>{referral.level ?? 1}</TableCell>
                <TableCell className="text-right font-semibold">{money(bonus?.amount ?? 0)}</TableCell>
                <TableCell><StatusBadge status={bonus?.status ?? "none"} /></TableCell>
                <TableCell>{shortDate(referral.created_at)}</TableCell>
              </TableRow>
            );
          })}
          {!referralsMade.length && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                No referrals found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
