import FingerprintJS from "@fingerprintjs/fingerprintjs";

let fingerprintPromise: Promise<string> | null = null;

export async function getFingerprint() {
  if (!fingerprintPromise) {
    fingerprintPromise = FingerprintJS.load()
      .then((fp) => fp.get())
      .then((result) => result.visitorId);
  }

  return fingerprintPromise;
}

export async function sendFingerprint(visitorId: string) {
  const response = await fetch("/api/fraud/fingerprint", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      visitorId,
      userAgent: navigator.userAgent,
    }),
  });

  return response.ok;
}

export async function captureAndSendFingerprint() {
  try {
    const visitorId = await getFingerprint();
    await sendFingerprint(visitorId);
  } catch (error) {
    console.error("[fraud:fingerprint] Failed to send fingerprint", error);
  }
}
