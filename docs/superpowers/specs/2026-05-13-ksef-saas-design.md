# KSeF Invoice Translator — SaaS Design

**Date:** 2026-05-13
**Status:** Draft for review
**Owner:** Jakub Śledź

## 1. Goal

Evolve the existing KSeF Invoice Translator MVP (Next.js 15 + OpenAI, anonymous, single-page) into a self-serve SaaS:

- Magic-link login (no passwords)
- Free tier: 1 invoice per calendar month
- Pay-as-you-go credit packs purchased from a slider (5 → 100, step 5) via Stripe Checkout
- Persistent history of parsed invoices and translations per user
- Modern, branded frontend that retains the current PL/EN landing page

Out of scope for this spec: KSeF API integration, accounting features, team accounts, subscriptions, organization billing.

## 2. Approach: Hybrid public landing + auth-gated workspace

Decision: keep the existing landing page anonymous so visitors can try a built-in sample invoice with zero friction, but require magic-link login before any real upload. This preserves the current conversion funnel and avoids a hard auth wall.

Alternatives considered:

- **Auth-wall everything.** Simpler, but loses the "try it now" moment that already converts visitors.
- **Subscription tier + credits.** Adds proration, dunning, cancellation, and entitlement edge cases for an MVP. Easy to layer on later without re-architecting the credit model.

## 3. Unit of consumption

**1 credit = 1 uploaded source file.**

The unit is the file, not the translation. Once a user has uploaded a source file (XML or PDF) and paid 1 credit for it, all of the following are free:

- Translating it into any language
- Re-translating into a different language
- Toggling bilingual/mono output
- Re-downloading the PDF
- Viewing the parsed invoice on the history page

Idempotency: source files are fingerprinted with `sha256(file_bytes)` per user. Re-uploading the same bytes returns the existing invoice row and does not consume a credit.

This rule is chosen because it is the most defensible and easiest to communicate. A user is paying for the parsing + first AI translation pass, which is where the OpenAI cost lives; subsequent re-translations are bounded because the parsed structure is cached and only free-text fields need re-translating, which is cheap.

## 4. Credit accounting

Two balances per user:

- `free_credits_remaining` — granted 1 per calendar month on first need, does not accumulate, resets on the 1st (UTC)
- `paid_credits` — purchased via Stripe, never expire

Consumption order: free first, then paid. If both are zero, the upload is blocked with a friendly modal pointing to the slider.

A `credit_ledger` table records every grant, purchase, consumption, refund, and adjustment as an immutable append-only audit log. Balances in `credit_balances` are a denormalised view of the ledger sum for performance; they are updated inside the same SQL function that writes the ledger entry.

## 5. Pricing ladder (slider)

Slider range: 5 → 100, step 5. Tiered unit pricing rewards larger packs and pushes users away from the smallest pack.

| Pack size  | Unit price | Pack total |
|------------|-----------:|-----------:|
| 5          |     €1.50  |     €7.50  |
| 10, 15, 20 |     €1.30  |    €13–26  |
| 25–45      |     €1.10  |    €27.50–€49.50 |
| 50–95      |     €0.90  |    €45–€85.50 |
| 100        |     €0.75  |    €75.00  |

These numbers are placeholders intended to be sensible defaults; final pricing is a business decision. The slider always renders the current unit price and total live, so users see the discount as they drag.

Currency: EUR primary, with a setting to add PLN as a second Stripe Price set later. Tax/VAT handling: enable Stripe Tax in the dashboard so cross-border EU VAT is collected automatically; the app does not implement custom VAT logic.

## 6. Architecture

```
+----------------------+            +---------------------+
|  Next.js 15 (Vercel) |            |  Stripe Checkout    |
|  - App Router        | <--------> |  - one-time payments|
|  - Server Actions    |            |  - Tax enabled      |
|  - API routes        |            +---------------------+
|     /api/parse-pdf   |                     |
|     /api/translate   |                     | webhook
|     /api/pdf         |                     v
|     /api/stripe/*    | <-----------+-----------------+
+----------------------+             |
            |                        |
            v                        v
+---------------------------+  +-------------------+
|  Supabase                 |  |  OpenAI           |
|  - Auth (magic link)      |  |  - free-text only |
|  - Postgres + RLS         |  +-------------------+
|  - SQL functions          |
|  - (optional) Storage     |
+---------------------------+
```

