export function normalizeDatetime(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;

  const trimmed = value.trim();
  const normalized = trimmed.length === 16 ? `${trimmed}:00.000Z` : trimmed;
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString();
}

export function normalizeTaskDatetimes<T extends Record<string, unknown>>(value: T): T {
  return {
    ...value,
    publish_at: normalizeDatetime(value.publish_at),
    expires_at: normalizeDatetime(value.expires_at),
  };
}
