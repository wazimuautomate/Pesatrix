# Changelog

## [fix] Withdrawal Balance Rebuild And Admin Queue Recovery - 2026-05-20
- Fixed wallet summary logic to derive available balance from ledger bucket state instead of relying on a narrow `status = 'available'` rule that could collapse older available credits to zero after a withdrawal request
- Added a repair migration to rebuild `wallets.available_balance`, `pending_balance`, and `total_earned` from the transaction ledger for all users and keep future syncs aligned with the corrected bucket-based accounting
- Updated runtime wallet summary reads to fall back to live ledger computation and log any `wallets` table drift
- Fixed the admin withdrawals API and detail views to load real request data with explicit profile hydration instead of the broken nested `profiles(...)` select that caused the dashboard fetch failure
- Added inline retry/error handling on the admin withdrawals page and expanded wallet tests to cover the `200 -> 125` withdrawal reservation case

## [fix] Wallet History And Withdrawal Flow Hardening - 2026-05-20
- Replaced the wallet transaction history with live `wallet_transactions` data, added server-seeded initial state, user-friendly `Money In` and `Money Out` filters, and clearer loading/error handling
- Fixed withdrawal request creation by storing M-Pesa numbers in the database format expected by `withdrawal_requests`, enforcing account-phone-only withdrawals on both the client and server, and returning the configured processing timeframe in the success response
- Added a shared withdrawal helper for account phone resolution, webhook payload construction, and resilient n8n webhook delivery with retries and graceful failure logging
- Hardened wallet balance sync so reserved and completed withdrawal debits reduce `wallets.available_balance`, and updated the wallet sync trigger to recalculate on deletes as well
- Added a new database migration for atomic withdrawal creation, one-active-withdrawal protection, withdrawal ledger uniqueness, and a configurable `withdrawal_n8n_webhook_url` platform setting
- Completed the admin withdrawal operations path by restoring missing `PATCH` and `DELETE` handlers, aligning approval and decline actions with the mock payout workflow, and keeping retry/reversal flows consistent with ledger state
- Added focused withdrawal and wallet summary tests plus example environment entries for the optional webhook integration

## [fix] Remove Phone/Email Verification Requirement for Withdrawals - 2026-05-20
- Removed phone and email verification check from withdrawal API
- Users can now withdraw without requiring phone and email verification

## [fix] Training Reward Display Now Dynamic from Platform Settings - 2026-05-19
- Removed hardcoded `TRAINING_REWARD_AMOUNT = 50` from `training-program.ts` and `training-view.ts`
- `buildTrainingView()` now accepts an optional `rewardAmount` parameter (defaults to 50 for backward compat)
- Training page and API routes fetch the reward from `platform_settings.training_completion_reward_ksh` via `getTrainingCompletionRewardKsh()` instead of using a static constant
- Admin-configured reward changes are now reflected immediately on the training page (the actual reward credited was already dynamic via `ensureTrainingReward()`)

## [fix] Admin Training Progress System - 2026-05-19
- Fixed the admin training dashboard to load real `training_progress` records with real profile data instead of relying on a broken relation select
- Restored working search and status filters for not started, in progress, awaiting test, and completed learners
- Rebuilt the admin training table to show real user identity, status, day, stage, completed days, attempts, reward linkage, last activity, and completion time
- Added admin loading and error states for the training dashboard
- Expanded the admin training detail panel with validated controls to adjust day, stage, status, attempt count, unlock the next day, reset progress, and mark training completed
- Added a dedicated admin training list helper so page and API responses use the same real database query path
- Hardened training reward crediting by reusing or backfilling an existing wallet transaction before inserting a new one
- Updated admin completion flow to use the shared reward helper and link `reward_transaction_id` consistently
- Added a new wallet unique index migration to block duplicate training completion rewards at the database level
- Preserved frontend and backend training lock protection after completion so users cannot repeat training unless an admin resets progress

## [fix] Referral System End-to-End - 2026-05-19
- Fixed user referral dashboard to load the logged-in profile referral code from `profiles.referral_code`
- Added environment-aware referral link generation with server-side base URL detection for localhost, configured app URLs, and Vercel deployments
- Replaced remaining referral mockups on the user dashboard with live referral network, pending earnings, available earnings, level counts, and bonus history
- Refactored referral payout logic to read level depth and reward amounts from database-backed platform settings instead of hardcoded percentages
- Preserved activation-gated referral crediting and tightened idempotency so existing bonuses and wallet credits are not duplicated or silently rewritten
- Added referral programme settings keys and seeded defaults via a new migration
- Expanded admin settings UI to manage referral level count, activation rule, and per-level KSh payouts
- Rebuilt the admin referrals dashboard to show live counts, live bonus totals, real referrer/referee labels, and generated referral links
- Fixed admin referral creation so staff can assign direct referrals by user ID, referral code, email, or phone with proper validation and persistence
- Added loading/error handling for user and admin referral pages
- Added referral reward unit coverage and updated the test command to include it

## [feat] OpenRouter Vision Models as Fallback - 2026-05-19
- Extended existing NVIDIA vision fallback system with OpenRouter free vision models
- Added OpenRouter models to fallback chain (processed after NVIDIA models fail):
  - qwen/qwen2.5-vl-72b-instruct:free
  - meta-llama/llama-3.2-11b-vision-instruct:free
  - google/gemma-3-27b-it:free
- Refactored vision model config to support multiple providers with different base URLs
- Each model now specifies its own API key source (NVIDIA_API_KEY or OPENROUTER_API_KEY)
- Added OpenRouter required headers (HTTP-Referer, X-Title) for API compliance
- Check for ANY available API key before attempting vision grading (not just NVIDIA)
- Updated .env.local.example with OPENROUTER_API_KEY placeholder
- All models return standardized output: { score, reasoning, passed/decision }
- Preserved existing error handling, timeouts, rate limiting, and JSON validation

## [fix] Auth Callback & Account Status Race Condition - 2026-05-18
- Fixed auth callback showing "confirmation link invalid/already used" error
  - Added logic to check if user already has valid session when code exchange fails
  - Gracefully handles already-confirmed accounts instead of showing error
  - Added helper to detect confirmation link errors vs other auth errors
- Fixed duplicate account_status creation in /api/me endpoint
  - Replaced insert with upsert using onConflict to handle race conditions
  - Added fallback fetch if upsert fails to handle concurrent requests
  - Cleaned up logging - no more false "failure" logs for successful cases
- Added Coming Soon page to Daily Rewards route
  - Replaced rewards UI with centered message explaining requirements
  - Shows icon and step-by-step account activation sequence
  - Route preserved for future development

## [feat] Onboarding Carousel - 2026-05-18
- Converted static card-based onboarding to interactive carousel with smooth animations
- Added step-by-step navigation with previous/next buttons
- Implemented progress indicator showing current step
- Added final confirmation screen with checkbox agreement
- Kept existing form submission logic and API integration intact
- Using framer-motion for animations matching design reference

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
