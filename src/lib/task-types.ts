import { z } from "zod";
import { PROOF_REQUIREMENT_DEFAULTS } from "./social-engagement";

export type TaskCategory =
  | "survey"
  | "data_labeling"
  | "social_engagement"
  | "verification"
  | "content_creation"
  | "watch_respond";

export type TaskStatus = "draft" | "scheduled" | "active" | "paused" | "completed";
export type TaskDifficulty = "easy" | "medium" | "hard";
export type SubmissionStatus =
  | "pending"
  | "ai_reviewing"
  | "approved"
  | "declined"
  | "flagged"
  | "admin_reviewed";

export const QUESTION_TYPE_MULTIPLE_CHOICE = "multiple_choice";
export const QUESTION_TYPE_OPEN_TEXT = "open_text";
export const QUESTION_TYPE_MULTI_SELECT = "multi_select";
export const QUESTION_TYPE_RATING = "rating";
export const QUESTION_TYPE_YES_NO = "yes_no";

export const baseQuestionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  required: z.boolean().default(true),
});

export const multipleChoiceQuestionSchema = baseQuestionSchema.extend({
  type: z.literal(QUESTION_TYPE_MULTIPLE_CHOICE),
  options: z.array(z.string().min(1)).min(2),
});

export const openTextQuestionSchema = baseQuestionSchema.extend({
  type: z.literal(QUESTION_TYPE_OPEN_TEXT),
  min_words: z.number().int().min(0).default(0),
  max_words: z.number().int().min(1).default(500),
});

export const multiSelectQuestionSchema = baseQuestionSchema.extend({
  type: z.literal(QUESTION_TYPE_MULTI_SELECT),
  options: z.array(z.string().min(1)).min(2),
});

export const ratingQuestionSchema = baseQuestionSchema.extend({
  type: z.literal(QUESTION_TYPE_RATING),
  scale: z.number().int().min(1).max(10).default(5),
});

export const yesNoQuestionSchema = baseQuestionSchema.extend({
  type: z.literal(QUESTION_TYPE_YES_NO),
});

export const questionSchema = z.discriminatedUnion("type", [
  multipleChoiceQuestionSchema,
  openTextQuestionSchema,
  multiSelectQuestionSchema,
  ratingQuestionSchema,
  yesNoQuestionSchema,
]);

export const surveyTaskDataSchema = z.object({
  type: z.literal("survey"),
  questions: z.array(questionSchema).min(1),
});

export const dataLabelingItemSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1),
  content_type: z.enum(["text", "image_url"]).default("text"),
  correct_label: z.string().min(1),
});

export const dataLabelingTaskDataSchema = z.object({
  type: z.literal("data_labeling"),
  subtype: z.enum(["sentiment", "image_classification", "language_detection", "text_correction", "category_tagging"]).default("sentiment"),
  batch_size: z.number().int().min(5).max(15),
  label_options: z.array(z.string().min(1)).min(2).max(6),
  items: z.array(dataLabelingItemSchema).min(5).max(15),
});

export const socialEngagementTaskDataSchema = z.object({
  type: z.literal("social_engagement"),
  platform: z.enum(["facebook", "instagram", "youtube", "tiktok", "whatsapp", "twitter", "google", "playstore", "appstore", "other"]),
  action: z.enum(["follow", "subscribe", "like", "comment", "share", "join", "review", "rate", "download", "purchase"]),
  target_url: z.string().url(),
  target_name: z.string().min(1),
  target_identifier: z.string().min(1),
  proof_requirements: z.object({
    requires_screenshot: z.literal(true),
    requires_username: z.boolean(),
    requires_text_input: z.boolean(),
    text_input_label: z.string().nullable(),
    text_input_placeholder: z.string().nullable(),
  }),
  screenshot_instructions: z.string().min(1),
  ai_check_criteria: z.string().min(1),
  hold_days: z.number().int().min(1).max(30).default(7),
  comment_prompt: z.string().nullable().default(null),
  verification_notes: z.string().nullable().default(null),
  reverification_enabled: z.boolean().default(false),
});

