export const SOCIAL_PLATFORMS = [
  "facebook",
  "instagram",
  "youtube",
  "tiktok",
  "whatsapp",
  "twitter",
  "google",
  "playstore",
  "appstore",
  "other",
] as const;

export const SOCIAL_ACTIONS = [
  "follow",
  "subscribe",
  "like",
  "comment",
  "share",
  "join",
  "review",
  "rate",
  "download",
  "purchase",
] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export type SocialAction = (typeof SOCIAL_ACTIONS)[number];

export type SocialProofRequirements = {
  requires_screenshot: boolean;
  requires_username: boolean;
  requires_text_input: boolean;
  text_input_label: string | null;
  text_input_placeholder: string | null;
};

export type SocialEngagementTaskData = {
  type: "social_engagement";
  platform: SocialPlatform;
  action: SocialAction;
  target_url: string;
  target_name: string;
  target_identifier: string;
  proof_requirements: SocialProofRequirements;
  screenshot_instructions: string;
  ai_check_criteria: string;
  hold_days: number;
  comment_prompt: string | null;
  verification_notes: string | null;
  reverification_enabled?: boolean;
};

export const PLATFORM_COLORS: Record<SocialPlatform, string> = {
  facebook: "#1877F2",
  instagram: "#E1306C",
  youtube: "#FF0000",
  tiktok: "#000000",
  whatsapp: "#25D366",
  twitter: "#1DA1F2",
  google: "#4285F4",
  playstore: "#34A853",
  appstore: "#0D96F6",
  other: "#6B7280",
};

export const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  twitter: "Twitter/X",
  google: "Google",
  playstore: "Play Store",
  appstore: "App Store",
  other: "Other",
};

export const ACTION_LABELS: Record<SocialAction, string> = {
  follow: "Follow",
  subscribe: "Subscribe",
  like: "Like",
  comment: "Comment",
  share: "Share",
  join: "Join",
  review: "Review",
  rate: "Rate",
  download: "Download",
  purchase: "Purchase",
};

export const PROOF_REQUIREMENT_DEFAULTS: Record<SocialAction, SocialProofRequirements> = {
  follow: {
    requires_screenshot: true,
    requires_username: true,
    requires_text_input: false,
    text_input_label: null,
    text_input_placeholder: null,
  },
  subscribe: {
    requires_screenshot: true,
    requires_username: true,
    requires_text_input: false,
    text_input_label: null,
    text_input_placeholder: null,
  },
  like: {
    requires_screenshot: true,
    requires_username: true,
    requires_text_input: false,
    text_input_label: null,
    text_input_placeholder: null,
  },
  comment: {
    requires_screenshot: true,
    requires_username: true,
    requires_text_input: true,
    text_input_label: "Paste the exact comment you wrote",
    text_input_placeholder: "Paste your comment here",
  },
  share: {
    requires_screenshot: true,
    requires_username: true,
    requires_text_input: false,
    text_input_label: null,
    text_input_placeholder: null,
  },
  join: {
    requires_screenshot: true,
    requires_username: true,
    requires_text_input: false,
    text_input_label: null,
    text_input_placeholder: null,
  },
  review: {
    requires_screenshot: true,
    requires_username: true,
    requires_text_input: true,
    text_input_label: "Paste your review text",
    text_input_placeholder: "Paste your review here",
  },
  rate: {
    requires_screenshot: true,
    requires_username: true,
    requires_text_input: false,
    text_input_label: null,
    text_input_placeholder: null,
  },
  download: {
    requires_screenshot: true,
    requires_username: false,
    requires_text_input: false,
    text_input_label: null,
    text_input_placeholder: null,
  },
  purchase: {
    requires_screenshot: true,
    requires_username: false,
    requires_text_input: true,
    text_input_label: "Enter the transaction confirmation number",
    text_input_placeholder: "e.g. MPESA confirmation code",
  },
};

export const PLATFORM_ACTIONS: Record<SocialPlatform, SocialAction[]> = {
  facebook: ["follow", "like", "comment", "share", "join", "review"],
  instagram: ["follow", "like", "comment", "share"],
  youtube: ["subscribe", "like", "comment", "share"],
  tiktok: ["follow", "like", "comment", "share"],
  whatsapp: ["join", "share"],
  twitter: ["follow", "like", "comment", "share"],
  google: ["review", "rate"],
  playstore: ["download", "rate", "review"],
  appstore: ["download", "rate", "review"],
  other: [...SOCIAL_ACTIONS],
};

export function isSocialPlatform(value: unknown): value is SocialPlatform {
  return typeof value === "string" && SOCIAL_PLATFORMS.includes(value as SocialPlatform);
}

export function isSocialAction(value: unknown): value is SocialAction {
  return typeof value === "string" && SOCIAL_ACTIONS.includes(value as SocialAction);
}

export function normalizeSocialPlatform(value: unknown): SocialPlatform {
  return isSocialPlatform(value) ? value : "other";
}

