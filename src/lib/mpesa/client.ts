import "server-only";

import {
  generateStkPassword,
  generateTimestamp,
  resolveSecurityCredential,
} from "./security";
import type {
  B2CInitiationResponse,
  B2CRequest,
  DarajaTokenResponse,
  StkPushRequest,
  StkPushResponse,
} from "./types";

function resolveDarajaEnvironment() {
  const env = process.env.DARAJA_ENV?.trim().toLowerCase();

  if (!env || env === "sandbox" || env === "development" || env === "test") {
    return "sandbox" as const;
  }

  if (env === "production" || env === "live") {
    return "production" as const;
  }

  throw new Error(
    `Unsupported DARAJA_ENV value "${process.env.DARAJA_ENV}". Use sandbox/development/test or production/live.`
  );
}

const DARAJA_ENVIRONMENT = resolveDarajaEnvironment();
const DARAJA_BASE =
  DARAJA_ENVIRONMENT === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

let cachedToken: { token: string; expiresAt: number } | null = null;

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function parseDarajaJson(response: Response) {
  const text = await response.text();

  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error(`Daraja returned non-JSON response (${response.status})`);
  }
}

function sanitizeDarajaError(data: Record<string, unknown>, fallback: string) {
  if (typeof data.errorMessage === "string" && data.errorMessage.trim()) {
    return data.errorMessage.trim();
  }

  if (typeof data.ResponseDescription === "string" && data.ResponseDescription.trim()) {
    return data.ResponseDescription.trim();
  }

  if (typeof data.error_description === "string" && data.error_description.trim()) {
    return data.error_description.trim();
  }

  return fallback;
}

function isInvalidAccessTokenError(data: Record<string, unknown>) {
  const values = [
    data.errorMessage,
    data.ResponseDescription,
    data.error_description,
  ];

  return values.some(
    (value) => typeof value === "string" && value.toLowerCase().includes("invalid access token")
  );
}

function getAccessTokenMismatchHint() {
  if (DARAJA_ENVIRONMENT === "sandbox") {
    return "Invalid Access Token. Daraja is rejecting the sandbox STK request. This usually means the app is using live shortcode/passkey credentials against sandbox. Set DARAJA_ENV=production for live credentials, or switch to sandbox shortcode/passkey values.";
  }

  return "Invalid Access Token. Daraja is rejecting the live STK request. Confirm the consumer key/secret, shortcode, and passkey all belong to the same approved live app.";
}

export async function getDarajaToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const credentials = Buffer.from(
    `${getRequiredEnv("DARAJA_CONSUMER_KEY")}:${getRequiredEnv("DARAJA_CONSUMER_SECRET")}`
  ).toString("base64");

  const response = await fetch(`${DARAJA_BASE}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: {
      Authorization: `Basic ${credentials}`,
    },
    cache: "no-store",
  });

  const data = (await parseDarajaJson(response)) as Partial<DarajaTokenResponse>;

  if (!response.ok || typeof data.access_token !== "string" || typeof data.expires_in !== "string") {
    throw new Error(`Daraja auth failed: ${sanitizeDarajaError(data, `HTTP ${response.status}`)}`);
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + Number.parseInt(data.expires_in, 10) * 1000,
  };

  return cachedToken.token;
}

export async function initiateStkPush(params: {
  phone: string;
  amount: number;
  accountRef: string;
  description: string;
  callbackUrl?: string;
}) {
  const token = await getDarajaToken();
  const timestamp = generateTimestamp();

  const payload: StkPushRequest = {
    BusinessShortCode: getRequiredEnv("DARAJA_SHORTCODE"),
    Password: generateStkPassword(timestamp),
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: params.amount,
    PartyA: params.phone,
    PartyB: getRequiredEnv("DARAJA_SHORTCODE"),
    PhoneNumber: params.phone,
    CallBackURL: params.callbackUrl ?? getRequiredEnv("DARAJA_CALLBACK_URL"),
    AccountReference: params.accountRef,
    TransactionDesc: params.description,
  };

  const response = await fetch(`${DARAJA_BASE}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = (await parseDarajaJson(response)) as Partial<StkPushResponse>;

  if (isInvalidAccessTokenError(data)) {
    throw new Error(`STK Push failed: ${getAccessTokenMismatchHint()}`);
  }

  if (
    !response.ok ||
    data.ResponseCode !== "0" ||
    typeof data.CheckoutRequestID !== "string" ||
    typeof data.MerchantRequestID !== "string"
  ) {
    throw new Error(`STK Push failed: ${sanitizeDarajaError(data, `HTTP ${response.status}`)}`);
  }

  return {
    checkoutRequestId: data.CheckoutRequestID,
    merchantRequestId: data.MerchantRequestID,
    responseCode: data.ResponseCode,
    responseDescription: data.ResponseDescription ?? "Accepted",
    customerMessage: data.CustomerMessage ?? "Check your phone for the M-Pesa prompt",
  };
}

export async function initiateB2C(params: {
  phone: string;
  amount: number;
  remarks: string;
  occasion: string;
  resultUrl?: string;
  timeoutUrl?: string;
}) {
  const token = await getDarajaToken();

  const payload: B2CRequest = {
    InitiatorName: getRequiredEnv("DARAJA_INITIATOR_NAME"),
    SecurityCredential: resolveSecurityCredential(),
    CommandID: "SalaryPayment",
    Amount: String(params.amount),
    PartyA: getRequiredEnv("DARAJA_SHORTCODE"),
    PartyB: params.phone,
    Remarks: params.remarks,
    QueueTimeOutURL: params.timeoutUrl ?? getRequiredEnv("DARAJA_B2C_TIMEOUT_URL"),
    ResultURL: params.resultUrl ?? getRequiredEnv("DARAJA_B2C_RESULT_URL"),
    Occasion: params.occasion,
  };

  const response = await fetch(`${DARAJA_BASE}/mpesa/b2c/v1/paymentrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = (await parseDarajaJson(response)) as Partial<B2CInitiationResponse>;

  if (
    !response.ok ||
    data.ResponseCode !== "0" ||
    typeof data.ConversationID !== "string" ||
    typeof data.OriginatorConversationID !== "string"
  ) {
    throw new Error(`B2C failed: ${sanitizeDarajaError(data, `HTTP ${response.status}`)}`);
  }

  return {
    conversationId: data.ConversationID,
    originatorConversationId: data.OriginatorConversationID,
    responseCode: data.ResponseCode,
    responseDescription: data.ResponseDescription ?? "Accepted",
  };
}