export const verificationTaskDataSchema = z.object({
  type: z.literal("verification"),
  verification_type: z.enum(["text_only", "screenshot_only", "url_only", "mixed"]).default("text_only"),
  requires_text_answer: z.boolean().default(true),
  requires_screenshot: z.boolean().default(false),
  requires_url: z.boolean().default(false),
  text_answer_label: z.string().trim().max(120).optional().nullable(),
  expected_answer: z.string().trim().max(1000).optional().nullable(),
  expected_answer_strict: z.boolean().default(false),
  answer_hint: z.string().trim().max(500).optional().nullable(),
  verification_url: z.string().trim().max(1000).optional().nullable(),
});

export const contentCreationTaskDataSchema = z.object({
  type: z.literal("content_creation"),
  subtype: z.enum(["review", "social_post", "article", "caption"]).default("review"),
  prompt: z.string().min(1),
  media_url: z.string().url().nullable().default(null),
  min_words: z.number().int().min(0).default(0),
  max_words: z.number().int().min(1).default(500),
  language: z.string().default("english"),
});

export const watchRespondQuestionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  type: z.enum(["open_text", "multiple_choice"]).default("open_text"),
  min_words: z.number().int().min(0).default(0),
  options: z.array(z.string().min(1)).optional(),
});

export const watchRespondTaskDataSchema = z.object({
  type: z.literal("watch_respond"),
  video_url: z.string().url(),
  video_duration_seconds: z.number().int().min(1).optional().nullable(),
  min_watch_seconds: z.number().int().min(1).default(60),
  questions: z.array(watchRespondQuestionSchema),
});

export const taskDataSchema = z.discriminatedUnion("type", [
  surveyTaskDataSchema,
  dataLabelingTaskDataSchema,
  socialEngagementTaskDataSchema,
  verificationTaskDataSchema,
  contentCreationTaskDataSchema,
  watchRespondTaskDataSchema,
]);

export const taskInsertSchema = z.object({
  title: z.string().trim().min(3).max(200),
  category: z.enum(["survey", "data_labeling", "social_engagement", "verification", "content_creation", "watch_respond"]),
  description: z.string().trim().max(1000).optional().nullable(),
  instructions: z.string().trim().min(10),
  payout_ksh: z.number().int().min(1),
  total_slots: z.number().int().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]).default("easy"),
  publish_at: z.string().datetime().nullable().default(null),
  expires_at: z.string().datetime().nullable().default(null),
  ai_grading_enabled: z.boolean().default(true),
  ai_rubric: z.string().trim().max(2000).optional().nullable(),
  requires_screenshot: z.boolean().default(false),
  requires_url: z.boolean().default(false),
  min_word_count: z.number().int().min(0).default(0),
  task_data: taskDataSchema,
});

export const bulkImportTaskSchema = taskInsertSchema.extend({
  publish_at: z.string().datetime().nullable().default(null),
  expires_at: z.string().datetime().nullable().default(null),
});

export const bulkImportSchema = z.array(bulkImportTaskSchema);

export type SurveyTaskData = z.infer<typeof surveyTaskDataSchema>;
export type DataLabelingTaskData = z.infer<typeof dataLabelingTaskDataSchema>;
export type SocialEngagementTaskData = z.infer<typeof socialEngagementTaskDataSchema>;
export type VerificationTaskData = z.infer<typeof verificationTaskDataSchema>;
export type ContentCreationTaskData = z.infer<typeof contentCreationTaskDataSchema>;
export type WatchRespondTaskData = z.infer<typeof watchRespondTaskDataSchema>;
export type TaskData = z.infer<typeof taskDataSchema>;

