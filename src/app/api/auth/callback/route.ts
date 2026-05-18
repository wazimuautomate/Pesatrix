import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function buildRedirectUrl(origin: string, pathname: string, params?: Record<string, string>) {
  const url = new URL(pathname, origin);

  Object.entries(params ?? {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return url;
}

function isConfirmationAlreadyUsedError(error: { message?: string }) {
  const msg = error?.message?.toLowerCase() ?? "";
  return (
    msg.includes("already been used") ||
    msg.includes("invalid") ||
    msg.includes("expired") ||
    msg.includes("code") ||
    msg.includes("token")
  );
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
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data?.session) {
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

    if (error) {
      console.warn("[Auth callback] Code exchange failed:", error.message);

      if (isConfirmationAlreadyUsedError(error)) {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
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
            message: "This confirmation link has already been used. Please try logging in.",
          })
        );
      }

      return NextResponse.redirect(
        buildRedirectUrl(origin, "/login", {
          error: "auth_callback_failed",
          message: "The confirmation link is invalid or has expired.",
        })
      );
    }
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

    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session) {
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
