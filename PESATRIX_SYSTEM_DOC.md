# PESATRIX SYSTEM ARCHITECTURE & TECHNICAL DOCUMENTATION

**Version:** 1.0 (Generated)  
**Target Audience:** Senior Software Architects, Lead Developers, System Administrators

---

## 1. PROJECT OVERVIEW

Pesatrix is a Next.js web application designed for users in Kenya to earn money by completing online tasks (surveys, data labeling, content creation) and referring others. The system requires users to pay a one-time activation fee (via M-Pesa) before they can earn. It features a robust wallet ledger system with built-in fraud prevention (e.g., 7-day holds on earnings), a dynamic task management system with AI grading support, and a comprehensive admin portal for managing payouts, users, and tasks.

**Target Users & Roles:**
- **Standard Users:** Individuals completing tasks, referring friends, and withdrawing earnings.
- **Admins (`super_admin`, `admin`, `finance`, `support`, `fraud`):** Internal staff managing the platform via the admin portal (`/wazim`).

**Current Status:**
- MVP core is implemented (Auth, DB Schema, M-Pesa Activation, Wallet Ledger, Task System).
- Some third-party Offerwalls (Lootably, BitLabs, etc.) are implemented but awaiting vendor approval. CPX Research is live.

**Technology Stack:**
- **Frontend/Backend:** Next.js 15 (App Router, Server Actions, API Routes)
- **UI/Styling:** React 19, TailwindCSS, Radix UI, Framer Motion, Lucide React
- **Database & Auth:** Supabase (PostgreSQL, Supabase Auth, Row Level Security)
- **Payments:** M-Pesa Daraja API (STK Push for activation, B2C for withdrawals)
- **Integrations:** CPX Research (Surveys)

**Environment Variables:**
```env
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DARAJA_CONSUMER_KEY
DARAJA_CONSUMER_SECRET
DARAJA_SHORTCODE
DARAJA_PASSKEY
DARAJA_CALLBACK_URL
DARAJA_ENV
NEXT_PUBLIC_APP_URL
ACTIVATION_FEE_KSH
SUPER_ADMIN_EMAIL
# Additional offerwall keys (e.g., CPX_APP_ID, CPX_SECURE_HASH, LOOTABLY_API_KEY) exist depending on provider status.
```

---

## 2. FOLDER STRUCTURE

```
Pesatrix/
├── src/
│   ├── app/                      # Next.js App Router root
│   │   ├── (auth)/               # User authentication routes (login, register)
│   │   ├── (dashboard)/          # Authenticated user dashboard flows
│   │   ├── (marketing)/          # Landing pages and public marketing
│   │   ├── (portal)/             # Secondary user portal views
│   │   ├── activate/             # M-Pesa activation flow routes
│   │   ├── api/                  # API Route Handlers (Server-side endpoints)
│   │   │   ├── admin/            # Protected admin endpoints
│   │   │   ├── auth/             # Custom auth hooks/callbacks
│   │   │   ├── cron/             # Scheduled tasks (e.g., releasing pending funds)
│   │   │   ├── me/               # User session bootstrap
│   │   │   ├── offers/           # Third-party offerwall fetchers
│   │   │   ├── onboarding/       # Setup completion hooks
│   │   │   ├── payments/         # M-Pesa Daraja integrations & callbacks
│   │   │   ├── postback/         # Offerwall webhook receivers (Crucial for earning)
│   │   │   ├── profile/          # User profile management
│   │   │   ├── rewards/          # Referral and task rewards
│   │   │   ├── support/          # Support ticketing API
│   │   │   ├── tasks/            # Task fetching and submission
│   │   │   ├── training/         # Training module APIs
│   │   │   ├── wallet/           # Ledger and withdrawal APIs
│   │   ├── tasks/                # Frontend views for task execution
│   │   └── wazim/                # ADMIN PORTAL (Dashboard, Users, Payouts, Fraud)
│   ├── components/               # Reusable React UI components (Radix/Tailwind)
│   ├── lib/                      # Core business logic, DB clients, utilities
│   │   ├── auth/                 # Authentication helpers
│   │   └── supabase/             # Supabase clients (Browser, Server, Admin)
│   ├── providers/                # React Context providers (React Query, Theme, etc.)
│   └── types/                    # TypeScript interfaces and type definitions
├── supabase/
│   └── migrations/               # PostgreSQL schema definitions and migration scripts
├── public/                       # Static assets (images, icons)
├── tests/                        # Vitest test suites
├── Pesatrix_Backend_Database_API_Spec.md # Original design spec documentation
└── offerwall-integration-guide.md # Technical guide for integrating 3rd party survey providers
```
*Note: The `wazim` folder acts as a completely segregated admin interface, structurally decoupled from the main user `(dashboard)`.*

