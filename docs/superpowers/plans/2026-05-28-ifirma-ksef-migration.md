# Migrate KSeF Bridge from Fakturownia to iFirma Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Fakturownia KSeF bridge (merged in PR #28/#29) with an iFirma.pl integration, since the company already uses iFirma for accounting — keeping invoicing and bookkeeping in one system.

**Architecture:** Same provider-agnostic surface as before — a `ksef_invoices` table (renamed from `fakturownia_invoices`), the Stripe webhook queues rows, a Vercel Cron drives the state machine. Only the adapter layer changes: a new `lib/billing/ifirma/` module that signs requests with HMAC-SHA1, creates a `fakturakraj` invoice, then sends it to KSeF in a **separate** call, polls status, and serves the PDF through an authenticated proxy route (iFirma has no public PDF URL). Ships behind `KSEF_LIVE=false`; the undocumented KSeF-status response shape is built defensively and verified against live creds later.

**Tech Stack:** Next.js 15 App Router, React 19, Supabase, TypeScript strict, Vitest, Node's `crypto` (HMAC-SHA1), Vercel Cron, iFirma REST API (`https://www.ifirma.pl/iapi`).

**Decisions locked (from the user):**
1. **Replace** Fakturownia entirely — delete `lib/billing/fakturownia/` and its tests.
2. **Rename** `fakturownia_invoices` → `ksef_invoices`, column `fakturownia_id` → `provider_invoice_id`. The table is empty (nothing issued; `KSEF_LIVE=false`), so a drop+recreate migration is zero-risk.
3. **Build defensively** for KSeF-status retrieval (iFirma docs don't document the response shape); log raw responses, ship behind the flag, verify the real field names against the user's creds later.
4. **Server proxy route** for the faktura PDF (`/api/invoices/[id]/pdf`).

**Branching:** Per `CLAUDE.md`, branch off `main`:
```bash
git fetch origin main && git checkout -b claude/ifirma-ksef-migration origin/main
```

**Reference docs (iFirma API):**
- Auth header (HMAC-SHA1): https://api.ifirma.pl/naglowek-autoryzacji/
- Issue domestic invoice (faktura krajowa): https://api.ifirma.pl/wystawianie-faktury-sprzedaz%cc%87y-krajowej-towarow-i-uslug/
- Send invoice to KSeF: https://api.ifirma.pl/wysylanie-faktury-do-ksef/
- Correction invoice: https://api.ifirma.pl/faktura-korygujaca-fakture-krajowa/
- Invoice list (status): https://api.ifirma.pl/lista-faktur/

---

## iFirma API reference (extracted from the docs — engineers, read this)

### Authentication
Every request carries an `Authentication` header:
```
Authentication: IAPIS user=<username>, hmac-sha1=<hex-hmac>
```
- `hmac = HMAC_SHA1(key = hexDecode(IFIRMA_INVOICE_KEY), message = url + username + keyName + requestBody)`
- `keyName` is `"faktura"` for all invoice operations (iFirma has separate keys per service: `abonent`, `faktura`, `rachunek`, `wydatek`).
- The key is a **hex string** → must be decoded to raw bytes before HMAC.
- `requestBody` is the exact JSON string sent. For **GET** requests (no body), the message omits it: `url + username + keyName`.
- The `url` in the message is the request URL **without** query string.
- Other headers: `Accept: application/json`, `Content-type: application/json; charset=UTF-8`.

### Issue domestic invoice
- `POST https://www.ifirma.pl/iapi/fakturakraj.json`
- Body (fields we set):
  ```json
  {
    "Zaplacono": 95.94,
    "LiczOd": "NET",
    "DataWystawienia": "2026-05-28",
    "DataSprzedazy": "2026-05-28",
    "FormatDatySprzedazy": "DZN",
    "SposobZaplaty": "PRZ",
    "NazwaSeriiNumeracji": "default",
    "Pozycje": [{
      "StawkaVat": 0.23,
      "Ilosc": 50,
      "CenaJednostkowa": 1.56,
      "NazwaPelna": "KSeF Translator — pakiet 50 kredytów",
      "Jednostka": "szt",
      "PKWiU": "",
      "TypStawkiVat": "PRC"
    }],
    "Kontrahent": {
      "Nazwa": "ACME Sp. z o.o.",
      "NIP": "5260250995",
      "Ulica": "ul. Marszałkowska 1",
      "KodPocztowy": "00-001",
      "Miejscowosc": "Warszawa",
      "Kraj": "Polska",
      "Email": "biuro@acme.pl",
      "OsobaFizyczna": false
    }
  }
  ```
  - `LiczOd: "NET"` — we provide net unit prices (Stripe charges net + VAT exclusive).
  - `StawkaVat: 0.23` is a **decimal** (not "23"); `TypStawkiVat: "PRC"` = percentage rate.
  - `Zaplacono` = gross total the customer actually paid = `round(netTotal × 1.23, 2)`.
  - `Kontrahent.OsobaFizyczna: false` — B2B (company), not a private person.
- Response: `{ "response": { "Kod": 0, "Informacja": "...", "Identyfikator": "1244512" } }`
  - `Kod === 0` means success; `Identyfikator` is the iFirma invoice id (string) → store as `provider_invoice_id`.

### Send invoice to KSeF (SEPARATE call)
- `POST https://www.ifirma.pl/iapi/fakturakraj/ksef/send/<identyfikator>.json`
- Body: `{ "DataWysylki": null }`
- Response shape is **not documented** — capture `Kod`/`Informacja` defensively.

### Correction invoice (korekta)
- `POST https://www.ifirma.pl/iapi/fakturakraj/korekta/<originalIdentyfikator>.json`
- Body includes `PowodKorekty` (reason enum, e.g. `"ZWR_SPRZ_TOW"` = return of goods/services), `DataWystawienia`, `Pozycje` (the corrected final-state line items), etc.
- Response: `{ "response": { "Kod": 0, "Informacja": "...", "Identyfikator": "152212" } }`
- KSeF send for a korekta: `POST .../iapi/fakturakraj/korekta/ksef/send/<id>.json` with `{ "DataWysylki": null }`.

### Invoice list / status
- `GET https://www.ifirma.pl/iapi/faktury.json?dataOd=YYYY-MM-DD&dataDo=YYYY-MM-DD`
- Returns `response.Wynik[]` with `FakturaId`, `PelnyNumer`, `CzyWyslano` (bool — sent to KSeF?), `Rodzaj`, `Waluta`, `Brutto`.
- **Does not expose the numer KSeF directly** — this is the documented gap. Defensive plan: poll the single-invoice JSON (`GET /iapi/fakturakraj/<id>.json`) and log the raw body so we can discover the KSeF status/number fields with live creds.

### PDF
- `GET https://www.ifirma.pl/iapi/fakturakraj/<id>.pdf` (authenticated, `Accept: application/pdf`). No public URL.

---

## File Structure

**New (`lib/billing/ifirma/`):**
- `types.ts` — iFirma request/response types (`IfirmaPozycja`, `IfirmaKontrahent`, `IfirmaInvoiceRequest`, `IfirmaResponseEnvelope`, `IfirmaApiError`, normalized `KsefInvoiceResult`)
- `auth.ts` — `buildAuthHeader({ url, username, keyName, keyHex, body })` HMAC-SHA1 signer
- `client.ts` — `ifirmaPost<T>(path, body)` / `ifirmaGet<T>(path)` / `ifirmaGetBinary(path)` using `auth.ts`
- `issue-faktura.ts` — `issueFaktura(params)` → POST `/fakturakraj.json`, returns `{ providerInvoiceId }`
- `send-to-ksef.ts` — `sendToKsef(providerInvoiceId, { korekta })` → POST `.../ksef/send/<id>.json`
- `issue-korekta.ts` — `issueKorekta(params)` → POST `/fakturakraj/korekta/<id>.json`
- `get-status.ts` — `getKsefStatus(providerInvoiceId)` → defensive single-invoice GET + raw-body logging
- `get-pdf.ts` — `getFakturaPdf(providerInvoiceId)` → `ArrayBuffer`
- `index.ts` — barrel

**New elsewhere:**
- `supabase/migrations/20260528000001_rename_to_ksef_invoices.sql` — drop `fakturownia_invoices`, create `ksef_invoices`
- `lib/billing/build-ifirma-faktura.ts` — pure mapper `stripe_purchases` row → iFirma invoice body (replaces `build-faktura-params.ts`)
- `app/api/invoices/[id]/pdf/route.ts` — authenticated PDF proxy
- Tests mirroring the modules above

**Modified:**
- `app/api/stripe/webhook/route.ts` — swap imports to iFirma; two-step inline issue (create → send); table/column renames
- `app/api/cron/poll-ksef/route.ts` — swap imports; two-step issue with `provider_invoice_id` idempotency guard; status poll via iFirma; renames
- `components/billing/purchase-history.tsx` — PDF link → `/api/invoices/<ksefInvoiceId>/pdf`; query renames
- `.env.example` — remove `FAKTUROWNIA_*`; add `IFIRMA_USERNAME`, `IFIRMA_INVOICE_KEY`, `IFIRMA_BASE_URL`

**Deleted:**
- `lib/billing/fakturownia/` (all 6 files)
- `tests/integration/lib/fakturownia/` (all 4 test files)
- `lib/billing/build-faktura-params.ts` + `tests/integration/lib/build-faktura-params.test.ts`

---

## Environment Variables

`.env.example` after this plan:
```env
# ── iFirma (Stripe → KSeF bridge) ──────────────────────────────────────
# iFirma login (the account that owns the invoices).
IFIRMA_USERNAME=
# The "faktura" API key from iFirma → Konto → Konfiguracja → Klucze API.
# Hex-encoded; the client hex-decodes it before HMAC-SHA1 signing.
IFIRMA_INVOICE_KEY=
# Optional base URL override (defaults to https://www.ifirma.pl/iapi).
# iFirma has no public sandbox; leave unset for production.
IFIRMA_BASE_URL=

# Production cutover gate. When false the webhook + cron skip iFirma
# entirely and leave rows in 'pending'. Flip to "true" only after the
# iFirma keys are set and the KSeF-status shape is verified.
KSEF_LIVE=false

# Vercel Cron auth — Authorization: Bearer <secret>.
CRON_SECRET=
```

---

## Pre-Task Setup

- [ ] **Step 0a: Branch off main**
```bash
git fetch origin main && git checkout -b claude/ifirma-ksef-migration origin/main
```

- [ ] **Step 0b: Verify baseline**
Use Node 22: `source ~/.nvm/nvm.sh && nvm use 22 > /dev/null` before any npm/npx command.
```bash
source ~/.nvm/nvm.sh && nvm use 22 > /dev/null
npm run lint && npx tsc --noEmit
npm run test -- tests/integration/lib/fakturownia tests/integration/lib/build-faktura-params 2>&1 | tail -5
```
Expected: lint + tsc clean; the Fakturownia tests pass (they exist on main — we'll delete them in Task 12). Pre-existing baseline failures (`tests/components/marketing/landing-page.test.tsx`, `tests/integration/api/*` needing a dev server) are unrelated.

---

## Task 1: Migration — rename fakturownia_invoices → ksef_invoices

**Files:**
- Create: `supabase/migrations/20260528000001_rename_to_ksef_invoices.sql`

The table is empty (`KSEF_LIVE=false`, nothing issued) so we drop and recreate cleanly rather than chaining RENAMEs across the two existing migrations.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260528000001_rename_to_ksef_invoices.sql`:

```sql
-- Migrate the KSeF bridge from Fakturownia to iFirma. The table is empty
-- (nothing issued yet — KSEF_LIVE was never flipped), so we drop the old
-- provider-named table and recreate it provider-neutral. The dependent
-- trigger/policy/indexes drop with CASCADE; the updated_at function is
-- dropped explicitly (functions aren't owned by the table).

drop table if exists public.fakturownia_invoices cascade;
drop function if exists public.touch_fakturownia_invoices_updated_at() cascade;

create table public.ksef_invoices (
  id                   uuid primary key default gen_random_uuid(),
  stripe_purchase_id   uuid not null references public.stripe_purchases(id) on delete cascade,
  kind                 text not null check (kind in ('vat', 'correction')),
  parent_id            uuid references public.ksef_invoices(id) on delete set null,
  -- The provider's own invoice id (iFirma `Identyfikator`); null until the
  -- create call succeeds.
  provider_invoice_id  text unique,
  gov_status           text not null default 'pending'
                       check (gov_status in ('pending', 'processing', 'ok', 'send_error', 'failed')),
  gov_id               text,
  pdf_url              text,
  last_error           text,
  attempt_count        integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- A korekta must reference a parent; a vat invoice must not (carried over
  -- from the 20260527000002 constraints migration).
  constraint ksef_invoices_kind_parent_chk
    check ((kind = 'vat' and parent_id is null) or (kind = 'correction' and parent_id is not null))
);

create unique index ksef_invoices_one_vat_per_purchase
  on public.ksef_invoices (stripe_purchase_id)
  where kind = 'vat';

create index ksef_invoices_cron_scan
  on public.ksef_invoices (gov_status, created_at)
  where gov_status in ('pending', 'processing', 'failed');

create index ksef_invoices_parent_id
  on public.ksef_invoices (parent_id)
  where parent_id is not null;

alter table public.ksef_invoices enable row level security;

create policy "ksef_invoices_select_own" on public.ksef_invoices
  for select to authenticated
  using (
    exists (
      select 1 from public.stripe_purchases sp
      where sp.id = ksef_invoices.stripe_purchase_id
        and sp.user_id = (select auth.uid())
    )
  );

create or replace function public.touch_ksef_invoices_updated_at()
returns trigger language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_ksef_invoices
  before update on public.ksef_invoices
  for each row execute function public.touch_ksef_invoices_updated_at();

comment on table public.ksef_invoices is
  'Tracks provider-issued faktury and korekty for each Stripe purchase. Provider-neutral (currently iFirma). KSeF state machine: pending -> processing -> ok | send_error | failed. Driven by /api/cron/poll-ksef.';
```

- [ ] **Step 2: Apply the migration**

Use the Supabase MCP (`apply_migration`) or CLI (`npx supabase db push`) per `CLAUDE.md`. If the CLI prompts for a DB password and it fails SASL auth, fall back to the MCP `apply_migration` tool (the migration file is the source of truth either way). If neither works, report BLOCKED.

- [ ] **Step 3: Regenerate types**
```bash
npx supabase gen types typescript --linked > lib/supabase/database.types.ts
```
Confirm `lib/supabase/database.types.ts` now has `ksef_invoices` (with `provider_invoice_id`) and no longer has `fakturownia_invoices`.

- [ ] **Step 4: Verify tsc fails loudly where the old table is referenced**
```bash
source ~/.nvm/nvm.sh && nvm use 22 > /dev/null && npx tsc --noEmit 2>&1 | head -30
```
Expected: tsc now reports errors in `app/api/stripe/webhook/route.ts`, `app/api/cron/poll-ksef/route.ts`, and `components/billing/purchase-history.tsx` because they still reference `fakturownia_invoices` / `fakturownia_id`. **This is expected** — those files get fixed in Tasks 9–11. Do NOT fix them here. Note the errors so later tasks can confirm they're resolved.

- [ ] **Step 5: Commit**
```bash
git add supabase/migrations/20260528000001_rename_to_ksef_invoices.sql lib/supabase/database.types.ts
git commit -m "feat(db): rename fakturownia_invoices to ksef_invoices (provider-neutral)"
```

---

## Task 2: iFirma types

**Files:**
- Create: `lib/billing/ifirma/types.ts`

- [ ] **Step 1: Create the types file**

```ts
/**
 * iFirma REST API type stubs (https://api.ifirma.pl). Only the fields we
 * read or write are typed.
 */

/** VAT rate kind. "PRC" = percentage; "ZW" = zwolniony; "NP" = nie podlega. */
export type IfirmaTypStawkiVat = "PRC" | "ZW" | "NP";

/** A single invoice line item (pozycja). */
export interface IfirmaPozycja {
  /** Decimal VAT rate, e.g. 0.23 for 23%. */
  StawkaVat: number;
  Ilosc: number;
  /** Net unit price (LiczOd="NET"). */
  CenaJednostkowa: number;
  NazwaPelna: string;
  Jednostka: string;
  PKWiU?: string;
  TypStawkiVat: IfirmaTypStawkiVat;
}

/** Buyer (kontrahent). For B2B, OsobaFizyczna=false and NIP is required. */
export interface IfirmaKontrahent {
  Nazwa: string;
  NIP: string;
  Ulica?: string;
  KodPocztowy?: string;
  Miejscowosc?: string;
  /** Full country name in Polish, e.g. "Polska". */
  Kraj?: string;
  Email?: string;
  OsobaFizyczna: boolean;
}

/** Body for POST /iapi/fakturakraj.json. */
export interface IfirmaInvoiceRequest {
  /** Gross amount paid. */
  Zaplacono: number;
  /** "NET" = prices are net; "BRT" = prices are gross. */
  LiczOd: "NET" | "BRT";
  DataWystawienia: string;
  DataSprzedazy: string;
  /** "DZN" = day-level sale date. */
  FormatDatySprzedazy: "DZN" | "MIE";
  /** "PRZ" = przelew (bank transfer). */
  SposobZaplaty: string;
  NazwaSeriiNumeracji: string;
  Pozycje: IfirmaPozycja[];
  Kontrahent: IfirmaKontrahent;
}

/** Body for POST /iapi/fakturakraj/korekta/<id>.json. */
export interface IfirmaKorektaRequest {
  DataWystawienia: string;
  /** Correction reason enum, e.g. "ZWR_SPRZ_TOW" (return of goods/services). */
  PowodKorekty: string;
  Zaplacono: number;
  SposobZaplaty: string;
  Pozycje: IfirmaPozycja[];
}

/** Standard iFirma response envelope. */
export interface IfirmaResponseEnvelope {
  response: {
    /** 0 = success. */
    Kod: number;
    Informacja: string;
    /** Present on create/korekta success — the new invoice id. */
    Identyfikator?: string;
  };
}

/**
 * Normalized status result our callers consume. `govStatus` follows the
 * same enum as the DB column. `raw` carries the untouched provider body so
 * we can discover the real KSeF-status fields with live creds (the iFirma
 * docs don't document them).
 */
export interface KsefInvoiceResult {
  providerInvoiceId: string;
  govStatus: "pending" | "processing" | "ok" | "send_error" | "failed";
  govId: string | null;
  errorMessages: string[];
  raw?: unknown;
}

export class IfirmaApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly kod: number | null,
    public readonly body: unknown,
    message: string
  ) {
    super(message);
    this.name = "IfirmaApiError";
  }
}
```

- [ ] **Step 2: Verify tsc** (the new file should compile; pre-existing errors from Task 1's renames are still present and expected)
```bash
source ~/.nvm/nvm.sh && nvm use 22 > /dev/null && npx tsc --noEmit 2>&1 | grep ifirma/types || echo "no errors in ifirma/types.ts"
```
Expected: `no errors in ifirma/types.ts`.

- [ ] **Step 3: Commit**
```bash
git add lib/billing/ifirma/types.ts
git commit -m "feat(ifirma): API request/response type stubs"
```

---

## Task 2.5: ⚠️ Verification spike — confirm iFirma auth + endpoints against live creds (OPTIONAL, do FIRST if creds available)

This is the highest-risk area: HMAC signing details and the undocumented KSeF-status shape. If the user has provided `IFIRMA_USERNAME` + `IFIRMA_INVOICE_KEY`, run a throwaway script to confirm the auth works and capture the real KSeF responses BEFORE building on assumptions. If creds aren't available yet, skip this task and rely on the defensive design (the whole plan ships behind `KSEF_LIVE=false`).

- [ ] **Step 1: Throwaway probe (do not commit)**

Create `/tmp/ifirma-probe.mjs`:

```js
import crypto from "node:crypto";

const username = process.env.IFIRMA_USERNAME;
const keyHex = process.env.IFIRMA_INVOICE_KEY;
const base = process.env.IFIRMA_BASE_URL ?? "https://www.ifirma.pl/iapi";

function sign(url, body) {
  const message = url + username + "faktura" + body;
  const hmac = crypto.createHmac("sha1", Buffer.from(keyHex, "hex")).update(message, "utf8").digest("hex");
  return `IAPIS user=${username}, hmac-sha1=${hmac}`;
}

// Read-only list call — safe, issues nothing.
const url = `${base}/faktury.json`;
const res = await fetch(`${url}?dataOd=2026-01-01&dataDo=2026-12-31`, {
  headers: { Accept: "application/json", Authentication: sign(url, "") }
});
console.log("status", res.status);
console.log(await res.text());
```

Run: `IFIRMA_USERNAME=... IFIRMA_INVOICE_KEY=... node /tmp/ifirma-probe.mjs`

- [ ] **Step 2: Record findings**

In your report, note: did the list call authenticate (HTTP 200, `Kod: 0`)? What fields does each `Wynik[]` entry actually contain (especially anything KSeF-related)? If you can safely issue + send + GET a single test invoice, capture the single-invoice JSON body and note which field carries the numer KSeF / status. **This directly informs Task 7 (get-status).** Delete `/tmp/ifirma-probe.mjs` after.

If no creds: report "skipped — no creds; get-status built defensively per plan."

---

## Task 3: iFirma HMAC-SHA1 auth signer

**Files:**
- Create: `lib/billing/ifirma/auth.ts`
- Test: `tests/integration/lib/ifirma/auth.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/integration/lib/ifirma/auth.test.ts`:

```ts
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildAuthHeader } from "@/lib/billing/ifirma/auth";

