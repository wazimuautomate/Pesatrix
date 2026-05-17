import type { Metadata } from "next";
import WithdrawClientPage from "./withdraw-client";

export const metadata: Metadata = {
  title: "Withdraw",
};

export default function WithdrawPage() {
  return <WithdrawClientPage />;
}
