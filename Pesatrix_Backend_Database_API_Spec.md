![/workspace/assets/pesatrix/logo\_concept.png](/workspace/Pesatrix_Backend_Database_API_Spec_media/media/7f6c10aba5052c3bd195a20e12d7e1ce1fe0136f.png "logo_concept.png")

**BACKEND + DATABASE + API SPECIFICATION**

**Pesatrix**

Goal: define the Supabase database schema, RLS security, admin RBAC, wallet ledger rules, and API contract that wires every user and admin screen. No emojis. No marketing hype. Everything is explicit for implementation.

|                      |                                                                              |
| -------------------- | ---------------------------------------------------------------------------- |
| **Stack**            | Next.js (App Router) + Supabase (Auth + Postgres + RLS + Storage optional).  |
| **Primary login**    | Phone number (Kenya).                                                        |
| **Also required**    | Email; both phone and email must be verified.                                |
| **Payments**         | M-Pesa Daraja STK Push for KSh 500 activation + withdrawals (as configured). |
| **Referral trigger** | After registration + account setup complete (then bonus credited pending).   |
| **Payout hold**      | 7-day hold before funds become withdrawable (pending visible immediately).   |
| **Admin**            | Full admin portal with RBAC + audit logs for money-affecting actions.        |
| **Version**          | v1.0 — 2026-04-18                                                            |

**1. Architecture Overview**

Pesatrix uses a single Next.js codebase for both the user app and admin app. Supabase is the system of record (Postgres) and identity provider (Auth). Sensitive operations (payments, webhooks, ledger writes, admin actions) are performed server-side via Next.js API routes or Supabase Edge Functions.

![/workspace/assets/pesatrix/backend/diagram\_system\_architecture.png](/workspace/Pesatrix_Backend_Database_API_Spec_media/media/0121d85b15ab5f4eefff99e9999c6070783a1ad5.png "diagram_system_architecture.png")

*Figure 1 — MVP architecture: Next.js + Supabase + external payment/webhook systems.*

**1.1 Key principles**

  - Server-side authority: all money-affecting writes happen on the server only.

  - Ledger-based wallet: never edit balances directly; append transactions and compute balances.

  - RLS everywhere: users can only access their own rows; admins are granted elevated access via roles/claims.

  - Auditability: every admin action that impacts users or money is logged with before/after states and a reason.

**2. Identity, Onboarding, and Account States**

**2.1 Authentication**

  - Phone login is the primary identity (OTP).

  - Email is collected and must be verified as well (OTP/magic link).

  - Withdrawals require both phone and email to be verified.

**2.2 Account status state machine**

|                              |                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------- |
| **registered**               | User exists in Supabase Auth.                                                   |
| **setup\_complete**          | User completed profile + accepted terms + provided required onboarding details. |
| **activated**                | User paid KSh 500 activation fee via STK Push and callback confirmed.           |
| **kyc\_verified (optional)** | For higher withdrawal limits and fraud control. Can be staged in phases.        |
| **suspended/banned**         | Admin-enforced restrictions; all money operations are blocked.                  |

**3. Payments (Daraja)**

**3.1 Activation payment flow (KSh 500)**

![/workspace/assets/pesatrix/backend/diagram\_activation\_payment\_flow.png](/workspace/Pesatrix_Backend_Database_API_Spec_media/media/c27106fb1e60aba0723da90c55c7d891a791aed9.png "diagram_activation_payment_flow.png")

*Figure 2 — STK push initiation and callback confirmation for activation payments.*

**Activation flow rules**

  - Create activation payment record as pending before calling Daraja.

  - Mark account as activated only after callback confirms success and receipt number exists.

  - Store full callback payload for audit and dispute resolution.

  - Idempotency: callback handler must be safe to run multiple times (same CheckoutRequestID).

**Callback validations (minimum)**

  - Validate amount = 500 KSh.

  - Validate phone matches the intended account (or record mismatch flag for review).

  - Validate receipt exists and is unique.

  - Persist callback\_raw JSON for investigation.

**4. Wallet Ledger and Balances**

To preserve the instant feel while protecting against fraud, Pesatrix shows earnings instantly in Pending, then releases them to Available after a 7-day hold. Withdrawals only use Available.

