"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { KENYA_COUNTIES } from "@/lib/auth/counties";
import {
  buildRegisterSignUpInput,
  mapRegisterErrorMessage,
} from "@/lib/auth/register";
import { captureAndSendFingerprint, getFingerprint, sendFingerprint } from "@/lib/fraud/fingerprint";
import { createClient } from "@/lib/supabase/client";

const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Full name must be at least 2 characters")
      .max(100, "Full name too long"),
    phone: z
      .string()
      .min(10, "Enter a valid phone number")
      .max(20, "Phone number is too long")
      .regex(/^(?:\+?254|0)(?:7\d{8}|1\d{8})$/, "Enter a valid Kenyan phone number"),
    county: z
      .string()
      .trim()
      .min(2, "Select your county")
      .max(80, "County is too long"),
    email: z
      .string()
      .trim()
      .email("Enter a valid email address")
      .max(255, "Email address is too long"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Include at least one uppercase letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirmPassword: z.string(),
    referralCode: z.string().trim().max(32, "Referral code is too long").optional(),
    confirmHuman: z.boolean().refine((value) => value === true, {
      message: "Please verify that you are human",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

const steps = [
  { label: "Profile", fields: ["fullName", "phone", "county"] as const },
  { label: "Security", fields: ["email", "password", "confirmPassword"] as const },
  { label: "Verification", fields: ["referralCode", "confirmHuman"] as const },
];

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [supabase] = useState(() => createClient());

  const {
    register,
    handleSubmit,
    setValue,
    trigger,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      county: "",
      email: "",
      password: "",
      confirmPassword: "",
      referralCode: "",
      confirmHuman: false,
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const referralCode = params.get("ref");

    void supabase.auth.signOut();

    if (referralCode) {
      setValue("referralCode", referralCode);
    }
  }, [setValue, supabase]);

  useEffect(() => {
    void getFingerprint()
      .then(setVisitorId)
      .catch((error) => {
        console.error("[register] Failed to collect fingerprint", error);
      });
  }, []);

  async function nextStep() {
    const fieldsToValidate = steps[step].fields;
    const isValid = await trigger(fieldsToValidate as unknown as (keyof RegisterForm)[]);
    if (isValid) {
      setStep((current) => Math.min(current + 1, steps.length - 1));
    }
  }

  async function onSubmit(data: RegisterForm) {
    try {
      const payload = buildRegisterSignUpInput(
        {
          fullName: data.fullName,
          phone: data.phone,
          county: data.county,
          email: data.email,
          password: data.password,
          referralCode: data.referralCode,
          humanVerified: data.confirmHuman,
        },
        window.location.origin
      );

      const { error } = await supabase.auth.signUp(payload);

      if (error) {
        toast.error(mapRegisterErrorMessage(error.message));
        return;
      }

      try {
        if (visitorId) {
          await sendFingerprint(visitorId);
        } else {
          await captureAndSendFingerprint();
        }
      } catch (fingerprintError) {
        console.error("[register] Failed to record fingerprint", fingerprintError);
      }

      await supabase.auth.signOut();

      toast.success("Account created. Confirm your email before signing in.");
      router.push(
        `/login?tab=email&message=${encodeURIComponent(
          "We sent a confirmation link to your email. Confirm it before signing in."
        )}`
      );
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  }

  const progress = ((step + 1) / steps.length) * 100;

  return (
    <Card className="border-outline-variant/40">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold text-navy">
          Create Your Account
        </CardTitle>
        <CardDescription>
          Step {step + 1} of {steps.length}: {steps[step].label}
        </CardDescription>
        <Progress value={progress} className="mt-3" />
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {step === 0 ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="reg-name">Full Name</Label>
                <Input
                  id="reg-name"
                  placeholder="John Kamau"
                  {...register("fullName")}
                />
                {errors.fullName ? (
                  <p className="text-xs text-destructive">{errors.fullName.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-phone">Phone Number</Label>
                <Input
                  id="reg-phone"
                  placeholder="07XX XXX XXX"
                  {...register("phone")}
                />
                {errors.phone ? (
                  <p className="text-xs text-destructive">{errors.phone.message}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    This becomes your M-Pesa withdrawal number.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-county">County</Label>
                <select
                  id="reg-county"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  {...register("county")}
                >
                  <option value="">Select your county</option>
                  {KENYA_COUNTIES.map((county) => (
                    <option key={county} value={county}>
                      {county}
                    </option>
                  ))}
                </select>
                {errors.county ? (
                  <p className="text-xs text-destructive">{errors.county.message}</p>
                ) : null}
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="reg-email">Email Address</Label>
                <Input
                  id="reg-email"
                  type="email"
                  placeholder="you@example.com"
                  {...register("email")}
                />
                {errors.email ? (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Supabase will send confirmation and password reset emails here.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-password">Password</Label>
                <div className="relative">
                  <Input
                    id="reg-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a strong password"
                    {...register("password")}
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
                {errors.password ? (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-confirm">Confirm Password</Label>
                <Input
                  id="reg-confirm"
                  type="password"
                  placeholder="Confirm your password"
                  {...register("confirmPassword")}
                />
                {errors.confirmPassword ? (
                  <p className="text-xs text-destructive">
                    {errors.confirmPassword.message}
                  </p>
                ) : null}
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="reg-referral">Referral Code (Optional)</Label>
                <Input
                  id="reg-referral"
                  placeholder="Enter referral code"
                  {...register("referralCode")}
                />
                <p className="text-xs text-muted-foreground">
                  Please enter a valid referral code if you were referred by a friend.
                </p>
              </div>

              <label className="flex items-start gap-3 rounded-md border border-outline-variant/40 bg-surface-container-low p-4 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-input"
                  {...register("confirmHuman")}
                />
                <span>
                  I confirm I am human and accept the terms of service & privacy policy.
                </span>
              </label>
              {errors.confirmHuman ? (
                <p className="text-xs text-destructive">{errors.confirmHuman.message}</p>
              ) : null}

              <div className="rounded-md border border-outline-variant/40 bg-surface-container-low p-4">
                <h4 className="mb-2 text-sm font-semibold text-foreground">
                  What happens next
                </h4>
                <ul className="space-y-1.5 text-sm text-on-surface-variant">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal" />
                    We will send a confirmation email immediately
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal" />
                    You sign in after confirmation using email or phone plus password
                  </li>
                 </ul>
              </div>
            </>
          ) : null}

          <div className="flex gap-3 pt-2">
            {step > 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep((current) => current - 1)}
                className="flex-1"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            ) : null}

            {step < steps.length - 1 ? (
              <Button type="button" onClick={nextStep} className="flex-1">
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Create Account
              </Button>
            )}
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
