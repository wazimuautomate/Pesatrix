export type IpIntelligence = {
  country: string | null;
  city: string | null;
  isVpn: boolean;
  isDatacenter: boolean;
};

const LOCAL_IP_COUNTRY = "LOCAL";

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const nextRequestIp = (request as unknown as { ip?: string }).ip?.trim();

  return forwardedFor || realIp || nextRequestIp || null;
}

export function isLocalIp(ip: string | null) {
  if (!ip) return false;

  const normalized = ip.trim().toLowerCase();

  return (
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "localhost" ||
    normalized.startsWith("10.") ||
    normalized.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized) ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

export async function lookupIpIntelligence(ip: string | null): Promise<IpIntelligence> {
  if (!ip) {
    return {
      country: null,
      city: null,
      isVpn: false,
      isDatacenter: false,
    };
  }

  if (isLocalIp(ip)) {
    return {
      country: LOCAL_IP_COUNTRY,
      city: null,
      isVpn: false,
      isDatacenter: false,
    };
  }

  try {
    const response = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=country,city,proxy,hosting`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(`ip-api.com returned ${response.status}`);
    }

    const payload = (await response.json()) as {
      country?: string;
      city?: string;
      proxy?: boolean;
      hosting?: boolean;
    };

    const isDatacenter = payload.hosting === true;

    return {
      country: payload.country ?? null,
      city: payload.city ?? null,
      isVpn: payload.proxy === true || isDatacenter,
      isDatacenter,
    };
  } catch (error) {
    console.error("[fraud:ip] Failed to look up IP intelligence", error);

    return {
      country: null,
      city: null,
      isVpn: false,
      isDatacenter: false,
    };
  }
}
