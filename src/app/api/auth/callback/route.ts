import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function buildRedirectUrl(origin: string, pathname: string, params?: Record<string, string>) {
  const url = new URL(pathname, origin);

  Object.entries(params ?? {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return url;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const authType = searchParams.get("type");
  const next =
    searchParams.get("next") ??
    (authType === "recovery"
      ? "/reset-password"
      : authType === "signup"
        ? "/login?confirmed=1"
        : "/dashboard");

  const supabase = await createServerSupabaseClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (authType === "signup") {
        await supabase.auth.signOut();
        return NextResponse.redirect(
          buildRedirectUrl(origin, "/login", {
            tab: "email",
            confirmed: "1",
          })
        );
      }

      return NextResponse.redirect(new URL(next, origin));
    }

    return NextResponse.redirect(
      buildRedirectUrl(origin, "/login", {
        error: "auth_callback_failed",
        message: "The confirmation link is invalid or has already been used.",
      })
    );
  }

  if (tokenHash && authType) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: authType as any,
    });

    if (!error) {
      if (authType === "signup") {
        await supabase.auth.signOut();
        return NextResponse.redirect(
          buildRedirectUrl(origin, "/login", {
            tab: "email",
            confirmed: "1",
          })
        );
      }

      return NextResponse.redirect(new URL(next, origin));
    }

    return NextResponse.redirect(
      buildRedirectUrl(origin, "/login", {
        error: "auth_callback_failed",
        message: "The confirmation link is invalid or has expired. Request a new one and try again.",
      })
    );
  }

  return NextResponse.redirect(
    buildRedirectUrl(origin, "/login", {
      error: "auth_callback_failed",
      message: "The email link is missing the required confirmation data.",
    })
  );
}
