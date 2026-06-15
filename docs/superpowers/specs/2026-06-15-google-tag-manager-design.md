# Google Tag Manager migration — design

Date: 2026-06-15
Status: Approved (pending spec review)
Author: brainstorming session

## Goal

Replace the hardcoded Google Ads `gtag.js` tag with a Google Tag Manager
(GTM) container (`GTM-MGZXZ4PD`). GTM becomes the single tag manager; the
Google Ads conversion tag is re-created *inside* the GTM container UI rather
than hardcoded in the app. The existing Consent Mode v2 / cookie-consent
system is preserved unchanged in behaviour.

Additionally, emit a `dataLayer` `purchase` event on the post-checkout
success page so the Google Ads purchase conversion can be triggered off a
real event (with a `transaction_id` for dedup) instead of a bare URL match.

## Background (current state)

- Google Ads is loaded **directly** via two `next/script` tags in
  `components/consent/google-ads-tag.tsx`, mounted at
  `components/consent/consent-provider.tsx:101`. It uses **advanced consent
  mode**: the tag loads for every visitor, all four Consent Mode v2 signals
  default to `denied`, `ads_data_redaction` is set, and the granted state is
  read live from the `cookie_consent` cookie. `gtag('config', 'AW-…')` fires
  at the end.
- Tag id comes from `NEXT_PUBLIC_GOOGLE_ADS_ID` (production-only Vercel var).
  When unset, the component renders `null`, so dev/preview/test load no
  Google scripts.
- Consent plumbing: two user toggles (`analytics`, `marketing`) plus an
  always-on `necessary`, mapped to the four Consent Mode v2 signals. State is
  stored in the `cookie_consent` cookie (`lib/consent/types.ts`,
  `lib/consent/storage.ts`). Runtime consent changes flow through
  `pushConsentUpdate` in `lib/consent/gtag.ts`, which calls
  `window.gtag('consent','update',…)` if the shim is defined, otherwise
  queues the canonical `arguments` object into `window.dataLayer`.
- No GTM anywhere yet; no `NEXT_PUBLIC_GTM_ID`.
- CSP is `frame-ancestors 'none'` only (in `vercel.json`) — no `script-src`
  / `connect-src` allowlist, so GTM is not blocked. No CSP change needed now.
- Stripe success redirect: `${NEXT_PUBLIC_APP_URL}/billing?status=paid&session_id={CHECKOUT_SESSION_ID}`
  (`lib/billing/checkout-session-params.ts:77`). Rendered as a success state
  in `app/(protected)/billing/page.tsx` (which currently parses only
  `status` from `searchParams`). `/billing` is in the `(protected)` route
  group, so only the logged-in buyer reaches it.

## Decisions

1. **Replace, not coexist.** Remove the direct Google Ads tag; Google Ads is
   re-created inside the GTM container UI (out of code scope).
2. **Env-gated** on `NEXT_PUBLIC_GTM_ID`. Component renders nothing when
   unset, so dev/preview/test load no GTM. Production sets
   `NEXT_PUBLIC_GTM_ID=GTM-MGZXZ4PD` in Vercel.
3. **Keep advanced Consent Mode v2.** Consent defaults (all denied) +
   `ads_data_redaction` + live-cookie consent update are pushed to the
   `dataLayer` **before** the GTM container loads, in a single inline script,
   so ordering is guaranteed. This is mandatory for EU compliance — without
   it GTM tags could set ad/analytics cookies before consent.
4. **Add a `purchase` dataLayer event** on the success page carrying
   `transaction_id` = the Stripe `session_id` from the URL, so the Ads
   conversion can dedup on refresh. No server fetch required. Value/currency
   deferred to a later iteration.
5. **`lib/consent/gtag.ts` is unchanged.** GTM reads the same `dataLayer`, so
   `pushConsentUpdate` keeps working as-is.
6. **`NEXT_PUBLIC_GOOGLE_ADS_ID` is removed from code.** The conversion ID now
   lives only inside the GTM container configuration.

## Components

### 1. `components/consent/google-tag-manager.tsx` (new)

Client component. Mirrors the structure of the removed `google-ads-tag.tsx`.

- Reads `process.env.NEXT_PUBLIC_GTM_ID`; returns `null` if unset.
- Renders **one** inline `next/script` (`id="gtm-init"`,
  `strategy="afterInteractive"`) whose body, in strict order:
  1. `window.dataLayer = window.dataLayer || []`
  2. defines `function gtag(){dataLayer.push(arguments)}` and
     `window.gtag = window.gtag || gtag` (the shim `pushConsentUpdate`
     depends on)
  3. `gtag('consent','default', { ad_storage:'denied', ad_user_data:'denied',
     ad_personalization:'denied', analytics_storage:'denied' })`
  4. `gtag('set','ads_data_redaction', true)`
  5. reads the `cookie_consent` cookie (same regex/parse as the old
     bootstrap, keyed on `CONSENT_COOKIE_NAME`); on a valid prior decision,
     `gtag('consent','update', …)` with `marketing` → ad_* and `analytics` →
     analytics_storage. Malformed cookie → signals stay denied (try/catch).
  6. runs the standard GTM loader IIFE (the exact snippet supplied), injecting
     `https://www.googletagmanager.com/gtm.js?id=${gtmId}`.

  All six steps live in the same inline script so the consent defaults are in
  the `dataLayer` before `gtm.js` executes.

### 2. `components/consent/consent-provider.tsx` (edit)

- Remove the `GoogleAdsTag` import and its `<GoogleAdsTag />` mount (line 7,
  line 101); mount `<GoogleTagManager />` in its place.

