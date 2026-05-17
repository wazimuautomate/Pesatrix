import { createHash } from "crypto";

export type CpxSurvey = {
  id: string;
  title: string;
  loi: string;
  payout: number;
  payoutPublisherUsd: number | null;
  conversionRate: string | null;
  href: string;
};

type RawCpxSurvey = {
  id?: unknown;
  title?: unknown;
  loi?: unknown;
  payout?: unknown;
  payout_publisher_usd?: unknown;
  conversion_rate?: unknown;
  href?: unknown;
};

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toStringOrNull(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function createCpxSecureHash(userId: string, secureHashBase: string) {
  return createHash("md5").update(`${userId}-${secureHashBase}`).digest("hex");
}

export function normalizeCpxSurveys(payload: unknown): CpxSurvey[] {
  const rawSurveys = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { surveys?: unknown }).surveys)
      ? (payload as { surveys: unknown[] }).surveys
      : [];

  return rawSurveys.flatMap((entry) => {
    const survey = entry as RawCpxSurvey;
    const id = toStringOrNull(survey.id);
    const href = toStringOrNull(survey.href);

    if (!id || !href) {
      return [];
    }

    return [
      {
        id,
        title: toStringOrNull(survey.title) ?? `Survey ${id}`,
        loi: toStringOrNull(survey.loi) ?? "Varies",
        payout: toNumber(survey.payout),
        payoutPublisherUsd:
          survey.payout_publisher_usd === undefined ? null : toNumber(survey.payout_publisher_usd),
        conversionRate: toStringOrNull(survey.conversion_rate),
        href,
      },
    ];
  });
}
