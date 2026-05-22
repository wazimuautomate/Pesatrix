import fs from "node:fs";
import path from "node:path";
import NodeRSA from "node-rsa";

export function generateSecurityCredential(): string {
  const password = process.env.MPESA_INITIATOR_PASSWORD?.trim() || process.env.DARAJA_INITIATOR_PASSWORD?.trim();
  
  let cert = process.env.MPESA_PUBLIC_CERT;

  // Fallback to loading from uploaded certificates in the root directory if the environment variable is not defined
  if (!cert) {
    const isProd = process.env.DARAJA_ENV?.trim().toLowerCase() === "production";
    const certFilename = isProd ? "ProductionCertificate.cer" : "SandboxCertificate.cer";
    const certPath = path.join(process.cwd(), certFilename);
    
    try {
      if (fs.existsSync(certPath)) {
        cert = fs.readFileSync(certPath, "utf8");
      }
    } catch (err) {
      console.error(`[M-Pesa B2C] Failed to read certificate from fallback path: ${certPath}`, err);
    }
  }

  if (!password || !cert) {
    throw new Error("MPESA_INITIATOR_PASSWORD (or DARAJA_INITIATOR_PASSWORD) and MPESA_PUBLIC_CERT (or local certificate files) are not set");
  }

  const key = new NodeRSA();
  
  // Resilient format loading
  try {
    key.importKey(cert, "pkcs8-public-pem");
  } catch {
    // If standard PEM parsing fails, import using general public detection format
    key.importKey(cert, "public");
  }
  
  key.setOptions({ encryptionScheme: "pkcs1" });

  return key.encrypt(password, "base64");
}
