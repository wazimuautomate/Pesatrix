import type { Metadata } from "next";
import ActivateClientPage from "@/app/activate/activate-client";

export const metadata: Metadata = {
  title: "Activate Account",
};

export default function DashboardActivatePage() {
  return <ActivateClientPage />;
}
