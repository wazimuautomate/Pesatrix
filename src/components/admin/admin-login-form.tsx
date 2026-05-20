"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get("error") === "not_admin") {
      toast.error("This account is not an active Wazim admin.");
    }
  }, [searchParams]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      const verifyResponse = await fetch("/api/admin/verify", { cache: "no-store" });
      if (!verifyResponse.ok) {
        await supabase.auth.signOut();
        toast.error("Login succeeded, but this account is not an active Wazim admin.");
        return;
      }

      router.push("/wazim");
      router.refresh();
    } catch {
      toast.error("Unable to sign in right now.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md border-outline-variant/40 bg-white shadow-sm">
      <CardHeader className="space-y-3 text-center">
        <BrandLogo size="auth" className="mx-auto" />
        <div>
          <CardTitle className="text-2xl font-bold text-navy">Wazim Login</CardTitle>
          <CardDescription>Restricted Pesatrix operations access</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="wazim-email">Email address</Label>
            <Input
              id="wazim-email"
              type="email"
              autoComplete="email"
              placeholder="admin@example.com"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wazim-password">Password</Label>
            <div className="relative">
              <Input
                id="wazim-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setShowPassword((value) => !value)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button className="w-full" disabled={loading} type="submit">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Sign in
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
