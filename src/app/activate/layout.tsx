import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ActivationStatus = {
  is_activated: boolean | null;
};

export default async function ActivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Already activated? Skip this page
  const { data: statusRow } = await supabase
    .from("account_status")
    .select("is_activated")
    .eq("user_id", user.id)
    .single();

  const status = statusRow as ActivationStatus | null;
  if (status?.is_activated) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-surface-container-low">
      <div className="mx-auto max-w-2xl px-4 py-12">{children}</div>
    </div>
  );
}
