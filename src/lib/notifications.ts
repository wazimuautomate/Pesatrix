type ReferralEmailArgs = {
  to: string;
  beneficiaryName?: string | null;
  amount: number;
  activatedUserName?: string | null;
};

function getEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return null;
  }

  return { apiKey, from };
}

export async function sendReferralBonusEmail(args: ReferralEmailArgs) {
  const config = getEmailConfig();
  if (!config || !args.to) {
    return false;
  }

  const activatedUserLabel = args.activatedUserName?.trim() || "your referral network";
  const beneficiaryLabel = args.beneficiaryName?.trim() || "there";

  const subject = `Pesatrix referral bonus unlocked: KSh ${args.amount}`;
  const html = `
    <div style="font-family: Arial, sans-serif; background:#f4f7fb; padding:32px;">
      <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:18px; overflow:hidden; border:1px solid #e3e9f3;">
        <div style="padding:28px 32px; background:linear-gradient(135deg,#0b1f3b,#1457ff); color:#ffffff;">
          <p style="margin:0; font-size:12px; letter-spacing:0.18em; text-transform:uppercase;">Pesatrix Referral Bonus</p>
          <h1 style="margin:12px 0 0; font-size:28px; line-height:1.2;">KSh ${args.amount} credited to your wallet</h1>
        </div>
        <div style="padding:28px 32px; color:#20324d;">
          <p style="margin:0 0 14px;">Hi ${beneficiaryLabel},</p>
          <p style="margin:0 0 14px;">
            A direct referral activation from ${activatedUserLabel} has now cleared, and your wallet has been credited.
          </p>
          <p style="margin:0 0 20px;">
            You can view the updated balance from your Pesatrix wallet and referral dashboard immediately.
          </p>
          <div style="padding:16px 18px; background:#f7faff; border:1px solid #d8e6ff; border-radius:14px; font-weight:600;">
            Bonus amount: KSh ${args.amount}
          </div>
        </div>
      </div>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.from,
      to: [args.to],
      subject,
      html,
    }),
  });

  return response.ok;
}
