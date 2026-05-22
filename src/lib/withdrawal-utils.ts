function normalizeKenyanPhone(phone: string) {
  const value = phone.trim().replace(/\s+/g, "");

  if (value.startsWith("0")) {
    return `+254${value.slice(1)}`;
  }

  if (value.startsWith("254")) {
    return `+${value}`;
  }

  return value;
}

function normalizeDarajaPhone(phone: string) {
  const clean = phone.replace(/[^\d+]/g, "");
  if (clean.startsWith("+254")) return clean.slice(1);
  if (clean.startsWith("254")) return clean;
  if (clean.startsWith("0")) return "254" + clean.slice(1);
  return clean;
}

export function normalizeWithdrawalStoragePhone(phone: string) {
  const normalized = normalizeKenyanPhone(phone);
  if (!/^\+254[17]\d{8}$/.test(normalized)) {
    throw new Error("Withdrawal phone must be a valid Kenyan M-Pesa number");
  }

  return normalized;
}

export function isAllowedWithdrawalPhone(inputPhone: string, allowedPhone: string | null) {
  if (!allowedPhone) {
    return false;
  }

  return normalizeDarajaPhone(inputPhone) === normalizeDarajaPhone(allowedPhone);
}
