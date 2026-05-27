# Stripe → KSeF Integration: Research & Architectural Options

**Date:** 2026-05-26
**Status:** Research / pre-spec — implementation plan to follow after architecture decision
**Owner:** Jakub
**Urgency:** ⚠️ **Legally mandatory NOW** (since 1 April 2026 for all non-large taxpayers); penalty for missed KSeF submission is up to **100% of the VAT amount**.

---

## TL;DR

The company is already legally required to issue KSeF-compliant faktury for every Polish B2B sale (since 1 April 2026). Today's Stripe Checkout setup is **not compliant** — it generates Stripe-native invoices that don't reach KSeF.

Three viable architectures, ordered by recommendation:

1. **Fakturownia + their native Stripe app** (~10 PLN/mo, ~10h dev) — Fakturownia handles KSeF auth, FA(3) XML, status polling, korekty on refunds. **Recommended.**
2. **Stripto.pl as a zero-code bridge over Fakturownia** (~79 PLN/mo at scale, 30min setup) — same backend, less of our own code.
3. **Direct KSeF API integration** (~6–10 dev-weeks, ongoing maintenance) — overkill for our volume.

A 4th option exists: **Merchant of Record (Paddle / Lemon Squeezy / Freemius)** outsources the entire VAT + KSeF + tax-residency problem in exchange for a ~5% revenue cut. Worth considering only if we want to fully step out of Polish tax compliance.

---

## 1. The legal headline

| | Date | Who |
|---|---|---|
| KSeF 1.0 voluntary | 2022–2024 | Volunteers |
| KSeF 1.0 shut down | 1 Feb 2026 | — |
| KSeF 2.0 mandatory (large) | 1 Feb 2026 | Sales >200M PLN in 2024 |
| **KSeF 2.0 mandatory (everyone else)** | **1 Apr 2026** | **Us** |
| Smallest firms phase-in | 1 Jan 2027 | Monthly sales ≤10k PLN |

Legal basis: Ustawa z dnia 5 sierpnia 2025 r. (Dz. U. 2025 poz. 1203). The Ministry of Finance has said it won't penalize **technical good-faith failures** during the rollout — but the obligation itself stands. Once mandate kicks in for our tier, every B2B faktura must go through KSeF.

For B2C (consumer) sales without a NIP, KSeF is voluntary — see §4.

## 2. Current state of our Stripe integration

`app/api/stripe/checkout/route.ts` today:

```ts
automatic_tax: { enabled: true },            // Stripe Tax computes VAT ✓
invoice_creation: { enabled: true, ... },    // Stripe issues its OWN invoice ✗ not KSeF-compliant
// tax_id_collection: missing                // ✗ no NIP captured
// billing_address_collection: missing       // ✗ no company address
```

`app/api/stripe/webhook/route.ts` today: handles `checkout.session.completed` (grant credits) and `charge.refunded` (refund credits). No KSeF call.

**Gap:** we collect no business identity at checkout, and no faktura ever reaches KSeF. Every paying Polish business customer puts us out of compliance.

## 3. Architectural options compared

### A. Direct KSeF API integration

Build everything ourselves: XAdES signing with a qualified seal, FA(3) XML mapping, async session + invoice + status polling, korekta flow, AES-256-CBC encryption of invoice payloads, JWT auth with refresh, rate-limit handling.

| Pros | Cons |
|---|---|
| Full control | 125–230h initial dev work |
| No middleman fee | 10–20h/quarter ongoing as MF iterates the API |
| Single source of truth | Must own JPK_V7 export + audit posture separately |
| Reuses our existing parser/translator knowledge | Cert procurement + rotation, sandbox/prod env management |
| | No mature Node SDK; build atop generated OpenAPI client |

**Verdict:** overkill for our volume. Reconsider only if we cross ~5–10k invoices/mo or have a strategic reason to own the regulatory surface.

### B. Polish invoicing SaaS as the KSeF backend (Fakturownia / inFakt / wFirma)

We keep Stripe as the payment + customer-data system of record. On `checkout.session.completed`, we call the SaaS API (e.g., Fakturownia) to create a faktura with `gov_save_and_send: true` — the SaaS handles KSeF auth, FA(3), status polling, and korekty.

**Recommended provider: Fakturownia.pl**

