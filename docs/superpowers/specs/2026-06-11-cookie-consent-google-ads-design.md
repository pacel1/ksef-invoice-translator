# Cookie consent (RODO) + Google Ads tag — design spec

Date: 2026-06-11
Branch: `claude/google-ads-tag`
Status: approved by user (custom component, basic consent mode, 3 categories, bottom bar)

## Goal

Add a RODO/GDPR-compliant cookie consent banner to the whole site (landing, marketing pages, logged-in app) and use it to gate a new Google Ads tag (`AW-18231110784`) with Google Consent Mode v2 signals. Update the privacy policy so it describes reality.

## Decisions (user-approved)

1. **Custom component** built with the existing design tokens and locale pattern. No third-party consent library, no paid CMP.
2. **Basic consent mode**: gtag.js does not load at all until the user grants marketing consent. Nothing is sent to Google pre-consent.
3. **Three categories**: necessary (always on: Supabase auth, Cloudflare Turnstile), analytics (empty today, ready for PostHog), marketing (Google Ads).
4. **Bottom bar** banner with equal-prominence "Accept all" / "Reject all" buttons plus a "Settings" action opening per-category toggles.

## Architecture

### Consent core — `lib/consent/`

- `types.ts` — `ConsentState` (`necessary: true`, `analytics: boolean`, `marketing: boolean`, `version: number`, `decidedAt: ISO string`), constants: cookie name `cookie_consent`, `CONSENT_VERSION = 1`, max age 365 days.
- `storage.ts` — pure parse/serialize with zod validation (malformed or version-mismatched cookie ⇒ `null` ⇒ banner re-shows), plus thin `document.cookie` read/write helpers (`SameSite=Lax; Path=/; Max-Age=31536000; Secure` on https). Immutable state construction.
- `locale.ts` — `localeFromPathname(pathname)`: `"en"` when pathname is `/en` or starts with `/en/`, else `"pl"`.
- `copy.ts` — PL/EN dictionary (banner text, button labels, modal title/descriptions, per-category labels and descriptions, footer "Cookie settings" label). No em/en dashes, natural human copy.

### React layer — `components/consent/`

- `consent-provider.tsx` (client) — context + `useConsent()` hook. On mount reads the cookie; missing/invalid/version-mismatch ⇒ banner visible. Actions: `acceptAll`, `rejectAll`, `savePreferences({analytics, marketing})`, `openSettings`, `closeSettings`. Listens for a `ksef:open-cookie-settings` window event so server-component footers can reopen settings without context plumbing. Renders children + banner + modal + Google Ads loader. Locale via `usePathname()`.
- `cookie-banner.tsx` — fixed bottom bar (`fixed inset-x-0 bottom-0 z-50`), surface tokens, body text with privacy-policy link, three actions: Accept all and Reject all visually identical (RODO equal prominence), Settings as tertiary button.
- `consent-settings-modal.tsx` — accessible dialog (`role="dialog"`, `aria-modal`, labelled by title, Escape closes, initial focus). Per-category `Switch` rows; necessary is checked and disabled. Buttons: save preferences, accept all, reject all.
- `google-ads-tag.tsx` — renders nothing unless `marketing === true` **and** `NEXT_PUBLIC_GOOGLE_ADS_ID` is set (prod-only env var; dev/preview/test never load Google). When rendered: gtag.js via `next/script` + inline bootstrap that sets Consent Mode v2 defaults reflecting the granted state (`ad_storage`, `ad_user_data`, `ad_personalization` granted; `analytics_storage` follows the analytics toggle) before `gtag('config', ...)`. If consent is revoked mid-session, fire `gtag('consent', 'update', ...all denied)`; the script never loads again on later visits.
- `cookie-settings-button.tsx` (client) — small button that dispatches `ksef:open-cookie-settings`; used by both footers, label from consent copy.

### Mounting

`app/layout.tsx` wraps `{children}` in `<ConsentProvider>`. Children stay server-rendered (passed through). Banner renders only after mount to avoid hydration mismatch.

### Withdrawal path

"Cookie settings" link added to `components/layout/legal-footer.tsx` (trust column) and `components/landing/site-footer.tsx` (bottom bar) — withdrawal as easy as consent.

### Legal copy

Rewrite privacy §10 (`lib/legal/privacy/pl.ts` + `en.ts`, section id `cookies`): three categories described, Google Ads marketing cookies named, consent banner and footer withdrawal path explained, browser-settings note kept. Remove the claim that no banner is needed. Bump `PRIVACY_LAST_UPDATED` if needed (already 2026-06-11).

## Error handling

- Malformed cookie JSON or failed zod parse ⇒ treated as no decision, banner shows again. Never throws into render.
- Cookie write failures are non-fatal (state still updates in memory for the session).

## Testing (TDD, vitest + Playwright)

- Unit (`tests/lib/consent/`): storage parse/serialize round-trip, malformed JSON, version mismatch, immutability; locale detection edge cases (`/`, `/en`, `/en/pricing`, `/pricing`).
- Component (`tests/components/consent/`): banner renders PL and EN copy; accept all ⇒ state granted + banner hidden + cookie written; reject all ⇒ all optional false; settings modal toggles + save; necessary toggle locked; gtag loader renders nothing without consent or env var, renders scripts with both (mock `next/script`); revocation fires consent update.
- Update `tests/lib/legal/privacy-content.test.ts` (old copy asserted "no analytics cookies / no banner").
- E2E (`tests/e2e/cookie-consent.spec.ts`): first visit shows banner; accept ⇒ cookie set, banner gone after reload; reject ⇒ optional categories false; footer settings link reopens modal; no Google script in test env (env var unset).

## Addendum (2026-06-11, post PR #63): switch to advanced consent mode

User-requested follow-up after Google Ads could not detect the tag (its
verification bot never accepts the banner, so under basic mode the script was
invisible to it). The tag now loads for every visitor when
`NEXT_PUBLIC_GOOGLE_ADS_ID` is set, with all Consent Mode v2 signals defaulted
to denied and `ads_data_redaction` enabled, then granted from the live consent
cookie or later `consent update` pushes. No cookies are written pre-consent;
Google receives cookieless pings. The banner, storage, and withdrawal flow are
unchanged. Privacy policy §10 wording updated to match (the "scripts are not
loaded" sentence replaced with a Consent Mode description).

## Out of scope

- Google Ads conversion events (configured later in Google Ads UI / follow-up).
- PostHog integration (separate branch reads `useConsent()` when it lands).
- Vercel env var `NEXT_PUBLIC_GOOGLE_ADS_ID=AW-18231110784` — manual user step at rollout.
