# Changelog

## [migrate] Screenshot Analysis - Claude Sonnet to NVIDIA Vision Models - 2026-05-18
- Removed Claude Sonnet 4 (Anthropic) image analysis dependency for social engagement task screenshot validation
- Migrated to free NVIDIA-hosted vision models with automatic fallback handling
- New vision models in priority order:
  1. mistralai/mistral-large-3-675b-instruct-2512
  2. meta/llama-4-maverick-17b-128e-instruct  
  3. google/paligemma-3b-pt-224 (primary vision-capable model)
- Implemented automatic fallback: if first model fails, times out, rate-limits, or returns invalid output, system automatically tries next model
- Added comprehensive error logging for:
  - Model failures (with specific error details)
  - Invalid responses (malformed JSON, empty responses)
  - Timeout issues (30-second timeout per model)
  - Fallback switches (logs which model was used)
- Response parsing remains standardized across all fallback models
- Implementation is modular - additional models can easily be added to VISION_MODELS array
- Removed all ANTHROPIC_API_KEY environment variable references
- Screenshot validation logic remains fully functional after migration
- Task submission workflow and database behavior preserved

## [update] Data Labeling Builder Tabs - 2026-05-18
- Reworked the Wazim data labeling builder into Manual Entry and Bulk JSON Import tabs that share the same items array.
- Added label-first item creation, inline JSON paste/import validation, imported item editing in Manual Entry, and drag-handle row reordering.
- Moved data labeling preview below both tabs and kept preview payload free of `correct_label`.

## [feat] Data Labeling Task Category - 2026-05-18
- Added user-facing data labeling card stack with draft restore, image fallback, progress, back navigation, and one-label-per-item selection.
- Sanitized data labeling task payloads so `correct_label` never reaches user-facing task APIs or client task detail rendering.
- Added server-side data labeling submission validation and objective grading against stored `correct_label` values without calling an LLM.
- Stored data labeling item review details in `task_submissions.grading_detail` for admin review.
- Extended Wazim task creation with subtype, label option chips, item builder, JSON import, same-label warning, and user preview.
- Added data labeling review breakdowns and dashboard card metadata.
- Added an automated sanitizer test for `correct_label` stripping.

## [fix] Wallet Display, Training Reward, Admin Hold Settings - 2026-05-18
- Wallet now shows available, pending, and total earned separately
- Training completion credits wallet instantly with configurable reward
- Task approval hold period read from platform_settings not hardcoded
- Admin can configure hold days, processing days, training reward
- Cron route for releasing pending credits verified/created


## [feat] User Task Submissions History Page - 2026-05-18
- New page /submissions showing all user task submissions
- Status badges: pending, ai_reviewing, approved, declined, flagged
- AI score and reasoning shown per submission
- Declined submissions show reason clearly
- Pagination for users with many submissions
- Navigation link added to dashboard sidebar


## [feat] AI Grading Pipeline + Admin AI Provider Management - 2026-05-17
- Built AI grading service with OpenAI-compatible provider support
- Admin can configure NVIDIA, OpenRouter, Groq, Ollama providers
- API keys stored securely in Supabase vault
- Grading runs async after submission, does not block user
- Auto-credits wallet on AI approval with 7-day hold
- Cron retry route for stuck ai_reviewing submissions
- Environment variable fallback for NVIDIA_API_KEY


## [fix] Task Submission Flow — Redirect, Slots, Daily Limit, Submissions Page - 2026-05-17
- Redirect users back to `/tasks` after confirmed task submission success and keep errors on the task page.
- Added UTC daily task submission limit enforcement from `platform_settings.daily_task_limit`.
- Added visible "Tasks today" usage on the tasks page and Wazim setting controls for the daily task limit.
- Added pre-submit task availability checks and post-insert atomic slot decrement via `decrement_task_slot`.
- Fixed Wazim submissions loading by avoiding the invalid profiles join and returning exact Supabase errors.

## [fix] Onboarding Flow and Activation Persistence - 2026-05-17
- Removed onboarding modal, replaced with page/inline section gated server-side
- Fixed onboarding completion writing is_setup_complete to account_status
- Fixed mock activation writing is_activated and activation_payments correctly
- Fixed dashboard reading activation state from server, not stale client cache
- Added idempotency check to prevent double activation
- Fixed GET /api/me to return correct activation and setup state

## [fix] Onboarding Modal Shows Once and Persists Completion

### Fixed
- Onboarding modal now reads visibility state from server (is_setup_complete in account_status table) instead of localStorage
- Removed localStorage dependency that caused modal to reappear when browser data was cleared
- Modal now properly removed from DOM when setup is complete (conditional render with !setupComplete)
- On completion, router.refresh() is called to re-fetch fresh server state
- User closing modal without completing will see it again on next login (correct behavior since is_setup_complete is still false in database)

## [fix] Mock Activation Flow & Account State Read

### Fixed
- STK push route now returns proper idempotent response with `alreadyActivated: true` instead of error
- Added comprehensive logging to activation flow for debugging
- Fixed activation payments flow - checks for existing pending payment first before inserting
- Fixed /api/me endpoint to create account_status row if it doesn't exist (bootstrap on read)
- Fixed frontend activation client to use hard navigation (window.location.href) instead of soft router.refresh() to ensure fresh server read
- Account status now uses `status: 'active'` instead of `'activated'` for consistency
- Updated /api/tasks, /api/tasks/submit, /api/rewards/spin routes to check activation_payments table for 'paid' status in addition to account_status.is_activated
- Updated training.ts getTrainingProgramSnapshotForUser to check activation_payments
- Updated referral.ts hasActivated function to check both account_status and activation_payments
- Users with paid activation payments now correctly bypass the activation modal on task page