---

## 3. DATABASE SCHEMA

The database is built on PostgreSQL (via Supabase) with heavy reliance on Row Level Security (RLS) and database triggers to maintain data integrity (especially for the wallet ledger).

### Core User Tables

**`profiles`**
- **Columns:** `user_id` (UUID, PK, FK to auth.users), `full_name` (Text), `phone` (Text, Unique), `email` (Text, Unique), `county` (Text), `created_at`, `updated_at`.
- **Purpose:** Stores core demographic data. Phone/email must be unique and are required after setup.

**`account_status`**
- **Columns:** `user_id` (UUID, PK), `is_setup_complete` (Bool), `setup_completed_at`, `is_activated` (Bool), `activated_at`, `status` (Text: active/suspended/banned).
- **Purpose:** State machine for user lifecycle. Determines if a user has paid the KSh 500 activation fee.
- **Triggers:** Automatically bootstraps a `wallets` row when `is_activated` becomes true.

**`user_verification`**
- **Columns:** `user_id` (UUID, PK), `phone_verified` (Bool), `email_verified` (Bool), `kyc_status` (Text), `risk_score` (Int), `flags` (JSONB).
- **Purpose:** Tracks verification states required for withdrawals and fraud prevention.

### Financial & Wallet Tables

**`activation_payments`**
- **Columns:** `id` (UUID, PK), `user_id` (UUID), `amount` (Int), `phone` (Text), `status` (Text: pending/paid/failed), `checkout_request_id` (Text, Unique), `mpesa_receipt` (Text, Unique), `callback_raw` (JSONB), `created_at`, `paid_at`.
- **Purpose:** Logs STK Push requests and Daraja callbacks for the KSh 500 activation fee.

**`wallet_transactions`** (The Ledger)
- **Columns:** `id` (UUID, PK), `user_id` (UUID), `type` (Text: task_earning/referral_bonus/withdrawal/admin_adjustment), `direction` (Text: credit/debit), `amount` (Numeric), `status` (Text: pending/available/locked/reversed), `reference_table`, `reference_id`, `available_at`, `created_at`, `created_by_admin_id`.
- **Purpose:** Immutable append-only ledger for all user balances.
- **Triggers:** Automatically recalculates and updates the `wallets` table via `sync_wallet_from_transactions()` on insert/update.

**`wallets`** (Materialized View / Summary)
- **Columns:** `user_id` (UUID, PK), `available_balance` (Numeric), `pending_balance` (Numeric), `total_earned` (Numeric), `updated_at`.
- **Purpose:** High-performance summary of balances kept in sync with `wallet_transactions` via DB triggers. *Never updated directly by the application.*

**`withdrawal_requests`**
- **Columns:** `id` (UUID, PK), `user_id` (UUID), `amount` (Numeric), `phone` (Text), `status` (Text: requested/processing/sent/failed/held), `mpesa_txn_id`, `failure_reason`, `created_at`, `processed_at`.
- **Purpose:** Tracks user requests to cash out available balances.

### Task & Offer Tables

**`tasks`**
- **Columns:** `id` (UUID, PK), `title`, `category`, `description`, `instructions`, `payout_ksh` (Numeric), `total_slots` (Int), `slots_remaining` (Int), `difficulty`, `status` (Text: draft/scheduled/active/paused/completed), `publish_at`, `expires_at`, `created_by` (UUID), `ai_grading_enabled` (Bool), `ai_rubric`, `task_data` (JSONB), `created_at`, `updated_at`.
- **Purpose:** Stores administrative-created tasks that users can complete on the platform.

**`task_submissions`**
- **Columns:** `id` (UUID, PK), `task_id` (UUID, FK), `user_id` (UUID, FK), `submitted_at`, `answers` (JSONB), `screenshot_url`, `status` (Text: pending/ai_reviewing/approved/declined/flagged/admin_reviewed), `ai_score`, `ai_reasoning`, `admin_decision`, `payout_credited` (Bool).
- **Constraints:** Unique constraint on `(task_id, user_id)` (one submission per task).
- **Purpose:** Logs user attempts at tasks. Handles AI grading workflow and manual admin reviews.

**`transactions`** (Offerwall Webhooks)
- **Columns:** `id` (UUID, PK), `user_id` (UUID), `provider` (Text: cpx, lootably, bitlabs), `transaction_id` (Text, Unique), `offer_name`, `reward_usd` (Numeric), `status`, `raw_postback` (JSONB), `created_at`.
- **Purpose:** Idempotency and audit log for third-party offerwall postbacks. Protects against double-crediting.

### Social & Support Tables

