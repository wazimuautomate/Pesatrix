export {
  ACTIVATION_FEE_KSH as MPESA_STK_AMOUNT,
  DARAJA_PHONE_REGEX,
  KENYAN_MPESA_PHONE_REGEX as KENYAN_PHONE_REGEX,
  extractIP,
  generateStkPassword,
  generateTimestamp,
  normalizeKenyanPhone as normalizePesaPhone,
  normalizeStoredWithdrawalPhone,
  phonesMatch,
  resolveSecurityCredential,
  validateKenyanMpesaPhone,
  validateSafaricomIP,
} from "./mpesa/security";

export { getDarajaToken, initiateB2C, initiateStkPush } from "./mpesa/client";

export type {
  B2CResultPayload,
  B2CTimeoutPayload,
  ParsedB2CResult,
  ParsedStkCallbackMetadata,
  StkCallbackPayload,
} from "./mpesa/types";

import type {
  B2CResultPayload,
  ParsedB2CResult,
  ParsedStkCallbackMetadata,
  StkCallbackMetadataItem,
} from "./mpesa/types";

export function parseStkCallbackMetadata(
  items: StkCallbackMetadataItem[] | undefined
): ParsedStkCallbackMetadata {
  const metadata = new Map<string, unknown>();

  for (const item of items ?? []) {
    if (item?.Name) {
      metadata.set(item.Name, item.Value);
    }
  }

  const amountValue = metadata.get("Amount");
  const receiptValue = metadata.get("MpesaReceiptNumber");
  const phoneValue = metadata.get("PhoneNumber");
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
  };
}

export function parseB2CResultPayload(payload: B2CResultPayload): ParsedB2CResult {
  const parameters = new Map<string, unknown>();

  for (const item of payload.Result?.ResultParameters?.ResultParameter ?? []) {
    if (item?.Key) {
      parameters.set(item.Key, item.Value);
    }
  }

  const amountValue = parameters.get("TransactionAmount");
  const receiptValue = parameters.get("TransactionReceipt");

  return {
    amount:
      typeof amountValue === "number"
        ? amountValue
        : typeof amountValue === "string" && amountValue.trim()
          ? Number(amountValue)
          : undefined,
    receipt:
      typeof receiptValue === "string" && receiptValue.trim() ? receiptValue.trim() : undefined,
    receiverPartyPublicName:
      typeof parameters.get("ReceiverPartyPublicName") === "string"
        ? (parameters.get("ReceiverPartyPublicName") as string)
        : undefined,
    transactionCompletedDateTime:
      typeof parameters.get("TransactionCompletedDateTime") === "string"
        ? (parameters.get("TransactionCompletedDateTime") as string)
        : undefined,
    utilityAccountAvailableFunds:
      typeof parameters.get("UtilityAccountAvailableFunds") === "string"
        ? (parameters.get("UtilityAccountAvailableFunds") as string)
        : undefined,
    workingAccountAvailableFunds:
      typeof parameters.get("WorkingAccountAvailableFunds") === "string"
        ? (parameters.get("WorkingAccountAvailableFunds") as string)
        : undefined,
  };
}
