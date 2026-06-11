# PostHog Analytics — Design Spec

Date: 2026-06-11
Status: approved (user delegated final approval)
Branch: `claude/posthog-analytics`

## 1. Context and goals

We are adding product analytics to the KSeF Invoice Translator so we can see where visitors and users drop off, what drives credit purchases, and which product features matter. Today the app has **no analytics and no error tracking**.

The PostHog wizard (`npx @posthog/wizard --region eu`) was run on 2026-06-11 and produced a baseline integration (committed verbatim as the first commit on this branch; see `posthog-setup-report.md`). This spec defines the target state: what the wizard got right, what must be fixed, and the full event taxonomy to build out.

Questions this system must answer:

1. Where does the landing → demo → email → signup funnel leak?
2. Where does the signup → onboarding → first translation funnel leak?
3. What converts free users to paying (and what does `paywall_hit` do to conversion)?
4. Which languages/formats/features are actually used?
5. Where do users hit errors that we never hear about?

## 2. Decisions (made with the user, 2026-06-11)

| Decision | Choice |
|---|---|
| Hosting | PostHog Cloud **EU** (project id 199578, `eu.i.posthog.com`) |
| Consent posture | **Cookieless anonymous by default** (`persistence: "memory"`), small consent prompt upgrades to `localStorage+cookie`. Logged-in users identified by Supabase `user.id` under legitimate-interest product analytics, disclosed in the privacy policy. |
| Scope | Event analytics + funnels + dashboards. `capture_exceptions: true` kept (free error visibility). **Out of scope:** session replay, feature flags, surveys. |
| Event naming | The wizard's 14 event names are **canonical** (its PostHog dashboard/insights already reference them). New events follow the same style: snake_case, object_action past tense. |
| Branching | All work on `claude/posthog-analytics` off `main`, merged via PR(s). |

## 3. Architecture

```
Browser (posthog-js, cookieless until consent/login)
  └─ /ingest/* ──rewrite──▶ eu.i.posthog.com        (next.config.ts, wizard ✓)
       /ingest/static|array ─▶ eu-assets.i.posthog.com

Server (posthog-node singleton, lib/posthog-server.ts, wizard ✓)
  ├─ app/auth/callback/route.ts      → signup/login completion   (NEW)
  ├─ app/api/translate/route.ts      → invoice_translated        (wizard ✓)
  ├─ app/api/stripe/checkout/route.ts→ checkout_session_created  (wizard ✓)
  ├─ app/api/stripe/webhook/route.ts → payment_* (revenue truth) (wizard ✓)
  └─ app/api/me/account/route.ts     → account_deleted + GDPR erasure (NEW)
```

- **Client init**: `instrumentation-client.ts` (Next 15.3+ pattern, no React provider). Wizard config is kept but extended with `persistence: "memory"` and `autocapture: false`.
- **Why autocapture off**: invoice data (party names, NIP, amounts) renders in the wizard DOM; autocapture records clicked element text. All events are explicit.
- **Typed event catalog**: `lib/analytics/events.ts` defines a TypeScript union of every event name and its property shape. `lib/analytics/client.ts` (wraps `posthog-js`) and `lib/analytics/server.ts` (wraps the `posthog-node` singleton) expose `captureClient` / `captureServer`. **No raw `posthog.capture("string")` calls outside these modules.** The wizard's scattered raw calls get migrated into the catalog.
- **Serverless flush**: server captures wrap in `after()` from `next/server` so the response is not delayed, plus `await client.flush()` inside the `after` callback so events are not lost when the lambda freezes. (Wizard gap: fire-and-forget.)
- **Middleware**: add `ingest` to the matcher exclusion in `middleware.ts` so Supabase session refresh does not run on analytics traffic.
- **Env**: `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` + `NEXT_PUBLIC_POSTHOG_HOST` already in `.env.local`; add placeholders to `.env.example`; add both to Vercel project env before merge.

## 4. Identity strategy

