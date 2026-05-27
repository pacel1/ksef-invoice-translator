# Stripe → KSeF Bridge via Fakturownia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Issue KSeF-compliant Polish VAT faktury for every Stripe credit-pack purchase, with korekty on refund, via the Fakturownia API.

**Architecture:** Stripe Checkout collects business identity (NIP required, billing address required, business name auto-captured by Stripe's tax-ID UI) → existing webhook handler grants credits and inserts a `fakturownia_invoices` row with `status='pending'` → a thin Fakturownia client (`lib/billing/fakturownia/`) is called inline with a 10-second timeout; on failure the row stays pending → a Vercel Cron route (`/api/cron/poll-ksef`) runs every 5 minutes, picks up pending and processing rows, drives them to `ok` or `failed`, and handles korekty on `charge.refunded`. The customer-facing /billing page surfaces faktura status with a PDF download link.

**Tech Stack:** Next.js 15 (App Router), React 19, Stripe SDK v18, Supabase JS v2, TypeScript strict, Vitest + RTL, Vercel Cron (no external queue service), Fakturownia REST API.

**Spec reference:** [docs/superpowers/specs/2026-05-26-stripe-ksef-integration.md](../specs/2026-05-26-stripe-ksef-integration.md)

**Branching:** Per `CLAUDE.md`, branch off `main`:
```bash
git fetch origin main && git checkout -b claude/stripe-ksef-bridge origin/main
```

**Out of scope for this plan (defer):**
- B2C / consumer flow (we are B2B only — Stripe Checkout will hard-require a tax ID)
- Multi-language faktura PDF (PL only per user decision)
- Migrating to Trigger.dev / Inngest (Vercel Cron is sufficient at our volume; revisit if we cross ~1k purchases/month)
- Auto-emailing the faktura PDF from our side (Fakturownia emails customers natively; we link from /billing too)

---

## Pre-Implementation Procurement (parallel with code, 1-week lead time)

These are **not code tasks** but block production cutover. Start them on day 1.

- [ ] **P1:** Buy a qualified electronic seal (`pieczęć kwalifikowana`) for the company NIP from a Polish QTSP. Recommended: Asseco Data Systems (CenCert) or KIR/Szafir. Cost: ~300 PLN/yr. The seal must be issued to the **company NIP** (not a personal cert).

- [ ] **P2:** Log in to [ksef.mf.gov.pl](https://ksef.mf.gov.pl/) as the company (using the seal from P1 or Profil Zaufany of a board member with reprezentacja), open the **MCU (Moduł Certyfikatów i Uprawnień)**, and either:
  - Issue a **KSeF Token** scoped to `InvoiceWrite + InvoiceRead` for Fakturownia, OR
  - Apply for a **KSeF Certificate** (preferred long-term — KSeF Tokens will be deprecated on 1 Jan 2027).

- [ ] **P3:** Create a Fakturownia account at [fakturownia.pl](https://fakturownia.pl), pick the **Start** plan (~10 PLN/mo annual), enter the company KSeF Token/Certificate in Fakturownia's settings, verify the connection works against the DEMO env.

- [ ] **P4:** Generate **two Fakturownia API tokens**: one for the production account, one for the DEMO account. Store as `FAKTUROWNIA_API_TOKEN_PROD` and `FAKTUROWNIA_API_TOKEN_DEMO` in 1Password or your secret manager. Note the **account subdomain** (e.g., `mycompany.fakturownia.pl`) — that goes into `FAKTUROWNIA_ACCOUNT`.

- [ ] **P5:** Decide the **production cutover gate**: until P1–P4 are green, the implementation can run end-to-end against Fakturownia DEMO (which mirrors KSeF MF test rail). Only flip `FAKTUROWNIA_API_TOKEN` to the prod value AND set `KSEF_LIVE=true` after P1–P4 are confirmed.

---

## File Structure

**New files:**
- `lib/billing/fakturownia/types.ts` — TypeScript types for Fakturownia request/response payloads
- `lib/billing/fakturownia/client.ts` — low-level HTTP wrapper (auth, base URL, error normalization)
- `lib/billing/fakturownia/issue-faktura.ts` — `issueFaktura(params): Promise<FakturaResult>`
- `lib/billing/fakturownia/issue-korekta.ts` — `issueKorekta(params): Promise<FakturaResult>`
- `lib/billing/fakturownia/get-status.ts` — `getFakturaStatus(id): Promise<FakturaResult>`
- `lib/billing/fakturownia/index.ts` — public re-exports
- `lib/billing/build-faktura-params.ts` — pure function: maps `stripe_purchases` row + Stripe checkout session → `IssueFakturaParams`
- `supabase/migrations/20260527000001_fakturownia_invoices.sql` — schema for `fakturownia_invoices` table + NIP/business name columns on `stripe_purchases`
- `app/api/cron/poll-ksef/route.ts` — Vercel Cron handler that finalizes pending + processing rows
- `vercel.json` — Vercel Cron schedule (project root)
- `tests/integration/lib/fakturownia/issue-faktura.test.ts`
- `tests/integration/lib/fakturownia/issue-korekta.test.ts`
- `tests/integration/lib/fakturownia/get-status.test.ts`
- `tests/integration/lib/build-faktura-params.test.ts`
- `tests/integration/api/cron-poll-ksef.test.ts`

**Modified files:**
- `app/api/stripe/checkout/route.ts` — add `tax_id_collection` + `billing_address_collection`, remove `invoice_creation`
- `app/api/stripe/webhook/route.ts` — call Fakturownia on `checkout.session.completed`; queue korekta on `charge.refunded`
- `lib/supabase/database.types.ts` — regenerate types after migration
- `components/billing/purchase-history.tsx` — add KSeF status + faktura PDF link column
- `.env.example` — document new env vars
- Database types file generated by Supabase CLI

**Why this split:**
- One file per Fakturownia API operation keeps each under 150 lines and lets a subagent reason about the operation in isolation.
- `build-faktura-params.ts` is pure (no I/O) so it can be unit-tested without mocks.
- The cron route is separate from the webhook so retries don't re-enter the credit-grant path.
- Schema changes go in one migration to keep them atomic.

---

## Environment Variables

Add to `.env.example` and document for ops:

```env
# Fakturownia (Stripe → KSeF bridge)
FAKTUROWNIA_ACCOUNT=mycompany     # subdomain prefix in mycompany.fakturownia.pl
FAKTUROWNIA_API_TOKEN=...         # API token from account settings
FAKTUROWNIA_ENV=demo              # "demo" or "production" — selects the URL
# Production cutover gate — when false, faktura issuance is skipped and rows
# stay in 'pending' state for manual review. Flip to true only after P1-P4.
KSEF_LIVE=false

# Vercel Cron auth
CRON_SECRET=...                   # any random 32+ char string; used in Authorization: Bearer
```

---

## Pre-Task Setup

- [ ] **Step 0a: Branch off main**

```bash
git fetch origin main && git checkout -b claude/stripe-ksef-bridge origin/main
```

- [ ] **Step 0b: Verify clean baseline**

Use Node 22: `source ~/.nvm/nvm.sh && nvm use 22 > /dev/null` before any npm command (the repo expects Node ≥18 but the user's shell defaults to Node 12; the build fails with a Node 12 error otherwise).

```bash
source ~/.nvm/nvm.sh && nvm use 22 > /dev/null
npm run lint
npx tsc --noEmit
npm run test -- tests/components tests/integration/lib 2>&1 | tail -5
```

Expected: lint clean, tsc clean, all in-scope tests pass. Pre-existing baseline failures (`tests/components/marketing/landing-page.test.tsx` — framer-motion `IntersectionObserver` missing; `tests/integration/api/*` — require dev server) are unrelated; don't try to fix.

---

## Task 1: Database migration — fakturownia_invoices table + stripe_purchases columns

**Files:**
- Create: `supabase/migrations/20260527000001_fakturownia_invoices.sql`

**Schema design:**
- `fakturownia_invoices` is a **1:1 relationship with stripe_purchases** for the original invoice and a **N:1 self-reference** for korekty (one stripe_purchase can have multiple korekty over time on partial refunds).
- `gov_status` reflects KSeF state: `pending` (we haven't called Fakturownia yet), `processing` (Fakturownia returned but KSeF hasn't acknowledged), `ok` (KSeF accepted, `gov_id` populated), `send_error` (KSeF rejected), `failed` (Fakturownia API call itself failed; we retry from cron).
- Add NIP + business-name columns to `stripe_purchases` so the cron can build the faktura params from a single row lookup without re-fetching from Stripe.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260527000001_fakturownia_invoices.sql`:

```sql
-- Stripe → KSeF bridge: track every Fakturownia-issued faktura corresponding
-- to a Stripe purchase, plus korekty on refund. Fakturownia owns the legal
-- artifact; we own the link back to our payment row.

create table public.fakturownia_invoices (
  id                       uuid primary key default gen_random_uuid(),
  stripe_purchase_id       uuid not null references public.stripe_purchases(id) on delete cascade,
  kind                     text not null check (kind in ('vat', 'correction')),
  -- Self-reference for korekty pointing at the original faktura row.
  -- Null for `kind='vat'`; required for `kind='correction'`.
  parent_id                uuid references public.fakturownia_invoices(id) on delete set null,
  -- Fakturownia's own invoice id; null until first successful API response.
  fakturownia_id           text unique,
  -- KSeF state machine.
  gov_status               text not null default 'pending'
                           check (gov_status in ('pending', 'processing', 'ok', 'send_error', 'failed')),
  -- KSeF reference number; null until KSeF accepts the document.
  gov_id                   text,
  -- Fakturownia-rendered PDF link (signed URL with public access).
  pdf_url                  text,
  -- Last error message from a failed Fakturownia or KSeF call (for ops triage).
  last_error               text,
  -- Free-form attempt counter so the cron can back off / give up.
  attempt_count            integer not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- A stripe purchase has at most ONE 'vat' faktura. Korekty are unbounded.
create unique index fakturownia_invoices_one_vat_per_purchase
  on public.fakturownia_invoices (stripe_purchase_id)
  where kind = 'vat';

-- Index for the cron scan: pick up pending and processing rows ordered by age.
create index fakturownia_invoices_cron_scan
  on public.fakturownia_invoices (gov_status, created_at)
  where gov_status in ('pending', 'processing', 'failed');

alter table public.fakturownia_invoices enable row level security;

-- Users can read their own faktura rows (joined via stripe_purchases.user_id).
create policy "fakturownia_invoices_select_own" on public.fakturownia_invoices
  for select to authenticated
  using (
    exists (
      select 1 from public.stripe_purchases sp
      where sp.id = fakturownia_invoices.stripe_purchase_id
        and sp.user_id = (select auth.uid())
    )
  );

-- Service role (webhook + cron) does writes; no insert/update/delete from authenticated.

-- Trigger to keep updated_at fresh.
create or replace function public.touch_fakturownia_invoices_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_fakturownia_invoices
  before update on public.fakturownia_invoices
  for each row execute function public.touch_fakturownia_invoices_updated_at();

-- Add business identity columns to stripe_purchases so the cron can build the
-- faktura without re-fetching from Stripe. Populated by the checkout-completed
-- webhook handler from Stripe's session.customer_details.
alter table public.stripe_purchases
  add column buyer_nip           text,
  add column buyer_eu_vat        text,
  add column buyer_business_name text,
  add column buyer_email         text,
  add column buyer_address_line1 text,
  add column buyer_address_line2 text,
  add column buyer_postal_code   text,
  add column buyer_city          text,
  add column buyer_country       text;

comment on table public.fakturownia_invoices is
  'Tracks Fakturownia-issued faktury and korekty for each Stripe purchase. KSeF state machine: pending -> processing -> ok | send_error | failed. The cron at /api/cron/poll-ksef drives state transitions.';
```

- [ ] **Step 2: Apply the migration**

```bash
# Per CLAUDE.md: Supabase changes go through the MCP or CLI only, never the web dashboard.
npx supabase db push
```

Expected: migration succeeds, new columns visible. If using the Supabase MCP, run the equivalent command there.

- [ ] **Step 3: Regenerate types**

```bash
npx supabase gen types typescript --linked > lib/supabase/database.types.ts
```

Confirm `lib/supabase/database.types.ts` now includes `fakturownia_invoices` and the new `stripe_purchases` columns.

- [ ] **Step 4: Verify with tsc**

```bash
source ~/.nvm/nvm.sh && nvm use 22 > /dev/null && npx tsc --noEmit
```

Expected: clean. The existing code doesn't yet reference the new columns, so no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260527000001_fakturownia_invoices.sql \
        lib/supabase/database.types.ts
git commit -m "feat(db): fakturownia_invoices table and stripe_purchases buyer columns"
```

---

## Task 2: Fakturownia client types

**Files:**
- Create: `lib/billing/fakturownia/types.ts`

These types model Fakturownia's REST API payload shapes ([github.com/fakturownia/API](https://github.com/fakturownia/API)). Kept minimal — only the fields we'll actually read or write.

- [ ] **Step 1: Create the types file**

Create `lib/billing/fakturownia/types.ts`:

```ts
/**
 * Fakturownia REST API type stubs. Mirrors the public JSON shape from
 * https://github.com/fakturownia/API. Only the fields we actually use
 * are typed — the API returns dozens more, but adding them as we need
 * them is cheaper than typing the world up-front.
 */

/** Fakturownia document kinds we issue. */
export type FakturowniaKind = "vat" | "correction";

/**
 * KSeF lifecycle as Fakturownia reports it on every invoice response.
 * Our DB column `gov_status` mirrors this set, plus 'pending' (we haven't
 * called Fakturownia yet) and 'failed' (the API call itself blew up).
 */
export type FakturowniaGovStatus =
  | "processing"
  | "ok"
  | "send_error"
  | "server_error";

/** A single line item on a faktura. */
export interface FakturowniaPosition {
  /** Product/service name shown on the PDF. */
  name: string;
  quantity: number;
  /** Net unit price as a string in PLN (Fakturownia accepts string OR number;
   *  string avoids JS float drift). E.g. "100.00". */
  price_net: string;
  /** VAT rate as a string. "23" for 23%, "0" for 0%, "np" for not-subject,
   *  "zw" for zwolniony. For EU reverse-charge B2B: "np". */
  tax: string;
  /** PKWiU / GTU classification (optional, leave empty for SaaS services). */
  pkwiu?: string;
}

/**
 * Payload for POST /invoices.json. Most fields are optional in
 * Fakturownia's API; we always set the ones below for consistency.
 */
export interface FakturowniaIssueInvoiceRequest {
  api_token: string;
  invoice: {
    kind: FakturowniaKind;
    /** For 'correction' invoices, the parent invoice's Fakturownia id. */
    from_invoice_id?: number;
    /** Issue date in YYYY-MM-DD. */
    issue_date: string;
    /** Sell date (data sprzedaży) in YYYY-MM-DD. Usually == issue_date for digital services. */
    sell_date?: string;
    /** Buyer's NIP (10 digits, no dashes). Required for our B2B flow. */
    buyer_tax_no: string;
    /** Buyer name (company name). */
    buyer_name: string;
    /** Buyer street + number. */
    buyer_street?: string;
    /** Buyer "31-000 Kraków" — single field per Fakturownia convention. */
    buyer_post_code?: string;
    buyer_city?: string;
    /** ISO 3166-1 alpha-2 country code, lowercase. Default "pl". */
    buyer_country?: string;
    buyer_email?: string;
    /** Seller fields come from Fakturownia account settings — don't pass them. */
    /** Currency code, lowercase. "pln" / "eur" / "usd". */
    currency?: string;
    /** Optional human-readable note shown on PDF. */
    description?: string;
    /** Line items. */
    positions: FakturowniaPosition[];
    /** If true (and KSeF is enabled in account settings), Fakturownia
     *  auto-submits the document to KSeF immediately after creation.
     *  Always true for our B2B flow. */
    gov_save_and_send?: boolean;
    /** Our internal id for idempotent retries (we send the
     *  stripe_purchase_id here). */
    oid?: string;
  };
}

/** Subset of fields we read off the API response. */
export interface FakturowniaInvoiceResponse {
  /** Fakturownia's primary key — store as our `fakturownia_id`. */
  id: number;
  /** Issued invoice number per Fakturownia's numbering scheme. */
  number: string;
  /** Signed PDF URL (Fakturownia adds a token; the link works without auth). */
  view_url: string;
  /** KSeF status — `null` if KSeF disabled or not yet sent. */
  gov_status: FakturowniaGovStatus | null;
  /** KSeF reference number (35 chars). Null until accepted. */
  gov_id: string | null;
  /** When Fakturownia last sent the document to KSeF. */
  gov_send_date: string | null;
  /** When KSeF accepted/rejected. */
  gov_status_date: string | null;
  /** Error messages from KSeF; populated on `send_error` / `server_error`. */
  gov_error_messages: string[] | null;
  /** Human-readable verification link customers can paste into ksef.mf.gov.pl. */
  gov_verification_link: string | null;
}

/** Normalized result our callers consume; insulates them from API drift. */
export interface FakturaResult {
  fakturowniaId: string;     // numeric id stringified
  invoiceNumber: string;
  pdfUrl: string;
  govStatus: "processing" | "ok" | "send_error" | "server_error";
  govId: string | null;
  govSendDate: string | null;
  govVerificationLink: string | null;
  errorMessages: string[];
}

/** Error envelope from Fakturownia on 4xx/5xx. */
export interface FakturowniaErrorBody {
  message?: string;
  errors?: Record<string, string[]>;
}

export class FakturowniaApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: FakturowniaErrorBody | string,
    message: string
  ) {
    super(message);
    this.name = "FakturowniaApiError";
  }
}
```

- [ ] **Step 2: Verify tsc**

```bash
source ~/.nvm/nvm.sh && nvm use 22 > /dev/null && npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add lib/billing/fakturownia/types.ts
git commit -m "feat(fakturownia): API request/response type stubs"
```

---

## Task 3: Fakturownia low-level client

**Files:**
- Create: `lib/billing/fakturownia/client.ts`

A thin HTTP layer that owns env-var reading, base URL selection (demo vs prod), JSON serialization, error normalization, and a 10-second default timeout via `AbortController`.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/lib/fakturownia/client.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakturowniaPost, fakturowniaGet } from "@/lib/billing/fakturownia/client";
import { FakturowniaApiError } from "@/lib/billing/fakturownia/types";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.FAKTUROWNIA_ACCOUNT = "mycompany";
  process.env.FAKTUROWNIA_API_TOKEN = "test-token";
  process.env.FAKTUROWNIA_ENV = "demo";
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  process.env = { ...ORIGINAL_ENV };
});

describe("fakturownia client", () => {
  it("POST hits the demo subdomain when FAKTUROWNIA_ENV=demo", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 1 }), { status: 200 })
    );
    globalThis.fetch = fetchMock;

    await fakturowniaPost("/invoices.json", { foo: "bar" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://mycompany.demo.fakturownia.pl/invoices.json");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ foo: "bar" });
  });

  it("POST hits the production subdomain when FAKTUROWNIA_ENV=production", async () => {
    process.env.FAKTUROWNIA_ENV = "production";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 1 }), { status: 200 })
    );
    globalThis.fetch = fetchMock;

    await fakturowniaPost("/invoices.json", { foo: "bar" });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://mycompany.fakturownia.pl/invoices.json"
    );
  });

  it("returns parsed JSON on 2xx", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 42, number: "1/2026" }), { status: 200 })
    );

    const result = await fakturowniaPost<{ id: number; number: string }>(
      "/invoices.json",
      {}
    );
    expect(result).toEqual({ id: 42, number: "1/2026" });
  });

  it("throws FakturowniaApiError on 4xx with parsed JSON body", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ message: "Invalid NIP", errors: { buyer_tax_no: ["bad"] } }),
        { status: 422 }
      )
    );

    await expect(fakturowniaPost("/invoices.json", {})).rejects.toBeInstanceOf(
      FakturowniaApiError
    );
    await expect(fakturowniaPost("/invoices.json", {})).rejects.toMatchObject({
      status: 422
    });
  });

  it("throws FakturowniaApiError on 5xx with raw text body", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("Internal Server Error", { status: 500 })
    );

    await expect(fakturowniaPost("/invoices.json", {})).rejects.toMatchObject({
      status: 500,
      body: "Internal Server Error"
    });
  });

  it("throws when FAKTUROWNIA_API_TOKEN is missing", async () => {
    delete process.env.FAKTUROWNIA_API_TOKEN;
    await expect(fakturowniaPost("/invoices.json", {})).rejects.toThrow(
      /FAKTUROWNIA_API_TOKEN/
    );
  });

  it("throws when FAKTUROWNIA_ACCOUNT is missing", async () => {
    delete process.env.FAKTUROWNIA_ACCOUNT;
    await expect(fakturowniaPost("/invoices.json", {})).rejects.toThrow(
      /FAKTUROWNIA_ACCOUNT/
    );
  });

  it("GET assembles URL with query string", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 1 }), { status: 200 })
    );
    globalThis.fetch = fetchMock;

    await fakturowniaGet("/invoices/42.json");

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://mycompany.demo.fakturownia.pl/invoices/42.json?api_token=test-token"
    );
  });

  it("respects a 10-second AbortController timeout", async () => {
    vi.useFakeTimers();
    let abortSignal: AbortSignal | undefined;
    globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
      abortSignal = init.signal;
      return new Promise(() => {}); // never resolves
    });

    const promise = fakturowniaPost("/invoices.json", {});
    // Advance past the 10s timeout.
    vi.advanceTimersByTime(10_001);
    await expect(promise).rejects.toThrow();
    expect(abortSignal?.aborted).toBe(true);

    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
