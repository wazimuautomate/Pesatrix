import assert from "node:assert/strict";
import test from "node:test";

const {
  KENYAN_MPESA_PHONE_REGEX,
  normalizeKenyanPhone,
  phonesMatch,
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

test("phonesMatch compares database and callback phone formats", () => {
  assert.equal(phonesMatch("+254790295408", "254790295408"), true);
  assert.equal(phonesMatch("254111327204", "+254111327204"), true);
});