- **Anonymous visitors**: memory persistence; distinct id resets per page load. Accepted trade-off: anonymous cross-page journeys fragment; the demo funnel (single page) is unaffected.
- **Consent upgrade**: accepting the consent prompt calls `posthog.set_config({ persistence: "localStorage+cookie" })`; choice itself stored in `localStorage` (functional, no consent needed). Declining keeps memory persistence; the prompt does not re-appear for 180 days.
- **Identified users**: a small client component in `app/(protected)/layout.tsx` calls `posthog.identify(user.id, { email, locale })` once per session (guarded so repeat renders don't re-identify). Login merges that session's anonymous events automatically.
- **MUST FIX (wizard bug)**: remove `posthog.identify(email)` from `app/login/login-form.tsx`. It identifies an *unverified, unauthenticated* email at OTP-send time and uses email as distinct id while server events use `user.id` — every user becomes two unlinked persons, and any stranger's typed email creates a person profile.
- **Server events** always use `user.id` as `distinctId`. For session stitching on `/api/translate`, the client sends `X-POSTHOG-SESSION-ID` (from `posthog.get_session_id()`); the route passes it as `$session_id`.
- **Sign-out**: `posthog.reset()` alongside the existing `signOut` action.
- **Account deletion**: capture `account_deleted`, then delete the person via the PostHog API (GDPR erasure), keyed by `user.id`.

### PII rules (hard constraints, encoded as comments + tests on the catalog)

- Never capture invoice content: file names, party names, NIP/VAT ids, IBAN, amounts, invoice numbers.
- Allowed: counts, byte sizes, language codes, booleans, error codes, durations, package sizes, PLN totals of **our own** credit packages, internal UUIDs (`invoice_id`, `user.id`, Stripe ids).
- Person properties limited to: `email`, `locale`, `signup_method`, `signup_source`, `marketing_opt_in`, `is_paying`, `first_translated_at` (`$set_once`).

## 5. Event taxonomy

Status legend: ✅ shipped by wizard (keep name, migrate into typed catalog) · ➕ new.

### Marketing and demo (anonymous, landing page)

| Status | Event | Properties | Source |
|---|---|---|---|
| auto | `$pageview` / `$pageleave` | UTM, referrer (defaults `2026-01-30`) | posthog-js |
| ➕ | `landing_cta_clicked` | `cta_id` (`hero_primary`\|`hero_secondary`\|`nav_login`\|`mobile_nav`\|`pricing_teaser`\|`final_cta`), `locale` | `components/landing/{hero,site-nav,mobile-nav-sheet,pricing-teaser,final-cta}.tsx` |
| ➕ | `demo_language_selected` | `language`, `lane` (`sample`\|`upload`) | `components/landing/demo/language-chips.tsx` |
| ➕ | `demo_file_uploaded` | `status` (`success`\|`invalid`\|`rate_limited`\|`error`), `error_code?` | `components/landing/demo/upload-panel.tsx` |
| ➕ | `demo_translation_completed` | `language`, `lane` | `components/landing/demo/demo-section.tsx` |
| ➕ | `demo_translation_failed` | `language`, `lane`, `error_code` | same |
| ➕ | `demo_download_gate_opened` | `trigger` (`download`\|`more_languages`), `lane` | `components/landing/demo/download-gate.tsx` |
| ➕ | `demo_email_submitted` | `status` (`success`\|`rate_limited`\|`error`), `marketing_opt_in`, `lane` | same |
| ➕ | `demo_pdf_downloaded` | `language`, `lane` | same |
| ➕ | `contact_form_submitted` | `locale` | contact form component |

### Auth and onboarding

| Status | Event | Properties | Source |
|---|---|---|---|
| ✅ | `login_submitted` | `method: "email_otp"` | `app/login/login-form.tsx` |
| ✅ | `google_signin_clicked` | — | same |
| ✅ | `login_email_sent` | `method` (**remove the `identify(email)` call next to it**) | same |
| ➕ | `signup_completed` | `method` (`magic_link`\|`google`), `signup_source` (`landing_demo`\|`direct`) | **server**, `app/auth/callback/route.ts` (new user ⇔ `created_at` within 5 min) |
| ➕ | `login_completed` | `method` | same |
| ➕ | `auth_failed` | `reason` | same, error branch |
| ➕ | `onboarding_name_shown` / `onboarding_name_completed` | — | `components/account/name-capture-modal.tsx` |
| ➕ | `signed_out` | — | header sign-out form |

### Core product (translate wizard)

| Status | Event | Properties | Source |
|---|---|---|---|
| ✅ | `files_uploaded` | `file_count`, `success_count`, `failure_count` | `components/translate/use-translation-wizard.ts` |
| ✅ | `translation_started` | `file_count`, `language`, `bilingual` | same |
| ✅ | `translation_batch_cancelled` | `total`, `done` | same |
| ➕ | `wizard_language_selected` | `language` | same |
| ➕ | `wizard_bilingual_toggled` | `bilingual` | same |
| ➕ | `paywall_hit` | `remaining_files` | same, on 402 `insufficient_credit` |
| ➕ | `translation_retried` | — | same |
| ✅ | `invoice_translated` | `invoice_id`, `language`, `bilingual`, `cache_hit`, `used_ai`, `duration_ms` | **server**, `app/api/translate/route.ts` |
| ➕ | `translation_failed` | `error_code` | **server**, same route, error paths |
| ✅ | `pdf_downloaded` | `invoice_id`, `language`, `bilingual` (+ ➕ `context`: `single`\|`batch_row`) | `components/translate/delivery-step.tsx` |
| ✅ | `zip_downloaded` | `invoice_count`, `language`, `bilingual` | same |
| ➕ | `editor_opened` | — | `components/translate/translation-editor.tsx` |
| ➕ | `translation_edited` | `field_count` | same, on save |
| ➕ | `invoice_reopened` | `source` (`sidebar`\|`history`) | sidebar / history components |

### Billing and account

| Status | Event | Properties | Source |
|---|---|---|---|
| ✅ | `checkout_initiated` | `package_size`, `total_net_pln` | `components/billing/credit-slider.tsx` |
| ✅ | `checkout_session_created` | `package_size`, `total_amount_cents`, `currency`, `stripe_session_id` | **server**, checkout route |
| ✅ | `payment_completed` | `package_size`, `total_amount_cents`, `currency`, `stripe_session_id` | **server**, Stripe webhook (revenue truth) |
| ✅ | `payment_failed` / `payment_refunded` | session/charge ids, `package_size` | **server**, webhook |
| ➕ | `checkout_cancelled` | — | billing page, `?status=cancelled` |
| ➕ | `credit_drawer_opened` | `trigger` (`low_balance_banner`\|`balance_chip`\|`paywall`) | `components/billing/credit-purchase-drawer.tsx` |
| ➕ | `data_exported` | — | `components/account/data-export-section.tsx` |
| ➕ | `account_deleted` | — | **server**, `app/api/me/account/route.ts` + PostHog person erasure |
| ➕ | `profile_updated` | `locale_changed` | profile section |

## 6. Consent prompt

Minimal non-blocking bottom-corner card (both locales), shown only to visitors with no stored choice and only when PostHog is loaded. Copy (final wording in implementation, no dashes, honest tone per copy rules): analytics runs without cookies; accepting lets us remember the visitor across visits. Buttons: accept / decline. No layout shift, dismissible, keyboard accessible. New components: `components/analytics/consent-prompt.tsx`, logic in `lib/analytics/consent.ts` (pure functions: read/store choice with timestamp, decide visibility, apply persistence upgrade).

## 7. Dashboards (PostHog UI, documented in `docs/analytics.md`)

The wizard created "Analytics basics (wizard)" (dashboard 740875) with payment, login, translations, revenue, and translation-to-download insights. Keep it, then add:

1. **Demo funnel**: `$pageview` (/, /en) → `demo_language_selected` OR `demo_file_uploaded` → `demo_download_gate_opened` → `demo_email_submitted` → `demo_pdf_downloaded`.
2. **Activation funnel** (7-day window): `signup_completed` → `onboarding_name_completed` → `translation_started` → `invoice_translated` → `pdf_downloaded`.
3. **Paywall conversion**: `paywall_hit` → `credit_drawer_opened` → `checkout_initiated` → `payment_completed`.
4. **Quality monitor**: `translation_failed`, `demo_translation_failed`, `auth_failed`, upload failure rates by `error_code`; alert on spikes.
5. **Engagement**: weekly retention on `invoice_translated`, language popularity, bilingual share, cache-hit rate, invoices per user.

`docs/analytics.md` records: taxonomy reference, dashboard links, how to add an event (catalog-first), PII rules.

## 8. Privacy and compliance checklist

- [ ] Privacy policy: add PostHog (EU) to sub-processors; describe legitimate-interest analytics for logged-in users; describe cookieless anonymous analytics and the optional consent cookie.
- [ ] Cookieless mode verified: **no** `ph_*` cookies / localStorage before consent or login (Playwright assertion).
- [ ] Account deletion triggers PostHog person erasure.
- [ ] No PII in event properties (unit test scans catalog types; review checklist for prop additions).
- [ ] Vercel env vars set before merge.

## 9. Testing strategy (per repo TDD policy)

- **Unit** (vitest): `lib/analytics/consent.ts` (choice storage, visibility, expiry), `lib/analytics/events.ts` catalog type guards, `lib/analytics/server.ts` capture wrapper (mock `posthog-node`, assert distinct id + `after` flush), client wrapper no-op safety when PostHog not loaded.
- **Component/integration** (vitest + testing-library): consent prompt renders/choices persist; wizard hook fires catalog events on transitions (mock client wrapper — existing wizard hook tests extended).
- **E2E** (Playwright): landing page issues `/ingest` requests with no `ph_*` cookies before consent; accept sets persistence cookie; demo flow emits expected event names (network interception of `/ingest`).
- Wizard-baseline code is migrated into the catalog with tests **before** new events are added.

## 10. Rollout

- **PR 1 — foundation fixes** (this branch): wizard baseline commit + cookieless/autocapture config, identity fix, typed catalog migration of the 14 wizard events, `after()` flush, middleware exclusion, consent prompt, `.env.example`, privacy policy update, `docs/analytics.md`.
- **PR 2 — acquisition funnel**: demo + landing + contact events; auth completion server events; onboarding events; demo funnel + activation funnel dashboards.
- **PR 3 — product depth**: wizard depth events (`paywall_hit`, language/bilingual, retry, editor, reopen), billing edges (`credit_drawer_opened`, `checkout_cancelled`), account events + GDPR erasure; paywall + quality dashboards.

Sequential PRs off `main` per project branching rules (PR N+1 starts after PR N merges).

## 11. Out of scope

Session replay, feature flags/experiments, surveys, server-side `$pageview` capture, Sentry-style full error tracking (only PostHog `capture_exceptions` ships). Revisit after the dashboards prove themselves.
