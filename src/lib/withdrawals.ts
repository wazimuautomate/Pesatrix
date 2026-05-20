import "server-only";

import { getMinWithdrawalKsh, getPlatformSetting, getWithdrawalFeeKsh } from "@/lib/platform-settings";
import { WITHDRAWAL_N8N_WEBHOOK_URL_KEY } from "@/lib/platform-setting-keys";
import { normalizePesaPhone } from "@/lib/mpesa";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  isAllowedWithdrawalPhone,
  normalizeWithdrawalStoragePhone,
} from "@/lib/withdrawal-utils";

const WEBHOOK_TIMEOUT_MS = 5000;
const WEBHOOK_MAX_ATTEMPTS = 3;

export type WithdrawalContact = {
  email: string | null;
  fullName: string | null;
  phone: string | null;
};

export async function getMinWithdrawalAmount() {
  return getMinWithdrawalKsh();
}

export async function getWithdrawalFeeAmount() {
  return getWithdrawalFeeKsh();
}

export async function getWithdrawalContactForUser(userId: string): Promise<WithdrawalContact> {
  const admin = createAdminSupabaseClient();
  const { data: profile, error: profileError } = await (admin.from("profiles" as never) as any)
    .select("full_name, email, phone")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  const authUserResult = await admin.auth.admin.getUserById(userId);
  if (authUserResult.error) {
    console.warn("[Withdrawal] Failed to fetch auth user metadata", authUserResult.error);
  }

  const authUser = authUserResult.data.user;
  const metadata = authUser?.user_metadata ?? {};

  const rawPhone =
    profile?.phone ??
    (typeof metadata.phone === "string" ? metadata.phone : null) ??
    null;

  let normalizedPhone: string | null = null;
  if (typeof rawPhone === "string" && rawPhone.trim().length > 0) {
    try {
      normalizedPhone = normalizeWithdrawalStoragePhone(rawPhone);
    } catch {
      normalizedPhone = null;
    }
  }

  return {
    email:
      profile?.email ??
      authUser?.email ??
      (typeof metadata.email === "string" ? metadata.email : null) ??
      null,
    fullName:
      profile?.full_name ??
      (typeof metadata.full_name === "string" ? metadata.full_name : null) ??
      null,
    phone: normalizedPhone,
  };
}

export async function getConfiguredWithdrawalWebhookUrl() {
  const setting = await getPlatformSetting(WITHDRAWAL_N8N_WEBHOOK_URL_KEY);
  const configured = typeof setting?.value === "string" ? setting.value.trim() : "";
  const fallback = process.env.WITHDRAWAL_N8N_WEBHOOK_URL?.trim() ?? "";
  return configured || fallback || null;
}

export type WithdrawalWebhookPayload = {
  amount: number;
  date: string;
  email: string | null;
  fee_ksh?: number;
  name: string | null;
  phone_number: string;
  requested_amount?: number;
};

export function buildWithdrawalWebhookPayload(input: {
  amountToReceive: number;
  createdAt: string;
  contact: WithdrawalContact;
  feeKsh: number;
  phone: string;
  requestedAmount: number;
}): WithdrawalWebhookPayload {
  return {
    name: input.contact.fullName,
    email: input.contact.email,
    amount: input.amountToReceive,
    requested_amount: input.requestedAmount,
    fee_ksh: input.feeKsh,
    phone_number: normalizePesaPhone(input.phone),
    date: input.createdAt,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendWithdrawalWebhook(payload: WithdrawalWebhookPayload, withdrawalId: string) {
  const url = await getConfiguredWithdrawalWebhookUrl();
  if (!url) {
    return { ok: false, skipped: true, attempts: 0 as number };
  }

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= WEBHOOK_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        return { ok: true, skipped: false, attempts: attempt };
      }

      lastError = new Error(`Webhook responded with ${response.status}`);
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;
    }

    if (attempt < WEBHOOK_MAX_ATTEMPTS) {
      await sleep(attempt * 300);
    }
  }

  console.error("[Withdrawal Webhook] Failed after retries", {
    withdrawalId,
    payload,
    error: lastError instanceof Error ? lastError.message : lastError,
  });

  return { ok: false, skipped: false, attempts: WEBHOOK_MAX_ATTEMPTS };
}
export { isAllowedWithdrawalPhone, normalizeWithdrawalStoragePhone };
