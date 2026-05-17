import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ProfileSecurityClient } from "./profile-security-client";

export const metadata = {
  title: "Profile",
};

type ProfileRow = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  metadata: Record<string, unknown> | null;
};

function getAvatarPath(metadata: Record<string, unknown> | null | undefined) {
  const value = metadata?.avatar_path;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminSupabaseClient();
  const { data } = await (admin.from("profiles" as never) as any)
    .select("full_name, email, phone, metadata")
    .eq("id", user!.id)
    .maybeSingle();

  const profile = (data ?? {}) as ProfileRow;
  const avatarPath = getAvatarPath(profile.metadata);
  const avatarUrl = avatarPath
    ? (
        await admin.storage
          .from("kyc-documents")
          .createSignedUrl(avatarPath, 60 * 60)
      ).data?.signedUrl ?? null
    : null;

  return (
    <ProfileSecurityClient
      profile={{
        fullName: profile.full_name ?? user?.user_metadata?.full_name ?? "",
        email: profile.email ?? user?.email ?? "",
        phone: profile.phone ?? "",
        avatarPath,
        avatarUrl,
      }}
    />
  );
}