export function normalizeSocialAction(value: unknown): SocialAction {
  return isSocialAction(value) ? value : "follow";
}

export function proofDefaultsForAction(action: unknown): SocialProofRequirements {
  return { ...PROOF_REQUIREMENT_DEFAULTS[normalizeSocialAction(action)] };
}

export function normalizeProofRequirements(
  action: unknown,
  value: unknown
): SocialProofRequirements {
  const defaults = proofDefaultsForAction(action);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return defaults;
  }

  const source = value as Partial<SocialProofRequirements>;
  return {
    requires_screenshot: true,
    requires_username:
      typeof source.requires_username === "boolean"
        ? source.requires_username
        : defaults.requires_username,
    requires_text_input:
      typeof source.requires_text_input === "boolean"
        ? source.requires_text_input
        : defaults.requires_text_input,
    text_input_label:
      typeof source.text_input_label === "string" && source.text_input_label.trim()
        ? source.text_input_label.trim()
        : defaults.text_input_label,
    text_input_placeholder:
      typeof source.text_input_placeholder === "string" && source.text_input_placeholder.trim()
        ? source.text_input_placeholder.trim()
        : defaults.text_input_placeholder,
  };
}

export function normalizeSocialTaskData(value: unknown): SocialEngagementTaskData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.type !== "social_engagement") return null;

  const platform = normalizeSocialPlatform(raw.platform);
  const action = normalizeSocialAction(raw.action);
  const targetUrl = typeof raw.target_url === "string" ? raw.target_url : "";
  const targetName = typeof raw.target_name === "string" ? raw.target_name : "";
  const targetIdentifier =
    typeof raw.target_identifier === "string" && raw.target_identifier.trim()
      ? raw.target_identifier.trim()
      : targetName;
  const holdDays = Math.max(1, Math.min(30, Number(raw.hold_days ?? 7) || 7));

  return {
    type: "social_engagement",
    platform,
    action,
    target_url: targetUrl,
    target_name: targetName,
    target_identifier: targetIdentifier,
    proof_requirements: normalizeProofRequirements(action, raw.proof_requirements ?? {
      requires_screenshot: raw.requires_screenshot,
      requires_username: raw.requires_username,
    }),
    screenshot_instructions:
      typeof raw.screenshot_instructions === "string" && raw.screenshot_instructions.trim()
        ? raw.screenshot_instructions.trim()
        : suggestScreenshotInstructions(platform, action, targetIdentifier),
    ai_check_criteria:
      typeof raw.ai_check_criteria === "string" && raw.ai_check_criteria.trim()
        ? raw.ai_check_criteria.trim()
        : suggestAiCriteria(platform, action),
    hold_days: holdDays,
    comment_prompt:
      typeof raw.comment_prompt === "string" && raw.comment_prompt.trim()
        ? raw.comment_prompt.trim()
        : null,
    verification_notes:
      typeof raw.verification_notes === "string" && raw.verification_notes.trim()
        ? raw.verification_notes.trim()
        : null,
    reverification_enabled: Boolean(raw.reverification_enabled),
  };
}

export function isSocialEngagementTaskData(value: unknown): value is SocialEngagementTaskData {
  return normalizeSocialTaskData(value) !== null;
}

export function suggestScreenshotInstructions(
  platform: SocialPlatform,
  action: SocialAction,
  identifier?: string
) {
  const target = identifier?.trim() ? identifier.trim() : "the target page";
  if (platform === "other") {
    return `Screenshot must clearly show ${target} and proof that the requested action is complete.`;
  }

  const platformLabel = PLATFORM_LABELS[platform];
  const actionLabel = ACTION_LABELS[action].toLowerCase();
  if (action === "follow" || action === "subscribe") {
    return `Screenshot must show: your ${platformLabel} account context, ${target} open, and the button showing the completed ${actionLabel} state.`;
  }
  if (action === "comment" || action === "review") {
    return `Screenshot must show: ${target}, your submitted ${actionLabel} text, and visible context proving it was posted on ${platformLabel}.`;
  }
  if (action === "download") {
    return `Screenshot must show the app listing or device screen with the app installed or downloading.`;
  }
  if (action === "purchase") {
    return `Screenshot must show the confirmation screen or receipt for the completed purchase.`;
  }
  return `Screenshot must show: ${target} on ${platformLabel} and visible evidence that the ${actionLabel} action is complete.`;
}

export function suggestAiCriteria(platform: SocialPlatform, action: SocialAction) {
  const platformLabel = PLATFORM_LABELS[platform];
  const actionLabel = ACTION_LABELS[action].toLowerCase();
  return `Verify the screenshot is from ${platformLabel}, shows the correct target, and contains clear visual evidence that the ${actionLabel} action was completed. Flag unclear, cropped, edited, stale, or mismatched screenshots.`;
}

export function socialEstimatedTime(action: unknown) {
  const normalized = normalizeSocialAction(action);
  if (normalized === "comment" || normalized === "review") return "~5 min";
  if (normalized === "download") return "~3 min";
  return "~2 min";
}
