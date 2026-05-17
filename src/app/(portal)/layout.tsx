import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PortalShell } from "@/components/layout/portal-shell";

export const metadata = {
  title: "Portal",
};

export default async function PortalLayout({
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

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .maybeSingle();

  const shellUser = profileRow
    ? {
        full_name: profileRow.full_name ?? "Portal User",
        phone: profileRow.phone ?? "",
      }
    : undefined;

  return (
    <PortalShell user={shellUser}>
      {children}
    </PortalShell>
  );
}