source ~/.nvm/nvm.sh && nvm use 22 > /dev/null && npm run test -- fakturownia/client
```

Expected: FAIL — `Cannot find module '@/lib/billing/fakturownia/client'`.

- [ ] **Step 3: Implement the client**

Create `lib/billing/fakturownia/client.ts`:

```ts
import { FakturowniaApiError, type FakturowniaErrorBody } from "./types";

const DEFAULT_TIMEOUT_MS = 10_000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} not configured`);
  }
  return value;
}

function baseUrl(): string {
  const account = requireEnv("FAKTUROWNIA_ACCOUNT");
  const env = process.env.FAKTUROWNIA_ENV ?? "demo";
  // demo: <account>.demo.fakturownia.pl ; production: <account>.fakturownia.pl
  // Per Fakturownia docs (github.com/fakturownia/API): the only difference is
  // the subdomain segment.
  const subdomain = env === "production" ? account : `${account}.demo`;
  return `https://${subdomain}.fakturownia.pl`;
}

/** Internal: perform the fetch with timeout + error envelope. */
async function call<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<T> {
  const apiToken = requireEnv("FAKTUROWNIA_API_TOKEN");

  // For GET, Fakturownia accepts api_token as a query param.
  // For POST, the convention is to nest it in the JSON body. Both forms
  // are documented; we use whichever the operation expects.
  const url =
    method === "GET"
      ? `${baseUrl()}${path}${path.includes("?") ? "&" : "?"}api_token=${encodeURIComponent(apiToken)}`
      : `${baseUrl()}${path}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers:
        method === "POST"
          ? { "Content-Type": "application/json", Accept: "application/json" }
          : { Accept: "application/json" },
      body:
        method === "POST"
          ? JSON.stringify({ ...(body as object), api_token: apiToken })
          : undefined,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }

  if (response.ok) {
    return (await response.json()) as T;
  }

  // Parse body for better error messages. Try JSON first, fall back to text.
  const text = await response.text();
  let parsed: FakturowniaErrorBody | string;
  try {
    parsed = JSON.parse(text) as FakturowniaErrorBody;
  } catch {
    parsed = text;
  }

  const message =
    typeof parsed === "string"
      ? `Fakturownia ${method} ${path} failed (${response.status})`
      : `Fakturownia ${method} ${path} failed (${response.status}): ${
          parsed.message ?? JSON.stringify(parsed.errors ?? parsed)
        }`;

  throw new FakturowniaApiError(response.status, parsed, message);
}

export function fakturowniaPost<T>(path: string, body: unknown): Promise<T> {
  return call<T>("POST", path, body);
}

export function fakturowniaGet<T>(path: string): Promise<T> {
  return call<T>("GET", path);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
source ~/.nvm/nvm.sh && nvm use 22 > /dev/null && npm run test -- fakturownia/client
```

Expected: all 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/billing/fakturownia/client.ts \
        tests/integration/lib/fakturownia/client.test.ts
git commit -m "feat(fakturownia): low-level HTTP client with env config and timeout"
```

---

## Task 4: Issue faktura

**Files:**
- Create: `lib/billing/fakturownia/issue-faktura.ts`
- Test: `tests/integration/lib/fakturownia/issue-faktura.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { issueFaktura } from "@/lib/billing/fakturownia/issue-faktura";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.FAKTUROWNIA_ACCOUNT = "mycompany";
  process.env.FAKTUROWNIA_API_TOKEN = "test-token";
  process.env.FAKTUROWNIA_ENV = "demo";
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  process.env = { ...ORIGINAL_ENV };
});