// A fixed hex key so the expected HMAC is reproducible.
const KEY_HEX = "0123456789abcdef0123456789abcdef";
const USER = "testuser";
const KEY_NAME = "faktura";

function expectedHmac(message: string): string {
  return crypto
    .createHmac("sha1", Buffer.from(KEY_HEX, "hex"))
    .update(message, "utf8")
    .digest("hex");
}

describe("buildAuthHeader", () => {
  it("formats the header as 'IAPIS user=<u>, hmac-sha1=<hex>'", () => {
    const url = "https://www.ifirma.pl/iapi/fakturakraj.json";
    const body = '{"Zaplacono":1}';
    const header = buildAuthHeader({
      url,
      username: USER,
      keyName: KEY_NAME,
      keyHex: KEY_HEX,
      body
    });
    const expected = expectedHmac(url + USER + KEY_NAME + body);
    expect(header).toBe(`IAPIS user=${USER}, hmac-sha1=${expected}`);
  });

  it("hex-decodes the key before signing (not used as a UTF-8 string)", () => {
    const url = "https://www.ifirma.pl/iapi/fakturakraj.json";
    const header = buildAuthHeader({
      url,
      username: USER,
      keyName: KEY_NAME,
      keyHex: KEY_HEX,
      body: ""
    });
    // If the key were used as a literal string the digest would differ.
    const wrongIfStringKey = crypto
      .createHmac("sha1", KEY_HEX) // raw string, NOT hex-decoded
      .update(url + USER + KEY_NAME, "utf8")
      .digest("hex");
    expect(header).not.toContain(wrongIfStringKey);
  });

  it("omits the body from the message for GET (empty body)", () => {
    const url = "https://www.ifirma.pl/iapi/fakturakraj/123.pdf";
    const header = buildAuthHeader({
      url,
      username: USER,
      keyName: KEY_NAME,
      keyHex: KEY_HEX,
      body: ""
    });
    const expected = expectedHmac(url + USER + KEY_NAME);
    expect(header).toBe(`IAPIS user=${USER}, hmac-sha1=${expected}`);
  });

  it("produces a different hash when the body changes", () => {
    const url = "https://www.ifirma.pl/iapi/fakturakraj.json";
    const a = buildAuthHeader({ url, username: USER, keyName: KEY_NAME, keyHex: KEY_HEX, body: '{"a":1}' });
    const b = buildAuthHeader({ url, username: USER, keyName: KEY_NAME, keyHex: KEY_HEX, body: '{"a":2}' });
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**
```bash
npm run test -- ifirma/auth
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/billing/ifirma/auth.ts`:

```ts
import crypto from "node:crypto";

export interface BuildAuthHeaderParams {
  /** Request URL WITHOUT query string. */
  url: string;
  username: string;
  /** iFirma key name for the service, e.g. "faktura". */
  keyName: string;
  /** Hex-encoded API key. */
  keyHex: string;
  /** JSON request body for POST; "" for GET. */
  body: string;
}

/**
 * Build the iFirma `Authentication` header. The signature is
 * HMAC-SHA1(hexDecode(key), url + username + keyName + body), hex-encoded.
 * For GET requests pass body="" so the message omits it.
 */
export function buildAuthHeader(params: BuildAuthHeaderParams): string {
  const message = params.url + params.username + params.keyName + params.body;
  const hmac = crypto
    .createHmac("sha1", Buffer.from(params.keyHex, "hex"))
    .update(message, "utf8")
    .digest("hex");
  return `IAPIS user=${params.username}, hmac-sha1=${hmac}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**
```bash
npm run test -- ifirma/auth
```
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**
```bash
git add lib/billing/ifirma/auth.ts tests/integration/lib/ifirma/auth.test.ts
git commit -m "feat(ifirma): HMAC-SHA1 Authentication header signer"
```

---

## Task 4: iFirma HTTP client

**Files:**
- Create: `lib/billing/ifirma/client.ts`
- Test: `tests/integration/lib/ifirma/client.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/integration/lib/ifirma/client.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ifirmaPost, ifirmaGet } from "@/lib/billing/ifirma/client";
import { IfirmaApiError } from "@/lib/billing/ifirma/types";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.IFIRMA_USERNAME = "testuser";
  process.env.IFIRMA_INVOICE_KEY = "0123456789abcdef0123456789abcdef";
  delete process.env.IFIRMA_BASE_URL;
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  process.env = { ...ORIGINAL_ENV };
});

describe("ifirma client", () => {
  it("POSTs to the iapi base with an Authentication header and JSON body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ response: { Kod: 0, Identyfikator: "1" } }), { status: 200 })
    );
    globalThis.fetch = fetchMock;

    await ifirmaPost("/fakturakraj.json", { Zaplacono: 1 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://www.ifirma.pl/iapi/fakturakraj.json");
    expect(init.method).toBe("POST");
    expect(init.headers.Authentication).toMatch(/^IAPIS user=testuser, hmac-sha1=[0-9a-f]{40}$/);
    expect(init.headers["Content-type"]).toMatch(/application\/json/);
    expect(JSON.parse(init.body)).toEqual({ Zaplacono: 1 });
  });

  it("signs POST using the EXACT serialized body string it sends", async () => {
    // The HMAC must be computed over the same string passed as the body,
    // or iFirma rejects the signature.
    let sentBody = "";
    let sentAuth = "";
    globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
      sentBody = init.body;
      sentAuth = init.headers.Authentication;
      return Promise.resolve(
        new Response(JSON.stringify({ response: { Kod: 0 } }), { status: 200 })
      );
    });
    const crypto = await import("node:crypto");
    await ifirmaPost("/fakturakraj.json", { b: 2, a: 1 });
    const url = "https://www.ifirma.pl/iapi/fakturakraj.json";
    const expectedHmac = crypto
      .createHmac("sha1", Buffer.from("0123456789abcdef0123456789abcdef", "hex"))
      .update(url + "testuser" + "faktura" + sentBody, "utf8")
      .digest("hex");
    expect(sentAuth).toBe(`IAPIS user=testuser, hmac-sha1=${expectedHmac}`);
  });

  it("GET strips the query string from the signed URL but fetches the full URL", async () => {
    let fetchedUrl = "";
    let auth = "";
    globalThis.fetch = vi.fn().mockImplementation((url, init) => {
      fetchedUrl = url;
      auth = init.headers.Authentication;
      return Promise.resolve(
        new Response(JSON.stringify({ response: { Kod: 0, Wynik: [] } }), { status: 200 })
      );
    });
    const crypto = await import("node:crypto");
    await ifirmaGet("/faktury.json?dataOd=2026-01-01&dataDo=2026-12-31");

    expect(fetchedUrl).toBe(
      "https://www.ifirma.pl/iapi/faktury.json?dataOd=2026-01-01&dataDo=2026-12-31"
    );
    const signedUrl = "https://www.ifirma.pl/iapi/faktury.json"; // no query
    const expectedHmac = crypto
      .createHmac("sha1", Buffer.from("0123456789abcdef0123456789abcdef", "hex"))
      .update(signedUrl + "testuser" + "faktura", "utf8")
      .digest("hex");
    expect(auth).toBe(`IAPIS user=testuser, hmac-sha1=${expectedHmac}`);
  });

  it("honours IFIRMA_BASE_URL override", async () => {
    process.env.IFIRMA_BASE_URL = "https://example.test/iapi";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ response: { Kod: 0 } }), { status: 200 })
    );
    globalThis.fetch = fetchMock;
    await ifirmaGet("/faktury.json");
    expect(fetchMock.mock.calls[0][0]).toBe("https://example.test/iapi/faktury.json");
  });

  it("throws IfirmaApiError when response Kod !== 0", async () => {
    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ response: { Kod: 400, Informacja: "Błędny NIP" } }), { status: 200 })
      )
    );
    await expect(ifirmaPost("/fakturakraj.json", {})).rejects.toBeInstanceOf(IfirmaApiError);
    await expect(ifirmaPost("/fakturakraj.json", {})).rejects.toMatchObject({ kod: 400 });
  });

  it("throws IfirmaApiError on non-2xx HTTP", async () => {
    globalThis.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response("Forbidden", { status: 403 }))
    );
    await expect(ifirmaGet("/faktury.json")).rejects.toMatchObject({ status: 403 });
  });

  it("throws when IFIRMA_USERNAME is missing", async () => {
    delete process.env.IFIRMA_USERNAME;
    await expect(ifirmaGet("/faktury.json")).rejects.toThrow(/IFIRMA_USERNAME/);
  });

  it("throws when IFIRMA_INVOICE_KEY is missing", async () => {
    delete process.env.IFIRMA_INVOICE_KEY;
    await expect(ifirmaGet("/faktury.json")).rejects.toThrow(/IFIRMA_INVOICE_KEY/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**
```bash
npm run test -- ifirma/client
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/billing/ifirma/client.ts`:

```ts
import { buildAuthHeader } from "./auth";
import { IfirmaApiError, type IfirmaResponseEnvelope } from "./types";

const DEFAULT_TIMEOUT_MS = 30_000;
const KEY_NAME = "faktura";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} not configured`);
  return value;
}

function baseUrl(): string {
  return process.env.IFIRMA_BASE_URL ?? "https://www.ifirma.pl/iapi";
}

function stripQuery(url: string): string {
  const i = url.indexOf("?");
  return i === -1 ? url : url.slice(0, i);
}

async function call<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<T> {
  const username = requireEnv("IFIRMA_USERNAME");
  const keyHex = requireEnv("IFIRMA_INVOICE_KEY");
  const fullUrl = `${baseUrl()}${path}`;
  const bodyString = method === "POST" ? JSON.stringify(body ?? {}) : "";

  const authHeader = buildAuthHeader({
    url: stripQuery(fullUrl),
    username,
    keyName: KEY_NAME,
    keyHex,
    body: bodyString
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(fullUrl, {
      method,
      headers: {
        Accept: "application/json",
        ...(method === "POST"
          ? { "Content-type": "application/json; charset=UTF-8" }
          : {}),
        Authentication: authHeader
      },
      body: method === "POST" ? bodyString : undefined,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new IfirmaApiError(
      response.status,
      null,
      text,
      `iFirma ${method} ${path} failed (HTTP ${response.status})`
    );
  }

  const json = (await response.json()) as T & Partial<IfirmaResponseEnvelope>;
  // iFirma wraps results in { response: { Kod, ... } }. Kod !== 0 is an error
  // even on HTTP 200.
  const kod = json.response?.Kod;
  if (typeof kod === "number" && kod !== 0) {
    throw new IfirmaApiError(
      response.status,
      kod,
      json,
      `iFirma ${method} ${path} returned Kod ${kod}: ${json.response?.Informacja ?? ""}`
    );
  }

  return json;
}

export function ifirmaPost<T>(path: string, body: unknown): Promise<T> {
  return call<T>("POST", path, body);
}

export function ifirmaGet<T>(path: string): Promise<T> {
  return call<T>("GET", path);
}

/** Binary GET (PDF). Returns the raw bytes; does not parse JSON. */
export async function ifirmaGetBinary(path: string): Promise<ArrayBuffer> {
  const username = requireEnv("IFIRMA_USERNAME");
  const keyHex = requireEnv("IFIRMA_INVOICE_KEY");
  const fullUrl = `${baseUrl()}${path}`;
  const authHeader = buildAuthHeader({
    url: stripQuery(fullUrl),
    username,
    keyName: KEY_NAME,
    keyHex,
    body: ""
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(fullUrl, {
      method: "GET",
      headers: { Accept: "application/pdf", Authentication: authHeader },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    throw new IfirmaApiError(
      response.status,
      null,
      null,
      `iFirma GET ${path} (binary) failed (HTTP ${response.status})`
    );
  }
  return response.arrayBuffer();
}
```

- [ ] **Step 4: Run the test to verify it passes**
```bash
npm run test -- ifirma/client
```
Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**
```bash
git add lib/billing/ifirma/client.ts tests/integration/lib/ifirma/client.test.ts
git commit -m "feat(ifirma): HTTP client with HMAC auth, query-strip signing, Kod error mapping"
```

---

## Task 5: issueFaktura

**Files:**
- Create: `lib/billing/ifirma/issue-faktura.ts`
- Test: `tests/integration/lib/ifirma/issue-faktura.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/integration/lib/ifirma/issue-faktura.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { issueFaktura } from "@/lib/billing/ifirma/issue-faktura";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.IFIRMA_USERNAME = "testuser";
  process.env.IFIRMA_INVOICE_KEY = "0123456789abcdef0123456789abcdef";
  delete process.env.IFIRMA_BASE_URL;
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  process.env = { ...ORIGINAL_ENV };
});

const sampleBody = {
  Zaplacono: 95.94,
  LiczOd: "NET" as const,
  DataWystawienia: "2026-05-28",
  DataSprzedazy: "2026-05-28",
  FormatDatySprzedazy: "DZN" as const,
  SposobZaplaty: "PRZ",
  NazwaSeriiNumeracji: "default",
  Pozycje: [
    {
      StawkaVat: 0.23,
      Ilosc: 50,
      CenaJednostkowa: 1.56,
      NazwaPelna: "KSeF Translator — pakiet 50 kredytów",
      Jednostka: "szt",
      PKWiU: "",
      TypStawkiVat: "PRC" as const
    }
  ],
  Kontrahent: {
    Nazwa: "ACME Sp. z o.o.",
    NIP: "5260250995",
    Ulica: "ul. Marszałkowska 1",
    KodPocztowy: "00-001",
    Miejscowosc: "Warszawa",
    Kraj: "Polska",
    Email: "biuro@acme.pl",
    OsobaFizyczna: false
  }
};

describe("issueFaktura", () => {
  it("POSTs to /fakturakraj.json and returns the Identyfikator", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          response: { Kod: 0, Informacja: "Faktura dodana.", Identyfikator: "1244512" }
        }),
        { status: 200 }
      )
    );
    globalThis.fetch = fetchMock;

    const result = await issueFaktura(sampleBody);

    expect(fetchMock.mock.calls[0][0]).toBe("https://www.ifirma.pl/iapi/fakturakraj.json");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.LiczOd).toBe("NET");
    expect(body.Pozycje[0].StawkaVat).toBe(0.23);
    expect(body.Kontrahent.OsobaFizyczna).toBe(false);
    expect(result.providerInvoiceId).toBe("1244512");
  });

  it("throws when the response has no Identyfikator", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ response: { Kod: 0, Informacja: "ok" } }), { status: 200 })
    );
    await expect(issueFaktura(sampleBody)).rejects.toThrow(/Identyfikator/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**
```bash
npm run test -- ifirma/issue-faktura
```

- [ ] **Step 3: Implement**

Create `lib/billing/ifirma/issue-faktura.ts`:

```ts
import { ifirmaPost } from "./client";
import type { IfirmaInvoiceRequest, IfirmaResponseEnvelope } from "./types";

export interface IssueFakturaResult {
  providerInvoiceId: string;
}

/**
 * Create a domestic VAT invoice in iFirma. Does NOT send it to KSeF — that's
 * a separate call (see send-to-ksef.ts). Returns the iFirma invoice id.
 */
export async function issueFaktura(
  body: IfirmaInvoiceRequest
): Promise<IssueFakturaResult> {
  const res = await ifirmaPost<IfirmaResponseEnvelope>("/fakturakraj.json", body);
  const id = res.response.Identyfikator;
  if (!id) {
    throw new Error(
      `iFirma /fakturakraj.json returned no Identyfikator (Kod=${res.response.Kod}, ${res.response.Informacja})`
    );
  }
  return { providerInvoiceId: id };
}
```

- [ ] **Step 4: Run the test to verify it passes**
```bash
npm run test -- ifirma/issue-faktura
```
Expected: 2 tests PASS.

- [ ] **Step 5: Commit**
```bash
git add lib/billing/ifirma/issue-faktura.ts tests/integration/lib/ifirma/issue-faktura.test.ts
git commit -m "feat(ifirma): issueFaktura (POST /fakturakraj.json)"
```

---

## Task 6: sendToKsef

**Files:**
- Create: `lib/billing/ifirma/send-to-ksef.ts`
- Test: `tests/integration/lib/ifirma/send-to-ksef.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/integration/lib/ifirma/send-to-ksef.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendToKsef } from "@/lib/billing/ifirma/send-to-ksef";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.IFIRMA_USERNAME = "testuser";
  process.env.IFIRMA_INVOICE_KEY = "0123456789abcdef0123456789abcdef";
  delete process.env.IFIRMA_BASE_URL;
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  process.env = { ...ORIGINAL_ENV };
});

