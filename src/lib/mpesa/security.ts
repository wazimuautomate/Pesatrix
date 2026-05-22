import crypto from "node:crypto";

export const KENYAN_MPESA_PHONE_REGEX = /^(?:\+?254|0)[17]\d{8}$/;
export const DARAJA_PHONE_REGEX = /^254[17]\d{8}$/;
const DEFAULT_SAFARICOM_CALLBACK_IPS = ["196.201.212.74"];

function getEnvValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function generateTimestamp(date = new Date()): string {
  return date.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
}

export function generateStkPassword(timestamp: string): string {
  const shortcode = getEnvValue("DARAJA_SHORTCODE");
  const passkey = getEnvValue("DARAJA_PASSKEY");
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
}

export function encryptCredential(plainText: string, certificate: string): string {
  return crypto
    .publicEncrypt(
      {
        key: certificate,
        padding: crypto.constants.RSA_PKCS1_PADDING,
      },
      Buffer.from(plainText, "utf8")
    )
    .toString("base64");
}

export function resolveSecurityCredential(): string {
  const directCredential = process.env.DARAJA_SECURITY_CREDENTIAL?.trim();
  if (directCredential) {
    return directCredential;
  }

  const initiatorPassword = process.env.DARAJA_INITIATOR_PASSWORD?.trim();
  const certificate = process.env.DARAJA_CERTIFICATE?.trim();
  if (initiatorPassword && certificate) {
    return encryptCredential(initiatorPassword, certificate);
  }

  throw new Error("Missing Daraja B2C security credential configuration");
}

export function normalizeKenyanPhone(input: string): string {
  const value = input.trim().replace(/[^\d+]/g, "");

  if (value.startsWith("+254")) {
    return value.slice(1);
  }

  if (value.startsWith("254")) {
    return value;
  }

  if (value.startsWith("0")) {
    return `254${value.slice(1)}`;
  }

  return value;
}

export function normalizeStoredWithdrawalPhone(input: string): string {
  const normalized = normalizeKenyanPhone(input);
  if (!/^254[17]\d{8}$/.test(normalized)) {
    throw new Error("Withdrawal phone must be a valid Kenyan M-Pesa number");
  }

  return `+${normalized}`;
}

export function validateKenyanMpesaPhone(input: string): boolean {
  return DARAJA_PHONE_REGEX.test(normalizeKenyanPhone(input));
}

export function phonesMatch(left: string | null | undefined, right: string | null | undefined) {
  if (!left || !right) {
    return false;
  }

  return normalizeKenyanPhone(left) === normalizeKenyanPhone(right);
}

export function extractIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "0.0.0.0";
  }

  return request.headers.get("x-real-ip")?.trim() ?? "0.0.0.0";
}

function ipv4ToNumber(ip: string): number | null {
  const octets = ip.split(".");
  if (octets.length !== 4) {
    return null;
  }

  let value = 0;
  for (const octet of octets) {
    if (!/^\d{1,3}$/.test(octet)) {
      return null;
    }

    const parsed = Number(octet);
    if (parsed < 0 || parsed > 255) {
      return null;
    }

    value = value * 256 + parsed;
  }

  return value >>> 0;
}

function ipMatchesAllowlistEntry(requestIP: string, entry: string): boolean {
  if (!entry.includes("/")) {
    return requestIP === entry;
  }

  const [rangeIP, prefixValue] = entry.split("/");
  const prefix = Number(prefixValue);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return false;
  }

  const requestNumber = ipv4ToNumber(requestIP);
  const rangeNumber = ipv4ToNumber(rangeIP);
  if (requestNumber === null || rangeNumber === null) {
    return false;
  }

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (requestNumber & mask) === (rangeNumber & mask);
}

export function validateSafaricomIP(requestIP: string): boolean {
  if (process.env.DARAJA_ENV !== "production") {
    return true;
  }

  const configuredWhitelist = (process.env.SAFARICOM_IP_WHITELIST ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const whitelist = [...DEFAULT_SAFARICOM_CALLBACK_IPS, ...configuredWhitelist];

  return whitelist.some((entry) => ipMatchesAllowlistEntry(requestIP, entry));
}