![/workspace/assets/pesatrix/backend/diagram\_wallet\_states.png](/workspace/Pesatrix_Backend_Database_API_Spec_media/media/e5a2fef9608a3587079ea2d354aff36f2b0346cb.png "diagram_wallet_states.png")

*Figure 3 — Wallet states: Earn → Pending → Available → Withdraw.*

**4.1 Ledger transaction types**

|                       |                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------ |
| **task\_earning**     | Credit. Created when admin approves a task submission or when external proof is validated. |
| **referral\_bonus**   | Credit. Created when referee completes trigger conditions.                                 |
| **withdrawal**        | Debit. Created when a withdrawal request is approved/processed.                            |
| **admin\_adjustment** | Credit or debit. Must have a reason and is always audited.                                 |
| **reversal**          | Debit. Used to reverse fraudulent credits.                                                 |

**4.2 Balance computation rules**

  - pending\_balance = sum(credits where status=pending) - sum(debits where status=pending)

  - available\_balance = sum(credits where status=available) - sum(debits where status=available)

  - total\_balance = pending\_balance + available\_balance

  - A scheduled job (daily) releases pending credits to available when available\_at \<= now.

**5. Database Schema (Supabase Postgres)**

All table names and columns below are explicit. Use UUID primary keys, timestamps, and constraints. Enable RLS on all user data tables. Use indexes for common queries (user\_id, status, created\_at).

**5.1 Core tables**

**profiles**

|                 |                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| **PK**          | user\_id uuid (references auth.users.id)                                                               |
| **Columns**     | full\_name text, phone text, email text, county text, created\_at timestamptz, updated\_at timestamptz |
| **Constraints** | unique(phone), unique(email) (as practical), not null on phone/email after setup\_complete             |
| **Indexes**     | phone, email                                                                                           |

**account\_status**

|             |                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **PK**      | user\_id uuid                                                                                                                                          |
| **Columns** | is\_setup\_complete boolean, setup\_completed\_at timestamptz, is\_activated boolean, activated\_at timestamptz, status text (active/suspended/banned) |
| **Indexes** | is\_activated, status                                                                                                                                  |

**user\_verification**

|             |                                                                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **PK**      | user\_id uuid                                                                                                                             |
| **Columns** | phone\_verified boolean, email\_verified boolean, kyc\_status text (not\_started/pending/approved/rejected), risk\_score int, flags jsonb |
| **Indexes** | kyc\_status, risk\_score                                                                                                                  |

**activation\_payments**

|                 |                                                                                                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PK**          | id uuid                                                                                                                                                                                                                   |
| **FK**          | user\_id uuid                                                                                                                                                                                                             |
| **Columns**     | amount int (500), phone text, status text (pending/paid/failed/reversed), checkout\_request\_id text, merchant\_request\_id text, mpesa\_receipt text, callback\_raw jsonb, created\_at timestamptz, paid\_at timestamptz |
| **Constraints** | unique(checkout\_request\_id), unique(mpesa\_receipt)                                                                                                                                                                     |
| **Indexes**     | user\_id, status, created\_at                                                                                                                                                                                             |

**referrals**

|                 |                                                                                      |
| --------------- | ------------------------------------------------------------------------------------ |
| **PK**          | id uuid                                                                              |
| **Columns**     | referrer\_id uuid, referee\_id uuid, created\_at timestamptz                         |
| **Constraints** | unique(referee\_id) (a user can only be referred once); referrer\_id \!= referee\_id |
| **Indexes**     | referrer\_id, referee\_id                                                            |

**referral\_bonuses**

|                 |                                                                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PK**          | id uuid                                                                                                                                                         |
| **Columns**     | referrer\_id uuid, referee\_id uuid, level int (1/2/3), amount int, status text (pending/available/revoked), available\_at timestamptz, created\_at timestamptz |
| **Constraints** | unique(referrer\_id, referee\_id, level)                                                                                                                        |
| **Indexes**     | referrer\_id, status, available\_at                                                                                                                             |

**wallet\_transactions**

|                 |                                                                                                                                                                                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PK**          | id uuid                                                                                                                                                                                                                                               |
| **Columns**     | user\_id uuid, type text, direction text (credit/debit), amount int, status text (pending/available/locked/reversed), reference\_table text, reference\_id uuid, available\_at timestamptz, created\_at timestamptz, created\_by\_admin\_id uuid null |
| **Constraints** | amount \> 0; direction in (credit,debit)                                                                                                                                                                                                              |
| **Indexes**     | user\_id, type, status, created\_at, available\_at                                                                                                                                                                                                    |

