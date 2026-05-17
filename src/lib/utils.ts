import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format KSh currency values (integer KSh, no floating point per spec)
 */
export function formatKSh(amount: number): string {
  return `KSh ${amount.toLocaleString("en-KE")}`;
}

/**
 * Format phone number for display: +254 7XX XXX XXX
 */
export function formatPhone(phone: string): string {
  const clean = phone.replace(/\D/g, "");
  if (clean.startsWith("254") && clean.length === 12) {
    return `+${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 9)} ${clean.slice(9)}`;
  }
  return phone;
}

/**
 * Normalize Kenyan phone to 254XXXXXXXXX format
 */
export function normalizePhone(phone: string): string {
  let clean = phone.replace(/\D/g, "");
  if (clean.startsWith("0")) {
    clean = "254" + clean.slice(1);
  } else if (clean.startsWith("+254")) {
    clean = clean.slice(1);
  } else if (!clean.startsWith("254")) {
    clean = "254" + clean;
  }
  return clean;
}

/**
 * Get relative time string from a date
 */
export function relativeTime(date: Date | string): string {
  const now = new Date();
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-KE", { month: "short", day: "numeric" });
}
