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
  ├─ app/api/stripe/webhook/route.ts  → payment_completed / payment_failed / payment_refunded
  └─ app/auth/callback/route.ts       → signup_completed / login_completed
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
  measure, disclosed in the privacy policy (sub-processor list in §5, item 9,
  and cookie categories in §10). It never changes persistence; under memory persistence the
  identity simply re-links on each page load. `resetAnalyticsIdentity` runs on
  sign-out and returns to the consent-derived persistence.

## 4. Event catalog

The catalog defines 28 events. `client` events fire from a client component
through `captureClient`; `server` events fire from a route handler through
`captureServer`. The foundation set is below; the acquisition set (PR2) follows
in §4.1.

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

### 4.1. Acquisition events (PR2)

The acquisition funnel: landing → demo → email → signup → onboarding.

**Demo funnel** (anonymous, landing page). `lane` is `"sample"` (built-in demo
invoice) or `"upload"` (visitor XML). `demo_file_uploaded` fires once per real
file selection; `demo_translation_completed` / `demo_translation_failed` fire on
every (re)translate in the upload lane. `error_code` is derived from the demo
API HTTP status (`lib/analytics/demo-status.ts`), never a localized copy key.

| Event | Properties | Where it fires | Source |
|---|---|---|---|
| `demo_language_selected` | `language`, `lane` | client | `components/landing/demo/demo-section.tsx` |
| `demo_file_uploaded` | `status` (`success`/`invalid`/`rate_limited`/`error`), `error_code?` | client | `components/landing/demo/upload-panel.tsx` |
| `demo_translation_completed` | `language`, `lane` | client | `components/landing/demo/upload-panel.tsx` |
| `demo_translation_failed` | `language`, `lane`, `error_code` | client | `components/landing/demo/upload-panel.tsx` |
| `demo_download_gate_opened` | `trigger` (`download`/`more_languages`), `lane` | client | `components/landing/demo/demo-section.tsx` |
| `demo_email_submitted` | `status` (`success`/`rate_limited`/`error`), `marketing_opt_in`, `lane` | client | `components/landing/demo/download-gate.tsx` |
| `demo_pdf_downloaded` | `language`, `lane` | client | `components/landing/demo/download-gate.tsx` |

**Auth / onboarding.** `signup_completed` vs `login_completed` is decided by
whether the Supabase user's `created_at` is within 5 minutes of the callback
(`signup_source` comes from `user_metadata.source`, seeded by the landing-demo
OTP). `auth_failed` is captured **client-side** from the `?error` param on
`/login` (the server callback has no authenticated distinct id and, as a
top-level redirect, no session header — client capture keeps it on the visitor's
session).

| Event | Properties | Where it fires | Source |
|---|---|---|---|
| `signup_completed` | `method` (`magic_link`/`google`), `signup_source` (`landing_demo`/`direct`) | server | `app/auth/callback/route.ts` |
| `login_completed` | `method` (`magic_link`/`google`) | server | `app/auth/callback/route.ts` |
| `auth_failed` | `reason` (capped to 64 chars) | client | `app/login/login-form.tsx` |
| `onboarding_name_shown` | (none) | client | `components/account/onboarding-name-modal.tsx` |
| `onboarding_name_completed` | (none) | client | `components/account/onboarding-name-modal.tsx` |
| `signed_out` | (none) | client | `components/layout/sign-out-button.tsx` |

**Landing CTA.** Fired through the `TrackedCtaLink` client wrapper
(`components/landing/ui/tracked-cta-link.tsx`) because 4 of the 6 CTA hosts are
server components.

| Event | Properties | Where it fires | Source |
|---|---|---|---|
| `landing_cta_clicked` | `cta_id` (`hero_primary`/`hero_secondary`/`nav_login`/`mobile_nav`/`pricing_teaser`/`final_cta`), `locale` | client | `components/landing/{hero,site-nav,pricing-teaser,final-cta,mobile-nav-sheet}.tsx` |

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

- **PR 2, acquisition funnel — shipped.** Demo funnel events, landing CTA
  clicks, server-side auth-completion events (`signup_completed`,
  `login_completed`) plus client-side `auth_failed`, and onboarding/sign-out
  events. See §4.1. Two deviations from the original spec §5, both deliberate:
  `auth_failed` is captured client-side (no distinct id / session header on the
  callback redirect), and `landing_cta_clicked` uses the `TrackedCtaLink` client
  wrapper (its CTA hosts are server components). `contact_form_submitted` was
  deferred (no verified contact-form integration point).
- **PR 3, product depth — pending**: `paywall_hit`, wizard
  language/bilingual/retry events, editor and reopen events, billing edges
  (`credit_drawer_opened`, `checkout_cancelled`), account events plus PostHog
  person erasure on account deletion. Dashboards: paywall conversion.

### Dashboards

Planned (PostHog UI, project 199578) — built once this PR deploys and the PR2
events begin flowing (the query tools validate against live events):

- **Acquisition / Demo** — demo conversion funnel, landing CTA clicks by
  `cta_id`, demo upload quality (`demo_file_uploaded` by `status`,
  `demo_translation_failed` by `error_code`).
- **Activation** — signup→activation funnel (7-day), signups by `method` /
  `signup_source`, login mix (`login_completed` / `google_signin_clicked` /
  `login_submitted`).
- **Quality & Engagement** — `auth_failed` by `reason`, demo completed vs failed,
  weekly retention on `invoice_translated`.

Kept as-is: the wizard "Analytics basics" dashboard
(https://eu.posthog.com/project/199578/dashboard/740875).

Still to build (PR3, spec §7): paywall conversion funnel.