**`referrals`** & **`referral_bonuses`**
- **Purpose:** Tracks who referred whom (`referrer_id`, `referee_id`), and logs the multi-level (Level 1/2/3) bonuses generated upon activation.

**`support_tickets`** & **`support_messages`**
- **Purpose:** Standard helpdesk ticketing system connecting users to `support` admins.

### Admin Tables

**`admin_users`**
- **Columns:** `id` (UUID, PK), `user_id` (UUID, Unique), `role` (Text: super_admin/admin/support/finance/fraud), `status`.
- **Purpose:** Role-Based Access Control (RBAC) mapping for the `/wazim` portal.

**`audit_log`**
- **Columns:** `id` (UUID), `admin_id`, `action`, `entity_type`, `entity_id`, `before_json`, `after_json`, `reason`, `ip`, `created_at`.
- **Purpose:** Compliance logging for all money-affecting admin actions.

---

## 4. AUTHENTICATION & AUTHORIZATION

- **Provider:** Supabase Auth.
- **Methods:** Phone OTP (Primary identity) and Email (Magic Link / OTP). Both must be verified to process a withdrawal.
- **Row Level Security (RLS):** Enabled on all public tables. Users can only `SELECT/INSERT/UPDATE` where `user_id = auth.uid()`.
- **Admin Access:** Enforced via RLS using `EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid() AND status = 'active')`. Server-side API routes under `/api/admin/*` must validate the caller's role against `admin_users` and utilize the `SUPABASE_SERVICE_ROLE_KEY` to bypass user RLS when orchestrating multi-table transactions (e.g., ledger adjustments).

---

## 5. USER SIDE — FLOWS & FEATURES

1. **Registration & Onboarding:**
   - User signs up via Phone. 
   - Fills out profile details (Name, Email, County). State transitions to `setup_complete`.
2. **Account Activation:**
   - User is blocked from earning until they pay KSh 500.
   - User initiates STK Push via `/api/payments/activation/stk-push`.
   - Daraja callback to `/api/payments/mpesa/callback` marks `is_activated = true`, triggering DB to bootstrap the wallet.
3. **Task Browsing & Execution:**
   - Activated user visits Dashboard. Browses active tasks (where `slots_remaining > 0`).
   - Submits task (answers, screenshots). Handled by `/api/tasks`. Status becomes `pending` or `ai_reviewing`.
4. **Offerwalls (Third-Party Tasks):**
   - User visits Earn page. Loads CPX Research iframe.
   - Completes survey on external site. CPX hits the `/api/postback/cpx` webhook.
   - Server credits user wallet automatically.
5. **Earnings Tracking:**
   - Dashboard fetches `wallets` table. Earnings land in `pending` status first (7-day hold).
6. **Withdrawal:**
   - Once funds transition to `available`, user requests withdrawal via `/api/wallet/withdraw`.
   - Request goes to `processing` queue for Admin approval. Requires verified email/phone.

---

## 6. ADMIN SIDE — FLOWS & FEATURES (`/wazim`)

The Admin portal is role-gated.
- **Dashboard:** High-level metrics (total users, total pending payouts, system revenue).
- **User Management (`/wazim/users`):** View profiles, suspend accounts, view verification status.
- **Task Management (`/wazim/tasks`):** Create new tasks, define payouts, set AI grading rubrics, set quotas (`total_slots`), schedule `publish_at` and `expires_at`.
- **Review Submissions:** Manually review user submissions marked `flagged` or needing human intervention. Approve/Decline.
- **Earnings & Payouts (`/wazim/withdrawals`):** (Finance Role) View `withdrawal_requests`. Mark as sent, input M-Pesa transaction IDs, or reject with a reason.
- **Fraud & Auditing (`/wazim/fraud`):** Track duplicate IPs, unusual behavior, revoke fraudulent referral bonuses. View the `audit_log`.

---

## 7. API ROUTES / SERVER ACTIONS

*All endpoints return JSON. Auth is validated via Supabase SSR session checks.*

- **`GET /api/me`**: Bootstraps dashboard. Returns profile, account status, verification flags, and wallet summary.
- **`POST /api/onboarding/complete`**: Updates profile, sets `is_setup_complete`.
- **`POST /api/payments/activation/stk-push`**: Calls Daraja API to trigger STK push on user's phone.
- **`POST /api/payments/mpesa/callback`**: **(Public/Webhook)** Daraja callback. Idempotent. Validates payment, marks account `activated`.
- **`GET /api/offers/[provider]`**: Fetches available external surveys (e.g., from CPX Research) using secure server-to-server calls to hide API keys.
- **`GET /api/postback/[provider]`**: **(Public/Webhook)** Receives completion ping from offerwalls. Validates secure hash, deduplicates via `transaction_id`, writes to `transactions`, and credits the `wallet_transactions` ledger.
- **`POST /api/wallet/withdraw`**: User requests cashout. Validates available balance, inserts `withdrawal_requests`, debits ledger.
- **`POST /api/admin/wallet/adjust`**: Admin override. Creates credit/debit ledger entry. Writes to `audit_log`.

