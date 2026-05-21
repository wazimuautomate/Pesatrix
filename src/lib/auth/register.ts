type RegisterInput = {
  fullName: string;
  phone: string;
  county: string;
  email: string;
  password: string;
  referralCode?: string;
  humanVerified?: boolean;
};

export function normalizeKenyanPhone(phone: string) {
  const value = phone.trim().replace(/\s+/g, "");

  if (value.startsWith("0")) {
    return `+254${value.slice(1)}`;
  }

  if (value.startsWith("254")) {
    return `+${value}`;
  }

  return value;
}

export function buildRegisterSignUpInput(
  data: RegisterInput,
  origin: string
) {
  const phone = normalizeKenyanPhone(data.phone);
  const fullName = data.fullName.trim();
  const county = data.county.trim();
  const email = data.email.trim().toLowerCase();
  const referralCode = data.referralCode?.trim() || undefined;
  const emailRedirectUrl = new URL("/api/auth/callback", origin);
  emailRedirectUrl.searchParams.set("next", "/login?confirmed=1");

  return {
    email,
    password: data.password,
    options: {
      emailRedirectTo: emailRedirectUrl.toString(),
      data: {
        full_name: fullName,
        phone,
        county,
        referral_code: referralCode,
        human_verified: data.humanVerified === true,
      },
    },
  };
}

export function mapRegisterErrorMessage(message: string) {
  const msg = message.toLowerCase();

  if (
    msg.includes("registration_disabled") ||
    msg.includes("registration is temporarily disabled") ||
    msg.includes("registrations are temporarily disabled")
  ) {
    return "New registrations are temporarily disabled. Please contact support.";
  }

  if (
    msg.includes("database error saving new user") ||
    msg.includes("unexpected_failure")
  ) {
    return "Signup failed due to a server setup error. Please try again.";
  }

  if (
    msg.includes("signups not allowed") ||
    msg.includes("sign up disabled") ||
    msg.includes("signup disabled")
  ) {
    return "Registration is disabled in the backend. Enable sign-ups in Supabase Auth settings.";
  }

  if (
    msg.includes("already registered") ||
    msg.includes("user already registered")
  ) {
    return "An account with this email already exists.";
  }

  return "Registration failed. Please review your details and try again.";
}
