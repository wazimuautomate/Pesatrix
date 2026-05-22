import assert from "node:assert/strict";
import test from "node:test";

const {
  KENYAN_MPESA_PHONE_REGEX,
  normalizeKenyanPhone,
  normalizeStoredWithdrawalPhone,
  phonesMatch,
  validateSafaricomIP,
} = await import("../src/lib/mpesa/security.ts");

test("activation phone validation accepts Safaricom 07 and 01 formats", () => {
  for (const phone of ["0790295408", "254790295408", "+254790295408", "0111327204", "254111327204", "+254111327204"]) {
    assert.match(phone, KENYAN_MPESA_PHONE_REGEX);
  }
});

test("normalizePesaPhone stores activation payment phones in Daraja format", () => {
  assert.equal(normalizeKenyanPhone("+254790295408"), "254790295408");
  assert.equal(normalizeKenyanPhone("0790295408"), "254790295408");
  assert.equal(normalizeKenyanPhone("+254111327204"), "254111327204");
  assert.equal(normalizeKenyanPhone("0111327204"), "254111327204");
});

test("normalizeStoredWithdrawalPhone accepts 07 and 01 withdrawal numbers", () => {
  assert.equal(normalizeStoredWithdrawalPhone("0790295408"), "+254790295408");
  assert.equal(normalizeStoredWithdrawalPhone("0111327204"), "+254111327204");
});

test("phonesMatch compares database and callback phone formats", () => {
  assert.equal(phonesMatch("+254790295408", "254790295408"), true);
  assert.equal(phonesMatch("254111327204", "+254111327204"), true);
});

test("production Safaricom IP validation accepts the observed Daraja callback IP", () => {
  const originalDarajaEnv = process.env.DARAJA_ENV;
  const originalWhitelist = process.env.SAFARICOM_IP_WHITELIST;

  try {
    process.env.DARAJA_ENV = "production";
    delete process.env.SAFARICOM_IP_WHITELIST;

    assert.equal(validateSafaricomIP("196.201.212.74"), true);
    assert.equal(validateSafaricomIP("8.8.8.8"), false);
  } finally {
    if (originalDarajaEnv === undefined) {
      delete process.env.DARAJA_ENV;
    } else {
      process.env.DARAJA_ENV = originalDarajaEnv;
    }

    if (originalWhitelist === undefined) {
      delete process.env.SAFARICOM_IP_WHITELIST;
    } else {
      process.env.SAFARICOM_IP_WHITELIST = originalWhitelist;
    }
  }
});

test("production Safaricom IP validation supports configured CIDR ranges", () => {
  const originalDarajaEnv = process.env.DARAJA_ENV;
  const originalWhitelist = process.env.SAFARICOM_IP_WHITELIST;

  try {
    process.env.DARAJA_ENV = "production";
    process.env.SAFARICOM_IP_WHITELIST = "196.201.212.0/24";

    assert.equal(validateSafaricomIP("196.201.212.74"), true);
    assert.equal(validateSafaricomIP("196.201.213.74"), false);
  } finally {
    if (originalDarajaEnv === undefined) {
      delete process.env.DARAJA_ENV;
    } else {
      process.env.DARAJA_ENV = originalDarajaEnv;
    }

    if (originalWhitelist === undefined) {
      delete process.env.SAFARICOM_IP_WHITELIST;
    } else {
      process.env.SAFARICOM_IP_WHITELIST = originalWhitelist;
    }
  }
});
