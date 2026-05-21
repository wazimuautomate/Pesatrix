import { redirect } from "next/navigation";
import { hasPaidActivationPayment } from "@/lib/activation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function ActivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    if (await hasPaidActivationPayment(supabase, user.id)) redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-surface-container-low">
      {children}
    </div>
  );
}