Hosting: Vercel for the app, Supabase managed cloud for auth + DB. No new infra.

## 7. Data model

All tables live in the public schema with RLS enabled. Every user-owned row carries `user_id uuid references auth.users(id)`.

### profiles

```
id              uuid primary key references auth.users(id) on delete cascade
email           text not null
display_name    text
locale          text not null default 'pl'        -- 'pl' | 'en'
created_at      timestamptz not null default now()
```

Created by a trigger on `auth.users` insert.

### credit_balances

```
user_id                       uuid primary key references profiles(id) on delete cascade
paid_credits                  integer not null default 0 check (paid_credits >= 0)
free_credits_remaining        integer not null default 0 check (free_credits_remaining >= 0)
free_credits_period_start     date    not null default date_trunc('month', now())::date
updated_at                    timestamptz not null default now()
```

A SQL function `ensure_free_credit_for_period(user_id)` is called before every consumption attempt: if the stored period is older than the current month, it resets `free_credits_remaining` to 1 and advances `free_credits_period_start`. This avoids needing a cron job.

### invoices

```
id              uuid primary key default gen_random_uuid()
user_id         uuid not null references profiles(id) on delete cascade
source_type     text not null check (source_type in ('xml','pdf'))
source_hash     text not null                       -- sha256(file_bytes)
source_size     integer not null
invoice_number  text
issue_date      date
currency        text
total_gross     numeric(18,2)
source_data     jsonb not null                       -- parsed Invoice model
warnings        text[] not null default '{}'
created_at      timestamptz not null default now()
unique (user_id, source_hash)
```

The `(user_id, source_hash)` unique constraint enforces per-user idempotency: re-uploading the same bytes returns the existing row.

### translations

```
id              uuid primary key default gen_random_uuid()
invoice_id      uuid not null references invoices(id) on delete cascade
language        text not null
bilingual       boolean not null
translated_data jsonb not null
used_ai         boolean not null
created_at      timestamptz not null default now()
unique (invoice_id, language, bilingual)
```

Cached so re-rendering a PDF in a previously selected language costs nothing.

### credit_ledger

```
id                          uuid primary key default gen_random_uuid()
user_id                     uuid not null references profiles(id) on delete cascade
event_type                  text not null check (event_type in ('purchase','consume','free_grant','refund','adjustment'))
delta_paid                  integer not null default 0
delta_free                  integer not null default 0
balance_paid_after          integer not null
balance_free_after          integer not null
invoice_id                  uuid references invoices(id)
stripe_purchase_id          uuid references stripe_purchases(id)
note                        text
created_at                  timestamptz not null default now()
```

Append-only. No updates, no deletes.

### stripe_purchases

```
id                            uuid primary key default gen_random_uuid()
user_id                       uuid not null references profiles(id) on delete cascade
stripe_checkout_session_id    text unique not null
stripe_payment_intent_id      text unique
package_size                  integer not null check (package_size between 5 and 100)
unit_price_cents              integer not null
total_amount_cents            integer not null
currency                      text not null default 'eur'
status                        text not null check (status in ('pending','paid','failed','refunded'))
credits_granted               integer not null default 0
created_at                    timestamptz not null default now()
paid_at                       timestamptz
```

Webhook handler is idempotent on `stripe_checkout_session_id`.

### RLS policies (summary)

- `profiles`: a user can `select` and `update` their own row.
- `credit_balances`: a user can `select` their own row. All writes happen via SQL functions invoked with `security definer` from server code; no direct user writes.
- `invoices`, `translations`: a user can `select`, `insert`, `update`, `delete` their own rows.
- `credit_ledger`, `stripe_purchases`: a user can `select` their own rows. All writes are server-side via `security definer` functions.

## 8. SQL functions (server-only, `security definer`)

- `ensure_free_credit_for_period(p_user uuid) returns void` — refreshes the monthly free grant if a new month has started; logs a `free_grant` ledger entry when it grants.
- `consume_credit(p_user uuid, p_invoice uuid) returns void` — atomic; raises `insufficient_credit` if both balances are zero; otherwise decrements free first then paid and writes a `consume` ledger entry.
- `grant_paid_credits(p_user uuid, p_purchase uuid, p_amount int) returns void` — increments `paid_credits` and writes a `purchase` ledger entry.
- `refund_paid_credits(p_user uuid, p_purchase uuid, p_amount int) returns void` — mirror of grant; writes `refund` ledger entry.

