"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Mail, Phone } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { captureAndSendFingerprint, getFingerprint, sendFingerprint } from "@/lib/fraud/fingerprint";
import { createClient } from "@/lib/supabase/client";

const phoneSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(10, "Enter a valid phone number")
    .regex(/^(?:\+?254|0)(?:7\d{8}|1\d{8})$/, "Enter a valid Kenyan phone number"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const emailSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type PhoneForm = z.infer<typeof phoneSchema>;
type EmailForm = z.infer<typeof emailSchema>;

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";
  const tabParam = searchParams.get("tab");
  const message = searchParams.get("message");
  const checkEmail = searchParams.get("checkEmail") === "1";
  const confirmed = searchParams.get("confirmed") === "1";
  const resetSuccess = searchParams.get("reset") === "success";
  const callbackError = searchParams.get("error") === "auth_callback_failed";
  const [showPassword, setShowPassword] = useState(false);
  const [tab, setTab] = useState<"phone" | "email">("phone");
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    void supabase.auth.signOut();
  }, [supabase]);

  useEffect(() => {
    if (tabParam === "phone" || tabParam === "email") {
      setTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    void getFingerprint()
      .then(setVisitorId)
      .catch((error) => {
        console.error("[login] Failed to collect fingerprint", error);
      });
  }, []);

  const phoneForm = useForm<PhoneForm>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { identifier: "", password: "" },
  });

  const emailForm = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "", password: "" },
  });

  async function getPostLoginRedirect(defaultRedirect: string) {
    try {
      const response = await fetch("/api/me", { cache: "no-store" });
      if (!response.ok) {
        return { url: defaultRedirect, banned: false };
      }

      const payload = await response.json();
      const status = payload?.status;
      const isBannedOrSuspended =
        status?.accountState === "banned" ||
        status?.accountState === "suspended";

      if (isBannedOrSuspended) {
        await supabase.auth.signOut();
        return {
          url: "/login?message=Your account has been suspended or banned. Please contact support.",
          banned: true
        };
      }

      return {
        url: status?.setupComplete ? defaultRedirect : "/dashboard",
        banned: false
      };
    } catch {
      return { url: defaultRedirect, banned: false };
    }
  }

  async function onPhoneSubmit(values: PhoneForm) {
    try {
      const lookupResponse = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ identifier: values.identifier }),
      });

      const lookupPayload = await lookupResponse.json();

      if (!lookupResponse.ok) {
        toast.error(lookupPayload?.error?.message ?? "Invalid email/phone or password");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: lookupPayload.email,
        password: values.password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      const nextResult = await getPostLoginRedirect(redirect);
      if (nextResult.banned) {
        toast.error("Your account has been suspended or banned. Please contact support.");
        router.push(nextResult.url);
        router.refresh();
        return;
      }

      await recordFingerprint(visitorId);
      sessionStorage.setItem("pesatrix_session_active", "true");

      toast.success("Login successful");
      router.push(nextResult.url);
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  }

  async function onEmailSubmit(values: EmailForm) {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      const nextResult = await getPostLoginRedirect(redirect);
      if (nextResult.banned) {
        toast.error("Your account has been suspended or banned. Please contact support.");
        router.push(nextResult.url);
        router.refresh();
        return;
      }

      await recordFingerprint(visitorId);
      sessionStorage.setItem("pesatrix_session_active", "true");

      toast.success("Login successful");
      router.push(nextResult.url);
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  }

  const isLoading =
    phoneForm.formState.isSubmitting || emailForm.formState.isSubmitting;

  return (
    <Card className="border-outline-variant/40">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold text-navy">
          Welcome Back
        </CardTitle>
        <CardDescription>
          Sign in to continue to onboarding or your dashboard
        </CardDescription>
      </CardHeader>
      <CardContent>
        {checkEmail ? (
          <div className="mb-4 rounded-md border border-primary/20 bg-accent p-4 text-sm text-muted-foreground">
            Your account was created. Check your inbox and confirm your email
            before signing in.
          </div>
        ) : null}

        {message ? (
          <div className="mb-4 rounded-md border border-primary/20 bg-accent p-4 text-sm text-muted-foreground">
            {message}
          </div>
        ) : null}

        {confirmed ? (
          <div className="mb-4 rounded-md border border-teal/30 bg-teal/5 p-4 text-sm text-foreground">
            Email confirmed. Sign in with your email or phone number to continue.
          </div>
        ) : null}

        {resetSuccess ? (
          <div className="mb-4 rounded-md border border-teal/30 bg-teal/5 p-4 text-sm text-foreground">
            Password updated successfully. Sign in with your new password.
          </div>
        ) : null}

        {callbackError ? (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            The email link could not be completed. Try logging in with the email and password.
          </div>
        ) : null}

        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as "phone" | "email")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="phone" className="gap-2">
              <Phone className="h-4 w-4" />
              Phone
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-2">
              <Mail className="h-4 w-4" />
              Email
            </TabsTrigger>
          </TabsList>

          <TabsContent value="phone">
            <form
              onSubmit={phoneForm.handleSubmit(onPhoneSubmit)}
              className="mt-4 space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="login-phone">Phone Number</Label>
                <Input
                  id="login-phone"
                  placeholder="07XX XXX XXX"
                  {...phoneForm.register("identifier")}
                />
                {phoneForm.formState.errors.identifier ? (
                  <p className="text-xs text-destructive">
                    {phoneForm.formState.errors.identifier.message}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Phone login resolves to the email linked to your Pesatrix account.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-phone-password">Password</Label>
                <div className="relative">
                  <Input
                    id="login-phone-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    {...phoneForm.register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {phoneForm.formState.errors.password ? (
                  <p className="text-xs text-destructive">
                    {phoneForm.formState.errors.password.message}
                  </p>
                ) : null}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Logging in...</> : "Sign In"}

              </Button>
            </form>
          </TabsContent>

          <TabsContent value="email">
            <form
              onSubmit={emailForm.handleSubmit(onEmailSubmit)}
              className="mt-4 space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="login-email">Email Address</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="you@example.com"
                  {...emailForm.register("email")}
                />
                {emailForm.formState.errors.email ? (
                  <p className="text-xs text-destructive">
                    {emailForm.formState.errors.email.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-email-password">Password</Label>
                <div className="relative">
                  <Input
                    id="login-email-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    {...emailForm.register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {emailForm.formState.errors.password ? (
                  <p className="text-xs text-destructive">
                    {emailForm.formState.errors.password.message}
                  </p>
                ) : null}
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Logging in...</> : "Sign In"}

              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Forgot your password?{" "}
          <Link href="/forgot-password" className="font-medium text-primary hover:underline">
            Reset it by email
          </Link>
        </p>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

async function recordFingerprint(visitorId: string | null) {
  try {
    if (visitorId) {
      await sendFingerprint(visitorId);
    } else {
      await captureAndSendFingerprint();
    }
  } catch (error) {
    console.error("[login] Failed to record fingerprint", error);
  }
}

function LoginPageFallback() {
  return (
    <Card className="border-outline-variant/40">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold text-navy">
          Welcome Back
        </CardTitle>
        <CardDescription>Loading sign-in options...</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-56 animate-pulse rounded-md bg-muted" />
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}