export type Question = z.infer<typeof questionSchema>;
export type MultipleChoiceQuestion = z.infer<typeof multipleChoiceQuestionSchema>;
export type OpenTextQuestion = z.infer<typeof openTextQuestionSchema>;
export type MultiSelectQuestion = z.infer<typeof multiSelectQuestionSchema>;
export type RatingQuestion = z.infer<typeof ratingQuestionSchema>;
export type YesNoQuestion = z.infer<typeof yesNoQuestionSchema>;

export type TaskInsert = z.infer<typeof taskInsertSchema>;
export type BulkImportTask = z.infer<typeof bulkImportTaskSchema>;

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  survey: "Surveys",
  data_labeling: "Data Labeling",
  social_engagement: "Social Engagement",
  verification: "Verification",
  content_creation: "Content Creation",
  watch_respond: "Watch & Respond",
};

export const CATEGORY_COLORS: Record<TaskCategory, string> = {
  survey: "bg-blue-100 text-blue-800 border-blue-200",
  data_labeling: "bg-purple-100 text-purple-800 border-purple-200",
  social_engagement: "bg-pink-100 text-pink-800 border-pink-200",
  verification: "bg-amber-100 text-amber-800 border-amber-200",
  content_creation: "bg-green-100 text-green-800 border-green-200",
  watch_respond: "bg-red-100 text-red-800 border-red-200",
};

export const DIFFICULTY_COLORS: Record<TaskDifficulty, string> = {
  easy: "bg-green-100 text-green-700 border-green-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  hard: "bg-red-100 text-red-700 border-red-200",
};

export function generateQuestionId(): string {
  return `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function generateItemId(): string {
  return `item${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function createEmptySurveyTaskData(): SurveyTaskData {
  return {
    type: "survey",
    questions: [],
  };
}

export function createEmptyDataLabelingTaskData(): DataLabelingTaskData {
  return {
    type: "data_labeling",
    subtype: "sentiment",
    batch_size: 0,
    label_options: ["Positive", "Negative", "Neutral"],
    items: [],
  };
}

export function createEmptySocialEngagementTaskData(): SocialEngagementTaskData {
  return {
    type: "social_engagement",
    platform: "instagram",
    action: "follow",
    target_url: "",
    target_name: "",
    target_identifier: "",
    proof_requirements: {
      ...PROOF_REQUIREMENT_DEFAULTS.follow,
      requires_screenshot: true,
    },
    screenshot_instructions: "Screenshot must show the target page and the completed action state.",
    ai_check_criteria: "Verify the correct platform, target, completed action state, and screenshot authenticity.",
    hold_days: 7,
    comment_prompt: null,
    verification_notes: null,
    reverification_enabled: false,
  };
}

export function createEmptyVerificationTaskData(): VerificationTaskData {
  return {
    type: "verification",
    verification_type: "text_only",
    requires_text_answer: true,
    requires_screenshot: false,
    requires_url: false,
    text_answer_label: "Your Answer",
    expected_answer: null,
    expected_answer_strict: false,
    answer_hint: null,
    verification_url: null,
  };
}

export function createEmptyContentCreationTaskData(): ContentCreationTaskData {
  return {
    type: "content_creation",
    subtype: "review",
    prompt: "",
    media_url: null,
    min_words: 30,
    max_words: 150,
    language: "english",
  };
}

export function createEmptyWatchRespondTaskData(): WatchRespondTaskData {
  return {
    type: "watch_respond",
    video_url: "",
    min_watch_seconds: 60,
    questions: [],
  };
}

export function createEmptyTaskData(category: TaskCategory): TaskData {
  switch (category) {
    case "survey":
      return createEmptySurveyTaskData();
    case "data_labeling":
      return createEmptyDataLabelingTaskData();
    case "social_engagement":
      return createEmptySocialEngagementTaskData();
    case "verification":
      return createEmptyVerificationTaskData();
    case "content_creation":
      return createEmptyContentCreationTaskData();
    case "watch_respond":
      return createEmptyWatchRespondTaskData();
  }
}
