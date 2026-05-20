import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-container-low px-4 py-12">
      {/* Logo */}
      <Link href="/" className="mb-8 flex items-center gap-3">
        <BrandLogo size="auth" />
        <span className="text-xl font-bold tracking-tight text-navy">
          Pesatrix
        </span>
      </Link>

      <div className="w-full max-w-md">{children}</div>

      <p className="mt-8 text-center text-xs text-on-surface-variant">
        By continuing, you agree to our{" "}
        <Link href="/terms" className="underline hover:text-foreground">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline hover:text-foreground">
          Privacy Policy
        </Link>
      </p>
    </div>
  );
}
