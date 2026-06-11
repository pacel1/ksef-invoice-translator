> **Historical artifact.** This is the verbatim output of `npx @posthog/wizard`
> (2026-06-11), kept for the dashboard links below. Several claims no longer
> match the shipped code: identification now happens post-auth by Supabase user
> id (never by email at OTP send), and the server client moved from
> `lib/posthog-server.ts` to `lib/analytics/server.ts`. The source of truth is
> `docs/analytics.md` and `docs/superpowers/specs/2026-06-11-posthog-analytics-design.md`.

<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into this Next.js 15 App Router project. Client-side tracking is initialized via `instrumentation-client.ts` (the Next.js 15.3+ pattern), with a reverse proxy configured in `next.config.ts` routing PostHog traffic through `/ingest` to the EU data region. A shared server-side client (`lib/posthog-server.ts`) captures critical payment and translation events from API routes. Users are identified by email on the client side when the OTP login email is sent, and by Supabase user ID on the server side in payment and translation events.

| Event | Description | File |
|---|---|---|
| `login_submitted` | User submitted the email OTP login form | `app/login/login-form.tsx` |
| `google_signin_clicked` | User clicked the Google OAuth sign-in button | `app/login/login-form.tsx` |
| `login_email_sent` | Magic-link / OTP email dispatched; user identified by email | `app/login/login-form.tsx` |
| `files_uploaded` | XML invoice files uploaded (batch) with success/failure counts | `components/translate/use-translation-wizard.ts` |
| `translation_started` | User confirmed language/format and kicked off a batch | `components/translate/use-translation-wizard.ts` |
| `translation_batch_cancelled` | User cancelled an in-progress translation batch | `components/translate/use-translation-wizard.ts` |
| `pdf_downloaded` | User downloaded a single translated PDF | `components/translate/delivery-step.tsx` |
| `zip_downloaded` | User downloaded all translated PDFs as a ZIP archive | `components/translate/delivery-step.tsx` |
| `checkout_initiated` | User clicked Continue to Checkout on the billing page | `components/billing/credit-slider.tsx` |
| `checkout_session_created` | Server created a Stripe checkout session (server-side) | `app/api/stripe/checkout/route.ts` |
| `payment_completed` | Stripe webhook confirmed payment and credits granted (server-side) | `app/api/stripe/webhook/route.ts` |
| `payment_failed` | Delayed BLIK/P24 payment definitively failed (server-side) | `app/api/stripe/webhook/route.ts` |
| `payment_refunded` | Full charge refund processed and credits revoked (server-side) | `app/api/stripe/webhook/route.ts` |
| `invoice_translated` | Invoice translation completed — cache hit or fresh AI (server-side) | `app/api/translate/route.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) — Dashboard](https://eu.posthog.com/project/199578/dashboard/740875)
- [Payment conversion funnel (wizard)](https://eu.posthog.com/project/199578/insights/eNFW6H1j) — checkout_initiated → checkout_session_created → payment_completed
- [Login funnel (wizard)](https://eu.posthog.com/project/199578/insights/JhXGOQ3E) — login_submitted → login_email_sent
- [Translations over time (wizard)](https://eu.posthog.com/project/199578/insights/3ofjQds2) — daily total translations and unique translating users
- [Revenue events trend (wizard)](https://eu.posthog.com/project/199578/insights/rlFwmD9t) — checkout started, payments, and refunds over time
- [Translation-to-download funnel (wizard)](https://eu.posthog.com/project/199578/insights/sL3j6S3k) — translation_started → pdf_downloaded

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