describe("sendToKsef", () => {
  it("POSTs DataWysylki:null to the vat send endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ response: { Kod: 0, Informacja: "Wysłano." } }), { status: 200 })
    );
    globalThis.fetch = fetchMock;

    await sendToKsef("1244512", { korekta: false });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://www.ifirma.pl/iapi/fakturakraj/ksef/send/1244512.json"
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ DataWysylki: null });
  });

  it("uses the korekta path when korekta=true", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ response: { Kod: 0 } }), { status: 200 })
    );
    globalThis.fetch = fetchMock;

    await sendToKsef("152212", { korekta: true });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://www.ifirma.pl/iapi/fakturakraj/korekta/ksef/send/152212.json"
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**
```bash
npm run test -- ifirma/send-to-ksef
```

- [ ] **Step 3: Implement**

Create `lib/billing/ifirma/send-to-ksef.ts`:

```ts
import { ifirmaPost } from "./client";
import type { IfirmaResponseEnvelope } from "./types";

export interface SendToKsefOptions {
  /** True for a faktura korygująca (uses the /korekta path). */
  korekta: boolean;
}

/**
 * Submit an already-created iFirma invoice to KSeF. The client throws on
 * Kod !== 0, so a successful resolve means iFirma accepted the submission
 * request (KSeF acceptance itself is async — poll via get-status).
 */
export async function sendToKsef(
  providerInvoiceId: string,
  options: SendToKsefOptions
): Promise<void> {
  const segment = options.korekta ? "fakturakraj/korekta" : "fakturakraj";
  await ifirmaPost<IfirmaResponseEnvelope>(
    `/${segment}/ksef/send/${encodeURIComponent(providerInvoiceId)}.json`,
    { DataWysylki: null }
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**
```bash
npm run test -- ifirma/send-to-ksef
```
Expected: 2 PASS.

- [ ] **Step 5: Commit**
```bash
git add lib/billing/ifirma/send-to-ksef.ts tests/integration/lib/ifirma/send-to-ksef.test.ts
git commit -m "feat(ifirma): sendToKsef (separate KSeF submission call)"
```

---

## Task 7: getKsefStatus (defensive)

**Files:**
- Create: `lib/billing/ifirma/get-status.ts`
- Test: `tests/integration/lib/ifirma/get-status.test.ts`

iFirma doesn't document the KSeF-status response. We fetch the single-invoice JSON, look for any field whose key contains "ksef" (case-insensitive) plus a numer/status, and fall back to the list endpoint's `CzyWyslano`. The raw body is returned on `result.raw` and logged so the real shape can be discovered with live creds (Task 2.5).

- [ ] **Step 1: Write the failing test**

Create `tests/integration/lib/ifirma/get-status.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getKsefStatus } from "@/lib/billing/ifirma/get-status";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.IFIRMA_USERNAME = "testuser";
  process.env.IFIRMA_INVOICE_KEY = "0123456789abcdef0123456789abcdef";
  delete process.env.IFIRMA_BASE_URL;
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  process.env = { ...ORIGINAL_ENV };
});

