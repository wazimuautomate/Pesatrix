import { createServerSupabaseClient } from "@/lib/supabase/server";
import ActivateClientPage from "./activate-client";

export default async function ActivatePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let defaultPhone = "";
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle();
    defaultPhone = profile?.phone ?? "";
  }

  return <ActivateClientPage isLoggedIn={Boolean(user)} defaultPhone={defaultPhone} />;
}