---

## 8. THIRD-PARTY INTEGRATIONS

- **M-Pesa Daraja API:**
  - *Purpose:* Activation payments (STK Push) and Payouts (B2C).
  - *Integration:* REST API + Asynchronous Webhooks.
  - *Failure Handling:* If callback drops, system supports manual admin verification using the M-Pesa receipt number.
- **CPX Research (Offerwall):**
  - *Purpose:* External surveys for users to earn money.
  - *Integration:* Frontend iframe/script + Server-side GET Webhook (`/api/postback/cpx`).
  - *Security:* Uses `md5(user_id + secret)` hash verification. Strictly requires returning HTTP 200 `"1"` to prevent webhook retries.

---

## 9. TASK SYSTEM — DEEP DIVE

The native task system is the core engine for user earnings not tied to external offerwalls.
- **Data Model:** Handled by `tasks` and `task_submissions`. Tasks have dynamic JSON payloads (`task_data`) allowing for surveys, data labeling, or URL sharing tasks.
- **Lifecycle:** `draft` → `scheduled` (waiting for `publish_at`) → `active` → `completed` (out of slots or hit `expires_at`).
- **Concurrency & Quotas:** Tasks have `total_slots` and `slots_remaining`. When a submission is created, `slots_remaining` must be atomically decremented.
- **AI Grading:** If `ai_grading_enabled` is true, submissions go to `ai_reviewing`. An external cron/worker (or inline logic) evaluates the `answers` against `ai_rubric`, outputs an `ai_score` and `ai_reasoning`. If score > threshold, auto-approved. If low or uncertain, status shifts to `flagged` for admin manual review.
- **Constraint:** RLS and DB constraints strictly enforce one submission per `user_id` per `task_id`.

---

## 10. EARNINGS & PAYMENTS

pesatrix strictly isolates "Pending" money from "Available" money to prevent rapid hit-and-run fraud.
- **Crediting:** When a task is approved or an offerwall postback is received, a `wallet_transactions` row is inserted with `status = 'pending'` and `direction = 'credit'`.
- **7-Day Hold:** The `available_at` timestamp is set to 7 days in the future.
- **Release Mechanism:** A scheduled cron job (or DB trigger function like `publish_scheduled_tasks`) must periodically convert `pending` to `available` when `now() >= available_at`.
- **Withdrawals:** Deducted *only* from `available_balance`. Processed manually by Admins via the Wazim portal (or automatically via M-Pesa B2C, depending on configuration). Minimum threshold rules are enforced at the API level.

---

## 11. KNOWN ISSUES & INCOMPLETE AREAS

- **Pending Offerwall Approvals:** Lootably, BitLabs, AdGate Media, Adscend Media, and Torox integrations are mapped in `offerwall-integration-guide.md` but are currently waiting on vendor account approval. Code for these routes exists but cannot be tested in production yet.
- **AI Grading Pipeline:** The schema supports AI grading (`ai_score`, `ai_rubric`), but the actual LLM integration orchestrator (OpenAI/Anthropic) processing the `task_submissions` needs ensuring it scales without timing out serverless functions.
- **M-Pesa B2C (Automated Payouts):** Withdrawals currently appear to queue in `withdrawal_requests` for manual admin marking. Automated M-Pesa B2C API integration for instant payouts is a potential future implementation.

---

## 12. BUSINESS RULES & CONSTRAINTS

These are critical to system integrity and are enforced across the DB (constraints/triggers) and API levels:
1. **No Pay, No Play:** A user cannot view active tasks, submit tasks, or utilize offerwalls until `account_status.is_activated = true`.
2. **Immutable Ledger:** User balances are **never** directly updated. They are calculated dynamically via triggers based on the append-only `wallet_transactions` table.
3. **Idempotent Webhooks:** M-Pesa callbacks and Offerwall Postbacks must guarantee idempotency using unique IDs (`checkout_request_id` for Daraja, `transaction_id` for offerwalls). Processing a webhook twice will silently return a 200 without double-crediting.
4. **Verification Gate:** Users cannot initiate a withdrawal unless `user_verification.phone_verified` and `email_verified` are both `true`.
5. **Withdrawal Limits:** Withdrawals can never exceed the `available_balance` (excluding `pending_balance`).
6. **Admin Auditing:** Any manual adjustment to a user's wallet via the admin portal strictly requires an `audit_log` entry recording the `admin_id`, `before_json`, `after_json`, and a string `reason`.
