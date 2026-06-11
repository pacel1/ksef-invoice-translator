# Analytics

Product analytics for the KSeF Invoice Translator, powered by PostHog.

## 1. Overview

We run [PostHog Cloud EU](https://eu.posthog.com) (project `199578`, region
`eu.i.posthog.com`). It answers where visitors and users drop off, what drives
credit purchases, and which product features matter. The scope is event
analytics, funnels, and dashboards, plus `capture_exceptions` for free error
visibility. Session replay, feature flags, and surveys are out of scope.

- Design spec: `docs/superpowers/specs/2026-06-11-posthog-analytics-design.md`
- Wizard dashboard ("Analytics basics"):
  https://eu.posthog.com/project/199578/dashboard/740875

## 2. Architecture

```
Browser (posthog-js, cookieless by default)
  └─ /ingest/* ──rewrite──▶ eu.i.posthog.com
       /ingest/static|array ─▶ eu-assets.i.posthog.com

Server (posthog-node, captureServer)
  ├─ app/api/translate/route.ts       → invoice_translated
  ├─ app/api/stripe/checkout/route.ts → checkout_session_created
  └─ app/api/stripe/webhook/route.ts  → payment_completed / payment_failed / payment_refunded
```

- **Client init** lives in `instrumentation-client.ts` (the Next 15.3+ pattern,
  no React provider). It starts cookieless: persistence is `"memory"` unless the
  visitor accepted the analytics cookie category. Autocapture is off because
  invoice content renders in the DOM.
- **Reverse proxy**: the browser talks to PostHog through `/ingest`, rewritten
  to the EU ingestion and asset hosts in `next.config.ts` `rewrites()`. The
  `ingest` path is excluded from the Supabase session middleware matcher in
  `middleware.ts`, and `skipTrailingSlashRedirect: true` keeps PostHog's
  trailing-slash paths intact.
- **Server captures** go through `captureServer` (`lib/analytics/server.ts`),
  wrapping a lazily-initialized `posthog-node` singleton. Each capture is
  deferred with `after()` from `next/server` so it never delays the response,
  then `flush()` runs inside the callback so events survive serverless freeze.
  `captureServer` must be called within a request scope (route handler or server
  action); out-of-scope calls are logged and dropped, and any failure is
  swallowed so analytics can never break a request.
- **Typed catalog**: `lib/analytics/events.ts` is the single source of truth for
  every event name and its property shape. Nothing else may call
  `posthog.capture` with a raw string.

## 3. Consent model

