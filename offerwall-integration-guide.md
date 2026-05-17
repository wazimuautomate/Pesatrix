# TrueEarn Offer Wall Integration Guide
**Next.js + Supabase + All 7 Providers**

---

## Table of Contents

1. [Provider Status Overview](#1-provider-status-overview)
2. [How the Whole System Works](#2-how-the-whole-system-works)
3. [Next.js Project Structure](#3-nextjs-project-structure)
4. [Supabase Database Schema](#4-supabase-database-schema)
5. [CPX Research — LIVE NOW](#5-cpx-research--live-now)
6. [Lootably — Pending Approval](#6-lootably--pending-approval)
7. [BitLabs — Pending Approval](#7-bitlabs--pending-approval)
8. [AdGate Media — Pending Approval](#8-adgate-media--pending-approval)
9. [Adscend Media — Pending Approval](#9-adscend-media--pending-approval)
10. [Torox/OfferToro — Pending Approval](#10-toroxoffertoro--pending-approval)
11. [Appen — Pending Reply](#11-appen--pending-reply)
12. [The Postback Endpoint — Core Logic](#12-the-postback-endpoint--core-logic)
13. [Security & Fraud Protection](#13-security--fraud-protection)
14. [Payment Thresholds & Getting Paid](#14-payment-thresholds--getting-paid)
15. [Deployment Checklist](#15-deployment-checklist)

---

## 1. Provider Status Overview

| Provider | Type | Status | Min Payout | Integration Method |
|---|---|---|---|---|
| **CPX Research** | Surveys | ✅ APPROVED | $50 | Script tag / iFrame / API |
| **Lootably** | Offers + Surveys | ⏳ Waiting | $100 | REST API (POST) |
| **BitLabs** | Surveys + Games | ⏳ Waiting | $50 | iFrame / REST API |
| **AdGate Media** | Offers | ⏳ Waiting | $25 | REST API / iFrame |
| **Adscend Media** | Offers + Surveys | ⏳ Waiting | $50 | REST API |
| **Torox/OfferToro** | Offers + Surveys | ⏳ Waiting | $50 | iFrame / API |
| **Appen** | Data Tasks | ⏳ No reply | Varies | API |

**Start with CPX Research only.** Get the full flow working end-to-end (display → click → postback → credit) before touching anything else.

---

## 2. How the Whole System Works

The flow is the same across every provider. Learn this pattern once.

```
1. Your server calls Provider API → gets list of offers/surveys
2. Your frontend displays those offers to the logged-in user
3. User clicks an offer → browser sends them to the provider's URL with YOUR user_id embedded
4. User completes the offer on the provider's site
5. Provider's server calls YOUR server (postback): GET https://yoursite.com/api/postback/cpx?user_id=123&reward=0.50
6. Your server verifies the request, then adds the reward to the user's balance in Supabase
```

Step 5 (postback) is where the money moves. If this endpoint fails or is wrong, users complete tasks and get nothing. Build this first and test it thoroughly.

---

## 3. Next.js Project Structure

```
/app
  /api
    /offers
      /cpx/route.ts          ← fetch surveys from CPX API
      /lootably/route.ts     ← fetch offers from Lootably
      /bitlabs/route.ts      ← fetch from BitLabs
    /postback
      /cpx/route.ts          ← CPX sends reward here
      /lootably/route.ts     ← Lootably sends reward here
      /bitlabs/route.ts      ← BitLabs sends reward here
      /adgate/route.ts
      /adscend/route.ts
      /torox/route.ts
  /earn
    /page.tsx                ← main earn page, shows all offer walls
    /[provider]/page.tsx     ← individual provider walls
/lib
  /providers
    cpx.ts                   ← CPX helper functions
    lootably.ts
    bitlabs.ts
  /supabase.ts
  /security.ts               ← hash verification helpers
/middleware.ts               ← auth check — wall only visible to logged-in users
```

**Rule:** API calls to providers always go through your `/api/` routes, never directly from the browser. Your API keys live in `.env.local`, never in frontend code.

---

## 4. Supabase Database Schema

Create these tables before writing a single line of integration code.

```sql
-- User balances
CREATE TABLE user_balances (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  balance_usd DECIMAL(10, 4) DEFAULT 0,
  total_earned_usd DECIMAL(10, 4) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transaction log — one row per completed offer
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  provider VARCHAR(50) NOT NULL,         -- 'cpx', 'lootably', 'bitlabs', etc.
  transaction_id VARCHAR(200) UNIQUE,    -- provider's TX ID — used for deduplication
  offer_name VARCHAR(500),
  reward_usd DECIMAL(10, 4),
  status VARCHAR(20) DEFAULT 'completed', -- 'completed' | 'reversed'
  raw_postback JSONB,                    -- store the full postback for debugging
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast deduplication checks
CREATE INDEX idx_transactions_tx_id ON transactions(transaction_id);
CREATE INDEX idx_transactions_user ON transactions(user_id);
```

The `transaction_id` unique constraint is your most important fraud defense. If a provider tries to send the same postback twice, the second insert fails and you don't double-credit the user.

---

## 5. CPX Research — LIVE NOW

You have this one. Build it end-to-end first.

### 5.1 Your Credentials (from CPX Dashboard)

- `app_id` — found in your publisher dashboard under Apps
- `secure_hash` — a secret string you use to sign requests
- Your postback URL — set this in the dashboard under Postback Settings

### 5.2 Option A: Script Tag (Easiest — Recommended to Start)

CPX's script tag handles display automatically. You just drop it in your page.

In your `/app/earn/page.tsx`:

```tsx
'use client';
import { useEffect } from 'react';
import { useUser } from '@/lib/hooks/useUser'; // your auth hook
import { md5 } from '@/lib/security'; // see security section

export default function EarnPage() {
  const { user } = useUser();

  useEffect(() => {
    if (!user) return;

    const secureHash = md5(`${user.id}-${process.env.NEXT_PUBLIC_CPX_SECURE_HASH}`);

    // Inject CPX config before the script loads
    (window as any).config = {
      general_config: {
        app_id: Number(process.env.NEXT_PUBLIC_CPX_APP_ID),
        ext_user_id: user.id,
        email: user.email,
        secure_hash: secureHash,
      },
      style_config: {
        text_color: '#2b2b2b',
        survey_box: {
          topbar_background_color: '#10b981', // match your brand
          box_background_color: 'white',
          rounded_borders: true,
        },
      },
      script_config: [
        {
          div_id: 'cpx-surveys',
          theme_style: 1, // fullscreen widget
          order_by: 2,    // sort by highest payout
          limit_surveys: 10,
        }
      ],
      debug: false,
    };

    const script = document.createElement('script');
    script.src = 'https://cdn.cpx-research.com/assets/js/script_tag_v2.0.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [user]);

  if (!user) return <p>Please log in to see surveys.</p>;

  return (
    <div>
      <h1>Earn with Surveys</h1>
      <div style={{ maxWidth: '950px', margin: 'auto' }} id="cpx-surveys" />
    </div>
  );
}
```

**Important:** `NEXT_PUBLIC_CPX_SECURE_HASH` is the hash base used for signing. The actual `secure_hash` sent to CPX is `md5(user_id + '-' + secure_hash_base)`. Never expose the raw hash base in your code.

### 5.3 Option B: API (More Control)

Create `/app/api/offers/cpx/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('user_id');
  const userIp = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const userAgent = encodeURIComponent(req.headers.get('user-agent') || '');

  if (!userId) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });

  const secureHashBase = process.env.CPX_SECURE_HASH!;
  const secureHash = createHash('md5').update(`${userId}-${secureHashBase}`).digest('hex');

  const url = new URL('https://live-api.cpx-research.com/api/get-surveys.php');
  url.searchParams.set('app_id', process.env.CPX_APP_ID!);
  url.searchParams.set('ext_user_id', userId);
  url.searchParams.set('output_method', 'api');
  url.searchParams.set('ip_user', userIp);
  url.searchParams.set('user_agent', userAgent);
  url.searchParams.set('secure_hash', secureHash);
  url.searchParams.set('limit', '12');

  const res = await fetch(url.toString(), { next: { revalidate: 120 } }); // cache 120s
  const data = await res.json();

  return NextResponse.json(data);
}
```

CPX survey objects look like this:
```json
{
  "id": "484727",
  "loi": "6",
  "payout": 0.40,
  "payout_publisher_usd": 0.81,
  "conversion_rate": "89.00",
  "href": "https://click.cpx-research.com/?k=..."
}
```

`loi` = minutes to complete. `payout_publisher_usd` = what you earn in USD. `payout` = what you display to the user in your local currency (configured in your CPX dashboard).

### 5.4 CPX Postback Setup

**In your CPX publisher dashboard**, set your postback URL to:
```
https://yoursite.com/api/postback/cpx?user_id={EXT_USER_ID}&transaction_id={TRANSACTION_ID}&reward={PAYOUT}&status={STATUS}
```

Then create `/app/api/postback/cpx/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const userId = params.get('user_id');
  const transactionId = params.get('transaction_id');
  const reward = parseFloat(params.get('reward') || '0');
  const status = params.get('status'); // '1' = completed, '0' = reversed

  // Basic validation
  if (!userId || !transactionId || !reward) {
    return new NextResponse('MISSING_PARAMS', { status: 400 });
  }

  // Deduplication — check if we already processed this transaction
  const { data: existing } = await supabaseAdmin
    .from('transactions')
    .select('id')
    .eq('transaction_id', `cpx_${transactionId}`)
    .single();

  if (existing) {
    // Already processed — return 1 so CPX stops retrying, but don't credit again
    return new NextResponse('1', { status: 200 });
  }

  // Insert transaction
  const { error: txError } = await supabaseAdmin
    .from('transactions')
    .insert({
      user_id: userId,
      provider: 'cpx',
      transaction_id: `cpx_${transactionId}`,
      reward_usd: reward,
      status: status === '1' ? 'completed' : 'reversed',
      raw_postback: Object.fromEntries(params),
    });

  if (txError) {
    console.error('CPX postback insert error:', txError);
    return new NextResponse('DB_ERROR', { status: 500 });
  }

  // Update user balance
  if (status === '1') {
    await supabaseAdmin.rpc('increment_balance', {
      p_user_id: userId,
      p_amount: reward,
    });
  }

  // MUST return exactly "1" — anything else and CPX marks it as failed and retries
  return new NextResponse('1', { status: 200 });
}
```

Create the Supabase RPC function:
```sql
CREATE OR REPLACE FUNCTION increment_balance(p_user_id UUID, p_amount DECIMAL)
RETURNS void AS $$
BEGIN
  INSERT INTO user_balances (user_id, balance_usd, total_earned_usd)
  VALUES (p_user_id, p_amount, p_amount)
  ON CONFLICT (user_id) DO UPDATE SET
    balance_usd = user_balances.balance_usd + p_amount,
    total_earned_usd = user_balances.total_earned_usd + p_amount,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
```

---

## 6. Lootably — Pending Approval

Once approved, you get a `placementID` and `apiKey` from your placement settings dashboard.

### 6.1 Install the TypeScript Types

```bash
npm install lootably-offers-api-types lootably-postback-hash
```

### 6.2 Fetch Offers

Create `/app/api/offers/lootably/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('user_id');
  const userIp = req.headers.get('x-forwarded-for') || '';
  const userAgent = req.headers.get('user-agent') || '';

  const res = await fetch('https://api.lootably.com/api/v2/offers/get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: process.env.LOOTABLY_API_KEY,
      placementID: process.env.LOOTABLY_PLACEMENT_ID,
      userData: {
        userID: userId,
        userAgentHeader: userAgent,
        ipAddress: userIp,
      },
    }),
    next: { revalidate: 60 },
  });

  const data = await res.json();
  return NextResponse.json(data);
}
```

Lootably offers have a `link` field that already contains `{userID}` as a placeholder if you use the User API. With User API, it fills it in automatically. With Catalogue API, you manually replace `{userID}` with the actual user ID before showing the link.

**Offer object key fields:**
- `name`, `description`, `image` — for display
- `link` — send users here
- `currencyReward` — how much your user earns in your configured currency
- `revenue` — how much you (publisher) earn in USD
- `conversionRate` — % of users who complete it; use this to sort what you show first

### 6.3 Lootably Postback

Set your postback URL in the Lootably dashboard:
```
https://yoursite.com/api/postback/lootably?userID={userID}&reward={currencyReward}&revenue={revenue}&txID={transactionID}&hash={hash}
```

Create `/app/api/postback/lootably/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { generateSHA256PostbackHash } from 'lootably-postback-hash';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const userID = params.get('userID')!;
  const reward = params.get('reward')!;
  const revenue = params.get('revenue')!;
  const txID = params.get('txID')!;
  const receivedHash = params.get('hash')!;
  const ip = params.get('ip') || '';

  // Verify the hash so you know this came from Lootably, not a fake request
  const expectedHash = generateSHA256PostbackHash({
    userID,
    ip,
    revenue,
    currencyReward: reward,
    postbackSecret: process.env.LOOTABLY_POSTBACK_SECRET!,
  });

  if (expectedHash !== receivedHash) {
    console.warn('Lootably postback hash mismatch — possible fraud attempt');
    return new NextResponse('INVALID_HASH', { status: 403 });
  }

  // Deduplication
  const { data: existing } = await supabaseAdmin
    .from('transactions')
    .select('id')
    .eq('transaction_id', `lootably_${txID}`)
    .single();

  if (existing) return new NextResponse('1', { status: 200 });

  // Insert + credit
  await supabaseAdmin.from('transactions').insert({
    user_id: userID,
    provider: 'lootably',
    transaction_id: `lootably_${txID}`,
    reward_usd: parseFloat(revenue),
    status: 'completed',
    raw_postback: Object.fromEntries(params),
  });

  await supabaseAdmin.rpc('increment_balance', {
    p_user_id: userID,
    p_amount: parseFloat(revenue),
  });

  return new NextResponse('1', { status: 200 });
}
```

**Must return `"1"` in the response body.** Anything else and Lootably marks it as failed and retries up to 5 times (configurable in your dashboard).

---

## 7. BitLabs — Pending Approval

BitLabs works through a placement you create in their dashboard. You get an `App Token`.

### 7.1 Option A: iFrame (Easiest)

The simplest integration — one iframe URL displays their full wall to the user.

```tsx
// In your earn page
const bitlabsIframeUrl = `https://web.bitlabs.ai?uid=${user.id}&token=${process.env.NEXT_PUBLIC_BITLABS_TOKEN}`;

return (
  <iframe
    src={bitlabsIframeUrl}
    width="100%"
    height="700px"
    frameBorder="0"
    title="BitLabs Surveys"
  />
);
```

### 7.2 Option B: Survey API

Create `/app/api/offers/bitlabs/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('user_id');

  const res = await fetch(
    `https://api.bitlabs.ai/v2/client/surveys?platform=WEB`,
    {
      headers: {
        'X-Api-Token': process.env.BITLABS_APP_TOKEN!,
        'X-User-Id': userId!,
      },
    }
  );

  const data = await res.json();
  return NextResponse.json(data);
}
```

### 7.3 BitLabs Callbacks

BitLabs calls callbacks as GET requests. Set your callback URL in the dashboard:
```
https://yoursite.com/api/postback/bitlabs?uid=[%UID%]&val=[%VAL%]&raw=[%RAW%]&tx=[%TX%]&hash=[hash]
```

Where:
- `[%UID%]` = your user ID
- `[%VAL%]` = user reward in your app currency
- `[%RAW%]` = USD payout to you
- `[%TX%]` = transaction ID for deduplication

**Whitelist these IPs** in your server/firewall — only accept postbacks from:
```
20.76.54.40/29
18.199.243.90
18.157.62.114
18.193.24.206
```

BitLabs retries failed callbacks up to 10 times with increasing delays (1s, 4s, 9s, 16s, 25s, 60s, 120s, 300s...). Your endpoint must return HTTP 200 to stop retries.

Create `/app/api/postback/bitlabs/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const uid = params.get('uid')!;
  const raw = parseFloat(params.get('raw') || '0');
  const tx = params.get('tx')!;
  const hash = params.get('hash')!;

  // Verify hash — BitLabs uses SHA-1 HMAC with App Secret
  const url = req.url.replace(/&hash=.*$/, '');
  const expectedHash = createHmac('sha1', process.env.BITLABS_APP_SECRET!)
    .update(url)
    .digest('hex');

  if (expectedHash !== hash) {
    return new NextResponse('INVALID_HASH', { status: 403 });
  }

  // Deduplication
  const { data: existing } = await supabaseAdmin
    .from('transactions')
    .select('id')
    .eq('transaction_id', `bitlabs_${tx}`)
    .single();

  if (existing) return new NextResponse('', { status: 200 });

  await supabaseAdmin.from('transactions').insert({
    user_id: uid,
    provider: 'bitlabs',
    transaction_id: `bitlabs_${tx}`,
    reward_usd: raw,
    status: 'completed',
    raw_postback: Object.fromEntries(params),
  });

  await supabaseAdmin.rpc('increment_balance', {
    p_user_id: uid,
    p_amount: raw,
  });

  return new NextResponse('', { status: 200 });
}
```

---

## 8. AdGate Media — Pending Approval

AdGate's old REST API (v1) is deprecated. They now recommend their newer offer panel API or using an iframe. When approved, they'll give you a `vc_code` (Virtual Currency code).

### 8.1 Option A: iFrame Wall (Recommended by AdGate)

```tsx
const adgateUrl = `https://wall.adgaterewards.com/${process.env.NEXT_PUBLIC_ADGATE_VC_CODE}/${user.id}`;

return (
  <iframe
    src={adgateUrl}
    width="100%"
    height="700px"
    frameBorder="0"
    title="AdGate Offers"
  />
);
```

### 8.2 Option B: REST API

```ts
// GET /api/offers/adgate
const res = await fetch(
  `https://wall.adgaterewards.com/apiv1/vc/${VC_CODE}/users/${userId}/offers?ip=${userIp}`,
  { next: { revalidate: 300 } }
);
const data = await res.json();
// data.data = array of offers
```

Each offer has:
- `click_url` — send the user here
- `points` — reward for your user
- `anchor` — offer title
- `icon_url` — display image
- `confirmation_time` — how long before it confirms

### 8.3 AdGate Postback

Set in AdGate dashboard:
```
https://yoursite.com/api/postback/adgate?user_id=[user_id]&points=[points]&tx=[tx_id]&status=[status]
```

AdGate's postback pattern is the same as the others — receive GET, deduplicate on tx_id, credit user, return HTTP 200.

---

## 9. Adscend Media — Pending Approval

Adscend has three separate APIs. For TrueEarn, use the **Offer Wall API** (user-specific) and the **Market Research API** (surveys).

### 9.1 Authentication

All Adscend API calls use HTTP Basic Auth:
```ts
const auth = Buffer.from(`${process.env.ADSCEND_API_USER}:${process.env.ADSCEND_API_PASS}`).toString('base64');

fetch('https://api.adscendmedia.com/...', {
  headers: {
    'Authorization': `Basic ${auth}`,
  }
});
```

### 9.2 Get Offers (Offer Wall API v1.1)

```ts
// GET /api/offers/adscend
const res = await fetch(
  `https://api.adscendmedia.com/api/wall/v1.1/get-offers.php?subid1=${userId}&ip=${userIp}`,
  {
    headers: { 'Authorization': `Basic ${auth}` },
    next: { revalidate: 300 },
  }
);
```

### 9.3 Get Surveys (Market Research API)

Surveys require a user profile. Before pulling surveys for a user, you must create their profile once:

```ts
// One-time call per user
await fetch('https://api.adscendmedia.com/api/market-research/v1/create-survey-profile.php', {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    subid1: userId,
    email: userEmail,
    gender: 'm', // or 'f'
    dob: '1995-01-15', // date of birth
    country: 'KE',
    zip: '',
  }),
});

// Then pull surveys
const surveys = await fetch(
  `https://api.adscendmedia.com/api/market-research/v1/get-surveys.php?subid1=${userId}`,
  { headers: { 'Authorization': `Basic ${auth}` } }
);
```

### 9.4 Adscend Postback

Set in Adscend dashboard under Postback URL settings. The pattern is the same — GET request with user_id, amount, tx_id. Return HTTP 200.

**VPN Detection:** Adscend includes a VPN flag in offer responses. Filter out or down-rank offers flagged as VPN-incompatible when the user's IP is detected as a VPN/proxy. This prevents fraudulent completions.

---

## 10. Torox/OfferToro — Pending Approval

Torox's public API documentation is thin. When they approve you, they send your API credentials and a more detailed integration guide through their account manager. The core pattern is the same as the others.

### 10.1 iFrame (Primary Method)

Torox primarily uses an iFrame wall with your publisher ID and the user's ID embedded in the URL:

```tsx
const toroxUrl = `https://wall.torox.io/iframe/?app_id=${process.env.NEXT_PUBLIC_TOROX_APP_ID}&user_id=${user.id}`;

return (
  <iframe
    src={toroxUrl}
    width="100%"
    height="700px"
    frameBorder="0"
    title="Torox Offers"
  />
);
```

### 10.2 Torox Postback

When they approve you, ask specifically for their postback parameter list. The postback handler code structure is the same as the others — get the user_id and reward amount from query params, deduplicate, credit.

---

## 11. Appen — Pending Reply

Appen is different from the others. They provide data labeling, transcription, and annotation tasks — not typical survey/offer walls. Their tasks pay more per hour but are skill-based.

When they reply, ask them:
- Do they have a Publisher/Affiliate API to show tasks to third-party users?
- What is their integration method for embedding tasks in external websites?
- What are their minimum traffic and user requirements?

If they don't have a publisher API, you cannot embed Appen tasks in TrueEarn. They primarily hire workers directly on their own platform.

---

## 12. The Postback Endpoint — Core Logic

Every postback endpoint follows this exact pattern. Never deviate from it.

```
1. Parse incoming query parameters
2. Validate required params are present
3. Verify the hash/signature (where provider supports it)
4. Check for duplicate transaction_id in Supabase
   - If exists: return success response WITHOUT crediting again
   - If not: continue
5. Insert row into transactions table
6. Call increment_balance RPC
7. Return the required success response for that provider
```

### Required Success Responses Per Provider

| Provider | Required Response Body | HTTP Status |
|---|---|---|
| CPX Research | `1` | 200 |
| Lootably | `1` | 200 |
| BitLabs | Empty | 200 |
| AdGate | `1` | 200 |
| Adscend | `1` | 200 |
| Torox | Confirm with account manager | 200 |

**If your endpoint returns anything other than the expected response, the provider will keep retrying the postback.** With 1,200 users, failed retries will flood your logs and potentially cause duplicate credits if your deduplication fails.

---

## 13. Security & Fraud Protection

### 13.1 Hash Verification

Always verify the postback signature where available:

| Provider | Hash Method | Verification |
|---|---|---|
| CPX Research | MD5 on requests | `md5(user_id + '-' + secure_hash)` |
| Lootably | SHA-256 on postback | `sha256(userID + ip + revenue + currencyReward + secret)` |
| BitLabs | SHA-1 HMAC | HMAC of full URL with App Secret |
| AdGate | IP whitelist | Verify request IP is from AdGate |
| Adscend | IP whitelist + token | Configured in dashboard |

Create `/lib/security.ts`:

```ts
import { createHash, createHmac } from 'crypto';

export const md5 = (str: string) =>
  createHash('md5').update(str).digest('hex');

export const sha256 = (str: string) =>
  createHash('sha256').update(str).digest('hex');

export const sha1Hmac = (key: string, data: string) =>
  createHmac('sha1', key).update(data).digest('hex');

// Reject postback if IP is not in provider's known range
const CPX_IP_WHITELIST = ['213.239.202.0/24']; // verify current IPs with CPX
const BITLABS_IP_WHITELIST = [
  '20.76.54.40', '20.76.54.41', '20.76.54.42', '20.76.54.43',
  '20.76.54.44', '20.76.54.45', '20.76.54.46', '20.76.54.47',
  '18.199.243.90', '18.157.62.114', '18.193.24.206',
];
```

### 13.2 VPN Detection

Offer providers send VPN/proxy flags. When displaying offers, check the flag and do not show offers that don't allow VPN traffic to users on VPN IPs. This protects your account from getting banned for fraudulent completions.

### 13.3 Rate Limiting on Postback Endpoints

Add Next.js middleware rate limiting on `/api/postback/*`. No real provider sends more than 1 postback per second per user. More than that is suspicious.

```ts
// middleware.ts — add rate limit on postback routes
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const POSTBACK_RATE_LIMIT = new Map<string, number[]>();

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/api/postback')) {
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    const windowMs = 1000; // 1 second
    const maxRequests = 10;

    const timestamps = POSTBACK_RATE_LIMIT.get(ip) || [];
    const recent = timestamps.filter(t => now - t < windowMs);

    if (recent.length >= maxRequests) {
      return new NextResponse('RATE_LIMITED', { status: 429 });
    }

    POSTBACK_RATE_LIMIT.set(ip, [...recent, now]);
  }
  return NextResponse.next();
}
```

### 13.4 Auth Guard on the Earn Page

No unauthenticated user should ever see your earn page. Protect it at the layout level:

```ts
// app/earn/layout.tsx
import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';

export default async function EarnLayout({ children }) {
  const session = await getServerSession();
  if (!session) redirect('/login');
  return <>{children}</>;
}
```

---

## 14. Payment Thresholds & Getting Paid

You earn when users complete offers. The providers pay YOU (the publisher). You then pay your users from your platform balance.

| Provider | Minimum to Pay You | Payment Methods | Payment Schedule |
|---|---|---|---|
| CPX Research | $50 | PayPal, Wire, Payoneer | Net 30 |
| Lootably | $100 | PayPal, Wire | Net 30 |
| BitLabs | $50 | Wire, PayPal | Net 30 |
| AdGate Media | $25 | PayPal, Wire | Net 15 |
| Adscend Media | $50 | PayPal, Wire, Check | Net 30 |
| Torox | $50 | PayPal, Wire | Net 30 |

**This means you carry the float.** Users complete tasks today, you credit their balance today, but the provider doesn't pay you for 15-30 days. With 1,200 users, keep a cash buffer to cover payouts before provider payments arrive.

**Your payout to users should be lower than what you earn from providers.** Standard practice is to pay users 70-80% of what you earn per completion. The 20-30% gap is your revenue.

---

## 15. Deployment Checklist

Before going live with any provider:

**Environment Variables** (`.env.local` and Vercel settings):
```
CPX_APP_ID=
CPX_SECURE_HASH=
NEXT_PUBLIC_CPX_APP_ID=       # safe to expose (just app ID)
NEXT_PUBLIC_CPX_SECURE_HASH=  # DO NOT expose this — server only

LOOTABLY_API_KEY=
LOOTABLY_PLACEMENT_ID=
LOOTABLY_POSTBACK_SECRET=

BITLABS_APP_TOKEN=
BITLABS_APP_SECRET=

ADGATE_VC_CODE=
ADSCEND_API_USER=
ADSCEND_API_PASS=

TOROX_APP_ID=
```

**Test your postback endpoint** before going live. Use a tool like `curl` or Postman to manually hit your postback URL with fake data and confirm:
1. The transaction inserts into Supabase
2. The user balance updates
3. Duplicate calls don't double-credit

**Pages your site must have** for provider approval reviews:
- `/terms` — Terms of Service (required by every provider)
- `/privacy` — Privacy Policy
- `/earn` — The actual earn page (must look professional and functional)
- `/profile` — User balance display

**Test mode:** Every provider has a test/sandbox mode. Use it until you have confirmed end-to-end flow working. Real completions cannot be reversed in most cases.

---

*Last updated: April 2026*
*Covers: CPX Research, Lootably, BitLabs, AdGate Media, Adscend Media, Torox/OfferToro, Appen*
