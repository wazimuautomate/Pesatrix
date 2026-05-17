import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { OnboardingPageClient } from "@/components/onboarding/onboarding-page-client";

export const metadata: Metadata = {
  title: "Onboarding",
};

type AccountStatusRow = {
  is_setup_complete: boolean | null;
  state: string | null;
  status: string | null;
};

type ProfileRow = {
  full_name: string | null;
  county: string | null;
};

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profileRow }, statusResult] = await Promise.all([
    (supabase.from("profiles" as never) as any)
      .select("full_name, county")
      .eq("id", user.id)
      .maybeSingle(),
    (supabase.from("account_status" as never) as any)
      .select("is_setup_complete, state, status")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (statusResult.error) {
    console.error("[OnboardingPage] Failed to read account_status:", statusResult.error);
    throw new Error("Could not load account status");
  }

  let accountStatus = statusResult.data as AccountStatusRow | null;

  if (!accountStatus) {
    const admin = createAdminSupabaseClient();
    const { data: adminStatus, error: adminStatusError } = await admin
      .from("account_status")
      .select("is_setup_complete, state, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminStatusError) {
      console.error("[OnboardingPage] Failed to read account_status with service role:", adminStatusError);
      throw new Error("Could not load account status");
    }

    accountStatus = adminStatus as AccountStatusRow | null;
  }

  const isSetupComplete = accountStatus?.is_setup_complete === true;

  if (isSetupComplete) {
    redirect("/dashboard");
  }

  const profile = profileRow as ProfileRow | null;

  return (
    <OnboardingPageClient
      fullName={profile?.full_name ?? ""}
      county={profile?.county ?? ""}
    />
  );
}