describe("getKsefStatus", () => {
  it("GETs the single-invoice JSON for the given id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ response: { Kod: 0 } }), { status: 200 })
    );
    globalThis.fetch = fetchMock;
    await getKsefStatus("1244512");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://www.ifirma.pl/iapi/fakturakraj/1244512.json"
    );
  });

  it("maps a KSeF reference number field to govStatus=ok + govId", async () => {
    // Defensive: we don't know the exact field name, so the implementation
    // scans for a key containing 'ksef' with a non-empty string value that
    // looks like a KSeF number. Use a plausible field name here.
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          response: {
            Kod: 0,
            NumerKSeF: "5260250995-20260528-0100001AF629-AF"
          }
        }),
        { status: 200 }
      )
    );
    const result = await getKsefStatus("1");
    expect(result.govStatus).toBe("ok");
    expect(result.govId).toBe("5260250995-20260528-0100001AF629-AF");
  });

  it("returns govStatus=processing when no KSeF number is present yet", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ response: { Kod: 0, CzyWyslano: true } }), { status: 200 })
    );
    const result = await getKsefStatus("1");
    expect(result.govStatus).toBe("processing");
    expect(result.govId).toBeNull();
  });

  it("always returns the raw body for later field discovery", async () => {
    const payload = { response: { Kod: 0, somethingUnknown: 42 } };
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(payload), { status: 200 })
    );
    const result = await getKsefStatus("1");
    expect(result.raw).toEqual(payload);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**