All functions are `security definer` and `set search_path = public`. Server code calls them with the service-role key.

## 9. Stripe payment flow

1. User opens `/billing`, drags slider to a value `n ∈ {5,10,…,100}`. The UI computes unit price and total client-side using a shared `lib/billing/pricing.ts` ladder.
2. Click **Continue to payment** → POST `/api/stripe/checkout` with `{ packageSize: n }`.
3. Server validates `n`, recomputes price from the canonical ladder (never trusts the client-supplied price), creates a `stripe_purchases` row with `status='pending'`, then creates a Stripe Checkout session with `mode='payment'`, line item using a server-side price calculation, `client_reference_id = purchase.id`, and success/cancel URLs.
4. User completes payment on Stripe-hosted page.
5. Stripe sends `checkout.session.completed` to `/api/stripe/webhook`. The handler:
   - Verifies the signature with `STRIPE_WEBHOOK_SECRET`.
   - Looks up the `stripe_purchases` row by `stripe_checkout_session_id`.
   - If already `paid`, returns 200 (idempotent).
   - Else updates the row to `paid`, calls `grant_paid_credits(...)`, and stores `stripe_payment_intent_id`.
6. User is redirected to `/billing?purchase={id}`, which polls for the row to flip to `paid` and then shows a toast and new balance.

Refunds: a `charge.refunded` webhook flips the purchase to `refunded` and calls `refund_paid_credits(...)`. If the user's `paid_credits` would go negative, it is clamped at zero and a note is added to the ledger entry; the operator can reconcile manually.

## 10. Application surface

### Routes

- `/` — existing landing page, anonymous, with a **Try with sample** CTA that loads the bundled `sample-fa3-invoice.xml`. Real uploads on this page redirect to `/login` with a return target.
- `/login` — magic link request form. Email-only. On submit, sends a Supabase OTP email and shows "check your inbox" state.
- `/auth/callback` — handles the magic-link redirect, sets the session, redirects to `/app`.
- `/app` — main workspace. The current `app/page.tsx` workspace section, lifted out and behind auth. Header shows balance chip `1 free · 35 paid`. Uploading consumes a credit (atomic — see §8).
- `/app/history` — list of past invoices (table with date, number, currency, gross, languages translated, actions). Each row can be reopened (free re-translate, free PDF download).
- `/billing` — current balance, slider purchase widget, list of purchases with Stripe receipt links, last 50 ledger entries.
- `/account` — email, display name, locale (PL/EN), logout. Future: delete account.
- `/legal/terms`, `/legal/privacy` — required for Stripe and GDPR.

### API routes (server)

- `POST /api/upload` — auth required, rate-limited 10/min/user. Single entry point for both XML and PDF (current client-side XML parsing in `app/page.tsx` is moved server-side so credit consumption cannot be bypassed). Flow inside a single transaction: (1) compute `source_hash`, (2) look up `invoices` by `(user_id, source_hash)` — if it exists, return the existing row without consuming a credit, (3) otherwise pre-check that `free_credits_remaining + paid_credits >= 1`, refusing with HTTP 402 if not, (4) detect type and parse via `parseKsefXml` or the PDF parser, (5) insert the new `invoices` row, (6) call `consume_credit`. If parsing fails after the pre-check, no credit is consumed because step 6 only runs after a successful insert. Steps 2–6 run in one DB transaction to prevent races where two parallel uploads of the same file double-charge.
- `POST /api/translate` — auth required. Uses cached translation if `(invoice_id, language, bilingual)` already exists. Free — no credit consumed here.
- `POST /api/pdf` — auth required. Free.
- `POST /api/stripe/checkout` — auth required. Creates pending purchase + Stripe session.
- `POST /api/stripe/webhook` — public endpoint, signature-verified. Idempotent.
- `GET /api/me/balance` — auth required, returns current balances (no SSR drift).

### Server actions

- `uploadInvoice(formData)` — thin wrapper around `/api/upload` for use in React Server Component flows.
- `requestMagicLink(email)` — used by `/login`.
- `signOut()` — clears session.

## 11. Frontend UX

The landing page keeps its current PL/EN copy and structure. New surface added:

