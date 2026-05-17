import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export const metadata = {
  title: "Dashboard",
};

type DashboardProfile = {
  full_name: string | null;
  phone: string | null;
  county?: string | null;
  metadata?: unknown;
};

type DashboardAccountStatus = {
  is_setup_complete: boolean | null;
  state: string | null;
  status: string | null;
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profileRow }, statusResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone, county, metadata")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("account_status")
      .select("is_setup_complete, state, status")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const profile = profileRow as DashboardProfile | null;
  const accountStatus = statusResult.data as DashboardAccountStatus | null;

  if (statusResult.error) {
    console.error("[DashboardLayout] Failed to read account_status:", statusResult.error);
    throw new Error("Could not load account status");
  }

  const shellUser = profile
    ? {
        full_name: profile.full_name ?? "Pesatrix User",
        phone: profile.phone ?? "",
      }
    : undefined;

  const isSetupComplete = accountStatus?.is_setup_complete === true;

  if (!isSetupComplete) {
    redirect("/onboarding");
  }

  return (
    <DashboardShell user={shellUser}>
      {children}
    </DashboardShell>
  );
}