```bash
npm run test -- ifirma/get-status
```

- [ ] **Step 3: Implement**

Create `lib/billing/ifirma/get-status.ts`:

```ts
import { ifirmaGet } from "./client";
import type { KsefInvoiceResult } from "./types";

// A KSeF reference number is 35 chars: NIP-DATE-12HEX-CRC. We don't hard-fail
// on the format; this is just a heuristic to recognise a "looks like a numer
// KSeF" string while the real field name is unconfirmed.
const KSEF_NUMBER_RE = /^\d{10}-\d{8}-[0-9A-F]{12}-[0-9A-F]{2}$/i;

/**
 * Best-effort KSeF status read. iFirma's docs don't document the KSeF-status
 * response, so we GET the single-invoice JSON and scan for:
 *   - any key containing "ksef" whose value looks like a numer KSeF -> ok
 *   - a truthy CzyWyslano (sent flag) with no number yet -> processing
 *   - otherwise -> processing (keep polling; the cron caps attempts)
 * The untouched body is returned on `raw` (and logged) so the real field
 * names can be confirmed against live creds, then this can be tightened.
 */
export async function getKsefStatus(
  providerInvoiceId: string
): Promise<KsefInvoiceResult> {
  const body = await ifirmaGet<Record<string, unknown>>(
    `/fakturakraj/${encodeURIComponent(providerInvoiceId)}.json`
  );

  // iFirma 200 bodies are wrapped in { response: {...} }; flatten for scanning.
  const inner =
    (body as { response?: Record<string, unknown> }).response ?? body;

  console.info(
    "[ifirma/get-status] raw KSeF status body for invoice",
    providerInvoiceId,
    JSON.stringify(inner)
  );

  const govId = findKsefNumber(inner);
  if (govId) {
    return { providerInvoiceId, govStatus: "ok", govId, errorMessages: [], raw: body };
  }

  return {
    providerInvoiceId,
    govStatus: "processing",
    govId: null,
    errorMessages: [],
    raw: body
  };
}

function findKsefNumber(obj: Record<string, unknown>): string | null {
  for (const [key, value] of Object.entries(obj)) {
    if (
      key.toLowerCase().includes("ksef") &&
      typeof value === "string" &&
      KSEF_NUMBER_RE.test(value)
    ) {
      return value;
    }
  }
  return null;
}
```

- [ ] **Step 4: Run the test to verify it passes**
```bash
npm run test -- ifirma/get-status
```
Expected: 4 PASS.

- [ ] **Step 5: Commit**
```bash
git add lib/billing/ifirma/get-status.ts tests/integration/lib/ifirma/get-status.test.ts
git commit -m "feat(ifirma): defensive getKsefStatus with raw-body logging for field discovery"
```

---

## Task 8: issueKorekta

**Files:**
- Create: `lib/billing/ifirma/issue-korekta.ts`
- Test: `tests/integration/lib/ifirma/issue-korekta.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/integration/lib/ifirma/issue-korekta.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { issueKorekta } from "@/lib/billing/ifirma/issue-korekta";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.IFIRMA_USERNAME = "testuser";
  process.env.IFIRMA_INVOICE_KEY = "0123456789abcdef0123456789abcdef";
  delete process.env.IFIRMA_BASE_URL;
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  process.env = { ...ORIGINAL_ENV };
});

describe("issueKorekta", () => {
  it("POSTs to /fakturakraj/korekta/<originalId>.json and returns the new id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ response: { Kod: 0, Identyfikator: "152212" } }),
        { status: 200 }
      )
    );
    globalThis.fetch = fetchMock;

    const result = await issueKorekta({
      originalProviderInvoiceId: "1244512",
      reason: "ZWR_SPRZ_TOW",
      issueDate: "2026-05-29",
      sposobZaplaty: "KOM",
      zaplacono: 0,
      positions: [
        {
          StawkaVat: 0.23,
          Ilosc: 0,
          CenaJednostkowa: 1.56,
          NazwaPelna: "KSeF Translator — pakiet 50 kredytów",
          Jednostka: "szt",
          TypStawkiVat: "PRC"
        }
      ]
    });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://www.ifirma.pl/iapi/fakturakraj/korekta/1244512.json"
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.PowodKorekty).toBe("ZWR_SPRZ_TOW");
    expect(body.DataWystawienia).toBe("2026-05-29");
    expect(body.Pozycje[0].Ilosc).toBe(0);
    expect(result.providerInvoiceId).toBe("152212");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**
```bash
npm run test -- ifirma/issue-korekta
```

- [ ] **Step 3: Implement**

Create `lib/billing/ifirma/issue-korekta.ts`:

```ts
import { ifirmaPost } from "./client";
import type {
  IfirmaKorektaRequest,
  IfirmaPozycja,
  IfirmaResponseEnvelope
} from "./types";

export interface IssueKorektaParams {
  /** iFirma id of the ORIGINAL invoice being corrected. */
  originalProviderInvoiceId: string;
  /** Correction reason enum, e.g. "ZWR_SPRZ_TOW". */
  reason: string;
  issueDate: string;
  /** Payment method enum, e.g. "KOM" (kompensata) for a refund. */
  sposobZaplaty: string;
  /** Gross still considered paid after the correction (0 for a full refund). */
  zaplacono: number;
  /**
   * Corrected (post-refund) line items. For a full refund, Ilosc=0 expresses
   * "everything returned"; iFirma computes the delta from the original.
   */
  positions: IfirmaPozycja[];
}

export interface IssueKorektaResult {
  providerInvoiceId: string;
}

export async function issueKorekta(
  params: IssueKorektaParams
): Promise<IssueKorektaResult> {
  const body: IfirmaKorektaRequest = {
    DataWystawienia: params.issueDate,
    PowodKorekty: params.reason,
    Zaplacono: params.zaplacono,
    SposobZaplaty: params.sposobZaplaty,
    Pozycje: params.positions
  };
  const res = await ifirmaPost<IfirmaResponseEnvelope>(
    `/fakturakraj/korekta/${encodeURIComponent(params.originalProviderInvoiceId)}.json`,
    body
  );
  const id = res.response.Identyfikator;
  if (!id) {
    throw new Error(
      `iFirma korekta returned no Identyfikator (Kod=${res.response.Kod}, ${res.response.Informacja})`
    );
  }
  return { providerInvoiceId: id };
}
```

- [ ] **Step 4: Run the test to verify it passes**
```bash
npm run test -- ifirma/issue-korekta
```
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add lib/billing/ifirma/issue-korekta.ts tests/integration/lib/ifirma/issue-korekta.test.ts
git commit -m "feat(ifirma): issueKorekta (POST /fakturakraj/korekta/<id>.json)"
```

---

## Task 9: getFakturaPdf + barrel exports

**Files:**
- Create: `lib/billing/ifirma/get-pdf.ts`
- Create: `lib/billing/ifirma/index.ts`
- Test: `tests/integration/lib/ifirma/get-pdf.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/integration/lib/ifirma/get-pdf.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFakturaPdf } from "@/lib/billing/ifirma/get-pdf";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.IFIRMA_USERNAME = "testuser";
  process.env.IFIRMA_INVOICE_KEY = "0123456789abcdef0123456789abcdef";
  delete process.env.IFIRMA_BASE_URL;
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  process.env = { ...ORIGINAL_ENV };
});

describe("getFakturaPdf", () => {
  it("GETs the .pdf endpoint with Accept: application/pdf and returns bytes", async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(pdfBytes, { status: 200, headers: { "Content-Type": "application/pdf" } })
    );
    globalThis.fetch = fetchMock;

    const buf = await getFakturaPdf("1244512");

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://www.ifirma.pl/iapi/fakturakraj/1244512.pdf"
    );
    expect(fetchMock.mock.calls[0][1].headers.Accept).toBe("application/pdf");
    expect(new Uint8Array(buf)).toEqual(pdfBytes);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**
```bash
npm run test -- ifirma/get-pdf
```

- [ ] **Step 3: Implement get-pdf**

Create `lib/billing/ifirma/get-pdf.ts`:

```ts
import { ifirmaGetBinary } from "./client";

/** Fetch the rendered faktura PDF bytes from iFirma (authenticated). */
export async function getFakturaPdf(
  providerInvoiceId: string
): Promise<ArrayBuffer> {
  return ifirmaGetBinary(
    `/fakturakraj/${encodeURIComponent(providerInvoiceId)}.pdf`
  );
}
```

- [ ] **Step 4: Create the barrel**

Create `lib/billing/ifirma/index.ts`:

```ts
export { issueFaktura } from "./issue-faktura";
export type { IssueFakturaResult } from "./issue-faktura";

export { sendToKsef } from "./send-to-ksef";
export type { SendToKsefOptions } from "./send-to-ksef";

export { issueKorekta } from "./issue-korekta";
export type { IssueKorektaParams, IssueKorektaResult } from "./issue-korekta";

