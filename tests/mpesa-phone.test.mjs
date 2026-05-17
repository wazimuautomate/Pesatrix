import assert from "node:assert/strict";
import test from "node:test";

const { KENYAN_PHONE_REGEX, normalizePesaPhone, phonesMatch } = await import("../src/lib/mpesa.ts");

test("activation phone validation accepts Safaricom 07 and 01 formats", () => {
  for (const phone of ["0790295408", "254790295408", "+254790295408", "0111327204", "254111327204", "+254111327204"]) {
    assert.match(phone, KENYAN_PHONE_REGEX);
  }
});

test("normalizePesaPhone stores activation payment phones in Daraja format", () => {
  assert.equal(normalizePesaPhone("+254790295408"), "254790295408");
  assert.equal(normalizePesaPhone("0790295408"), "254790295408");
  assert.equal(normalizePesaPhone("+254111327204"), "254111327204");
  assert.equal(normalizePesaPhone("0111327204"), "254111327204");
});

test("phonesMatch compares database and callback phone formats", () => {
  assert.equal(phonesMatch("+254790295408", "254790295408"), true);
  assert.equal(phonesMatch("254111327204", "+254111327204"), true);
});