- ~9.99 PLN/mo (Start plan), unlimited invoices, **API + KSeF + DEMO env included**
- REST/JSON API at [github.com/fakturownia/API](https://github.com/fakturownia/API) — well-documented, open
- **First-party native Stripe app** at [pomoc.fakturownia.pl/integracja-fakturowni-ze-stripe](https://pomoc.fakturownia.pl/integracja-fakturowni-ze-stripe-automatyczne-fakturowanie-platnosci) — auto-registers a Stripe webhook, generates faktura/paragon per payment, flushes to KSeF
- Response fields: `gov_status` (`ok|processing|send_error`), `gov_id`, `gov_send_date`, `gov_verification_link`, `gov_error_messages[]`
- Corrections via `kind: "correction"` + `invoice_id` of original — auto-link parent KSeF number
- Multi-currency (PLN/EUR/USD), bilingual PL/EN PDF templates, JPK_VAT export, direct accountant share

Alternatives ranked: **Fakturownia 23/25 > inFakt 20/25 > wFirma 15/25 > iFirma 14/25**. Comarch/Symfonia priced for enterprise — wrong fit. FakturaXL has XML-only API + harsh rate limits — skip.

| Pros | Cons |
|---|---|
| ~10 PLN/mo + ~10h initial dev | Vendor lock-in (mitigated: thin adapter pattern) |
| Fakturownia owns regulatory upkeep | If Fakturownia is down, our invoicing is down |
| Built-in B2B/B2C routing by NIP presence | No native TypeScript SDK (build a 50-line wrapper) |
| Native Stripe webhook auto-registration | No explicit `idempotency_key` (dedup via our DB) |
| Korekta on refunds is one API call | |

**Verdict:** best fit for a 1–2 person SaaS at our volume.

### C. Stripe → KSeF middleware (Stripto, Striptu, Striplo, S2K, KSeFSync)

Zero-code bridge. Paste Stripe + Fakturownia/inFakt/wFirma keys into the middleware's dashboard. Webhook → middleware → backend SaaS → KSeF. We never write the glue.

| Service | Pricing | KSeF backends | Notes |
|---|---|---|---|
| [Stripto.pl](https://stripto.pl) | Mini 19 PLN/mo (25 inv), Pro 79 PLN/mo (1k inv) | Fakturownia, inFakt, wFirma | Built-in idempotency; full Stripe Checkout/Billing/PaymentLinks |
| [Striptu.com](https://striptu.com) | 49 PLN/mo (or 490 PLN/yr) | Fakturownia, inFakt, wFirma, iFirma; direct KSeF | Newer, broader backend list |
| [Billio.pl](https://billio.pl) | Hidden pricing | Fakturownia, inFakt | Newer entrant |
| [S2K](https://s2ksef.com) | Hidden pricing | Direct KSeF | Skips invoicing SaaS layer |
| [KSeFSync.pl](https://ksefsync.pl) | Hidden pricing | Direct KSeF | Smaller |

**Verdict:** good for true zero-code shops. At our volume (~100 inv/mo) Fakturownia alone costs ~10 PLN/mo vs Stripto Mini at 19 PLN/mo — but Stripto saves ~10 dev-hours. Worth ~9 PLN/mo if our time is more expensive than the markup.

### D. Merchant of Record (MoR) — out-of-scope but worth naming

Paddle, Lemon Squeezy, Freemius, Gumroad become the **legal seller of record** for our digital product. They pay the VAT/sales tax in every jurisdiction (incl. issuing KSeF faktury for PL B2B), then remit to us minus a fee (~5%).

| Pros | Cons |
|---|---|
| Zero tax compliance work, ever | ~5% of revenue forever |
| Zero KSeF code | We can't fully control the buyer relationship |
| Handles VAT in 50+ jurisdictions | Refunds + fraud chargebacks via the MoR's policies |
| Built-in fraud + chargeback handling | Customer sees "Paddle, Inc." on their statement, not us |

**Verdict:** revisit if we expand globally (US + EU + UK + AU) and the per-jurisdiction tax overhead becomes unmanageable. For PL-focused now, the 5% fee outweighs the benefit.

## 4. Recommended architecture: hybrid Fakturownia bridge

```
Stripe Checkout
  │ enable: tax_id_collection { required: "if_supported" }
  │         billing_address_collection: "required"
  │         customer_creation: "always"
  │ disable: invoice_creation (Fakturownia issues the legal doc)
  ▼
Stripe webhook /api/stripe/webhook
  │ - verify signature
  │ - persist event.id (idempotency)
  │ - enqueue Trigger.dev / Inngest job
  │ - return 200 fast
  ▼
Background job: faktura issuance
  │ branch on customer.tax_ids:
  │   ├─ has pl_nip or eu_vat starting PL → B2B faktura
  │   │  POST fakturownia /invoices.json
  │   │       { gov_save_and_send: true, kind: "vat" }
  │   │       → returns invoice_id + gov_status=processing
  │   └─ no NIP → B2C faktura
  │      POST fakturownia /invoices.json
  │           { gov_save_and_send: false, kind: "vat_with_consumer" }
  │      (KSeF voluntary for B2C; we can flip to true if we want)
  ▼
Status polling job (every ~30s for ~5min, then back off)
  │ GET fakturownia /invoices/{id}
  │ When gov_status flips to "ok", persist gov_id (KSeF number) on our row
  ▼
Refund flow (charge.refunded)
  │ Look up our row → wait for parent gov_id if still processing
  │ POST fakturownia /invoices.json
  │      { kind: "correction", invoice_id: <original>, gov_save_and_send: true }
  ▼
Customer receives PDF (Fakturownia auto-emails OR we link from /billing)
```

### Why hybrid (not pure-Fakturownia-app)

Fakturownia has a native "paste Stripe keys → done" app. But:
- We lose control over **when** the faktura issues (Fakturownia decides) — relevant for our credit-pack purchases where we want issuance gated on our own webhook processing (e.g., abuse-cap checks, idempotency)
- Our credit-grant logic in the webhook already needs to run; better to keep one webhook entry point and call Fakturownia from there

So: use Fakturownia's **API**, not its **Stripe app**. Same backend, our code owns the orchestration.

### Stripe-side changes required

In `app/api/stripe/checkout/route.ts`:

```ts
const session = await stripe.checkout.sessions.create({
  // ... existing
  tax_id_collection: {
    enabled: true,
    required: "if_supported"           // forces NIP entry in PL
  },
  billing_address_collection: "required",
  customer_creation: "always",
  // REMOVE invoice_creation — Fakturownia issues the legal doc now
  // invoice_creation: { enabled: true, ... },  ← delete
  // keep automatic_tax for the VAT calc
  automatic_tax: { enabled: true }
});
```

### New Fakturownia adapter

`lib/billing/fakturownia-client.ts` (~150 lines):

```ts
export interface IssueFakturaParams {
  stripeSessionId: string;       // our idempotency key
  customer: {
    name: string;                // business_name or full name
    nip?: string;                // raw 10-digit PL NIP, or null
    euVat?: string;              // "PL1234567890" or "DE..."
    email: string;
    address: { street, city, postal_code, country };
  };
  items: Array<{ name, quantity, unit_price_net, vat_rate, currency }>;
  documentDate: string;          // YYYY-MM-DD
}

export interface FakturaResult {
  fakturowniaId: string;
  govStatus: "processing" | "ok" | "send_error";
  govId?: string;                // KSeF reference number (after acceptance)
  pdfUrl: string;
}

export async function issueFaktura(p: IssueFakturaParams): Promise<FakturaResult>
export async function getFakturaStatus(id: string): Promise<FakturaResult>
export async function issueKorekta(originalId: string, refundAmount: number): Promise<FakturaResult>
```

### New database table

`fakturownia_invoices`:
- `id uuid primary key`
- `stripe_purchase_id uuid references stripe_purchases(id)`
- `fakturownia_id text unique`
- `gov_status text` ('processing' | 'ok' | 'send_error')
- `gov_id text` (KSeF number, null until accepted)
- `pdf_url text`
- `kind text` ('vat' | 'correction')
- `parent_id uuid references fakturownia_invoices(id)` for korekty
- `created_at timestamptz`
- `updated_at timestamptz`

### Webhook handler update

`app/api/stripe/webhook/route.ts` adds two paths:

```ts
if (event.type === "checkout.session.completed") {
  await handleCheckoutCompleted(admin, session);
  // NEW: enqueue Fakturownia faktura issuance
  await enqueueIssueFaktura({ purchaseId, sessionId: session.id });
}

if (event.type === "charge.refunded") {
  await handleChargeRefunded(admin, charge);
  // NEW: enqueue korekta
  await enqueueIssueKorekta({ purchaseId });
}
```

### Background queue

Recommended: **Trigger.dev v3** (free tier sufficient; first-party Stripe webhook recipe; runs on Vercel). Alternative: Inngest. Avoid BullMQ (Redis) for our scale.

## 5. Open decisions before implementation

1. **B2C policy** — do we issue Polish "faktura dla osoby fizycznej" for non-NIP customers, or just rely on Stripe's receipt? Issuing voluntarily is cleaner; not issuing is simpler. (Recommendation: issue, mark `gov_save_and_send: false`, send PDF anyway. Standard Polish e-commerce practice.)

2. **NIP required vs optional at Checkout?** `required: "if_supported"` forces NIP entry for PL customers, optional elsewhere. Or `required: false` lets anyone skip. Required is the safer compliance posture; optional is the more friendly UX. (Recommendation: `required: "if_supported"`.)

3. **Multi-language faktura PDF** — Fakturownia supports bilingual PL/EN templates. Since we sell to Polish business customers primarily, default to PL with EN as a customer-pref toggle. Or always bilingual? (Recommendation: bilingual by default — fits the brand.)

4. **EU customers** — `eu_vat` starting with non-PL (e.g., `DE123456789`). Stripe Tax applies reverse charge (0% PL VAT, buyer settles in destination). Fakturownia FA(3) needs `P_12 = "np II"` + `P_18 = 1` (reverse charge flag) + buyer's EU VAT-ID. Fakturownia handles this when we set `kind: "vat_eu"` or similar — confirm in their docs during impl.

5. **Non-EU customers** — Stripe applies 0%. Faktura is "eksport usług" — different KSeF code. Need to handle three customer brackets: PL B2B, EU B2B, non-EU.

6. **Bilingual support** — we already do invoice translation as our core product; do we use that capability to render bilingual faktury for our own customers, or rely on Fakturownia's templates? (Recommendation: use Fakturownia's templates — separation of concerns; our translator product handles other people's invoices, not ours.)

7. **Buy a qualified electronic seal NOW** — even with Fakturownia, the company NIP needs to authorize Fakturownia to issue KSeF invoices on its behalf. This requires a one-time visit to [ksef.mf.gov.pl](https://ksef.mf.gov.pl/) and granting Fakturownia the `InvoiceWrite` permission. Some accountant-class providers can do this for us. Cost: ~300 PLN/yr for the seal (from Asseco/KIR/EuroCert).

## 6. Decision matrix

| Criterion | A: DIY direct | **B: Fakturownia API (recommended)** | C: Stripto bridge | D: Merchant of Record |
|---|---|---|---|---|
| Initial dev time | 125–230h | **~10h** | ~30min | 0h (pricing integration only) |
| Monthly cost | 0 | **~10 PLN + Trigger.dev free** | ~79 PLN (Pro) | ~5% of revenue |
| Maintenance burden | High | **Low** | None | None |
| Lock-in risk | None | Medium (adapter pattern mitigates) | High | High |
| Control over flow | Full | **High** | Low | None |
| Compliance liability | Ours | **Shared (Fakturownia signs)** | Shared | MoR's |
| Speed to launch | 6–10 weeks | **~1 week** | Same day | Same day |
| Fits if we hit 10k inv/mo? | Yes | Yes | Yes (their Pro+) | Yes |
| Fits if we expand globally? | Hard | Hard | Hard | **Best** |

## 7. Sources

Consolidated from three parallel research passes. Full reports in:
- KSeF API mandate + technical specs
- Stripe→KSeF architectural patterns
- Polish invoicing SaaS comparison

Key URLs:
- [KSeF mandate dates (Ministry of Finance)](https://ksef.podatki.gov.pl/etapy-wdrozenia-ksef/)
- [KSeF OpenAPI 2.0](https://github.com/CIRFMF/ksef-api)
- [FA(3) schema info sheet](https://ksef.podatki.gov.pl/media/4u1bmhx4/information-sheet-on-the-fa-3-logical-structure.pdf)
- [Fakturownia API](https://github.com/fakturownia/API)
- [Fakturownia Stripe integration guide](https://pomoc.fakturownia.pl/integracja-fakturowni-ze-stripe-automatyczne-fakturowanie-platnosci)
- [Stripe tax IDs in Checkout](https://docs.stripe.com/tax/checkout/tax-ids)
- [Stripe PL NIP changelog](https://docs.stripe.com/changelog/clover/2026-01-28/polish-nip-tax-id-type)
- [Stripto.pl developer docs](https://stripto.pl/ksef-dla-programistow)
- [Trigger.dev webhook recipes](https://trigger.dev/docs/guides/frameworks/webhooks-guides-overview)
- [Freemius: why MoR may beat DIY](https://freemius.com/poland-ksef-stripe-saas-billing-compliance/)

## 8. Recommended next step

1. **You decide:** A vs B vs C vs D. I recommend **B (Fakturownia API)**.
2. **You decide:** the 7 open questions in §5.
3. Then I'll write a detailed implementation plan (`docs/superpowers/plans/2026-05-26-stripe-ksef-bridge.md`) with TDD-style task breakdown, and we execute it via subagent-driven development.

Bonus: **the company should register on Fakturownia + procure a qualified electronic seal in parallel with development** — it's a 1-week procurement lead time and is on the critical path.
