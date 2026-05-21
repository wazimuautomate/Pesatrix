import "server-only";

import { headers } from "next/headers";

function normalizeBaseUrl(value: string | undefined | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed.replace(/\/+$/, "");
  }

  return `https://${trimmed.replace(/\/+$/, "")}`;
}

export async function getAppBaseUrl() {
  const explicit =
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeBaseUrl(process.env.APP_URL) ??
    normalizeBaseUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    normalizeBaseUrl(process.env.VERCEL_URL);

  if (explicit) {
    return explicit;
  }

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");

  if (host) {
    return `${protocol}://${host}`;
  }

  return "https://pesatrix.vercel.app";
}

export function buildReferralLink(baseUrl: string, referralCode: string | null | undefined) {
  const url = new URL("/register", baseUrl);
  if (referralCode) {
    url.searchParams.set("ref", referralCode);
  }
  return url.toString();
}
