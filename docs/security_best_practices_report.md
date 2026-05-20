# Security Audit Report

## Executive Summary

This pass replaced production-facing M-Pesa mocks with real Daraja STK/B2C flows, closed a real authorization flaw in the admin helper, and tightened payout state handling so withdrawal debits only become spendable deductions after confirmed payout success. The highest remaining risks are operational rather than code-generation mistakes: webhook source validation still depends on trusted proxy headers, and the current `next` dependency line still inherits an `npm audit` moderate finding through bundled `postcss`.

## Remediated Findings

### SEC-001
- Severity: High
- Status: Fixed
- Location: [src/app/api/payments/activation/stk-push/route.ts](/C:/Users/HP/Pesatrix/src/app/api/payments/activation/stk-push/route.ts), [src/app/api/payments/mpesa/callback/route.ts](/C:/Users/HP/Pesatrix/src/app/api/payments/mpesa/callback/route.ts), [src/app/api/payments/b2c/result/route.ts](/C:/Users/HP/Pesatrix/src/app/api/payments/b2c/result/route.ts)
- Evidence: the activation route now inserts only a pending row and hardcodes the server-side amount, with STK spam protection at [src/app/api/payments/activation/stk-push/route.ts](/C:/Users/HP/Pesatrix/src/app/api/payments/activation/stk-push/route.ts:91) and STK initiation tracking at [src/app/api/payments/activation/stk-push/route.ts](/C:/Users/HP/Pesatrix/src/app/api/payments/activation/stk-push/route.ts:107). The callback routes now own final state transitions and reject non-whitelisted origins before processing at [src/app/api/payments/mpesa/callback/route.ts](/C:/Users/HP/Pesatrix/src/app/api/payments/mpesa/callback/route.ts:33) and [src/app/api/payments/b2c/result/route.ts](/C:/Users/HP/Pesatrix/src/app/api/payments/b2c/result/route.ts:18).
- Impact: the previous mock flow could mark payments or withdrawals complete without Daraja confirmation.
- Fix: real Daraja client and hardened callback processing were added, including idempotency, amount/receipt checks, and audit logging.

### SEC-002
- Severity: High
- Status: Fixed
- Location: [src/app/api/admin/_lib.ts](/C:/Users/HP/Pesatrix/src/app/api/admin/_lib.ts:11), [src/app/api/admin/_lib.ts](/C:/Users/HP/Pesatrix/src/app/api/admin/_lib.ts:55), [src/app/api/admin/withdrawals/[id]/process/route.ts](/C:/Users/HP/Pesatrix/src/app/api/admin/withdrawals/[id]/process/route.ts:13), [src/app/api/admin/withdrawals/[id]/send/route.ts](/C:/Users/HP/Pesatrix/src/app/api/admin/withdrawals/[id]/send/route.ts:18), [src/app/api/admin/withdrawals/[id]/fail/route.ts](/C:/Users/HP/Pesatrix/src/app/api/admin/withdrawals/[id]/fail/route.ts:17), [src/app/api/payments/b2c/initiate/route.ts](/C:/Users/HP/Pesatrix/src/app/api/payments/b2c/initiate/route.ts:15)
- Evidence: `requireAdmin()` now enforces `allowedRoles`, and payout-affecting routes explicitly restrict access to `finance` and `super_admin`.
- Impact: before this change, any active admin row would have bypassed route-specific role intent because `allowedRoles` was ignored.
- Fix: role checks are enforced centrally and the schema migration expands `admin_users.role` beyond the legacy single-value constraint.

### SEC-003
- Severity: Medium
- Status: Fixed
- Location: [src/lib/wallet-math.ts](/C:/Users/HP/Pesatrix/src/lib/wallet-math.ts:39), [supabase/migrations/028_mpesa_production_hardening.sql](/C:/Users/HP/Pesatrix/supabase/migrations/028_mpesa_production_hardening.sql:23), [src/app/api/payments/b2c/result/route.ts](/C:/Users/HP/Pesatrix/src/app/api/payments/b2c/result/route.ts:102)
- Evidence: wallet math now subtracts only finalized debit rows, the migration moves pending withdrawal debits into the `locked` bucket, and B2C success explicitly promotes the debit into an `available` deduction.
- Impact: the earlier flow treated withdrawal debits as immediately effective before confirmed payout completion, which increased reconciliation risk and conflicted with the intended payout lifecycle.
- Fix: request-time withdrawals reserve funds in a non-deducting locked state, and only success callbacks finalize the debit.

## Residual Findings

### SEC-004
- Severity: Medium
- Status: Open
- Location: [src/lib/mpesa/security.ts](/C:/Users/HP/Pesatrix/src/lib/mpesa/security.ts:92), [src/lib/mpesa/security.ts](/C:/Users/HP/Pesatrix/src/lib/mpesa/security.ts:101), [src/app/api/payments/mpesa/callback/route.ts](/C:/Users/HP/Pesatrix/src/app/api/payments/mpesa/callback/route.ts:33), [src/app/api/payments/b2c/result/route.ts](/C:/Users/HP/Pesatrix/src/app/api/payments/b2c/result/route.ts:18)
- Evidence: webhook trust is derived from `x-forwarded-for` / `x-real-ip` and compared against `SAFARICOM_IP_WHITELIST`.
- Impact: if the reverse proxy or hosting platform does not overwrite and lock these headers, a direct attacker can spoof them and reach the public callback handlers.
- Fix: verify at deployment that the edge strips client-supplied forwarding headers and enforces its own canonical client IP header; if possible, also add platform-level IP/network ACLs in front of these routes.
- False positive notes: if Vercel or your upstream proxy already overwrites these headers and blocks direct origin access, this becomes a smaller residual risk.

### SEC-005
- Severity: Moderate
- Status: Open
- Location: [package.json](/C:/Users/HP/Pesatrix/package.json:41), [package.json](/C:/Users/HP/Pesatrix/package.json:57)
- Evidence: manifests are now aligned to `next@^15.5.18` and `eslint-config-next@^15.5.15`, but `npm audit --omit=dev` still reports a moderate advisory against bundled `postcss` through `next`.
- Impact: the advisory is not obviously exploitable in this app as written, but it remains an upstream dependency finding until Vercel resolves or reclassifies it.
- Fix: monitor the upstream Next.js advisory/changelog for a release that clears the bundled `postcss` report, then update and re-run `npm audit`.
- False positive notes: the current audit output is internally inconsistent in places, so confirm against the upstream advisory rather than relying on `npm audit` alone.

## Deployment Notes

- Apply [supabase/migrations/028_mpesa_production_hardening.sql](/C:/Users/HP/Pesatrix/supabase/migrations/028_mpesa_production_hardening.sql) before enabling the live Daraja routes.
- Populate the new Daraja and Safaricom allowlist variables shown in [.env.example](/C:/Users/HP/Pesatrix/.env.example:17) and [.env.local.example](/C:/Users/HP/Pesatrix/.env.local.example:16).
- Re-run an end-to-end STK and B2C smoke test in a non-user-facing window after migration, because these code paths now depend on real callback delivery rather than mock completion.
