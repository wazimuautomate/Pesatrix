"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Loader2, Mail, Phone, Shield, UserRound } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPhone } from "@/lib/utils";

type ProfileModel = {
  fullName: string;
  email: string;
  phone: string;
  avatarPath: string | null;
  avatarUrl: string | null;
};

type ProfileSecurityClientProps = {
  profile: ProfileModel;
};

function initials(name: string, email: string) {
  const source = name.trim() || email.trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase() || "PX";
}

function avatarExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export function ProfileSecurityClient({ profile }: ProfileSecurityClientProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fullName, setFullName] = useState(profile.fullName);
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone);
  const [password, setPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [avatarPath, setAvatarPath] = useState(profile.avatarPath);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fallback = useMemo(() => initials(fullName, email), [email, fullName]);

  async function uploadAvatar(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file for your profile picture.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Profile picture must be 5MB or smaller.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file, `avatar.${avatarExtension(file)}`);

      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        avatarPath?: string;
        avatarUrl?: string;
        error?: { message?: string };
      };

      if (!response.ok || !payload.avatarPath || !payload.avatarUrl) {
        throw new Error(payload.error?.message || "Profile picture upload failed.");
      }

      setAvatarPath(payload.avatarPath);
      setAvatarUrl(payload.avatarUrl);
      toast.success("Profile picture updated.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Profile picture upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      const response = await fetch("/api/profile/security", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          phone,
          password: password || undefined,
          avatarPath: avatarPath || undefined,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload.error?.message || "Profile update failed.");
        return;
      }

      setPassword("");
      toast.success("Profile updated.");
      router.refresh();
    } catch {
      toast.error("Profile update failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy">Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your account identity and security details.</p>
      </div>

      <Card className="overflow-hidden border-outline-variant/50 bg-white shadow-sm">
        <CardContent className="p-0">
          <div className="border-b border-outline-variant/50 px-6 py-4">
            <h2 className="text-base font-bold text-navy">Overview</h2>
          </div>
          <div className="grid gap-0 lg:grid-cols-[300px_1fr]">
            <div className="bg-surface-container-low p-6">
              <div className="flex flex-col items-center text-center">
                <Avatar className="h-28 w-28 border-4 border-white shadow-sm">
                  {avatarUrl ? <AvatarImage src={avatarUrl} alt={fullName || "Profile picture"} /> : null}
                  <AvatarFallback className="bg-primary/10 text-2xl font-black text-primary">{fallback}</AvatarFallback>
                </Avatar>
                <h2 className="mt-4 text-xl font-bold text-navy">{fullName || "Pesatrix user"}</h2>
                <p className="mt-1 max-w-full break-all text-sm text-muted-foreground">{email || "No email added"}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-5"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                  Change Photo
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadAvatar(file);
                  }}
                />
              </div>
            </div>

            <div className="grid gap-4 p-6 md:grid-cols-3">
              <div className="rounded-xl border border-outline-variant/50 p-4">
                <UserRound className="mb-3 h-5 w-5 text-primary" />
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Name</p>
                <p className="mt-1 break-words text-sm font-semibold text-navy">{fullName || "Not set"}</p>
              </div>
              <div className="rounded-xl border border-outline-variant/50 p-4">
                <Mail className="mb-3 h-5 w-5 text-primary" />
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email</p>
                <p className="mt-1 break-all text-sm font-semibold text-navy">{email || "Not set"}</p>
              </div>
              <div className="rounded-xl border border-outline-variant/50 p-4">
                <Phone className="mb-3 h-5 w-5 text-primary" />
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Phone</p>
                <p className="mt-1 text-sm font-semibold text-navy">{phone ? formatPhone(phone) : "Not set"}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-outline-variant/50 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-navy">
            <Shield className="h-5 w-5 text-primary" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Full name</Label>
              <Input id="profile-name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email">Email</Label>
              <Input id="profile-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-phone">Phone number</Label>
              <Input id="profile-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-password">New password</Label>
              <Input
                id="profile-password"
                type="password"
                value={password}
                placeholder="Leave blank to keep current password"
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={saving || uploading}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save changes
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