export { getKsefStatus } from "./get-status";
export { getFakturaPdf } from "./get-pdf";

export { IfirmaApiError } from "./types";
export type {
  IfirmaInvoiceRequest,
  IfirmaKontrahent,
  IfirmaPozycja,
  KsefInvoiceResult
} from "./types";
```

- [ ] **Step 5: Run the test + tsc**
```bash
npm run test -- ifirma/get-pdf && npx tsc --noEmit 2>&1 | grep "ifirma/" || echo "ifirma module clean"
```
Expected: PASS; no tsc errors inside `lib/billing/ifirma/`.

- [ ] **Step 6: Commit**
```bash
git add lib/billing/ifirma/get-pdf.ts lib/billing/ifirma/index.ts tests/integration/lib/ifirma/get-pdf.test.ts
git commit -m "feat(ifirma): getFakturaPdf + barrel exports"
```

---

## Task 10: build-ifirma-faktura mapper

**Files:**
- Create: `lib/billing/build-ifirma-faktura.ts`
- Test: `tests/integration/lib/build-ifirma-faktura.test.ts`

Pure mapper: `stripe_purchases` row → `IfirmaInvoiceRequest`. Net unit price from `unit_price_cents`; gross `Zaplacono = round(netTotal × 1.23, 2)`.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/lib/build-ifirma-faktura.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildIfirmaFaktura } from "@/lib/billing/build-ifirma-faktura";

const samplePurchase = {
  id: "purchase-uuid",
  package_size: 50,
  unit_price_cents: 156,     // 1.56 PLN net per credit
  total_amount_cents: 7800,  // 78.00 PLN net total
  currency: "pln",
  buyer_nip: "5260250995",
  buyer_business_name: "ACME Sp. z o.o.",
  buyer_email: "biuro@acme.pl",
  buyer_address_line1: "ul. Marszałkowska 1",
  buyer_address_line2: null,
  buyer_postal_code: "00-001",
  buyer_city: "Warszawa",
  buyer_country: "PL",
  created_at: "2026-05-28T10:00:00Z"
};

describe("buildIfirmaFaktura", () => {
  it("maps buyer into a Kontrahent with OsobaFizyczna=false", () => {
    const body = buildIfirmaFaktura(samplePurchase);
    expect(body.Kontrahent.NIP).toBe("5260250995");
    expect(body.Kontrahent.Nazwa).toBe("ACME Sp. z o.o.");
    expect(body.Kontrahent.Ulica).toBe("ul. Marszałkowska 1");
    expect(body.Kontrahent.KodPocztowy).toBe("00-001");
    expect(body.Kontrahent.Miejscowosc).toBe("Warszawa");
    expect(body.Kontrahent.Kraj).toBe("Polska");
    expect(body.Kontrahent.OsobaFizyczna).toBe(false);
  });

  it("strips PL prefix and separators from NIP", () => {
    expect(buildIfirmaFaktura({ ...samplePurchase, buyer_nip: "PL526-025-09-95" }).Kontrahent.NIP).toBe("5260250995");
  });

  it("concatenates line1 + line2 into Ulica", () => {
    const body = buildIfirmaFaktura({ ...samplePurchase, buyer_address_line2: "lok. 5" });
    expect(body.Kontrahent.Ulica).toBe("ul. Marszałkowska 1, lok. 5");
  });

  it("emits one net Pozycja with decimal VAT and TypStawkiVat=PRC", () => {
    const body = buildIfirmaFaktura(samplePurchase);
    expect(body.LiczOd).toBe("NET");
    expect(body.Pozycje).toHaveLength(1);
    expect(body.Pozycje[0].StawkaVat).toBe(0.23);
    expect(body.Pozycje[0].TypStawkiVat).toBe("PRC");
    expect(body.Pozycje[0].Ilosc).toBe(50);
    expect(body.Pozycje[0].CenaJednostkowa).toBe(1.56);
    expect(body.Pozycje[0].NazwaPelna).toBe("KSeF Translator — pakiet 50 kredytów");
  });

  it("sets Zaplacono to the gross total (net × 1.23, rounded to 2dp)", () => {
    const body = buildIfirmaFaktura(samplePurchase);
    // 78.00 net × 1.23 = 95.94
    expect(body.Zaplacono).toBe(95.94);
  });

  it("uses the purchase created_at date for DataWystawienia and DataSprzedazy", () => {
    const body = buildIfirmaFaktura(samplePurchase);
    expect(body.DataWystawienia).toBe("2026-05-28");
    expect(body.DataSprzedazy).toBe("2026-05-28");
  });

  it("throws when buyer_nip is missing", () => {
    expect(() => buildIfirmaFaktura({ ...samplePurchase, buyer_nip: null })).toThrow(/buyer_nip/);
  });

  it("throws when buyer_business_name is missing", () => {
    expect(() => buildIfirmaFaktura({ ...samplePurchase, buyer_business_name: null })).toThrow(/buyer_business_name/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**
```bash
npm run test -- build-ifirma-faktura
```

- [ ] **Step 3: Implement**

Create `lib/billing/build-ifirma-faktura.ts`:

```ts
import type { IfirmaInvoiceRequest } from "./ifirma";

/** Subset of stripe_purchases columns needed to build an iFirma invoice. */
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

const PL_VAT_RATE = 0.23;

function normalizeNip(raw: string): string {
  return raw.replace(/^PL/i, "").replace(/[-.\s]/g, "");
}

function buildStreet(line1: string | null, line2: string | null): string | undefined {
  const parts = [line1, line2]
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p && p.length > 0));
  return parts.length > 0 ? parts.join(", ") : undefined;
}

/** Polish full country name iFirma expects. Default "Polska". */
function countryName(code: string | null): string {
  // We only sell B2B to PL-NIP holders, so PL is the norm. Map the common
  // ISO code; otherwise pass through whatever's stored (iFirma accepts the
  // Polish country name — verify exotic cases against live creds).
  if (!code || code.toUpperCase() === "PL") return "Polska";
  return code;
}

