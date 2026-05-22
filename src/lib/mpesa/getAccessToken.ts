import { getDarajaToken } from "./client";

/**
 * Retrieves the cached or fresh Safaricom Daraja M-Pesa access token.
 * Reuses the existing robust token generation logic with automatic expiration caching.
 */
export async function getMpesaAccessToken(): Promise<string> {
  return getDarajaToken();
}
