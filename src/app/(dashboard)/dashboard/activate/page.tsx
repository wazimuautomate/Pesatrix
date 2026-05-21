import type { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import ActivateClientPage from "@/app/activate/activate-client";
import { getActivationFeeKsh } from "@/lib/platform-settings";

export const metadata: Metadata = {
  title: "Activate Account",
};

export default async function DashboardActivatePage() {
  const supabase = await createServerSupabaseClient();
  const activationFeeKsh = await getActivationFeeKsh();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let defaultPhone = "";
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle();
    defaultPhone = profile?.phone ?? "";
  }

  return (
    <ActivateClientPage
      activationFeeKsh={activationFeeKsh}
      isLoggedIn={Boolean(user)}
      defaultPhone={defaultPhone}
    />
  );
}