export function buildIfirmaFaktura(row: PurchaseRow): IfirmaInvoiceRequest {
  if (!row.buyer_nip || row.buyer_nip.trim() === "") {
    throw new Error(`buyer_nip missing on stripe_purchases ${row.id} — cannot issue B2B faktura`);
  }
  if (!row.buyer_business_name || row.buyer_business_name.trim() === "") {
    throw new Error(`buyer_business_name missing on stripe_purchases ${row.id} — cannot issue B2B faktura`);
  }

  const issueDate = row.created_at.slice(0, 10);
  const unitNet = row.unit_price_cents / 100;
  const netTotalCents = row.unit_price_cents * row.package_size;
  // Gross = net × 1.23, rounded to grosze, then to PLN.
  const grossCents = Math.round(netTotalCents * (1 + PL_VAT_RATE));
  const zaplacono = grossCents / 100;

  return {
    Zaplacono: zaplacono,
    LiczOd: "NET",
    DataWystawienia: issueDate,
    DataSprzedazy: issueDate,
    FormatDatySprzedazy: "DZN",
    SposobZaplaty: "PRZ",
    NazwaSeriiNumeracji: "default",
    Pozycje: [
      {
        StawkaVat: PL_VAT_RATE,
        Ilosc: row.package_size,
        CenaJednostkowa: unitNet,
        NazwaPelna: `KSeF Translator — pakiet ${row.package_size} kredytów`,
        Jednostka: "szt",
        PKWiU: "",
        TypStawkiVat: "PRC"
      }
    ],
    Kontrahent: {
      Nazwa: row.buyer_business_name,
      NIP: normalizeNip(row.buyer_nip),
      Ulica: buildStreet(row.buyer_address_line1, row.buyer_address_line2),
      KodPocztowy: row.buyer_postal_code ?? undefined,
      Miejscowosc: row.buyer_city ?? undefined,
      Kraj: countryName(row.buyer_country),
      Email: row.buyer_email ?? undefined,
      OsobaFizyczna: false
    }
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**
```bash
npm run test -- build-ifirma-faktura
```
Expected: 8 PASS.

- [ ] **Step 5: Commit**
```bash
git add lib/billing/build-ifirma-faktura.ts tests/integration/lib/build-ifirma-faktura.test.ts
git commit -m "feat(billing): build-ifirma-faktura mapper (net prices, gross Zaplacono, Kontrahent)"
```

---

## Task 11: Rewire the webhook for iFirma

**Files:**
- Modify: `app/api/stripe/webhook/route.ts`

The webhook currently imports `buildFakturaParams` + `issueFaktura` from Fakturownia, inserts into `fakturownia_invoices`, and references `fakturownia_id`. Rewire to iFirma's two-step issue and the renamed table.

- [ ] **Step 1: Read the current file** so you match its exact structure:
```bash
cat app/api/stripe/webhook/route.ts
```

- [ ] **Step 2: Swap imports**

Replace:
```ts
import { buildFakturaParams } from "@/lib/billing/build-faktura-params";
import { issueFaktura } from "@/lib/billing/fakturownia";
```
with:
```ts
import { buildIfirmaFaktura } from "@/lib/billing/build-ifirma-faktura";
import { issueFaktura, sendToKsef } from "@/lib/billing/ifirma";
```

- [ ] **Step 3: Rename table + column references in `handleCheckoutCompleted`**

- All `.from("fakturownia_invoices")` → `.from("ksef_invoices")`.
- The insert stays `{ stripe_purchase_id, kind: "vat", gov_status: "pending" }` (unchanged column names there).

- [ ] **Step 4: Replace `tryIssueFakturaInline` with the two-step iFirma flow**

Replace the whole `tryIssueFakturaInline` function body with:

```ts
async function tryIssueFakturaInline(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  ksefInvoiceRowId: string,
  stripePurchaseId: string
): Promise<void> {
  try {
    const fullRow = await admin
      .from("stripe_purchases")
      .select("id, package_size, unit_price_cents, total_amount_cents, currency, buyer_nip, buyer_business_name, buyer_email, buyer_address_line1, buyer_address_line2, buyer_postal_code, buyer_city, buyer_country, created_at")
      .eq("id", stripePurchaseId)
      .single();
    if (fullRow.error || !fullRow.data) {
      console.error(`[webhook] failed to reload stripe_purchases ${stripePurchaseId} for inline faktura`);
      return;
    }

    // Step 1: create the invoice in iFirma.
    const body = buildIfirmaFaktura(fullRow.data);
    const { providerInvoiceId } = await issueFaktura(body);

    // Persist the provider id immediately so a crash before the KSeF send
    // doesn't lose it (the cron resumes from provider_invoice_id).
    await admin
      .from("ksef_invoices")
      .update({ provider_invoice_id: providerInvoiceId, attempt_count: 1 })
      .eq("id", ksefInvoiceRowId);

    // Step 2: submit to KSeF.
    await sendToKsef(providerInvoiceId, { korekta: false });

    await admin
      .from("ksef_invoices")
      .update({ gov_status: "processing", last_error: null })
      .eq("id", ksefInvoiceRowId);
  } catch (error) {
    console.error(`[webhook] inline iFirma issue failed for purchase ${stripePurchaseId}:`, error);
    await admin
      .from("ksef_invoices")
      .update({
        gov_status: "failed",
        last_error: error instanceof Error ? error.message : String(error),
        attempt_count: 1
      })
      .eq("id", ksefInvoiceRowId);
  }
}
```

- [ ] **Step 5: Rename table references in `handleChargeRefunded`**

- `.from("fakturownia_invoices")` → `.from("ksef_invoices")` (both the lookup of the original `kind='vat'` row and the korekta insert). The korekta insert stays `{ stripe_purchase_id, kind: "correction", parent_id, gov_status: "pending" }`.

- [ ] **Step 6: Verify lint + tsc**
```bash
source ~/.nvm/nvm.sh && nvm use 22 > /dev/null && npm run lint && npx tsc --noEmit 2>&1 | grep "webhook/route" || echo "webhook clean"
```
Expected: no tsc errors in `webhook/route.ts` (other files fixed in later tasks may still error).

- [ ] **Step 7: Commit**
```bash
git add app/api/stripe/webhook/route.ts
git commit -m "feat(webhook): two-step iFirma issue (create + send-to-KSeF); ksef_invoices rename"
```

---

## Task 12: Rewire the cron for iFirma + delete Fakturownia

**Files:**
- Modify: `app/api/cron/poll-ksef/route.ts`
- Delete: `lib/billing/fakturownia/` (6 files), `tests/integration/lib/fakturownia/` (4 files), `lib/billing/build-faktura-params.ts`, `tests/integration/lib/build-faktura-params.test.ts`

- [ ] **Step 1: Read the current cron** so you match its structure:
```bash
cat app/api/cron/poll-ksef/route.ts
```

- [ ] **Step 2: Swap imports**

Replace the Fakturownia imports with:
```ts
import { buildIfirmaFaktura } from "@/lib/billing/build-ifirma-faktura";
import {
  issueFaktura,
  sendToKsef,
  issueKorekta,
  getKsefStatus
} from "@/lib/billing/ifirma";
```

- [ ] **Step 3: Rename table + column references throughout**

- `.from("fakturownia_invoices")` → `.from("ksef_invoices")` (all occurrences).
- `fakturownia_id` → `provider_invoice_id` (all occurrences — in selects, the embedded join select string, and update payloads).
- The embedded join `stripe_purchases(...)` select keeps the same columns (they're on `stripe_purchases`, unchanged).

- [ ] **Step 4: Replace the pending-pass `kind === "vat"` branch with the two-step + idempotency guard**

For a pending/failed `vat` row, the create call must not run twice. Use `provider_invoice_id` as the guard:

```ts
if (row.kind === "vat") {
  let providerInvoiceId = row.provider_invoice_id as string | null;

  // Step 1: create the invoice only if we haven't already.
  if (!providerInvoiceId) {
    const body = buildIfirmaFaktura(purchase);
    const created = await issueFaktura(body);
    providerInvoiceId = created.providerInvoiceId;
    await admin
      .from("ksef_invoices")
      .update({ provider_invoice_id: providerInvoiceId, attempt_count: row.attempt_count + 1 })
      .eq("id", row.id);
  }

  // Step 2: send to KSeF.
  await sendToKsef(providerInvoiceId, { korekta: false });
  await admin
    .from("ksef_invoices")
    .update({ gov_status: "processing", last_error: null, attempt_count: row.attempt_count + 1 })
    .eq("id", row.id);

  processed.push({ ksef_invoice_id: row.id, action: "issued", gov_status: "processing" });
  continue;
}
```

(Rename the `fakturownia_invoice_id` field in the `ProcessedItem` type + push sites to `ksef_invoice_id`.)

- [ ] **Step 5: Replace the `kind === "correction"` branch**

Once the parent is `gov_status === "ok"` and has a `provider_invoice_id`, issue the korekta then send it:

```ts
const built = buildIfirmaFaktura(purchase);
const korekta = await issueKorekta({
  originalProviderInvoiceId: parent.data.provider_invoice_id,
  reason: "ZWR_SPRZ_TOW",
  issueDate: new Date().toISOString().slice(0, 10),
  sposobZaplaty: "KOM",
  zaplacono: 0,
  // Full refund: corrected quantity 0 (everything returned). iFirma computes
  // the delta from the original. Verify partial-refund semantics with live creds.
  positions: built.Pozycje.map((p) => ({ ...p, Ilosc: 0 }))
});
await admin
  .from("ksef_invoices")
  .update({ provider_invoice_id: korekta.providerInvoiceId, attempt_count: row.attempt_count + 1 })
  .eq("id", row.id);
await sendToKsef(korekta.providerInvoiceId, { korekta: true });
await admin
  .from("ksef_invoices")
  .update({ gov_status: "processing", last_error: null })
  .eq("id", row.id);
processed.push({ ksef_invoice_id: row.id, action: "korekta_issued", gov_status: "processing" });
continue;
```

The parent lookup select must include `provider_invoice_id` (was `fakturownia_id`).

- [ ] **Step 6: Replace the processing-pass poll**

Replace `getFakturaStatus(row.fakturownia_id)` with `getKsefStatus(row.provider_invoice_id)`; the processing query selects `id, provider_invoice_id, attempt_count` and filters `.not("provider_invoice_id", "is", null)`. Persist `gov_status`, `gov_id`, `last_error`, `attempt_count + 1` from the `KsefInvoiceResult`. Drop the old `mapFakturowniaToDbStatus` helper — `KsefInvoiceResult.govStatus` is already the DB enum.

- [ ] **Step 7: Delete the Fakturownia adapter, its tests, and the old mapper**
```bash
git rm -r lib/billing/fakturownia tests/integration/lib/fakturownia
git rm lib/billing/build-faktura-params.ts tests/integration/lib/build-faktura-params.test.ts
```

- [ ] **Step 8: Verify lint + tsc + the iFirma tests**
```bash
source ~/.nvm/nvm.sh && nvm use 22 > /dev/null
npx tsc --noEmit
npm run lint
npm run test -- tests/integration/lib/ifirma tests/integration/lib/build-ifirma-faktura tests/integration/api/cron-poll-ksef
```
Expected: tsc clean (no more `fakturownia` references anywhere), lint clean, iFirma + cron tests green. The existing `tests/integration/api/cron-poll-ksef.test.ts` (auth/skip/empty-work cases) should still pass since its mocked admin client returns empty arrays; if it referenced `fakturownia_invoices` in a mock, update those strings to `ksef_invoices`.

- [ ] **Step 9: Commit**
```bash
git add -A
git commit -m "feat(cron): iFirma two-step issue + korekta + status poll; remove Fakturownia adapter"
```

---

## Task 13: PDF proxy route

**Files:**
- Create: `app/api/invoices/[id]/pdf/route.ts`
- Test: `tests/integration/api/invoice-pdf.test.ts`

`id` is the `ksef_invoices.id`. The route verifies the logged-in user owns the underlying purchase (via RLS-respecting client), then streams the iFirma PDF.

- [ ] **Step 1: Write the failing test**

Create `tests/integration/api/invoice-pdf.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

// Mocks for the route's dependencies.
const getUser = vi.fn();
const maybeSingle = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: getUser },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle }) })
    })
  })
}));
const getFakturaPdf = vi.fn();
vi.mock("@/lib/billing/ifirma", () => ({ getFakturaPdf: (id: string) => getFakturaPdf(id) }));

import { GET } from "@/app/api/invoices/[id]/pdf/route";

beforeEach(() => {
  process.env.IFIRMA_USERNAME = "u";
  process.env.IFIRMA_INVOICE_KEY = "0123456789abcdef0123456789abcdef";
  getUser.mockReset();
  maybeSingle.mockReset();
  getFakturaPdf.mockReset();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function req(): Request {
  return new Request("http://localhost/api/invoices/ksef-1/pdf");
}

describe("GET /api/invoices/[id]/pdf", () => {
  it("401 when not authenticated", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await GET(req(), { params: Promise.resolve({ id: "ksef-1" }) });
    expect(res.status).toBe(401);
  });

  it("404 when the ksef_invoice row is not visible to the user (RLS)", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const res = await GET(req(), { params: Promise.resolve({ id: "ksef-1" }) });
    expect(res.status).toBe(404);
  });

  it("404 when the row has no provider_invoice_id yet", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    maybeSingle.mockResolvedValue({ data: { id: "ksef-1", provider_invoice_id: null }, error: null });
    const res = await GET(req(), { params: Promise.resolve({ id: "ksef-1" }) });
    expect(res.status).toBe(404);
  });

  it("streams the PDF with application/pdf when authorized", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    maybeSingle.mockResolvedValue({ data: { id: "ksef-1", provider_invoice_id: "1244512" }, error: null });
    getFakturaPdf.mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer);
    const res = await GET(req(), { params: Promise.resolve({ id: "ksef-1" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(getFakturaPdf).toHaveBeenCalledWith("1244512");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**
```bash
npm run test -- invoice-pdf
```

- [ ] **Step 3: Implement**

Create `app/api/invoices/[id]/pdf/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getFakturaPdf } from "@/lib/billing/ifirma";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // RLS on ksef_invoices restricts SELECT to rows whose parent stripe_purchase
  // belongs to the caller, so a returned row implies ownership.
  const row = await supabase
    .from("ksef_invoices")
    .select("id, provider_invoice_id")
    .eq("id", id)
    .maybeSingle();

  if (!row.data || !row.data.provider_invoice_id) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  try {
    const pdf = await getFakturaPdf(row.data.provider_invoice_id);
    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="faktura-${row.data.provider_invoice_id}.pdf"`,
        "Cache-Control": "private, max-age=300"
      }
    });
  } catch (error) {
    console.error(`[api/invoices/${id}/pdf] iFirma PDF fetch failed:`, error);
    return NextResponse.json({ error: "PDF unavailable" }, { status: 502 });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**
```bash
npm run test -- invoice-pdf
```
Expected: 4 PASS.

- [ ] **Step 5: Commit**
```bash
git add app/api/invoices/[id]/pdf/route.ts tests/integration/api/invoice-pdf.test.ts
git commit -m "feat(api): authenticated iFirma faktura PDF proxy route"
```

---

## Task 14: Billing UI — point the PDF link at the proxy

**Files:**
- Modify: `components/billing/purchase-history.tsx`

The component currently joins `fakturownia_invoices` and links to `pdf_url`. Switch to `ksef_invoices` and link to the proxy route by the row id.

- [ ] **Step 1: Read the current file**:
```bash
cat components/billing/purchase-history.tsx
```

- [ ] **Step 2: Update the embedded select**

Change the join from `fakturownia_invoices(...)` to:
```ts
ksef_invoices(id, kind, provider_invoice_id, gov_status, gov_id, created_at)
```
(Drop `pdf_url` — we no longer store it; the link is derived from the row id.)

- [ ] **Step 3: Update the `findVatFaktura` helper + the PDF link**

The helper should read from `ksef_invoices` and surface the row `id` + `gov_status`. Replace the badge-cell IIFE so the link points at the proxy when the vat row is `ok`:

```tsx
const fakturaRows = (row as unknown as {
  ksef_invoices: { id: string; kind: string; gov_status: string; provider_invoice_id: string | null }[] | null;
}).ksef_invoices;
const vat = fakturaRows?.find((r) => r.kind === "vat") ?? null;
const status = (vat?.gov_status ?? "none") as FakturaStatus;
return (
  <div className="flex flex-wrap items-center gap-2">
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-micro font-medium ${fakturaBadgeClass(status)}`}>
      {fakturaLabel(status, t)}
    </span>
    {vat && vat.gov_status === "ok" && vat.provider_invoice_id ? (
      <a
        href={`/api/invoices/${vat.id}/pdf`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-small font-medium text-accent hover:text-accent-hover"
      >
        {String(t.fakturaDownload)}
      </a>
    ) : null}
  </div>
);
```

Where `FakturaStatus` is `"pending" | "processing" | "ok" | "send_error" | "failed" | "none"`. Keep the existing `fakturaBadgeClass` / `fakturaLabel` helpers (they already map these states); just ensure the `"none"` default still yields the muted "—" badge.

- [ ] **Step 4: Run the existing UI test + lint + tsc**
```bash
source ~/.nvm/nvm.sh && nvm use 22 > /dev/null
npm run test -- purchase-history
npx tsc --noEmit
npm run lint
```
Expected: the existing `purchase-history.test.tsx` may reference `fakturownia_invoices` in its mock rows — update those keys to `ksef_invoices` and the PDF assertion to expect an `/api/invoices/<id>/pdf` href instead of an external URL. All green after.

- [ ] **Step 5: Commit**
```bash
git add components/billing/purchase-history.tsx tests/components/billing/purchase-history.test.tsx
git commit -m "feat(billing): point faktura PDF link at the iFirma proxy route; ksef_invoices rename"
```

---

## Task 15: Env vars + cleanup

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Replace the Fakturownia block with iFirma**

In `.env.example`, remove the `FAKTUROWNIA_ACCOUNT` / `FAKTUROWNIA_API_TOKEN` / `FAKTUROWNIA_ENV` lines and replace with:

```env
# ── iFirma (Stripe → KSeF bridge) ──────────────────────────────────────
# iFirma login (the account that owns the invoices).
IFIRMA_USERNAME=
# The "faktura" API key from iFirma → Konto → Konfiguracja → Klucze API.
# Hex-encoded; the client hex-decodes it before HMAC-SHA1 signing.
IFIRMA_INVOICE_KEY=
# Optional base URL override (defaults to https://www.ifirma.pl/iapi).
IFIRMA_BASE_URL=
```

Keep the existing `KSEF_LIVE` and `CRON_SECRET` lines (update the `KSEF_LIVE` comment to drop the Fakturownia reference: "When false the webhook + cron skip iFirma entirely…").

- [ ] **Step 2: Grep for any stray Fakturownia references**
```bash
grep -rni "fakturownia" app/ lib/ components/ tests/ .env.example 2>/dev/null
```
Expected: NO results. If any remain (a comment, a leftover import), fix them.

- [ ] **Step 3: Commit**
```bash
git add .env.example
git commit -m "chore(env): replace Fakturownia vars with iFirma; drop stray references"
```

---

## Final verification

- [ ] **Step F1: Full in-scope test run**
```bash
source ~/.nvm/nvm.sh && nvm use 22 > /dev/null
npm run test -- tests/integration/lib/ifirma tests/integration/lib/build-ifirma-faktura tests/integration/api/cron-poll-ksef tests/integration/api/invoice-pdf tests/components/billing/purchase-history
```
Expected: all green (auth 4, client 8, issue-faktura 2, send-to-ksef 2, get-status 4, issue-korekta 1, get-pdf 1, build-ifirma-faktura 8, cron 4, invoice-pdf 4, purchase-history 4).

- [ ] **Step F2: Lint + typecheck + no-Fakturownia check**
```bash
npm run lint && npx tsc --noEmit && grep -rni "fakturownia" app/ lib/ components/ tests/ supabase/migrations/20260528000001_rename_to_ksef_invoices.sql || echo "no fakturownia references in code (migration drop statement is allowed)"
```
Expected: lint + tsc clean. The only acceptable `fakturownia` hits are the `drop table` / `drop function` lines in the rename migration.

- [ ] **Step F3: Push + PR**
```bash
git push -u origin claude/ifirma-ksef-migration
gh pr create --title "Migrate KSeF bridge from Fakturownia to iFirma" --body "$(cat <<'EOF'
## Summary

Replaces the Fakturownia KSeF bridge (PR #28/#29) with an iFirma.pl integration, since the company already uses iFirma for accounting — keeping invoicing and bookkeeping in one system.

- New `lib/billing/ifirma/` adapter: HMAC-SHA1 auth, `issueFaktura` (create), `sendToKsef` (separate KSeF submission), `issueKorekta`, defensive `getKsefStatus`, `getFakturaPdf`.
- Two-step issue (iFirma create → KSeF send), with `provider_invoice_id` as the idempotency guard so retries never double-create.
- DB: `fakturownia_invoices` → `ksef_invoices` (provider-neutral), `fakturownia_id` → `provider_invoice_id`. Table was empty so drop+recreate is zero-risk.
- PDF: iFirma has no public URL → authenticated `/api/invoices/[id]/pdf` proxy.
- Deleted the Fakturownia adapter, its tests, and the old mapper.
- Ships behind `KSEF_LIVE=false`.

## Known unknown (build-defensively decision)
iFirma's docs don't document the KSeF-status response shape. `getKsefStatus` scans for a `*ksef*` field matching a numer-KSeF pattern and logs the raw body; we tighten it once verified against live creds. Korekta semantics (full vs partial refund, `Ilosc:0`) likewise need a live confirmation.

## Test plan
- [ ] All in-scope unit/integration tests green
- [ ] With real `IFIRMA_USERNAME` + `IFIRMA_INVOICE_KEY`, the Task 2.5 probe authenticates (HTTP 200, Kod 0)
- [ ] `KSEF_LIVE=true` + a Stripe test purchase → `ksef_invoices` row goes pending → processing → ok; `provider_invoice_id` set
- [ ] Confirm the real KSeF-status field name from the logged raw body; tighten `getKsefStatus`
- [ ] PDF link in /billing streams the iFirma PDF via the proxy
- [ ] Refund → korekta row → cron issues + sends it after parent is `ok`

## Reference
Plan: docs/superpowers/plans/2026-05-28-ifirma-ksef-migration.md
EOF
)"
```
Print the PR URL.

---

## Self-Review Notes

**Spec coverage** (vs the user's three iFirma docs + the four decisions):
- Auth header (HMAC-SHA1, hex key, `faktura` keyName, query-strip) → Task 3 + Task 4. ✓
- Issue domestic invoice (`/fakturakraj.json`, net prices, decimal VAT, Kontrahent) → Task 5 + Task 10. ✓
- Send to KSeF (separate `/ksef/send/<id>.json`, `DataWysylki:null`) → Task 6. ✓
- Replace Fakturownia → Tasks 11, 12 (delete). ✓
- Rename table/column → Task 1. ✓
- Build defensively for status → Task 7 + Task 2.5 verification spike. ✓
- PDF proxy route → Tasks 9, 13, 14. ✓

**Placeholder scan:** No `TBD`/`implement later`. The defensive `getKsefStatus` and korekta `Ilosc:0` are explicitly flagged as "verify against live creds" per the build-defensively decision — that's a deliberate known-unknown, documented with a verification task (2.5), not a placeholder.

**Type consistency:**
- `KsefInvoiceResult.govStatus` uses the same enum as the DB `gov_status` CHECK — no `mapFakturowniaToDbStatus` shim needed (it's deleted in Task 12).
- `provider_invoice_id` is the column name in Task 1's migration and is used identically in Tasks 11, 12, 13, 14.
- `buildIfirmaFaktura` returns `IfirmaInvoiceRequest` (Task 2 type), consumed by Tasks 5/11/12.
- `IfirmaPozycja` shape (defined Task 2) is reused by the korekta `positions.map(p => ({ ...p, Ilosc: 0 }))` in Task 12 — same field names.
- The cron's `ProcessedItem.ksef_invoice_id` rename (Task 12 step 4) is applied consistently at all push sites.

**Risk hotspots (flagged for the verification spike / live-creds session):**
1. HMAC message construction — the single most likely thing iFirma rejects. Covered by deterministic unit tests AND the Task 2.5 live probe.
2. KSeF-status field name — unknown; `getKsefStatus` is defensive + logs raw. Task 2.5 + the PR test plan close it.
3. Korekta `Ilosc:0` semantics for a full refund — assumption; flagged for live verification.
4. `Zaplacono` gross rounding — assumes net × 1.23; verify against a real iFirma-rendered invoice that the VAT total matches Stripe Tax to the grosz.
