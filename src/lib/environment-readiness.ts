const ENVIRONMENT_READINESS_KEYS = [
  ["Supabase URL", "NEXT_PUBLIC_SUPABASE_URL"],
  ["Service role key", "SUPABASE_SERVICE_ROLE_KEY"],
  ["M-Pesa shortcode", "DARAJA_SHORTCODE"],
  ["Daraja callback URL", "DARAJA_CALLBACK_URL"],
  ["Daraja B2C result URL", "DARAJA_B2C_RESULT_URL"],
  ["Withdrawal n8n webhook", "WITHDRAWAL_N8N_WEBHOOK_URL"],
  ["NVIDIA API key fallback", "NVIDIA_API_KEY"],
  ["Cron secret", "CRON_SECRET"],
] as const;

export function getEnvironmentReadiness() {
  return ENVIRONMENT_READINESS_KEYS.map(([label, key]) => ({
    label,
    configured: Boolean(process.env[key]?.trim()),
  }));
}