### 3. `components/consent/google-ads-tag.tsx` (delete)

- Removed entirely.

### 4. `app/layout.tsx` (edit)

- Immediately after the opening `<body>` tag, render the GTM `<noscript>`
  iframe, env-gated on `NEXT_PUBLIC_GTM_ID` (a server component reading a
  `NEXT_PUBLIC_*` var is fine — it is inlined at build time). When the env var
  is unset, render nothing.
- The iframe is the exact snippet supplied:
  `https://www.googletagmanager.com/ns.html?id=GTM-MGZXZ4PD`, `height="0"
  width="0" style="display:none;visibility:hidden"`. The id is interpolated
  from the env var, not hardcoded.

  Note: the `<noscript>` path cannot honour Consent Mode (no JS runs), but it
  only applies to visitors with JavaScript disabled and is included per the
  standard GTM install.

### 5. Purchase conversion event

- `app/(protected)/billing/page.tsx`: extend the `searchParams` type to also
  read `session_id`. When `status === 'paid'`, render a small client
  component with the `session_id`.
- `components/billing/purchase-conversion.tsx` (new): client component that,
  once on mount, pushes
  `window.dataLayer.push({ event: 'purchase', transaction_id: <session_id> })`.
  Guards: only push when a non-empty `session_id` is present; initialise
  `window.dataLayer` if absent; push once per mount. It renders no DOM.

  The push is harmless on its own; whether the Ads conversion actually fires
  is decided by the tag-level consent settings inside GTM (requires
  `ad_storage`). `transaction_id` is the Stripe `cs_…` session id, not PII.

## Environment variables

- Add `NEXT_PUBLIC_GTM_ID` to `.env.example` (commented/example value) and to
  `.env.test.example` left **unset/absent** so tests load no GTM.
- Production: set `NEXT_PUBLIC_GTM_ID=GTM-MGZXZ4PD` in Vercel.
- `NEXT_PUBLIC_GOOGLE_ADS_ID` is no longer read by app code after this change.

## Data flow

1. First paint → inline GTM-init script runs: dataLayer + gtag shim →
   consent default denied → ads_data_redaction → cookie read → (maybe) consent
   update → load `gtm.js`.
2. GTM container loads with consent state already established; tags inside
   respect Consent Mode v2.
3. User decides via banner/modal → `decide()` →
   `pushConsentUpdate(state)` → `gtag('consent','update', …)` (or dataLayer
   queue) → GTM re-evaluates tag eligibility.
4. After checkout → `/billing?status=paid&session_id=cs_…` →
   `PurchaseConversion` pushes `{ event:'purchase', transaction_id:'cs_…' }`
   → GTM trigger on the `purchase` event fires the Ads conversion (subject to
   consent), deduped by `transaction_id`.

## Error handling

- Missing `NEXT_PUBLIC_GTM_ID` → component and noscript render nothing (no
  runtime error, no scripts).
- Malformed `cookie_consent` → caught; consent signals remain denied.
- Missing/empty `session_id` on the success page → no `purchase` push.
- Cookie reads/writes already wrapped in try/catch in the existing system;
  unchanged.

## Testing (TDD)

Framework: Vitest (jsdom for components) + Playwright (E2E).

New / changed tests:

1. `tests/components/consent/google-tag-manager.test.tsx` (new):
   - renders nothing when `NEXT_PUBLIC_GTM_ID` is unset (no scripts).
   - with the env var set, injects a script referencing
     `gtm.js?id=GTM-MGZXZ4PD`.
   - the inline init pushes `consent default` with all four signals `denied`
     and sets `ads_data_redaction` **before** the loader runs.
   - with a prior `cookie_consent` granting marketing/analytics, pushes a
     `consent update` with the matching granted signals.
   - defines the `window.gtag` shim.
2. `tests/components/consent/consent-provider.test.tsx` (edit): replace the
   "Google Ads tag gating" block with GTM equivalent (provider mounts the GTM
   component; env-gated). Keep the revocation `consent update` test (it
   exercises `pushConsentUpdate`, which is unchanged).
3. `tests/components/billing/purchase-conversion.test.tsx` (new):
   - pushes `{ event:'purchase', transaction_id }` once when `session_id` is
     present.
   - pushes nothing when `session_id` is missing/empty.
4. E2E `tests/e2e/cookie-consent.spec.ts`: stays green — test env has no
   `NEXT_PUBLIC_GTM_ID`, so the "loads no Google scripts" assertion (zero
   `script[src*='googletagmanager']`) still holds. No change required; add a
   clarifying comment that the absence is env-driven.

Coverage target: 80%+ (project policy). All new code is unit-tested.

## Out of scope

- Creating/configuring the Google Ads conversion tag inside the GTM container
  UI (manual, done by the user in GTM).
- GA4 or any other tag (configured in GTM UI later).
- Revenue/value on the purchase event (later iteration).
- Server-side / offline conversion import keyed off the Stripe webhook (a
  separate, later job for exact async-payment accuracy).
- CSP `script-src`/`connect-src` tightening (not currently present; if added
  later it must allow `https://www.googletagmanager.com`).

## Rollout

1. Merge code (GTM env-gated, renders nothing without the var).
2. Confirm the Google Ads conversion tag + consent settings exist inside the
   `GTM-MGZXZ4PD` container.
3. Set `NEXT_PUBLIC_GTM_ID=GTM-MGZXZ4PD` in Vercel production → GTM goes live.
4. Verify in GTM Preview / Google Tag Assistant that consent defaults to
   denied and updates on accept, and that the `purchase` event fires on a test
   checkout.
