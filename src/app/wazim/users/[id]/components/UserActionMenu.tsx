"use client";

import Link from "next/link";
import { useState } from "react";
import { MoreVertical, Scale, ShieldAlert, ShieldX, FileClock, Flag, BadgeCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BalanceAdjustModal } from "./BalanceAdjustModal";

export function UserActionMenu({
  userId,
  currentStatus,
  canAdjustBalance,
  currentAvailableBalance,
}: {
  userId: string;
  currentStatus: string;
  canAdjustBalance: boolean;
  currentAvailableBalance: number;
}) {
  const [adjustOpen, setAdjustOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="outline" aria-label="User actions">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {canAdjustBalance && (
            <DropdownMenuItem onClick={() => setAdjustOpen(true)}>
              <Scale className="mr-2 h-4 w-4" />
              Adjust Balance
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link href={`/wazim/activity?user_id=${encodeURIComponent(userId)}`}>
              <FileClock className="mr-2 h-4 w-4" />
              View Activity Log
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {currentStatus !== "suspended" && currentStatus !== "banned" ? (
            <DropdownMenuItem asChild>
              <Link href={`/wazim/fraud?user_id=${encodeURIComponent(userId)}&action=suspend`}>
                <ShieldAlert className="mr-2 h-4 w-4 text-amber-600" />
                Suspend account
              </Link>
            </DropdownMenuItem>
          ) : null}
          {currentStatus !== "banned" ? (
            <DropdownMenuItem asChild>
              <Link href={`/wazim/fraud?user_id=${encodeURIComponent(userId)}&action=ban`}>
                <ShieldX className="mr-2 h-4 w-4 text-destructive" />
                Ban account
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild>
            <Link href={`/wazim/fraud?user_id=${encodeURIComponent(userId)}`}>
              <Flag className="mr-2 h-4 w-4" />
              Flag for fraud review
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/wazim/users/${userId}#verification`}>
              <BadgeCheck className="mr-2 h-4 w-4" />
              Mark KYC verified / unverified
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {canAdjustBalance ? (
        <BalanceAdjustModal
          userId={userId}
          currentAvailableBalance={currentAvailableBalance}
          open={adjustOpen}
          onOpenChange={setAdjustOpen}
        />
      ) : null}
    </>
  );
}