The site-wide cookie banner (PR #63, `components/consent/` and `lib/consent/`)
is the single consent source of truth. Its **analytics** category governs
PostHog persistence for everyone, logged-in users included.

- **Default**: cookieless. `instrumentation-client.ts` reads the consent cookie
  via `analyticsPersistenceFromCookie` (`lib/analytics/consent.ts`) and stays in
  `"memory"` persistence until the analytics category is accepted. No `ph_*`
  cookies or storage are written before that.
- **Upgrade and revoke**: `PostHogConsentSync`
  (`components/analytics/posthog-consent-sync.tsx`), mounted inside
  `ConsentProvider` next to the Google Ads tag, applies the live decision. On
  acceptance it upgrades persistence to `localStorage+cookie`. On decline or
  revoke it calls `posthog.reset()` first (while the old persistence is still
  active, so any prior `ph_*` residue is cleared) and drops back to memory.
- **Identification is consent-independent**: `identifyAuthenticatedUser`
  (`lib/analytics/client.ts`) identifies logged-in users by their Supabase
  `user.id` regardless of the cookie choice. This is a legitimate-interest
  measure, disclosed in the privacy policy (sub-processor list §9 and cookie
  categories §10). It never changes persistence; under memory persistence the
  identity simply re-links on each page load. `resetAnalyticsIdentity` runs on
  sign-out and returns to the consent-derived persistence.

## 4. Event catalog

The 14 events live after the foundation PR. `client` events fire from a client
component through `captureClient`; `server` events fire from a route handler
through `captureServer`.

| Event | Properties | Where it fires | Source |
|---|---|---|---|
| `login_submitted` | `method: "email_otp"` | client | `app/login/login-form.tsx` |
| `google_signin_clicked` | (none) | client | `app/login/login-form.tsx` |
| `login_email_sent` | `method: "email_otp"` | client | `app/login/login-form.tsx` |
| `files_uploaded` | `file_count`, `success_count`, `failure_count` | client | `components/translate/use-translation-wizard.ts` |
| `translation_started` | `file_count`, `language`, `bilingual` | client | `components/translate/use-translation-wizard.ts` |
| `translation_batch_cancelled` | `total`, `done` | client | `components/translate/use-translation-wizard.ts` |
| `pdf_downloaded` | `invoice_id`, `language`, `bilingual`, `context` (`single` or `batch_row`) | client | `components/translate/delivery-step.tsx` |
| `zip_downloaded` | `invoice_count`, `language`, `bilingual` | client | `components/translate/delivery-step.tsx` |
| `checkout_initiated` | `package_size`, `total_net_pln?` | client | `components/billing/credit-slider.tsx` |
| `checkout_session_created` | `package_size`, `total_amount_cents`, `currency`, `stripe_session_id` | server | `app/api/stripe/checkout/route.ts` |
| `payment_completed` | `package_size`, `total_amount_cents`, `currency`, `stripe_session_id` | server | `app/api/stripe/webhook/route.ts` |
| `payment_failed` | `stripe_session_id`, `purchase_id` | server | `app/api/stripe/webhook/route.ts` |
| `payment_refunded` | `package_size`, `stripe_charge_id` | server | `app/api/stripe/webhook/route.ts` |
| `invoice_translated` | `invoice_id`, `language`, `bilingual`, `cache_hit`, `used_ai`, `duration_ms` | server | `app/api/translate/route.ts` |

PostHog also captures `$pageview` / `$pageleave` automatically (UTM and referrer
included), and `$exception` via `capture_exceptions`.

## 5. How to add an event

1. Add the event to `AnalyticsEventMap` in `lib/analytics/events.ts` with its
   typed property shape.
2. Add the same key to `EVENT_PROPERTY_WITNESS` in the same file. The witness is
   typed `Record<keyof Payload, true>`, so the compiler forces every property
   (optional ones included) to be listed and rejects unknown keys. The runtime
   `EVENT_PROPERTY_KEYS` list is derived from the witness, so it can never
   silently drift from the type.
3. Fire it through `captureClient` (client components) or `captureServer` (route
   handlers and server actions). Never call `posthog.capture` with a raw string
   outside `lib/analytics/`.
4. Run the catalog test. The PII guard in
   `tests/lib/analytics/events.test.ts` scans `EVENT_PROPERTY_KEYS` and fails on
   any forbidden property name (see PII rules below).

## 6. PII rules

Hard constraints from spec §4, encoded as catalog comments and enforced by the
guard test:

- **Never** capture invoice content: file names, party names, NIP/VAT ids,
  IBAN/SWIFT, invoice numbers, invoice amounts, emails.
- **Allowed**: counts, byte sizes, language codes, booleans, error codes,
  durations, credit package sizes, PLN prices of our own credit packages,
  internal UUIDs (`invoice_id`, `user.id`), and Stripe ids.
- **Person properties** are limited to `email` and `locale` today.

## 7. Session stitching

The translate route attributes server events to the originating browser session.
The wizard API client (`components/translate/default-wizard-api.ts`) reads the
posthog-js session id with `getAnalyticsSessionId()` and sends it on the
`/api/translate` request under the `POSTHOG_SESSION_HEADER` header
(`x-posthog-session-id`, exported from `lib/analytics/events.ts`). The route
(`app/api/translate/route.ts`) reads that header and passes it to `captureServer`
as `sessionId`, which sets `$session_id` on the event.

## 8. Environment and deploy

Two public env vars, documented in `.env.example`:

```bash
NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

The token ships to the browser; the browser reaches PostHog through the
`/ingest` rewrite, not the host directly. The host is also used by the
`posthog-node` server client. Both vars must be added to the Vercel project
environment before merge, or server captures are skipped (logged, never thrown)
and the client init runs against an empty token. Everything points at the EU
region; data stays in the EU (Frankfurt).

## 9. Roadmap

Two follow-up PRs build on this foundation (event lists pinned in spec §5,
dashboards in spec §7). Sequential off `main`, PR N+1 after PR N merges.

- **PR 2, acquisition funnel**: demo, landing, and contact events; server-side
  auth-completion events (`signup_completed`, `login_completed`, `auth_failed`)
  in the auth callback; onboarding events. Dashboards: demo funnel, activation
  funnel.
- **PR 3, product depth**: `paywall_hit`, wizard language/bilingual/retry
  events, editor and reopen events, billing edges (`credit_drawer_opened`,
  `checkout_cancelled`), account events plus PostHog person erasure on account
  deletion. Dashboards: paywall conversion, quality monitor.

Dashboards still to build (spec §7): demo funnel, activation funnel (7-day),
paywall conversion, quality monitor (failure rates by `error_code`), and
engagement (retention, language popularity, bilingual share, cache-hit rate).
