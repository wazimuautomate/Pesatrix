/**
 * Daraja (Safaricom M-Pesa) API client.
 * All secrets come from server-side env vars only — never exposed to the client.
 */

export const MPESA_STK_AMOUNT = 500;
export const KENYAN_PHONE_REGEX = /^(?:\+?254|0)[17]\d{8}$/;

const DARAJA_BASE_URL =
  process.env.MPESA_ENV === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";

const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY!;
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET!;
const SHORTCODE = process.env.MPESA_SHORTCODE!;
const PASSKEY = process.env.MPESA_PASSKEY!;
const CALLBACK_URL = process.env.MPESA_CALLBACK_URL!;

/** Get a short-lived OAuth access token */
async function getAccessToken(): Promise<string> {
  const credentials = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString("base64");
  const res = await fetch(`${DARAJA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Daraja auth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token as string;
}

/** Generate the base64-encoded password for STK push */
function generatePassword(timestamp: string): string {
  const raw = `${SHORTCODE}${PASSKEY}${timestamp}`;
  return Buffer.from(raw).toString("base64");
}

/** Format timestamp as YYYYMMDDHHmmss */
function getTimestamp(): string {
  return new Date()
    .toISOString()
    .replace(/[-T:.Z]/g, "")
    .slice(0, 14);
}

export interface STKPushResult {
  merchantRequestId: string;
  checkoutRequestId: string;
  responseCode: string;
  responseDescription: string;
  customerMessage: string;
}

export type StkCallbackMetadata = {
  amount?: number;
  mpesaReceipt?: string;
  phoneNumber?: string;
  transactionDate?: string;
};

/**
 * Initiate an STK Push (Lipa Na M-Pesa Online).
 * @param phone - Kenyan phone number starting with 254 (e.g. 254712345678)
 * @param amount - Integer amount in KSh
 * @param accountRef - Short reference shown on the user's phone
 * @param description - Transaction description (max 13 chars)
 */
export async function initiateStkPush(
  phone: string,
  amount: number,
  accountRef: string,
  description: string
): Promise<STKPushResult> {
  const token = await getAccessToken();
  const timestamp = getTimestamp();
  const password = generatePassword(timestamp);

  const body = {
    BusinessShortCode: SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: amount,
    PartyA: phone,
    PartyB: SHORTCODE,
    PhoneNumber: phone,
    CallBackURL: CALLBACK_URL,
    AccountReference: accountRef,
    TransactionDesc: description,
  };

  const res = await fetch(`${DARAJA_BASE_URL}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`STK Push failed ${res.status}: ${errText}`);
  }

  const data = await res.json();

  if (data.ResponseCode !== "0") {
    throw new Error(`STK Push error: ${data.ResponseDescription}`);
  }

  return {
    merchantRequestId: data.MerchantRequestID,
    checkoutRequestId: data.CheckoutRequestID,
    responseCode: data.ResponseCode,
    responseDescription: data.ResponseDescription,
    customerMessage: data.CustomerMessage,
  };
}

/** Normalize a Kenyan phone number to 254XXXXXXXXX format for M-Pesa. */
export function normalizePesaPhone(phone: string): string {
  const clean = phone.replace(/[^\d+]/g, "");
  if (clean.startsWith("+254")) return clean.slice(1);
  if (clean.startsWith("254")) return clean;
  if (clean.startsWith("0")) return "254" + clean.slice(1);
  return clean;
}

export function phonesMatch(left: string | null | undefined, right: string | null | undefined) {
  if (!left || !right) return false;
  return normalizePesaPhone(left) === normalizePesaPhone(right);
}

export function parseStkCallbackMetadata(items: Array<{ Name?: string; Value?: unknown }> | undefined) {
  const metadata = new Map<string, unknown>();

  for (const item of items ?? []) {
    if (item?.Name) {
      metadata.set(item.Name, item.Value);
    }
  }

  const amountValue = metadata.get("Amount");
  const phoneValue = metadata.get("PhoneNumber");
  const receiptValue = metadata.get("MpesaReceiptNumber");
  const transactionDateValue = metadata.get("TransactionDate");

  return {
    amount:
      typeof amountValue === "number"
        ? amountValue
        : typeof amountValue === "string" && amountValue.trim()
          ? Number(amountValue)
          : undefined,
    mpesaReceipt:
      typeof receiptValue === "string" && receiptValue.trim() ? receiptValue.trim() : undefined,
    phoneNumber:
      typeof phoneValue === "number"
        ? String(phoneValue)
        : typeof phoneValue === "string" && phoneValue.trim()
          ? phoneValue.trim()
          : undefined,
    transactionDate:
      typeof transactionDateValue === "number"
        ? String(transactionDateValue)
        : typeof transactionDateValue === "string" && transactionDateValue.trim()
          ? transactionDateValue.trim()
          : undefined,
  } satisfies StkCallbackMetadata;
}

const B2C_INITIATOR_NAME = process.env.DARAJA_B2C_INITIATOR_NAME!;
const B2C_SECURITY_CREDENTIAL = process.env.DARAJA_B2C_SECURITY_CREDENTIAL!;
const B2C_SHORTCODE = process.env.DARAJA_B2C_SHORTCODE!;
const B2C_RESULT_URL = process.env.DARAJA_B2C_RESULT_URL!;
const B2C_TIMEOUT_URL = process.env.DARAJA_B2C_TIMEOUT_URL!;

export interface B2CResult {
  ConversationID: string;
  OriginatorConversationID: string;
  ResponseDescription: string;
}

export async function initiateB2C(
  amount: number,
  phone: string,
  withdrawalId: string
): Promise<B2CResult> {
  const token = await getAccessToken();

  const body = {
    InitiatorName: B2C_INITIATOR_NAME,
    SecurityCredential: B2C_SECURITY_CREDENTIAL,
    CommandID: "BusinessPayment",
    Amount: amount,
    PartyA: B2C_SHORTCODE,
    PartyB: phone,
    Remarks: "Pesatrix withdrawal",
    Occasion: "Withdrawal",
    QueueTimeOutURL: B2C_TIMEOUT_URL,
    ResultURL: B2C_RESULT_URL,
  };

  const res = await fetch(`${DARAJA_BASE_URL}/mpesa/b2c/v3/paymentrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`B2C request failed ${res.status}: ${errText}`);
  }

  const data = await res.json();

  if (data.ResponseCode && data.ResponseCode !== "0") {
    throw new Error(`B2C error: ${data.ResponseDescription}`);
  }

  return {
    ConversationID: data.ConversationID,
    OriginatorConversationID: data.OriginatorConversationID,
    ResponseDescription: data.ResponseDescription,
  };
}