- **Balance chip** in the authenticated header, with a tiny popover that breaks down `free_credits_remaining`, `paid_credits`, and next free refresh date.
- **Insufficient-credit modal**: appears when a user attempts to upload with zero combined credits. Shows the slider directly in the modal so the user can buy without leaving the workspace.
- **Slider widget** (`components/billing/credit-slider.tsx`): horizontal Tailwind range input with custom thumb, live tier indicator, "Total €X.XX (€Y.YY/invoice)" panel, "Best value" badge on the 50+ tier.
- **History table**: dense, sortable, with a per-row dropdown menu (Open · Re-translate · Download last PDF · Delete).
- **Empty states** that match the current marketing tone — friendly, technical, no emojis.

Visual direction: stay with the current cyan/slate palette and shadcn-style primitives so the new pages feel native. Implementation will be done with the `frontend-design:frontend-design` skill so the final polish is distinctive rather than generic-AI.

Localisation: PL/EN already exists in `app/page.tsx`. Lift the `copy` object into `lib/i18n/copy.ts` so new screens can reuse the same dictionary.

## 12. Security

- Magic link only — no passwords stored. Supabase enforces per-email throttling; add an extra IP-based limit on `/api/auth/magic-link` (5 req / 10 min) using Vercel's edge config or Upstash Redis.
- RLS on every table. Service-role key only used in server code, never exposed to the client.
- All Stripe webhook calls verified with `stripe.webhooks.constructEvent` and `STRIPE_WEBHOOK_SECRET`.
- Pricing is recomputed server-side from a single source of truth; the client never tells the server how much to charge.
- File size limit: 10 MB per upload, enforced at the API route boundary.
- Per-user rate limits: `upload` 10/min, `translate` 20/min, `pdf` 30/min.
- OpenAI key, Stripe secret, Supabase service role: env-only, validated at server boot.
- Stored invoice data (`source_data`, `translated_data`) contains business PII (VAT IDs, addresses). RLS is the primary defence. Add an option to delete an invoice on the history page; a "delete my account" action cascades and purges all rows. Supabase backups still hold deleted data for the standard retention period — call this out in the privacy policy.
- Logs: never log raw invoice bodies, only `invoice_id` + warnings.

## 13. Observability

- Server logs structured via `pino` (already common with Next.js). One log line per credit event, one per Stripe webhook, one per failed parse.
- Supabase dashboards: track `auth.users` growth, `stripe_purchases.paid` per day, `credit_ledger` event counts.
- Sentry on the Next.js app for unhandled errors (optional in phase 1).

## 14. Phasing

Each phase ends with a deployable, demoable state.

1. **Foundation** — Supabase project, schema, RLS, magic-link auth, profile bootstrap trigger, protected route layout. Landing page still works anonymously.
2. **Workspace behind auth** — move existing parse/translate/pdf flow under `/app`. Add `invoices` and `translations` persistence. No quota enforcement yet.
3. **Credits & enforcement** — `credit_balances`, `credit_ledger`, SQL functions, free grant on signup, `consume_credit` wired into `/api/parse-pdf`. Insufficient-credit modal.
4. **Stripe purchases** — pricing module, slider widget, Checkout session endpoint, webhook handler, `/billing` page, purchase history.
5. **History page** — `/app/history` list view, reopen action, free re-translate, delete.
6. **UX polish + i18n lift** — `frontend-design` pass over `/app`, `/billing`, `/history`; lift `copy` to `lib/i18n`; balance chip in header; PL/EN parity for the new screens.
7. **Hardening** — rate limits, Sentry, account deletion, legal pages, Stripe Tax verification.

## 15. Open questions

These are not blockers but should be answered before launch:

- Final pricing ladder and currency mix (EUR only, or EUR + PLN).
- Whether the landing page should reveal the new SaaS pricing (replacing the current Starter/Business/Enterprise marketing tiers with the slider preview).
- Account-level GDPR retention window for deleted invoices.
- Whether to issue VAT-compliant invoices for the SaaS purchases themselves (likely yes for EU B2B; Stripe Tax + Stripe Invoicing covers this).
- Cap on `package_size`: 100 is a slider ceiling, but should there be a daily purchase cap to deter card-testing abuse?

## 16. Non-goals

- Team accounts, shared credit pools, org billing.
- Subscriptions or auto-top-up.
- Direct KSeF API integration.
- Invoice issuance, accounting, ERP features.
- Mobile apps.
- API access for third-party integrations.