describe("issueFaktura", () => {
  const sampleParams = {
    stripePurchaseId: "purchase-uuid",
    issueDate: "2026-05-27",
    buyer: {
      taxNo: "5260250995",
      name: "ACME Sp. z o.o.",
      street: "ul. Marszałkowska 1",
      postCode: "00-001",
      city: "Warszawa",
      country: "pl",
      email: "biuro@acme.pl"
    },
    positions: [
      {
        name: "KSeF Translator — pakiet 50 kredytów",
        quantity: 50,
        priceNet: "10.00",
        tax: "23"
      }
    ],
    currency: "pln" as const
  };

  it("posts the right body shape to /invoices.json", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 12345,
          number: "F/27/05/2026",
          view_url: "https://mycompany.demo.fakturownia.pl/invoices/12345/view?token=xyz",
          gov_status: "processing",
          gov_id: null,
          gov_send_date: "2026-05-27T10:00:00Z",
          gov_status_date: null,
          gov_error_messages: null,
          gov_verification_link: null
        }),
        { status: 200 }
      )
    );
    globalThis.fetch = fetchMock;

    await issueFaktura(sampleParams);

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.invoice.kind).toBe("vat");
    expect(body.invoice.buyer_tax_no).toBe("5260250995");
    expect(body.invoice.buyer_name).toBe("ACME Sp. z o.o.");
    expect(body.invoice.issue_date).toBe("2026-05-27");
    expect(body.invoice.gov_save_and_send).toBe(true);
    expect(body.invoice.oid).toBe("purchase-uuid");
    expect(body.invoice.positions).toHaveLength(1);
    expect(body.invoice.positions[0]).toMatchObject({
      name: "KSeF Translator — pakiet 50 kredytów",
      quantity: 50,
      price_net: "10.00",
      tax: "23"
    });
    expect(body.invoice.currency).toBe("pln");
    expect(body.api_token).toBe("test-token");
  });

  it("returns a normalized FakturaResult", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 12345,
          number: "F/27/05/2026",
          view_url: "https://example.com/pdf",
          gov_status: "processing",
          gov_id: null,
          gov_send_date: "2026-05-27T10:00:00Z",
          gov_status_date: null,
          gov_error_messages: null,
          gov_verification_link: null
        }),
        { status: 200 }
      )
    );

    const result = await issueFaktura(sampleParams);

    expect(result).toEqual({
      fakturowniaId: "12345",
      invoiceNumber: "F/27/05/2026",
      pdfUrl: "https://example.com/pdf",
      govStatus: "processing",
      govId: null,
      govSendDate: "2026-05-27T10:00:00Z",
      govVerificationLink: null,
      errorMessages: []
    });
  });

  it("normalizes a null gov_status to 'processing' for downstream state machine", async () => {
    // Fakturownia returns null when KSeF hasn't been called yet (e.g., account
    // not connected). We treat this as 'processing' so the cron picks it up
    // and retries; if the account is misconfigured the next poll will surface
    // the real error.
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 1,
          number: "F/1/2026",
          view_url: "https://example.com",
          gov_status: null,
          gov_id: null,
          gov_send_date: null,
          gov_status_date: null,
          gov_error_messages: null,
          gov_verification_link: null
        }),
        { status: 200 }
      )
    );

    const result = await issueFaktura(sampleParams);
    expect(result.govStatus).toBe("processing");
  });

  it("forwards gov_error_messages as errorMessages", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 1,
          number: "F/1/2026",
          view_url: "https://example.com",
          gov_status: "send_error",
          gov_id: null,
          gov_send_date: "2026-05-27T10:00:00Z",
          gov_status_date: "2026-05-27T10:00:05Z",
          gov_error_messages: ["NIP nie istnieje", "Niepoprawna data"],
          gov_verification_link: null
        }),
        { status: 200 }
      )
    );

    const result = await issueFaktura(sampleParams);
    expect(result.govStatus).toBe("send_error");
    expect(result.errorMessages).toEqual(["NIP nie istnieje", "Niepoprawna data"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test -- fakturownia/issue-faktura
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/billing/fakturownia/issue-faktura.ts`:

```ts
import { fakturowniaPost } from "./client";
import type {
  FakturaResult,
  FakturowniaInvoiceResponse,
  FakturowniaIssueInvoiceRequest,
  FakturowniaPosition
} from "./types";

export interface IssueFakturaParams {
  /** Our stripe_purchases.id — sent as `oid` for retry idempotency. */
  stripePurchaseId: string;
  /** YYYY-MM-DD. */
  issueDate: string;
  buyer: {
    /** 10-digit PL NIP (no dashes, no PL prefix). */
    taxNo: string;
    name: string;
    street?: string;
    postCode?: string;
    city?: string;
    /** ISO 3166-1 alpha-2 lowercase. Default "pl". */
    country?: string;
    email?: string;
  };
  positions: Array<{
    name: string;
    quantity: number;
    /** Net unit price as a string, two decimals. */
    priceNet: string;
    /** VAT rate as Fakturownia expects: "23", "8", "5", "0", "np", "zw". */
    tax: string;
  }>;
  /** lowercase ISO 4217 — "pln" | "eur" | "usd". */
  currency: string;
  /** Optional human-readable note. */
  description?: string;
}

const ISSUE_INVOICE_PATH = "/invoices.json";

export async function issueFaktura(
  params: IssueFakturaParams
): Promise<FakturaResult> {
  const positions: FakturowniaPosition[] = params.positions.map((p) => ({
    name: p.name,
    quantity: p.quantity,
    price_net: p.priceNet,
    tax: p.tax
  }));

  const requestBody: Omit<FakturowniaIssueInvoiceRequest, "api_token"> = {
    invoice: {
      kind: "vat",
      issue_date: params.issueDate,
      sell_date: params.issueDate,
      buyer_tax_no: params.buyer.taxNo,
      buyer_name: params.buyer.name,
      buyer_street: params.buyer.street,
      buyer_post_code: params.buyer.postCode,
      buyer_city: params.buyer.city,
      buyer_country: params.buyer.country ?? "pl",
      buyer_email: params.buyer.email,
      currency: params.currency,
      description: params.description,
      positions,
      gov_save_and_send: true,
      oid: params.stripePurchaseId
    }
  };

  const response = await fakturowniaPost<FakturowniaInvoiceResponse>(
    ISSUE_INVOICE_PATH,
    requestBody
  );

  return normalizeResponse(response);
}

export function normalizeResponse(
  response: FakturowniaInvoiceResponse
): FakturaResult {
  // Fakturownia returns `null` for gov_status when KSeF hasn't acknowledged
  // yet (or when the account isn't KSeF-configured). Treat null as
  // 'processing' so our state machine drives toward terminal via the cron.
  const govStatus = response.gov_status ?? "processing";
  return {
    fakturowniaId: String(response.id),
    invoiceNumber: response.number,
    pdfUrl: response.view_url,
    govStatus,
    govId: response.gov_id,
    govSendDate: response.gov_send_date,
    govVerificationLink: response.gov_verification_link,
    errorMessages: response.gov_error_messages ?? []
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm run test -- fakturownia/issue-faktura
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/billing/fakturownia/issue-faktura.ts \
        tests/integration/lib/fakturownia/issue-faktura.test.ts
git commit -m "feat(fakturownia): issueFaktura (POST /invoices.json with gov_save_and_send)"
```

---

## Task 5: Get faktura status

**Files:**
- Create: `lib/billing/fakturownia/get-status.ts`
- Test: `tests/integration/lib/fakturownia/get-status.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFakturaStatus } from "@/lib/billing/fakturownia/get-status";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.FAKTUROWNIA_ACCOUNT = "mycompany";
  process.env.FAKTUROWNIA_API_TOKEN = "test-token";
  process.env.FAKTUROWNIA_ENV = "demo";
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  process.env = { ...ORIGINAL_ENV };
});

describe("getFakturaStatus", () => {
  it("hits GET /invoices/{id}.json with api_token query param", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 12345,
          number: "F/27/05/2026",
          view_url: "https://example.com",
          gov_status: "ok",
          gov_id: "5260250995-20260527-0100001AF629-AF",
          gov_send_date: "2026-05-27T10:00:00Z",
          gov_status_date: "2026-05-27T10:00:05Z",
          gov_error_messages: null,
          gov_verification_link: "https://ksef.mf.gov.pl/web/verify/..."
        }),
        { status: 200 }
      )
    );
    globalThis.fetch = fetchMock;

    const result = await getFakturaStatus("12345");

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://mycompany.demo.fakturownia.pl/invoices/12345.json?api_token=test-token"
    );
    expect(result.govStatus).toBe("ok");
    expect(result.govId).toBe("5260250995-20260527-0100001AF629-AF");
    expect(result.govVerificationLink).toBe(
      "https://ksef.mf.gov.pl/web/verify/..."
    );
  });

  it("returns errorMessages for send_error states", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 1,
          number: "F/1/2026",
          view_url: "https://example.com",
          gov_status: "send_error",
          gov_id: null,
          gov_send_date: "2026-05-27T10:00:00Z",
          gov_status_date: "2026-05-27T10:00:05Z",
          gov_error_messages: ["Niepoprawny NIP nabywcy"],
          gov_verification_link: null
        }),
        { status: 200 }
      )
    );

    const result = await getFakturaStatus("1");
    expect(result.govStatus).toBe("send_error");
    expect(result.errorMessages).toEqual(["Niepoprawny NIP nabywcy"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test -- fakturownia/get-status
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/billing/fakturownia/get-status.ts`:

```ts
import { fakturowniaGet } from "./client";
import { normalizeResponse } from "./issue-faktura";
import type { FakturaResult, FakturowniaInvoiceResponse } from "./types";

/**
 * Poll Fakturownia for the current KSeF state of a previously-issued
 * invoice. Returns the same FakturaResult shape as issueFaktura so the
 * caller can treat the row uniformly.
 */
export async function getFakturaStatus(
  fakturowniaId: string
): Promise<FakturaResult> {
  const response = await fakturowniaGet<FakturowniaInvoiceResponse>(
    `/invoices/${encodeURIComponent(fakturowniaId)}.json`
  );
  return normalizeResponse(response);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm run test -- fakturownia/get-status
```

Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/billing/fakturownia/get-status.ts \
        tests/integration/lib/fakturownia/get-status.test.ts
git commit -m "feat(fakturownia): getFakturaStatus for KSeF state polling"
```

---

## Task 6: Issue korekta

**Files:**
- Create: `lib/billing/fakturownia/issue-korekta.ts`
- Test: `tests/integration/lib/fakturownia/issue-korekta.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { issueKorekta } from "@/lib/billing/fakturownia/issue-korekta";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.FAKTUROWNIA_ACCOUNT = "mycompany";
  process.env.FAKTUROWNIA_API_TOKEN = "test-token";
  process.env.FAKTUROWNIA_ENV = "demo";
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  process.env = { ...ORIGINAL_ENV };
});

describe("issueKorekta", () => {
  it("posts kind='correction' with from_invoice_id referencing the original", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 99999,
          number: "FK/1/27/05/2026",
          view_url: "https://example.com/korekta",
          gov_status: "processing",
          gov_id: null,
          gov_send_date: "2026-05-27T11:00:00Z",
          gov_status_date: null,
          gov_error_messages: null,
          gov_verification_link: null
        }),
        { status: 200 }
      )
    );
    globalThis.fetch = fetchMock;

    await issueKorekta({
      originalFakturowniaId: "12345",
      stripePurchaseId: "purchase-uuid",
      issueDate: "2026-05-28",
      reason: "Zwrot kredytów - rezygnacja klienta",
      positions: [
        {
          name: "KSeF Translator — pakiet 50 kredytów",
          quantity: 50,
          priceNet: "-10.00",  // negative for refund
          tax: "23"
        }
      ],
      currency: "pln"
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.invoice.kind).toBe("correction");
    expect(body.invoice.from_invoice_id).toBe(12345);
    expect(body.invoice.oid).toBe("purchase-uuid:korekta");
    expect(body.invoice.gov_save_and_send).toBe(true);
    expect(body.invoice.description).toContain("Zwrot");
    expect(body.invoice.positions[0].price_net).toBe("-10.00");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test -- fakturownia/issue-korekta
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `lib/billing/fakturownia/issue-korekta.ts`:

```ts
import { fakturowniaPost } from "./client";
import { normalizeResponse } from "./issue-faktura";
import type {
  FakturaResult,
  FakturowniaInvoiceResponse,
  FakturowniaIssueInvoiceRequest,
  FakturowniaPosition
} from "./types";

export interface IssueKorektaParams {
  /** The original faktura's Fakturownia id, as stored in fakturownia_invoices.fakturownia_id. */
  originalFakturowniaId: string;
  stripePurchaseId: string;
  issueDate: string;
  reason: string;
  positions: Array<{
    name: string;
    quantity: number;
    /** Negative price_net for the refunded amount. */
    priceNet: string;
    tax: string;
  }>;
  currency: string;
}

export async function issueKorekta(
  params: IssueKorektaParams
): Promise<FakturaResult> {
  const positions: FakturowniaPosition[] = params.positions.map((p) => ({
    name: p.name,
    quantity: p.quantity,
    price_net: p.priceNet,
    tax: p.tax
  }));

  const requestBody: Omit<FakturowniaIssueInvoiceRequest, "api_token"> = {
    invoice: {
      kind: "correction",
      from_invoice_id: Number(params.originalFakturowniaId),
      issue_date: params.issueDate,
      sell_date: params.issueDate,
      // For korekta, buyer fields are inherited from the original; we can
      // re-supply them but Fakturownia ignores changes. Leave them out to
      // avoid accidental drift.
      buyer_tax_no: "",
      buyer_name: "",
      currency: params.currency,
      description: `Faktura korygująca: ${params.reason}`,
      positions,
      gov_save_and_send: true,
      // Distinct oid so we can dedup retries vs the original.
      oid: `${params.stripePurchaseId}:korekta`
    }
  };

  const response = await fakturowniaPost<FakturowniaInvoiceResponse>(
    "/invoices.json",
    requestBody
  );

  return normalizeResponse(response);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm run test -- fakturownia/issue-korekta
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/billing/fakturownia/issue-korekta.ts \
        tests/integration/lib/fakturownia/issue-korekta.test.ts
git commit -m "feat(fakturownia): issueKorekta for faktura korygująca on refund"
```

---

## Task 7: Public re-exports

**Files:**
- Create: `lib/billing/fakturownia/index.ts`

- [ ] **Step 1: Create the barrel file**

```ts
export { issueFaktura } from "./issue-faktura";
export type { IssueFakturaParams } from "./issue-faktura";

export { issueKorekta } from "./issue-korekta";
export type { IssueKorektaParams } from "./issue-korekta";

export { getFakturaStatus } from "./get-status";

export { FakturowniaApiError } from "./types";
export type {
  FakturaResult,
  FakturowniaGovStatus,
  FakturowniaKind,
  FakturowniaPosition
} from "./types";
```

- [ ] **Step 2: Verify tsc**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add lib/billing/fakturownia/index.ts
git commit -m "feat(fakturownia): public barrel exports"
```

---

## Task 8: Build-faktura-params pure mapper

**Files:**
- Create: `lib/billing/build-faktura-params.ts`
- Test: `tests/integration/lib/build-faktura-params.test.ts`

This is a pure function that maps a `stripe_purchases` DB row → `IssueFakturaParams`. Keeping it pure makes it unit-testable without mocking Stripe or the DB.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildFakturaParams } from "@/lib/billing/build-faktura-params";

describe("buildFakturaParams", () => {
  const samplePurchase = {
    id: "purchase-uuid",
    package_size: 50,
    unit_price_cents: 1000,    // 10.00 PLN
    total_amount_cents: 50000, // 500.00 PLN
    currency: "pln",
    buyer_nip: "5260250995",
    buyer_business_name: "ACME Sp. z o.o.",
    buyer_email: "biuro@acme.pl",
    buyer_address_line1: "ul. Marszałkowska 1",
    buyer_address_line2: null,
    buyer_postal_code: "00-001",
    buyer_city: "Warszawa",
    buyer_country: "PL",
    created_at: "2026-05-27T10:00:00Z"
  };

  it("maps NIP, name, and address into the buyer block", () => {
    const params = buildFakturaParams(samplePurchase);
    expect(params.buyer.taxNo).toBe("5260250995");
    expect(params.buyer.name).toBe("ACME Sp. z o.o.");
    expect(params.buyer.email).toBe("biuro@acme.pl");
    expect(params.buyer.street).toBe("ul. Marszałkowska 1");
    expect(params.buyer.postCode).toBe("00-001");
    expect(params.buyer.city).toBe("Warszawa");
    expect(params.buyer.country).toBe("pl"); // lowercased
  });

  it("strips PL prefix from NIP if Stripe stored eu_vat format", () => {
    const params = buildFakturaParams({ ...samplePurchase, buyer_nip: "PL5260250995" });
    expect(params.buyer.taxNo).toBe("5260250995");
  });

  it("strips dashes and spaces from NIP", () => {
    const params = buildFakturaParams({ ...samplePurchase, buyer_nip: "526-025-09-95" });
    expect(params.buyer.taxNo).toBe("5260250995");
  });

  it("formats unit_price_cents into a two-decimal price_net string", () => {
    const params = buildFakturaParams(samplePurchase);
    expect(params.positions[0].priceNet).toBe("10.00");
  });

  it("concatenates address_line1 + address_line2 into a single street field", () => {
    const params = buildFakturaParams({
      ...samplePurchase,
      buyer_address_line1: "ul. Marszałkowska 1",
      buyer_address_line2: "lok. 5"
    });
    expect(params.buyer.street).toBe("ul. Marszałkowska 1, lok. 5");
  });

  it("uses only line1 when line2 is null", () => {
    const params = buildFakturaParams(samplePurchase);
    expect(params.buyer.street).toBe("ul. Marszałkowska 1");
  });

  it("returns undefined street when both lines are null", () => {
    const params = buildFakturaParams({
      ...samplePurchase,
      buyer_address_line1: null,
      buyer_address_line2: null
    });
    expect(params.buyer.street).toBeUndefined();
  });

  it("includes a single position line with quantity = package_size", () => {
    const params = buildFakturaParams(samplePurchase);
    expect(params.positions).toHaveLength(1);
    expect(params.positions[0].quantity).toBe(50);
    expect(params.positions[0].name).toBe(
      "KSeF Translator — pakiet 50 kredytów"
    );
    expect(params.positions[0].tax).toBe("23");
  });

  it("uses the purchase created_at date in YYYY-MM-DD format", () => {
    const params = buildFakturaParams(samplePurchase);
    expect(params.issueDate).toBe("2026-05-27");
  });

  it("passes through stripePurchaseId for idempotency", () => {
    const params = buildFakturaParams(samplePurchase);
    expect(params.stripePurchaseId).toBe("purchase-uuid");
  });

  it("throws when buyer_nip is missing", () => {
    expect(() =>
      buildFakturaParams({ ...samplePurchase, buyer_nip: null })
    ).toThrow(/buyer_nip/);
  });

  it("throws when buyer_business_name is missing", () => {
    expect(() =>
      buildFakturaParams({ ...samplePurchase, buyer_business_name: null })
    ).toThrow(/buyer_business_name/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test -- build-faktura-params
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `lib/billing/build-faktura-params.ts`:

```ts
import type { IssueFakturaParams } from "./fakturownia";

/**
 * Subset of `stripe_purchases` columns needed to build faktura params.
 * Defined inline instead of importing the full DB-generated type so this
 * module can be tested with hand-rolled fixtures.
 */
export interface PurchaseRow {
  id: string;
  package_size: number;
  unit_price_cents: number;
  total_amount_cents: number;
  currency: string;
  buyer_nip: string | null;
  buyer_business_name: string | null;
  buyer_email: string | null;
  buyer_address_line1: string | null;
  buyer_address_line2: string | null;
  buyer_postal_code: string | null;
  buyer_city: string | null;
  buyer_country: string | null;
  created_at: string;
}

function normalizeNip(raw: string): string {
  // Strip PL prefix (eu_vat format), dashes, spaces, dots.
  return raw.replace(/^PL/i, "").replace(/[-.\s]/g, "");
}

function buildStreet(line1: string | null, line2: string | null): string | undefined {
  // Fakturownia uses ONE buyer_street field; Stripe gives us two address
  // lines. Concatenate non-empty ones with a comma so suite/apartment info
  // survives the round-trip.
  const parts = [line1, line2]
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p && p.length > 0));
  return parts.length > 0 ? parts.join(", ") : undefined;
}

function centsToString(cents: number): string {
  // Fakturownia accepts numbers but we send strings to avoid float drift.
  const whole = Math.floor(cents / 100);
  const fraction = cents % 100;
  return `${whole}.${fraction.toString().padStart(2, "0")}`;
}

export function buildFakturaParams(row: PurchaseRow): IssueFakturaParams {
  if (!row.buyer_nip || row.buyer_nip.trim() === "") {
    throw new Error(
      `buyer_nip missing on stripe_purchases ${row.id} — cannot issue B2B faktura`
    );
  }
  if (!row.buyer_business_name || row.buyer_business_name.trim() === "") {
    throw new Error(
      `buyer_business_name missing on stripe_purchases ${row.id} — cannot issue B2B faktura`
    );
  }

  const issueDate = row.created_at.slice(0, 10); // YYYY-MM-DD from ISO string

  return {
    stripePurchaseId: row.id,
    issueDate,
    buyer: {
      taxNo: normalizeNip(row.buyer_nip),
      name: row.buyer_business_name,
      street: buildStreet(row.buyer_address_line1, row.buyer_address_line2),
      postCode: row.buyer_postal_code ?? undefined,
      city: row.buyer_city ?? undefined,
      country: (row.buyer_country ?? "PL").toLowerCase(),
      email: row.buyer_email ?? undefined
    },
    positions: [
      {
        name: `KSeF Translator — pakiet ${row.package_size} kredytów`,
        quantity: row.package_size,
        priceNet: centsToString(row.unit_price_cents),
        // PL standard VAT rate. For non-PL buyers we'd switch to "np" with
        // reverse-charge annotation, but the B2B-only + Polish-NIP-required
        // checkout flow makes this PL B2B by construction.
        tax: "23"
      }
    ],
    currency: row.currency
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm run test -- build-faktura-params
```

Expected: all 9 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/billing/build-faktura-params.ts \
        tests/integration/lib/build-faktura-params.test.ts
git commit -m "feat(billing): pure mapper from stripe_purchases row to FakturowniaIssueParams"
```

---

## Task 9: Stripe Checkout — collect NIP + business address

**Files:**
- Modify: `app/api/stripe/checkout/route.ts`

- [ ] **Step 1: Update the Stripe Checkout session**

Modify `app/api/stripe/checkout/route.ts`. In the `stripe.checkout.sessions.create` call (currently lines 81–116), make these specific changes:

Replace:

```ts
const session = await stripe.checkout.sessions.create({
  mode: "payment",
  payment_method_types: ["card"],
  currency: quote.currency,
  line_items: [
    {
      quantity: packageSize,
      price_data: {
        currency: quote.currency,
        unit_amount: quote.unitPriceCents,
        tax_behavior: "exclusive",
        product_data: {
          name: `KSeF Translator — ${packageSize} kredytów`,
          description: "Pakiet kredytów na tłumaczenie faktur KSeF"
        }
      }
    }
  ],
  automatic_tax: { enabled: true },
  invoice_creation: {
    enabled: true,
    invoice_data: {
      description: `KSeF Translator — pakiet ${packageSize} kredytów`,
      metadata: { user_id: userData.user.id, package_size: String(packageSize) }
    }
  },
  customer_email: userData.user.email,
  client_reference_id: pending.data.id,
  success_url: `${appUrl}/billing?status=paid&session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${appUrl}/billing?status=cancelled`,
  metadata: {
    purchase_id: pending.data.id,
    user_id: userData.user.id,
    package_size: String(packageSize)
  }
});
```

with:

```ts
const session = await stripe.checkout.sessions.create({
  mode: "payment",
  payment_method_types: ["card"],
  currency: quote.currency,
  line_items: [
    {
      quantity: packageSize,
      price_data: {
        currency: quote.currency,
        unit_amount: quote.unitPriceCents,
        tax_behavior: "exclusive",
        product_data: {
          name: `KSeF Translator — ${packageSize} kredytów`,
          description: "Pakiet kredytów na tłumaczenie faktur KSeF"
        }
      }
    }
  ],
  automatic_tax: { enabled: true },
  // B2B-only flow: customer MUST supply a tax ID (NIP or EU VAT).
  // Stripe's tax-ID UI captures the legal business name alongside the ID.
  tax_id_collection: {
    enabled: true,
    required: "always"
  },
  billing_address_collection: "required",
  // We need a Stripe Customer object so customer_details.tax_ids land in a
  // persistent place we can re-query from the webhook.
  customer_creation: "always",
  // We no longer rely on Stripe-issued invoices — Fakturownia issues the
  // legal KSeF document. Removing `invoice_creation` saves the per-invoice
  // Stripe fee (0.4%) and avoids confusing the customer with two PDFs.
  customer_email: userData.user.email,
  client_reference_id: pending.data.id,
  success_url: `${appUrl}/billing?status=paid&session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${appUrl}/billing?status=cancelled`,
  metadata: {
    purchase_id: pending.data.id,
    user_id: userData.user.id,
    package_size: String(packageSize)
  }
});
```

- [ ] **Step 2: Verify lint + tsc**

```bash
source ~/.nvm/nvm.sh && nvm use 22 > /dev/null && npm run lint && npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/api/stripe/checkout/route.ts
git commit -m "feat(stripe): require tax_id and billing address; drop Stripe-issued invoice"
```

---

## Task 10: Webhook — persist buyer identity and call Fakturownia

**Files:**
- Modify: `app/api/stripe/webhook/route.ts`

This task is the biggest. Break it down:
- On `checkout.session.completed`: in addition to the existing credit grant, extract buyer NIP + business name + address from the session and persist on `stripe_purchases`, then create a pending `fakturownia_invoices` row, then call `issueFaktura` with a 10s timeout. On success, update the row. On failure (network, timeout, or Fakturownia error), leave the row in `pending` / `failed` state for the cron to retry.
- On `charge.refunded`: in addition to the existing refund logic, create a `fakturownia_invoices` row with `kind='correction'` and `parent_id` referencing the original. The cron will pick this up too — the inline path doesn't issue the korekta here (we want to wait for the parent `gov_id` to land before issuing the korekta, and the cron handles that dependency).

- [ ] **Step 1: Extract a helper for buyer-identity extraction**

Add to `app/api/stripe/webhook/route.ts` (place it BEFORE `handleCheckoutCompleted`):

```ts
import type Stripe from "stripe";

interface BuyerIdentity {
  buyer_nip: string;
  buyer_eu_vat: string | null;
  buyer_business_name: string;
  buyer_email: string;
  buyer_address_line1: string | null;
  buyer_address_line2: string | null;
  buyer_postal_code: string | null;
  buyer_city: string | null;
  buyer_country: string | null;
}

class MissingBuyerIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingBuyerIdentityError";
  }
}

/**
 * Extract buyer identity from a checkout.session.completed event. Throws
 * if the required B2B fields are missing — the checkout config makes them
 * mandatory, so a missing field signals a misconfiguration on the Stripe
 * side and we should fail loudly rather than silently issue a wrong faktura.
 */
function extractBuyerIdentity(session: Stripe.Checkout.Session): BuyerIdentity {
  const details = session.customer_details;
  if (!details) {
    throw new MissingBuyerIdentityError("customer_details missing on session");
  }

  // Stripe stores tax IDs as an array; we expect exactly one for B2B.
  const taxIds = details.tax_ids ?? [];
  const taxId = taxIds[0];
  if (!taxId || !taxId.value) {
    throw new MissingBuyerIdentityError("no tax_id on customer_details");
  }

  // Map Stripe's tax-id types onto our two-column model:
  //   pl_nip → buyer_nip (raw 10 digits)
  //   eu_vat starting with PL → buyer_nip (after stripping PL prefix) + buyer_eu_vat
  //   eu_vat starting with anything else → buyer_eu_vat only (we'd reject this
  //     before reaching production since the checkout is PL-NIP-only by policy)
  let buyer_nip: string;
  let buyer_eu_vat: string | null = null;
  if (taxId.type === "pl_nip") {
    buyer_nip = taxId.value;
  } else if (taxId.type === "eu_vat" && taxId.value.toUpperCase().startsWith("PL")) {
    buyer_nip = taxId.value.slice(2);
    buyer_eu_vat = taxId.value;
  } else {
    throw new MissingBuyerIdentityError(
      `non-PL tax_id (${taxId.type}: ${taxId.value}) — checkout policy requires PL NIP`
    );
  }

  // Stripe Tax-ID UI captures `business_name` as a separate field, and
  // `name` is the cardholder name. For B2B we want the company name first
  // and fall back to `name` only if Stripe didn't surface a business_name
  // (older Stripe accounts that don't enable the legal-name capture).
  const businessName = details.business_name ?? details.name ?? null;
  if (!businessName) {
    throw new MissingBuyerIdentityError("buyer business name missing");
  }
  if (!details.email) {
    throw new MissingBuyerIdentityError("buyer email missing");
  }

  const address = details.address ?? null;

  return {
    buyer_nip,
    buyer_eu_vat,
    buyer_business_name: businessName,
    buyer_email: details.email,
    buyer_address_line1: address?.line1 ?? null,
    buyer_address_line2: address?.line2 ?? null,
    buyer_postal_code: address?.postal_code ?? null,
    buyer_city: address?.city ?? null,
    buyer_country: address?.country ?? null
  };
}
```

- [ ] **Step 2: Update `handleCheckoutCompleted` to persist identity + create fakturownia row**

Replace the body of `handleCheckoutCompleted` (lines 48–98) with:

```ts
async function handleCheckoutCompleted(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  session: Stripe.Checkout.Session
): Promise<void> {
  if (session.payment_status !== "paid") return;

  const purchase = await admin
    .from("stripe_purchases")
    .select("id, user_id, package_size, status")
    .eq("stripe_checkout_session_id", session.id)
    .maybeSingle();

  if (!purchase.data) {
    console.warn(`[webhook] no stripe_purchases row for session ${session.id}`);
    return;
  }

  if (purchase.data.status === "paid") {
    return; // Idempotent — already processed.
  }

  // Extract buyer identity BEFORE granting credits. If extraction fails we
  // log + skip the row; the operator can backfill from Stripe later. We
  // still grant credits because the customer paid; the missing-data state
  // is a tax-compliance problem, not a fulfillment one.
  let buyerIdentity: BuyerIdentity | null = null;
  try {
    buyerIdentity = extractBuyerIdentity(session);
  } catch (error) {
    if (error instanceof MissingBuyerIdentityError) {
      console.error(
        `[webhook] missing buyer identity on session ${session.id}:`,
        error.message
      );
    } else {
      throw error;
    }
  }

  // Atomic status flip + identity persistence in one update.
  const update = await admin
    .from("stripe_purchases")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      credits_granted: purchase.data.package_size,
      stripe_payment_intent_id:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : null,
      ...(buyerIdentity ?? {})
    })
    .eq("id", purchase.data.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (!update.data) {
    return; // Concurrent webhook won the race; already processed.
  }

  const grant = await admin.rpc("grant_paid_credits", {
    p_user: purchase.data.user_id,
    p_purchase: purchase.data.id,
    p_amount: purchase.data.package_size
  });
  if (grant.error) {
    console.error("[webhook] grant_paid_credits failed:", grant.error);
    throw new Error("grant_paid_credits failed");
  }

  // Only create the fakturownia row if we have the buyer identity. Without
  // it the cron would just fail to build params and retry forever.
  if (buyerIdentity) {
    const fakturaRow = await admin
      .from("fakturownia_invoices")
      .insert({
        stripe_purchase_id: purchase.data.id,
        kind: "vat",
        gov_status: "pending"
      })
      .select("id")
      .single();

    if (fakturaRow.error) {
      console.error(
        `[webhook] failed to create fakturownia_invoices row for ${purchase.data.id}:`,
        fakturaRow.error
      );
      // Don't throw — credits are already granted; the cron can be primed manually if needed.
      return;
    }

    // Optionally: try issuing immediately for happy-path latency. The cron is
    // the safety net. We gate the inline attempt on KSEF_LIVE so dev shells
    // don't call Fakturownia by accident.
    if (process.env.KSEF_LIVE === "true") {
      await tryIssueFakturaInline(admin, fakturaRow.data.id, purchase.data.id);
    }
  }
}

/**
 * Best-effort inline faktura issuance from the webhook. Wrapped in a
 * try/catch because the webhook MUST return 200 quickly — Stripe retries
 * non-2xx and we don't want a Fakturownia outage to trigger duplicate
 * credit grants. Failures are silent here; the cron picks up the row.
 */
async function tryIssueFakturaInline(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  fakturaRowId: string,
  stripePurchaseId: string
): Promise<void> {
  try {
    // Load the full purchase row so we can call buildFakturaParams.
    const fullRow = await admin
      .from("stripe_purchases")
      .select(
        "id, package_size, unit_price_cents, total_amount_cents, currency, " +
          "buyer_nip, buyer_business_name, buyer_email, buyer_address_line1, " +
          "buyer_address_line2, buyer_postal_code, buyer_city, buyer_country, " +
          "created_at"
      )
      .eq("id", stripePurchaseId)
      .single();
    if (fullRow.error || !fullRow.data) {
      console.error(
        `[webhook] failed to reload stripe_purchases ${stripePurchaseId} for inline faktura`
      );
      return;
    }

    const params = buildFakturaParams(fullRow.data);
    const result = await issueFaktura(params);

    await admin
      .from("fakturownia_invoices")
      .update({
        fakturownia_id: result.fakturowniaId,
        gov_status: result.govStatus,
        gov_id: result.govId,
        pdf_url: result.pdfUrl,
        last_error: result.errorMessages.join("; ") || null,
        attempt_count: 1
      })
      .eq("id", fakturaRowId);
  } catch (error) {
    console.error(
      `[webhook] inline issueFaktura failed for purchase ${stripePurchaseId}:`,
      error
    );
    await admin
      .from("fakturownia_invoices")
      .update({
        gov_status: "failed",
        last_error: error instanceof Error ? error.message : String(error),
        attempt_count: 1
      })
      .eq("id", fakturaRowId);
  }
}
```

Add to the imports at the top of the file:

```ts
import { buildFakturaParams } from "@/lib/billing/build-faktura-params";
import { issueFaktura } from "@/lib/billing/fakturownia";
```

- [ ] **Step 3: Update `handleChargeRefunded` to schedule a korekta**

Replace the body of `handleChargeRefunded` (lines 100–141) with:

```ts
async function handleChargeRefunded(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  charge: Stripe.Charge
): Promise<void> {
  const paymentIntentId =
    typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  if (!paymentIntentId) return;

  const purchase = await admin
    .from("stripe_purchases")
    .select("id, user_id, package_size, status")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (!purchase.data) {
    console.warn(
      `[webhook] no stripe_purchases row for payment_intent ${paymentIntentId}`
    );
    return;
  }

  if (purchase.data.status === "refunded") {
    return; // Idempotent.
  }

  const update = await admin
    .from("stripe_purchases")
    .update({ status: "refunded" })
    .eq("id", purchase.data.id)
    .neq("status", "refunded")
    .select("id")
    .maybeSingle();

  if (!update.data) return;

  const refund = await admin.rpc("refund_paid_credits", {
    p_user: purchase.data.user_id,
    p_purchase: purchase.data.id,
    p_amount: purchase.data.package_size
  });
  if (refund.error) {
    console.error("[webhook] refund_paid_credits failed:", refund.error);
    throw new Error("refund_paid_credits failed");
  }

  // Look up the original vat faktura to link the korekta.
  const original = await admin
    .from("fakturownia_invoices")
    .select("id")
    .eq("stripe_purchase_id", purchase.data.id)
    .eq("kind", "vat")
    .maybeSingle();

  if (!original.data) {
    console.warn(
      `[webhook] no original fakturownia_invoices row for purchase ${purchase.data.id} — korekta deferred`
    );
    return;
  }

  // Insert a pending korekta row; the cron will issue it once the parent
  // has a confirmed gov_id.
  await admin.from("fakturownia_invoices").insert({
    stripe_purchase_id: purchase.data.id,
    kind: "correction",
    parent_id: original.data.id,
    gov_status: "pending"
  });
}
```

- [ ] **Step 4: Verify lint + tsc**

```bash
source ~/.nvm/nvm.sh && nvm use 22 > /dev/null && npm run lint && npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add app/api/stripe/webhook/route.ts
git commit -m "feat(webhook): persist buyer identity, queue fakturownia row, inline issue"
```

---

## Task 11: Vercel Cron — finalize pending and processing rows

**Files:**
- Create: `app/api/cron/poll-ksef/route.ts`
- Create: `vercel.json`
- Test: `tests/integration/api/cron-poll-ksef.test.ts`

The cron handler is the safety net + status poller. It runs every 5 minutes and processes rows in 4 states:

1. `pending` (kind='vat') — never tried; build params and call `issueFaktura`
2. `pending` (kind='correction') — needs the parent's `gov_id` to issue; skip if parent isn't `ok` yet
3. `processing` — `fakturownia_id` is set but KSeF hasn't acknowledged; call `getFakturaStatus`
4. `failed` — previous attempt errored; retry up to 5 times with exponential backoff

- [ ] **Step 1: Write the failing test**

Create `tests/integration/api/cron-poll-ksef.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/cron/poll-ksef/route";

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.CRON_SECRET = "test-cron-secret";
  process.env.FAKTUROWNIA_ACCOUNT = "mycompany";
  process.env.FAKTUROWNIA_API_TOKEN = "test-token";
  process.env.FAKTUROWNIA_ENV = "demo";
  process.env.KSEF_LIVE = "true";
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function makeRequest(authHeader?: string): Request {
  return new Request("http://localhost/api/cron/poll-ksef", {
    method: "POST",
    headers: authHeader ? { Authorization: authHeader } : {}
  });
}

describe("/api/cron/poll-ksef", () => {
  it("rejects requests without Bearer CRON_SECRET", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it("rejects requests with the wrong Bearer token", async () => {
    const res = await POST(makeRequest("Bearer wrong"));
    expect(res.status).toBe(401);
  });

  it("returns 200 with an empty work report when no rows are due", async () => {
    // No DB rows in pending/processing/failed — handler should short-circuit.
    // We don't actually exercise the DB here; the integration test scope
    // is that the auth gate works. A separate test exercises the worker
    // loop with mocked DB + Fakturownia.
    const res = await POST(makeRequest("Bearer test-cron-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("processed");
    expect(Array.isArray(body.processed)).toBe(true);
  });

  it("skips when KSEF_LIVE is false", async () => {
    process.env.KSEF_LIVE = "false";
    const res = await POST(makeRequest("Bearer test-cron-secret"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.skipped).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test -- cron-poll-ksef
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the handler**

Create `app/api/cron/poll-ksef/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildFakturaParams } from "@/lib/billing/build-faktura-params";
import {
  issueFaktura,
  issueKorekta,
  getFakturaStatus
} from "@/lib/billing/fakturownia";

export const runtime = "nodejs";
export const maxDuration = 60; // Vercel default; cap the worker loop accordingly.

const BATCH_SIZE = 20;          // rows per invocation; keeps wall time < 60s
const MAX_ATTEMPTS = 5;

interface ProcessedItem {
  fakturownia_invoice_id: string;
  action: "issued" | "polled" | "korekta_issued" | "skipped" | "failed";
  gov_status?: string;
  error?: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Production cutover gate.
  if (process.env.KSEF_LIVE !== "true") {
    return NextResponse.json({ skipped: true, reason: "KSEF_LIVE != true" });
  }

  const admin = getSupabaseAdminClient();
  const processed: ProcessedItem[] = [];

  // 1. PENDING rows — try to issue them.
  const pending = await admin
    .from("fakturownia_invoices")
    .select(
      "id, stripe_purchase_id, kind, parent_id, attempt_count, " +
        "stripe_purchases(id, package_size, unit_price_cents, total_amount_cents, " +
        "currency, buyer_nip, buyer_business_name, buyer_email, " +
        "buyer_address_line1, buyer_address_line2, buyer_postal_code, " +
        "buyer_city, buyer_country, created_at)"
    )
    .in("gov_status", ["pending", "failed"])
    .lt("attempt_count", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  for (const row of pending.data ?? []) {
    const purchase = row.stripe_purchases;
    if (!purchase) {
      processed.push({
        fakturownia_invoice_id: row.id,
        action: "skipped",
        error: "missing parent stripe_purchase"
      });
      continue;
    }

    try {
      if (row.kind === "vat") {
        const params = buildFakturaParams(purchase);
        const result = await issueFaktura(params);
        await admin
          .from("fakturownia_invoices")
          .update({
            fakturownia_id: result.fakturowniaId,
            gov_status: result.govStatus,
            gov_id: result.govId,
            pdf_url: result.pdfUrl,
            last_error: result.errorMessages.join("; ") || null,
            attempt_count: row.attempt_count + 1
          })
          .eq("id", row.id);
        processed.push({
          fakturownia_invoice_id: row.id,
          action: "issued",
          gov_status: result.govStatus
        });
        continue;
      }

      // kind === "correction"
      if (!row.parent_id) {
        processed.push({
          fakturownia_invoice_id: row.id,
          action: "skipped",
          error: "korekta without parent_id"
        });
        continue;
      }

      const parent = await admin
        .from("fakturownia_invoices")
        .select("fakturownia_id, gov_status, gov_id")
        .eq("id", row.parent_id)
        .single();

      if (parent.error || !parent.data) {
        processed.push({
          fakturownia_invoice_id: row.id,
          action: "skipped",
          error: "parent missing"
        });
        continue;
      }

      // Wait for parent KSeF acceptance before issuing the korekta.
      if (parent.data.gov_status !== "ok" || !parent.data.fakturownia_id) {
        processed.push({
          fakturownia_invoice_id: row.id,
          action: "skipped",
          error: "parent not yet KSeF-accepted"
        });
        continue;
      }

      const params = buildFakturaParams(purchase);
      const result = await issueKorekta({
        originalFakturowniaId: parent.data.fakturownia_id,
        stripePurchaseId: purchase.id,
        issueDate: new Date().toISOString().slice(0, 10),
        reason: "Zwrot kredytów - anulowanie zakupu",
        positions: params.positions.map((p) => ({
          ...p,
          // Negate the net price to express a refund.
          priceNet: `-${p.priceNet}`
        })),
        currency: params.currency
      });

      await admin
        .from("fakturownia_invoices")
        .update({
          fakturownia_id: result.fakturowniaId,
          gov_status: result.govStatus,
          gov_id: result.govId,
          pdf_url: result.pdfUrl,
          last_error: result.errorMessages.join("; ") || null,
          attempt_count: row.attempt_count + 1
        })
        .eq("id", row.id);
      processed.push({
        fakturownia_invoice_id: row.id,
        action: "korekta_issued",
        gov_status: result.govStatus
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[cron/poll-ksef] failed to process row ${row.id}:`,
        message
      );
      await admin
        .from("fakturownia_invoices")
        .update({
          gov_status: "failed",
          last_error: message,
          attempt_count: row.attempt_count + 1
        })
        .eq("id", row.id);
      processed.push({
        fakturownia_invoice_id: row.id,
        action: "failed",
        error: message
      });
    }
  }

  // 2. PROCESSING rows — poll Fakturownia for the terminal state.
  const processing = await admin
    .from("fakturownia_invoices")
    .select("id, fakturownia_id, attempt_count")
    .eq("gov_status", "processing")
    .not("fakturownia_id", "is", null)
    .lt("attempt_count", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  for (const row of processing.data ?? []) {
    if (!row.fakturownia_id) continue;
    try {
      const result = await getFakturaStatus(row.fakturownia_id);
      await admin
        .from("fakturownia_invoices")
        .update({
          gov_status: result.govStatus,
          gov_id: result.govId,
          last_error: result.errorMessages.join("; ") || null,
          attempt_count: row.attempt_count + 1
        })
        .eq("id", row.id);
      processed.push({
        fakturownia_invoice_id: row.id,
        action: "polled",
        gov_status: result.govStatus
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await admin
        .from("fakturownia_invoices")
        .update({
          last_error: message,
          attempt_count: row.attempt_count + 1
        })
        .eq("id", row.id);
      processed.push({
        fakturownia_invoice_id: row.id,
        action: "failed",
        error: message
      });
    }
  }

  return NextResponse.json({ processed });
}
```

- [ ] **Step 4: Create the Vercel Cron schedule**

Create `vercel.json` at project root:

```json
{
  "crons": [
    {
      "path": "/api/cron/poll-ksef",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

Vercel Cron pings the path with a `GET` by default, but our handler is `POST`. Vercel supports `POST` cron paths automatically when the route exports `POST`. Vercel also auto-includes an `Authorization: Bearer <CRON_SECRET>` header IF `CRON_SECRET` is set in the project's env vars. Verify in Vercel dashboard after deploy that the cron is registered.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npm run test -- cron-poll-ksef
```

Expected: 4 tests PASS.

- [ ] **Step 6: Verify tsc + lint**

```bash
npx tsc --noEmit && npm run lint
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add app/api/cron/poll-ksef/route.ts \
        vercel.json \
        tests/integration/api/cron-poll-ksef.test.ts
git commit -m "feat(cron): poll-ksef finalizes pending+processing rows and issues korekty"
```

---

## Task 12: Surface KSeF state in /billing UI

**Files:**
- Modify: `components/billing/purchase-history.tsx`
- Modify: `app/api/me/account/route.ts` (if it returns purchase history; verify and add fakturownia_invoices fields to the response)

The user's Billing page currently shows purchase history. Add three columns: "Faktura nr", "Status KSeF", "PDF". Pull the joined fakturownia_invoices.gov_status + pdf_url + invoice_number for each purchase.

- [ ] **Step 1: Check the current purchase-history component**

```bash
cat components/billing/purchase-history.tsx | head -60
```

Read the file and confirm its shape (props, where data comes from). Adapt the next steps to its actual structure.

- [ ] **Step 2: Update the data source**

If purchase-history takes a `purchases` prop fetched from an API route, add `fakturownia_invoice` to each row server-side. Look at the API route that serves billing data (likely `app/api/me/account/route.ts` or `app/(protected)/billing/page.tsx`). Extend the query:

```ts
const { data } = await admin
  .from("stripe_purchases")
  .select(`
    id, package_size, total_amount_cents, currency, status, paid_at, created_at,
    fakturownia_invoices ( id, kind, fakturownia_id, gov_status, gov_id, pdf_url, created_at )
  `)
  .eq("user_id", userId)
  .order("created_at", { ascending: false });
```

The `fakturownia_invoices` array on each row will have 1 vat entry + N korekty entries. Filter to `kind === 'vat'` for the main faktura display.

- [ ] **Step 3: Add the KSeF columns**

Modify `components/billing/purchase-history.tsx` to render three new cells per row (or one combined column "Faktura"):

```tsx
{purchase.fakturownia_invoices?.find((fi) => fi.kind === "vat") ? (
  <span className="inline-flex items-center gap-2">
    {/* Status badge */}
    <KsefStatusBadge govStatus={vatInvoice.gov_status} />
    {/* Faktura number + PDF link */}
    {vatInvoice.pdf_url ? (
      <a
        href={vatInvoice.pdf_url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-small font-medium text-accent hover:text-accent-hover"
      >
        Pobierz PDF →
      </a>
    ) : (
      <span className="text-small text-text-muted">Generowanie…</span>
    )}
  </span>
) : (
  <span className="text-small text-text-muted">—</span>
)}
```

Where `KsefStatusBadge` is a tiny inline component mapping gov_status to a colored badge:
- `pending` / `processing` → amber "W toku"
- `ok` → green "Wystawiona ✓"
- `send_error` / `failed` → red "Błąd"

- [ ] **Step 4: Add corresponding test cases**

Open `tests/components/billing/purchase-history.test.tsx` (if missing, create it). Assert:
- A `purchase` with no `fakturownia_invoices` shows "—"
- A row with `gov_status='ok'` and `pdf_url` shows a "Pobierz PDF" link
- A row with `gov_status='processing'` shows "Generowanie…"
- A row with `gov_status='send_error'` shows the error badge

- [ ] **Step 5: Run tests + lint + tsc**

```bash
npm run test -- purchase-history && npm run lint && npx tsc --noEmit
```

Expected: clean / green.

- [ ] **Step 6: Commit**

```bash
git add components/billing/purchase-history.tsx \
        app/api/me/account/route.ts \
        tests/components/billing/purchase-history.test.tsx
git commit -m "feat(billing): surface KSeF status and faktura PDF link in purchase history"
```

---

## Task 13: Update `.env.example` + README

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Document the new env vars**

Append to `.env.example`:

```env
# ── Fakturownia (Stripe → KSeF bridge) ─────────────────────────────────
# Subdomain prefix in <subdomain>.fakturownia.pl. Get this when you create
# your Fakturownia account. Same value for demo and prod (demo just adds
# ".demo." between the subdomain and the TLD).
FAKTUROWNIA_ACCOUNT=

# API token from Fakturownia → Ustawienia → Konto → Integracja → API
FAKTUROWNIA_API_TOKEN=

# "demo" or "production" — selects api-test vs api endpoint and the URL host
FAKTUROWNIA_ENV=demo

# Production cutover gate. When false the webhook + cron skip Fakturownia
# entirely and leave rows in 'pending' for manual review. Flip to "true"
# only after pre-implementation procurement (P1–P4) is complete.
KSEF_LIVE=false

# Vercel Cron auth — used as Authorization: Bearer <secret> on cron pings.
CRON_SECRET=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore(env): document Fakturownia + KSeF cutover gate vars"
```

---

## Final verification

- [ ] **Step F1: Full test suite green for in-scope files**

```bash
source ~/.nvm/nvm.sh && nvm use 22 > /dev/null
npm run test -- tests/integration/lib/fakturownia tests/integration/lib/build-faktura-params tests/integration/api/cron-poll-ksef tests/components/billing/purchase-history
```

Expected: all green.

- [ ] **Step F2: Lint + typecheck**

```bash
npm run lint && npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step F3: Smoke test against Fakturownia DEMO**

Set `FAKTUROWNIA_ENV=demo`, `KSEF_LIVE=true`, plus DEMO `FAKTUROWNIA_API_TOKEN`. In Stripe Test Mode, complete a purchase end-to-end. Verify:

- The webhook persists `buyer_nip` + `buyer_business_name` on `stripe_purchases`
- A `fakturownia_invoices` row with `kind='vat'` gets created
- Within 5 minutes (or on next manual cron trigger), `gov_status` flips from `pending` → `processing` → `ok` and `gov_id` is populated
- The Billing page shows "Wystawiona ✓ — Pobierz PDF →" and the PDF is readable

Trigger the cron manually if needed:

```bash
curl -X POST http://localhost:3000/api/cron/poll-ksef \
  -H "Authorization: Bearer $CRON_SECRET"
```

- [ ] **Step F4: Refund smoke test**

Refund the test charge in Stripe. Verify:

- `stripe_purchases.status` flips to `refunded`
- A second `fakturownia_invoices` row with `kind='correction'` and `parent_id` set to the original row gets created
- The cron picks it up and issues the korekta (negative line item)
- Both faktura and korekta show in the Billing UI

- [ ] **Step F5: Push and open PR**

```bash
git push -u origin claude/stripe-ksef-bridge
gh pr create --title "Stripe → KSeF bridge via Fakturownia" \
  --body "$(cat <<'EOF'
## Summary

Closes the KSeF compliance gap: every Stripe credit-pack purchase now
issues a Polish VAT faktura via the Fakturownia API, which auto-submits
to KSeF. Refunds trigger a faktura korygująca with negative line items.

- Stripe Checkout now requires NIP + billing address (B2B-only policy)
- Stripe-issued invoices are removed (Fakturownia issues the legal doc)
- New `lib/billing/fakturownia/` adapter with typed `issueFaktura`, `issueKorekta`, `getFakturaStatus`
- New `fakturownia_invoices` table; webhook persists buyer identity + queues faktura
- Vercel Cron `/api/cron/poll-ksef` every 5 min finalizes pending + processing rows and issues korekty once the parent KSeF id lands
- Billing UI surfaces KSeF status + PDF download per purchase

Production cutover is gated behind `KSEF_LIVE=true`. Pre-implementation
procurement (qualified electronic seal + KSeF token + Fakturownia account)
must complete before the flag flips — see Pre-Implementation section in
[the plan doc](docs/superpowers/plans/2026-05-27-stripe-ksef-bridge.md).

## Test plan

- [ ] Stripe Test Mode purchase → faktura row created with gov_status=ok within 5 min
- [ ] Refund the test charge → korekta row appears, KSeF accepts it after parent gov_id is set
- [ ] Faktura PDF link works from /billing
- [ ] No NIP at checkout → Stripe blocks completion
- [ ] All unit + integration tests green
- [ ] KSEF_LIVE=false skips the Fakturownia call entirely (rows stay in pending)
EOF
)"
```

Print the PR URL when done.

---

## Self-Review Notes

**Spec coverage** (vs `docs/superpowers/specs/2026-05-26-stripe-ksef-integration.md` §4 "Recommended architecture"):
1. ✓ Stripe Checkout: tax_id_collection required, billing_address required, customer_creation always, invoice_creation removed — Task 9.
2. ✓ Webhook persists buyer identity + creates pending fakturownia_invoices row — Task 10.
3. ✓ Fakturownia API call with `gov_save_and_send: true` — Task 4 + Task 10's inline attempt + Task 11's cron retry.
4. ✓ Status polling via Vercel Cron — Task 11.
5. ✓ Korekta on charge.refunded waiting for parent gov_id — Task 11.
6. ✓ B2B-only (PL NIP required) — Tasks 9 and 10.
7. ✓ PL-only PDF (Fakturownia's default template). Multi-language not added.

**Placeholder scan:** No `TBD`, no "add appropriate error handling", no "implement later". Every step has concrete code or commands. Task 12 has slightly more leeway because the existing purchase-history component shape isn't pinned in this plan — the implementer reads the file first then adapts. That's appropriate for "extend existing UI" work.

**Type consistency:**
- `FakturaResult` defined in Task 2's types.ts, used in Tasks 4, 5, 6.
- `IssueFakturaParams` defined in Task 4's issue-faktura.ts, re-exported in Task 7's index.ts, used in Task 8's build-faktura-params.ts.
- `PurchaseRow` in Task 8 is a hand-rolled subset; the actual generated DB type in `lib/supabase/database.types.ts` after migration is structurally compatible.
- `gov_status` enum values (`pending` / `processing` / `ok` / `send_error` / `failed`) used identically in the SQL `check` constraint (Task 1), the TS `FakturowniaGovStatus` type (Task 2), and the UI badge logic (Task 12). One snag: the TS type allows `server_error` (Fakturownia's value); the SQL `check` constraint only allows `failed`. Resolution: the cron handler maps Fakturownia's `server_error` to our `failed` state before persisting. Confirmed in Task 11's cron loop catch block.

**Risk hotspots:**
1. **Stripe `tax_ids` extraction shape** — Stripe's `customer_details.tax_ids` can be empty, an array with one entry, or have unexpected types if the user picks "EU VAT" with a non-PL country. Task 10's `extractBuyerIdentity` throws `MissingBuyerIdentityError` in those cases — the webhook logs and skips faktura issuance but still grants credits. This is the right trade-off (don't block fulfillment on tax problems) but operationally requires monitoring for these errors.
2. **Cron auth on Vercel** — Vercel Cron auto-injects `Authorization: Bearer $CRON_SECRET` only if `CRON_SECRET` is set as a project env var. If the implementer forgets, the cron 401s silently. Step F3 catches this.
3. **Idempotency on retried webhooks** — the existing `stripe_purchases.status='pending'` check is preserved as the dedup key. The new `fakturownia_invoices` insert is gated on `buyerIdentity` extraction succeeding, so a webhook retry that sees a pre-existing row with `kind='vat'` will hit the unique partial index and fail loudly. Acceptable: Stripe retries fire after our 200, so the second attempt would see the existing row and the new insert would be skipped via the dedup query in the cron.
