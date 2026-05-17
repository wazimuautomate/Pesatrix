import test from "node:test";
import assert from "node:assert/strict";

const {
  buildRegisterSignUpInput,
  mapRegisterErrorMessage,
} = await import("./register" + ".ts");

test("buildRegisterSignUpInput normalizes and trims signup payload", () => {
  const payload = buildRegisterSignUpInput(
    {
      fullName: "  Jane Doe  ",
      phone: "0712 345 678",
      county: " Kisumu ",
      email: "  JANE@EXAMPLE.COM ",
      password: "Password1",
      referralCode: " REF123 ",
      humanVerified: true,
    },
    "http://localhost:3000"
  );

  assert.equal(payload.email, "jane@example.com");
  assert.equal(payload.password, "Password1");
  assert.equal(payload.options.data.full_name, "Jane Doe");
  assert.equal(payload.options.data.phone, "+254712345678");
  assert.equal(payload.options.data.county, "Kisumu");
  assert.equal(payload.options.data.referral_code, "REF123");
  assert.equal(payload.options.data.human_verified, true);
  assert.equal(
    payload.options.emailRedirectTo,
    "http://localhost:3000/api/auth/callback?next=%2Flogin%3Fconfirmed%3D1"
  );
});

test("mapRegisterErrorMessage handles database trigger failures", () => {
  assert.equal(
    mapRegisterErrorMessage("Database error saving new user"),
    "Signup failed due to a server setup error. Please try again."
  );

  assert.equal(
    mapRegisterErrorMessage("unexpected_failure"),
    "Signup failed due to a server setup error. Please try again."
  );
});

test("mapRegisterErrorMessage handles disabled signup errors", () => {
  assert.equal(
    mapRegisterErrorMessage("Signups not allowed for this instance"),
    "Registration is disabled in the backend. Enable sign-ups in Supabase Auth settings."
  );
});
