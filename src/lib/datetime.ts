export function normalizeDatetime(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;

  const trimmed = value.trim();
  const date = new Date(trimmed);

  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

export function toDatetimeLocalInputValue(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

export function normalizeTaskDatetimes<T extends Record<string, unknown>>(value: T): T {
  return {
    ...value,
    publish_at: normalizeDatetime(value.publish_at),
    expires_at: normalizeDatetime(value.expires_at),
  };
}