**withdrawal\_requests**

|             |                                                                                                                                                                                                          |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PK**      | id uuid                                                                                                                                                                                                  |
| **Columns** | user\_id uuid, amount int, phone text, status text (requested/processing/sent/failed/held), mpesa\_txn\_id text null, failure\_reason text null, created\_at timestamptz, processed\_at timestamptz null |
| **Indexes** | user\_id, status, created\_at                                                                                                                                                                            |

**support\_tickets**

|             |                                                                                                                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **PK**      | id uuid                                                                                                                                                                                                            |
| **Columns** | user\_id uuid, category text, subject text, status text (open/waiting\_on\_user/resolved/closed), priority text (low/medium/high), assigned\_admin\_id uuid null, created\_at timestamptz, updated\_at timestamptz |
| **Indexes** | status, priority, assigned\_admin\_id, created\_at                                                                                                                                                                 |

**support\_messages**

|             |                                                                                                                                    |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **PK**      | id uuid                                                                                                                            |
| **Columns** | ticket\_id uuid, sender\_type text (user/admin), sender\_id uuid, message text, attachment\_url text null, created\_at timestamptz |
| **Indexes** | ticket\_id, created\_at                                                                                                            |

**5.2 Admin and audit tables**

**admin\_users**

|                 |                                                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PK**          | id uuid                                                                                                                                                                   |
| **Columns**     | user\_id uuid (auth user), role text (super\_admin/admin/support/finance/fraud), status text (active/disabled), created\_at timestamptz, last\_login\_at timestamptz null |
| **Constraints** | unique(user\_id)                                                                                                                                                          |
| **Indexes**     | role, status                                                                                                                                                              |

**audit\_log**

|             |                                                                                                                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PK**      | id uuid                                                                                                                                                                           |
| **Columns** | admin\_id uuid, action text, entity\_type text, entity\_id uuid, before\_json jsonb, after\_json jsonb, reason text, created\_at timestamptz, ip text null, user\_agent text null |
| **Indexes** | admin\_id, entity\_type, entity\_id, created\_at                                                                                                                                  |

**6. Security: RLS and Admin RBAC**

**6.1 RLS rules (high level)**

  - Enable RLS on every table containing user data.

  - User read/write access is limited to rows where user\_id = auth.uid().

  - Admin access is via admin\_users and custom JWT claims or server-side service role for admin APIs.

  - Never expose service\_role key to the client. Use it only server-side.

**6.2 Suggested policy patterns**

  - profiles: select/update where user\_id = auth.uid().

  - wallet\_transactions: select where user\_id = auth.uid(); insert only via server (no client insert).

  - withdrawal\_requests: select where user\_id = auth.uid(); insert only via server.

  - support\_tickets/messages: user can only see their own tickets; inserts allowed by user on their own ticket only.

**6.3 Admin RBAC (recommended minimal roles)**

|                  |                                                                             |
| ---------------- | --------------------------------------------------------------------------- |
| **super\_admin** | Full access; can adjust ledger, revoke bonuses, mark payouts, manage roles. |
| **finance**      | Withdrawals + ledger view; cannot change roles.                             |
| **support**      | Tickets + disputes; cannot adjust money without approval workflow.          |
| **fraud**        | Risk holds, suspensions, referral abuse tools; cannot mark payouts sent.    |
| **admin**        | General operations; limited money actions depending on your policy.         |

Note: even if you want "admin has full control", keeping roles helps protect the business from internal mistakes. Super admin remains full control.

**7. Referral Program Rules (20% / 10% / 5%)**

**7.1 Trigger event (approved)**

  - Referee must complete registration and account setup (setup\_complete = true).

  - Then referral bonuses are created immediately as Pending credits (visible instantly).

  - Bonuses become Available after 7 days (available\_at).

**7.2 Calculation**

