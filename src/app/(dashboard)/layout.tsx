import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DashboardOnboardingGate } from "@/components/onboarding/dashboard-onboarding-gate";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getAccountProgressSnapshot } from "@/lib/account-progress";

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

  const [{ data: profileRow }, { data: statusRow }] = await Promise.all([
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
  const accountStatus = statusRow as DashboardAccountStatus | null;
  const progressSnapshot = getAccountProgressSnapshot(profile?.metadata);
  const shellUser = profile
    ? {
        full_name: profile.full_name ?? "Pesatrix User",
        phone: profile.phone ?? "",
      }
    : undefined;

  const isSetupComplete = Boolean(
    accountStatus?.is_setup_complete ||
      accountStatus?.state === "setup_complete" ||
      accountStatus?.state === "activated" ||
      accountStatus?.status === "setup_complete" ||
      accountStatus?.status === "activated" ||
      accountStatus?.status === "active" ||
      progressSnapshot.onboarding.completed
  );

  return (
    <>
      <DashboardShell user={shellUser}>
        {children}
      </DashboardShell>
      <DashboardOnboardingGate
        isSetupComplete={isSetupComplete}
        initialFullName={profile?.full_name ?? ""}
        initialCounty={profile?.county ?? ""}
        phone={profile?.phone ?? ""}
        email={user.email ?? ""}
        userId={user.id}
      />
    </>
  );
}
