import "server-only";

const SCOPE_API_URL = "https://sms.blazetechscope.com/v1/sendsms";
const SCOPE_SENDER_ID = "SKYSCOPE_";
const SMS_TIMEOUT_MS = 15000;

export async function sendSMS(phone: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.SCOPE_SMS_API_KEY;
  if (!apiKey) {
    return { success: false, error: "SCOPE_SMS_API_KEY is not configured" };
  }

  const normalizedPhone = normalizeScopePhone(phone);
  if (!normalizedPhone) {
    return { success: false, error: "Invalid phone number" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SMS_TIMEOUT_MS);

  try {
    const res = await fetch(SCOPE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: trimSms(message),
        phone: normalizedPhone,
        sender_id: SCOPE_SENDER_ID,
        api_key: apiKey,
      }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (data["response-code"] === 200) {
      return { success: true, messageId: data.messageid };
    }
    return { success: false, error: data.error || JSON.stringify(data) || `HTTP ${res.status}` };
  } catch (err) {
    const messageText = err instanceof Error ? err.message : String(err);
    console.error("[SMS] SCOPE send failed:", messageText);
    return { success: false, error: messageText };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function notifyAdminTaskSubmission(params: {
  adminPhone: string;
  userName: string;
  taskTitle: string;
  submissionId: string;
}): Promise<void> {
  const message = `[Pesatrix] Task review needed. User: ${compact(params.userName, 28)}. Task: ${compact(params.taskTitle, 42)}. ID: ${params.submissionId.slice(0, 8)}`;
  const result = await sendSMS(params.adminPhone, message);
  if (!result.success) {
    console.error("[SMS] Admin task notification failed:", result.error);
  }
}

export async function notifyAdminWithdrawal(params: {
  adminPhone: string;
  userName: string;
  userPhone: string;
  amount: number;
  withdrawalId: string;
}): Promise<void> {
  const message = `[Pesatrix] Withdrawal. User: ${compact(params.userName, 28)}. Phone: ${params.userPhone}. Amount: KSh ${params.amount}. ID: ${params.withdrawalId.slice(0, 8)}`;
  const result = await sendSMS(params.adminPhone, message);
  if (!result.success) {
    console.error("[SMS] Admin withdrawal notification failed:", result.error);
  }
}

function normalizeScopePhone(phone: string) {
  const digits = phone.trim().replace(/\s+/g, "");
  const normalized = digits.replace(/^\+254/, "0").replace(/^254/, "0");
  return /^07\d{8}$/.test(normalized) ? normalized : null;
}

function trimSms(message: string) {
  return message.length <= 160 ? message : `${message.slice(0, 157)}...`;
}

function compact(value: string, maxLength: number) {
  const trimmed = value.trim() || "Unknown";
  return trimmed.length <= maxLength ? trimmed : `${trimmed.slice(0, maxLength - 1)}...`;
}