|             |                                                                      |
| ----------- | -------------------------------------------------------------------- |
| **Level 1** | Referrer A gets 20% of KSh 500 (KSh 100).                            |
| **Level 2** | Referrer B gets 10% of KSh 500 (KSh 50).                             |
| **Level 3** | Referrer C gets 5% of KSh 500 (KSh 25).                              |
| **Total**   | KSh 175 maximum distributed per activation (before fraud reversals). |

  - Only create bonuses for levels that actually exist in the chain.

  - Prevent cycles: a user cannot refer themselves or appear twice in the chain.

**8. API Contract (Next.js route handlers)**

All endpoints return JSON. For errors, return { error: { code, message } }. Use 401 for unauthenticated, 403 for unauthorized, 422 for validation, 500 for unexpected.

**8.1 Authenticated user endpoints**

**GET /api/me**

  - Purpose: dashboard bootstrap (profile + verification + activation + balances).

Response 200 { "profile": { "fullName": "John Doe", "phone": "+2547...", "email": "a@b.com", "county": "Nairobi" }, "status": { "setupComplete": true, "activated": true, "accountState": "active" }, "verification": { "phoneVerified": true, "emailVerified": true, "kycStatus": "not\_started" }, "wallet": { "pending": 150, "available": 0, "total": 150 } }

**POST /api/onboarding/complete**

  - Purpose: mark setup\_complete after user fills profile + accepts terms.

Request { "fullName": "John Doe", "county": "Nairobi", "acceptTerms": true } Response 200 { "ok": true, "setupComplete": true }

**POST /api/payments/activation/stk-push**

  - Purpose: trigger STK push for KSh 500 activation.

Request { "phone": "+2547XXXXXXXX" } Response 200 { "paymentId": "uuid", "status": "pending", "checkoutRequestId": "ws\_CO\_..." }

**POST /api/payments/mpesa/callback**

  - Purpose: Daraja callback webhook; must be public but validated; idempotent.

Response 200 { "ok": true }

**GET /api/wallet/summary**

Response 200 { "pending": 150, "available": 0, "total": 150 }

**GET /api/wallet/transactions**

Response 200 { "items": \[ { "id": "uuid", "type": "referral\_bonus", "direction": "credit", "amount": 100, "status": "pending", "availableAt": "2026-05-01T00:00:00Z", "createdAt": "2026-04-24T00:00:00Z" } \] }

**POST /api/wallet/withdraw**

  - Purpose: create withdrawal\_request and debit available balance (server-side).

Request { "amount": 500, "phone": "+2547XXXXXXXX" } Response 200 { "withdrawalId": "uuid", "status": "requested" }

**Support endpoints**

POST /api/support/tickets { "category": "withdrawal", "subject": "Withdrawal delayed", "message": "My status is processing for 2 days." } GET /api/support/tickets GET /api/support/tickets/:id POST /api/support/tickets/:id/messages

**8.2 Admin endpoints (RBAC required, audited)**

Admin endpoints should be under /api/admin/\* and must verify the caller is an admin user. Every write action must create an audit\_log row with a reason.

Examples GET /api/admin/users GET /api/admin/users/:id POST /api/admin/users/:id/suspend { "reason": "Fraud risk: duplicate devices" } GET /api/admin/withdrawals POST /api/admin/withdrawals/:id/mark-sent { "mpesaTxnId": "..." , "reason": "Processed via payout batch" } POST /api/admin/wallet/adjust { "userId": "...", "direction": "credit", "amount": 200, "reason": "Support goodwill credit" } GET /api/admin/support/tickets POST /api/admin/support/tickets/:id/reply { "message": "..." }

**9. Background Jobs / Scheduled Tasks**

  - Release pending credits: daily job that sets wallet\_transactions.status=available when available\_at \<= now.

  - Fraud monitoring: periodic job to compute risk\_score signals (optional).

  - Webhook reconciliation: verify external offerwall conversions and reverse invalid credits (future).

**10. Non-Functional Requirements**

  - Reliability: idempotent webhook handlers; retries safe.

  - Observability: log request IDs, payment IDs, checkout IDs; store callback payloads.

  - Security: never trust client amounts; compute and validate server-side.

  - Compliance: store minimum necessary PII; protect access with RLS and admin RBAC.

**Appendix A — Naming conventions**

  - All monetary values stored as integer KSh (no floating point).

  - Use timestamptz everywhere; use UTC in backend logic.

  - Use consistent status enums (text with CHECK constraint or Postgres ENUM).
