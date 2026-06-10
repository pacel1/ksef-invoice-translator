# Landing Demo Sprint C (the upload lane) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an anonymous landing visitor upload their own KSeF FA(3) invoice (XML or PDF), see it translated live in the demo stage, and download it through the existing email gate, fully stateless and behind Turnstile + per-IP caps + a global daily circuit breaker.

**Architecture:** A new `upload-panel` in the demo section validates the file client-side and POSTs it (multipart) to a new stateless `POST /api/demo/translate`: Turnstile verify -> per-IP + global translate counters (one atomic SQL function) -> MIME/size checks -> parse (`parseKsefXml` / `parseKsefPdf`) -> `translateInvoiceFreeText` -> respond with `{ invoice, sourceXml, uploadToken }`. The `uploadToken` is an HMAC token binding a sha256 content hash of the exact response, so `/api/demo/pdf` (extended for `source: "upload"`) only ever renders content that actually passed the translate pipeline. `/api/demo/pdf` also gains a per-IP daily render cap (the Sprint B fast-follow). Nothing is persisted except salted-IP-hash counters in `demo_usage`.

**Tech Stack:** Next.js 15 App Router (`runtime = "nodejs"`), React 19, TypeScript, TailwindCSS, Supabase (service-role RPC counters), `@marsidev/react-turnstile` (already a dep), `node:crypto` HMAC + SHA-256, Vitest + Testing Library (jsdom), Playwright.

**Branch:** `claude/landing-demo-upload` (already created off `main`). One PR for this sprint. The live landing (`app/page.tsx`, `components/marketing/**`) stays untouched.

---

## Security decision (resolved, per the approved spec's open item)

The stateless download means the client re-sends `{ invoice, sourceXml }` to `/api/demo/pdf` for an `upload` download token. Without extra protection, one passed gate = 10 minutes of rendering arbitrary attacker JSON into official-looking MF PDFs. This plan implements **both** recommended mitigations:

1. **Content-hash binding (Task 3 + 6 + 7):** `/api/demo/translate` signs `uploadToken = HMAC({ hash: sha256(JSON.stringify(invoice) + "\0" + sourceXml), lang, exp })` over the exact payload it returns (TTL 60 minutes). `/api/demo/pdf` re-hashes the posted payload and refuses to render on any mismatch, then re-validates with `invoiceSchema` before rendering. The PDF route can therefore only render documents the translate pipeline produced.
2. **Per-IP cap on `/api/demo/pdf` itself (Task 1 + 4 + 7):** `increment_demo_pdf` + `consumePdf(ip)`, default `DEMO_PDF_PER_IP_PER_DAY=10`, applied to both `sample` and `upload` sources. This also closes the Sprint B fast-follow (leaked short-lived token re-rendering within its TTL).

JSON-stringify determinism note: the hash is computed over `JSON.stringify(invoice)`. The object goes server -> JSON wire -> client `JSON.parse` -> client `JSON.stringify` -> server `JSON.parse` -> server `JSON.stringify`. V8 preserves string-key insertion order through parse/stringify round-trips and the `Invoice` shape has no integer-like keys, so the bytes are stable end to end.

---

## Environment variables (server-side; all optional with defaults; document in `.env.example` in Task 6)

| Var | Default | Purpose |
| --- | --- | --- |
| `DEMO_TRANSLATE_PER_IP_PER_DAY` | 5 | Per-IP daily cap on `/api/demo/translate`. |
| `DEMO_GLOBAL_TRANSLATE_PER_DAY` | 500 | Global daily circuit breaker for `/api/demo/translate` (bounds worst-case OpenAI spend). |
| `DEMO_PDF_PER_IP_PER_DAY` | 10 | Per-IP daily cap on `/api/demo/pdf` renders. |
| `DEMO_MAX_XML_BYTES` | 1048576 | Max XML upload size (1 MB). |
| `DEMO_MAX_PDF_BYTES` | 8388608 | Max PDF upload size (8 MB). |

Existing Sprint B vars stay as-is (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`, `DEMO_TOKEN_SECRET`, `DEMO_IP_SALT`). Everything must remain testable WITHOUT them: the Turnstile dev-bypass and the `"dev"` client token already exist; tests set `DEMO_TOKEN_SECRET` themselves.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `supabase/migrations/<applied-ts>_demo_translate_pdf_counters.sql` (create) | `pdf_count` column, `increment_demo_translate(text)` (per-IP + `__global__` sentinel row, atomic), `increment_demo_pdf(text)`. |
| `lib/supabase/database.types.ts` (regenerate) | Types for the new column + functions. |
| `lib/demo/upload-limits.ts` (create) | Pure, client-safe: upload type detection (mirror of `detectSourceType`), accept string, size caps with server-side env override. |
| `lib/demo/signed-token.ts` (create) | Generic HMAC sign/verify with TTL + injectable `now` (extracted from `download-token.ts`). |
| `lib/demo/download-token.ts` (modify) | Delegates to `signed-token.ts`; public API and tests unchanged. |
| `lib/demo/upload-token.ts` (create) | `demoContentHash`, `signUploadToken`, `verifyUploadToken` (60-min TTL). |
| `lib/demo/rate-limit.ts` (modify) | Add `consumeTranslate(ip)` (per-IP + global breaker) and `consumePdf(ip)`. |
| `lib/landing/copy.ts` (modify) | Demo group gains upload-lane + §11 error strings (pl + en, no dashes). |
| `app/api/demo/translate/route.ts` (create) | The stateless translate endpoint (order per spec §12). |
| `app/api/demo/pdf/route.ts` (modify) | `source: "upload"` rendering (hash-bound, schema-revalidated) + per-IP pdf cap. |
| `app/api/demo/unlock/route.ts` (modify) | Accept optional `source` and sign it into the download token. |
| `components/landing/demo/invoice-stage.tsx` (modify) | Optional `upload` prop renders the uploaded invoice instead of the baked sample. |
| `components/landing/demo/upload-panel.tsx` (create) | Reveal link + dropzone + client validation + Turnstile + translate calls + re-translate on language switch. |
| `components/landing/demo/download-gate.tsx` (modify) | Pass `source`, re-send the upload payload to `/api/demo/pdf`, handle pdf 429/500. |
| `components/landing/demo/demo-section.tsx` (modify) | Own the `upload` state; wire panel -> stage -> gate. |
| `.env.example` (modify) | Document the demo env vars (Sprint B + C). |
| Tests | `tests/integration/lib/demo-upload-limits.test.ts`, `demo-upload-token.test.ts`, extend `demo-rate-limit.test.ts`, `landing-copy.test.ts`; `tests/integration/api/demo-translate.test.ts`, extend `demo-pdf.test.ts`, `demo-unlock.test.ts`; `tests/components/landing/upload-panel.test.tsx`, extend `invoice-stage.test.tsx`, `download-gate.test.tsx`, `demo-section.test.tsx`; extend `tests/e2e/landing-rebuild-preview.spec.ts`. |

Reuse note: the handoff points at `detectSourceType` in `lib/invoice/upload-service.ts`. It is not exported and that module drags server-only deps (supabase, synthetic-XML builder) into anything importing it, while the spec requires the SAME check client-side for fast feedback. So Task 2 creates one pure, client-safe helper used by BOTH the panel and the route (logic mirrored 1:1 from `detectSourceType`), and `upload-service.ts` stays untouched.

---

## Task 1: Migration: `pdf_count` + translate/pdf counter functions

**Files:**
- Create: `supabase/migrations/20260610000002_demo_translate_pdf_counters.sql` (renamed after apply, see Step 2)
- Regenerate: `lib/supabase/database.types.ts`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260610000002_demo_translate_pdf_counters.sql`:

```sql
-- Sprint C (upload lane): pdf render counter + translate counters (per IP and global).
-- The global counter lives in the same table under the sentinel ip_hash '__global__'.

alter table public.demo_usage
  add column pdf_count integer not null default 0;

-- Atomically increment the daily translate counter for an IP hash AND the global
-- daily counter, returning both new values in one row.
create or replace function public.increment_demo_translate(p_ip_hash text)
returns table (ip_count integer, global_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip integer;
  v_global integer;
begin
  insert into public.demo_usage (ip_hash, day, translate_count)
  values (p_ip_hash, current_date, 1)
  on conflict (ip_hash, day)
  do update set translate_count = public.demo_usage.translate_count + 1
  returning translate_count into v_ip;

  insert into public.demo_usage (ip_hash, day, translate_count)
  values ('__global__', current_date, 1)
  on conflict (ip_hash, day)
  do update set translate_count = public.demo_usage.translate_count + 1
  returning translate_count into v_global;

  return query select v_ip, v_global;
end;
$$;

revoke all on function public.increment_demo_translate(text) from public, anon, authenticated;
grant execute on function public.increment_demo_translate(text) to service_role;

-- Atomically increment the daily pdf-render counter for an IP hash.
create or replace function public.increment_demo_pdf(p_ip_hash text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.demo_usage (ip_hash, day, pdf_count)
  values (p_ip_hash, current_date, 1)
  on conflict (ip_hash, day)
  do update set pdf_count = public.demo_usage.pdf_count + 1
  returning pdf_count into v_count;
  return v_count;
end;
$$;

revoke all on function public.increment_demo_pdf(text) from public, anon, authenticated;
grant execute on function public.increment_demo_pdf(text) to service_role;
```

- [ ] **Step 2: Apply via the Supabase MCP** (project `ksef` = `tzfuboudblqdsdhhvrvs`; project rule: MCP or CLI only, never the dashboard)

Use the MCP `apply_migration` tool with name `demo_translate_pdf_counters` and the SQL above. `apply_migration` assigns its own version timestamp: after applying, run the MCP `list_migrations` tool, find the applied version, and RENAME the local file to `supabase/migrations/<applied-version>_demo_translate_pdf_counters.sql` so local files match remote history.

- [ ] **Step 3: Regenerate types**

Use the MCP `generate_typescript_types` tool and write the output over `lib/supabase/database.types.ts` (the npm `db:types` script targets a local stack; this project regenerates from the remote via MCP, same as Sprint B). Verify the file now contains `pdf_count` in the `demo_usage` row type and both `increment_demo_translate` (Returns includes `ip_count` and `global_count`) and `increment_demo_pdf` under `Functions`.

- [ ] **Step 4: Typecheck and commit**

```bash
npx tsc --noEmit
git add supabase/migrations/*demo_translate_pdf_counters.sql lib/supabase/database.types.ts
git commit -m "feat(landing-demo): translate + pdf rate-limit counters (per IP and global)"
```

---

## Task 2: Shared upload limits helper (client + server)

**Files:**
- Create: `lib/demo/upload-limits.ts`
- Test: `tests/integration/lib/demo-upload-limits.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/integration/lib/demo-upload-limits.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import {
  detectDemoUploadType,
  maxXmlBytes,
  maxPdfBytes,
  maxBytesFor,
  DEMO_UPLOAD_ACCEPT
} from "@/lib/demo/upload-limits";

beforeEach(() => {
  delete process.env.DEMO_MAX_XML_BYTES;
  delete process.env.DEMO_MAX_PDF_BYTES;
});

describe("demo upload limits", () => {
  it("detects xml by mime or extension", () => {
    expect(detectDemoUploadType("faktura.xml", "application/xml")).toBe("xml");
    expect(detectDemoUploadType("faktura.xml", "")).toBe("xml");
    expect(detectDemoUploadType("FAKTURA.XML", "text/xml")).toBe("xml");
  });

  it("detects pdf by mime or extension", () => {
    expect(detectDemoUploadType("faktura.pdf", "application/pdf")).toBe("pdf");
    expect(detectDemoUploadType("Faktura.PDF", "")).toBe("pdf");
  });

  it("returns null for anything else", () => {
    expect(detectDemoUploadType("notes.txt", "text/plain")).toBeNull();
    expect(detectDemoUploadType("invoice.docx", "")).toBeNull();
  });

  it("defaults to 1 MB xml and 8 MB pdf", () => {
    expect(maxXmlBytes()).toBe(1024 * 1024);
    expect(maxPdfBytes()).toBe(8 * 1024 * 1024);
    expect(maxBytesFor("xml")).toBe(maxXmlBytes());
    expect(maxBytesFor("pdf")).toBe(maxPdfBytes());
  });

  it("honours env overrides (server side)", () => {
    process.env.DEMO_MAX_XML_BYTES = "2048";
    process.env.DEMO_MAX_PDF_BYTES = "4096";
    expect(maxXmlBytes()).toBe(2048);
    expect(maxPdfBytes()).toBe(4096);
  });

  it("exposes an accept string covering both types", () => {
    expect(DEMO_UPLOAD_ACCEPT).toContain(".xml");
    expect(DEMO_UPLOAD_ACCEPT).toContain(".pdf");
    expect(DEMO_UPLOAD_ACCEPT).toContain("application/pdf");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails** — `npx vitest run tests/integration/lib/demo-upload-limits.test.ts` -> FAIL (module missing).

- [ ] **Step 3: Implement**

Create `lib/demo/upload-limits.ts`:

```typescript
/**
 * Shared constants and pure helpers for the demo upload lane, importable from
 * BOTH the client (fast feedback in the dropzone) and the server (authoritative
 * checks in /api/demo/translate). Type detection mirrors detectSourceType in
 * lib/invoice/upload-service.ts, which is not exported and not client-safe.
 * Env cap overrides only take effect server-side: non-NEXT_PUBLIC vars are
 * undefined in the browser bundle, so the client sees the defaults.
 */
export type DemoUploadType = "xml" | "pdf";

export const DEMO_UPLOAD_ACCEPT = ".xml,.pdf,application/xml,text/xml,application/pdf";

const DEFAULT_MAX_XML_BYTES = 1024 * 1024; // 1 MB
const DEFAULT_MAX_PDF_BYTES = 8 * 1024 * 1024; // 8 MB

export function detectDemoUploadType(name: string, mime: string): DemoUploadType | null {
  const lower = name.toLowerCase();
  if (mime === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  if (mime === "application/xml" || mime === "text/xml" || lower.endsWith(".xml")) return "xml";
  return null;
}

function capFromEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export function maxXmlBytes(): number {
  return capFromEnv("DEMO_MAX_XML_BYTES", DEFAULT_MAX_XML_BYTES);
}

export function maxPdfBytes(): number {
  return capFromEnv("DEMO_MAX_PDF_BYTES", DEFAULT_MAX_PDF_BYTES);
}

export function maxBytesFor(type: DemoUploadType): number {
  return type === "xml" ? maxXmlBytes() : maxPdfBytes();
}
```

- [ ] **Step 4: Run the test -> PASS.**

- [ ] **Step 5: Commit**

```bash
git add lib/demo/upload-limits.ts tests/integration/lib/demo-upload-limits.test.ts
git commit -m "feat(landing-demo): shared upload type + size limits (client and server)"
```

---

## Task 3: Generic signed token + the content-binding upload token

**Files:**
- Create: `lib/demo/signed-token.ts`, `lib/demo/upload-token.ts`
- Modify: `lib/demo/download-token.ts`
- Test: `tests/integration/lib/demo-upload-token.test.ts` (new); `tests/integration/lib/demo-download-token.test.ts` must stay green UNCHANGED (refactor guard)

- [ ] **Step 1: Write the failing test**

Create `tests/integration/lib/demo-upload-token.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { signUploadToken, verifyUploadToken, demoContentHash } from "@/lib/demo/upload-token";

beforeEach(() => {
  process.env.DEMO_TOKEN_SECRET = "unit-secret";
});

const NOW = 1_750_000_000_000;

describe("upload token", () => {
  it("round-trips a valid token within its 60-minute TTL", () => {
    const token = signUploadToken({ hash: "a".repeat(64), lang: "de" }, NOW);
    const result = verifyUploadToken(token, NOW + 59 * 60_000);
    expect(result.valid).toBe(true);
    expect(result.payload).toEqual({ hash: "a".repeat(64), lang: "de" });
  });

  it("rejects an expired token (61 minutes)", () => {
    const token = signUploadToken({ hash: "a".repeat(64), lang: "en" }, NOW);
    expect(verifyUploadToken(token, NOW + 61 * 60_000).valid).toBe(false);
  });

  it("rejects a tampered token and garbage", () => {
    const token = signUploadToken({ hash: "a".repeat(64), lang: "en" }, NOW);
    const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
    expect(verifyUploadToken(tampered, NOW + 1000).valid).toBe(false);
    expect(verifyUploadToken("not-a-token", NOW).valid).toBe(false);
    expect(verifyUploadToken("", NOW).valid).toBe(false);
  });

  it("rejects a payload missing the hash", () => {
    // A download token has the same signature scheme but no hash field.
    const { signDownloadToken } = require("@/lib/demo/download-token") as typeof import("@/lib/demo/download-token");
    const downloadToken = signDownloadToken({ lang: "en", source: "upload" }, NOW);
    expect(verifyUploadToken(downloadToken, NOW + 1000).valid).toBe(false);
  });
});

describe("demoContentHash", () => {
  it("is deterministic and sensitive to both invoice and xml", async () => {
    const invoice = { invoiceNumber: "FV 1", items: [{ name: "Stół" }] };
    const a = await demoContentHash(invoice, "<Faktura/>");
    const b = await demoContentHash(invoice, "<Faktura/>");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await demoContentHash({ ...invoice, invoiceNumber: "FV 2" }, "<Faktura/>")).not.toBe(a);
    expect(await demoContentHash(invoice, "<Faktura>x</Faktura>")).not.toBe(a);
  });

  it("survives a JSON wire round-trip unchanged", async () => {
    const invoice = { invoiceNumber: "FV 1", seller: { name: "Meble Dębowe" }, items: [{ name: "Stół", quantity: 1 }] };
    const roundTripped = JSON.parse(JSON.stringify(invoice));
    expect(await demoContentHash(roundTripped, "<x/>")).toBe(await demoContentHash(invoice, "<x/>"));
  });
});
```

- [ ] **Step 2: Run it -> FAIL** (`npx vitest run tests/integration/lib/demo-upload-token.test.ts`, module missing).

- [ ] **Step 3: Implement the generic signer**

Create `lib/demo/signed-token.ts`:

```typescript
import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string {
  const value = process.env.DEMO_TOKEN_SECRET;
  if (!value) throw new Error("DEMO_TOKEN_SECRET is not configured.");
  return value;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function hmac(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

/** Returns `base64url(payload+exp).base64url(hmac)`. `now` is injectable for tests. */
export function signPayload(payload: object, ttlMs: number, now: number = Date.now()): string {
  const body = b64url(JSON.stringify({ ...payload, exp: now + ttlMs }));
  return `${body}.${hmac(body)}`;
}

/** Verifies the signature and expiry; the caller validates the payload shape. */
export function verifyPayload(
  token: string,
  now: number = Date.now()
): { valid: boolean; payload?: Record<string, unknown> } {
  const parts = token.split(".");
  if (parts.length !== 2) return { valid: false };
  const [body, sig] = parts;
  const a = Buffer.from(sig);
  const b = Buffer.from(hmac(body));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { valid: false };
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
    if (typeof parsed.exp !== "number" || parsed.exp < now) return { valid: false };
    return { valid: true, payload: parsed };
  } catch {
    return { valid: false };
  }
}
```

- [ ] **Step 4: Refactor `lib/demo/download-token.ts` to delegate** (public API identical; its existing test file is the refactor guard and must not be edited)

Replace the whole file with:

```typescript
import { signPayload, verifyPayload } from "@/lib/demo/signed-token";

const TTL_MS = 10 * 60 * 1000;

export interface DownloadTokenPayload {
  lang: string;
  source: "sample" | "upload";
}

/** Returns `base64url(payload).base64url(hmac)`. `now` is injectable for tests. */
export function signDownloadToken(payload: DownloadTokenPayload, now: number = Date.now()): string {
  return signPayload(payload, TTL_MS, now);
}

export function verifyDownloadToken(
  token: string,
  now: number = Date.now()
): { valid: boolean; payload?: DownloadTokenPayload } {
  const result = verifyPayload(token, now);
  if (!result.valid || !result.payload) return { valid: false };
  const { lang, source } = result.payload;
  if (typeof lang !== "string" || (source !== "sample" && source !== "upload")) return { valid: false };
  return { valid: true, payload: { lang, source } };
}
```

- [ ] **Step 5: Implement the upload token**

Create `lib/demo/upload-token.ts`:

```typescript
import { sha256Hex } from "@/lib/invoice/source-hash";
import { signPayload, verifyPayload } from "@/lib/demo/signed-token";

/**
 * Content-binding token for the upload lane. /api/demo/translate signs it over
 * the exact { invoice, sourceXml } it returns; /api/demo/pdf refuses to render
 * upload content without a matching token, so the PDF route can never render
 * content that did not pass the translate pipeline. TTL is longer than the
 * 10-minute download token so a visitor can browse before downloading.
 */
const TTL_MS = 60 * 60 * 1000;

export interface UploadTokenPayload {
  hash: string;
  lang: string;
}

/** sha256 over the exact invoice JSON the client holds plus the source XML. */
export async function demoContentHash(invoice: unknown, sourceXml: string): Promise<string> {
  return sha256Hex(Buffer.from(`${JSON.stringify(invoice)}\0${sourceXml}`, "utf8"));
}

export function signUploadToken(payload: UploadTokenPayload, now: number = Date.now()): string {
  return signPayload(payload, TTL_MS, now);
}

export function verifyUploadToken(
  token: string,
  now: number = Date.now()
): { valid: boolean; payload?: UploadTokenPayload } {
  const result = verifyPayload(token, now);
  if (!result.valid || !result.payload) return { valid: false };
  const { hash, lang } = result.payload;
  if (typeof hash !== "string" || !hash || typeof lang !== "string") return { valid: false };
  return { valid: true, payload: { hash, lang } };
}
```

- [ ] **Step 6: Run all three token tests -> PASS**

```bash
npx vitest run tests/integration/lib/demo-upload-token.test.ts tests/integration/lib/demo-download-token.test.ts
```
Expected: both PASS; the download-token test file is byte-identical to before this task (`git diff --stat tests/integration/lib/demo-download-token.test.ts` shows nothing).

- [ ] **Step 7: Commit**

```bash
git add lib/demo/signed-token.ts lib/demo/upload-token.ts lib/demo/download-token.ts tests/integration/lib/demo-upload-token.test.ts
git commit -m "feat(landing-demo): content-binding upload token + shared HMAC signer"
```

---

## Task 4: Rate-limit: `consumeTranslate` (with global breaker) + `consumePdf`

**Files:**
- Modify: `lib/demo/rate-limit.ts`
- Test: extend `tests/integration/lib/demo-rate-limit.test.ts`

- [ ] **Step 1: Add the failing tests** to the existing `describe("demo rate-limit", ...)` in `tests/integration/lib/demo-rate-limit.test.ts` (the file already mocks `@/lib/supabase/admin` with an `rpc` vi.fn; extend the import line to `import { hashIp, clientIpFrom, consumeUnlock, consumeTranslate, consumePdf } from "@/lib/demo/rate-limit";`):

```typescript
  it("consumeTranslate allows under both caps and reports counts", async () => {
    process.env.DEMO_TRANSLATE_PER_IP_PER_DAY = "5";
    process.env.DEMO_GLOBAL_TRANSLATE_PER_DAY = "500";
    rpc.mockResolvedValueOnce({ data: [{ ip_count: 3, global_count: 120 }], error: null });
    expect(await consumeTranslate("1.2.3.4")).toEqual({ allowed: true, ipCount: 3, globalCount: 120 });
    expect(rpc).toHaveBeenLastCalledWith("increment_demo_translate", { p_ip_hash: hashIp("1.2.3.4") });
  });

  it("consumeTranslate blocks with reason ip past the per-IP cap", async () => {
    process.env.DEMO_TRANSLATE_PER_IP_PER_DAY = "5";
    process.env.DEMO_GLOBAL_TRANSLATE_PER_DAY = "500";
    rpc.mockResolvedValueOnce({ data: [{ ip_count: 6, global_count: 10 }], error: null });
    expect(await consumeTranslate("1.2.3.4")).toEqual({
      allowed: false,
      reason: "ip",
      ipCount: 6,
      globalCount: 10
    });
  });

  it("consumeTranslate blocks with reason global past the daily breaker", async () => {
    process.env.DEMO_TRANSLATE_PER_IP_PER_DAY = "5";
    process.env.DEMO_GLOBAL_TRANSLATE_PER_DAY = "500";
    rpc.mockResolvedValueOnce({ data: [{ ip_count: 1, global_count: 501 }], error: null });
    expect(await consumeTranslate("1.2.3.4")).toEqual({
      allowed: false,
      reason: "global",
      ipCount: 1,
      globalCount: 501
    });
  });

  it("consumeTranslate fails open on infra errors", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "down" } });
    expect(await consumeTranslate("1.2.3.4")).toEqual({ allowed: true, ipCount: 0, globalCount: 0 });
  });

  it("consumePdf allows up to the cap, blocks beyond it, and fails open", async () => {
    process.env.DEMO_PDF_PER_IP_PER_DAY = "2";
    rpc.mockResolvedValueOnce({ data: 2, error: null });
    expect(await consumePdf("1.2.3.4")).toEqual({ allowed: true, count: 2 });
    rpc.mockResolvedValueOnce({ data: 3, error: null });
    expect(await consumePdf("1.2.3.4")).toEqual({ allowed: false, count: 3 });
    expect(rpc).toHaveBeenLastCalledWith("increment_demo_pdf", { p_ip_hash: hashIp("1.2.3.4") });
    rpc.mockResolvedValueOnce({ data: null, error: { message: "down" } });
    expect(await consumePdf("1.2.3.4")).toEqual({ allowed: true, count: 0 });
  });
```

Also add to the existing `beforeEach`: `delete process.env.DEMO_TRANSLATE_PER_IP_PER_DAY; delete process.env.DEMO_GLOBAL_TRANSLATE_PER_DAY; delete process.env.DEMO_PDF_PER_IP_PER_DAY;`

- [ ] **Step 2: Run -> FAIL** (`npx vitest run tests/integration/lib/demo-rate-limit.test.ts`).

- [ ] **Step 3: Implement** in `lib/demo/rate-limit.ts`. Replace the `DEFAULT_UNLOCK_CAP` constant block and `unlockCap()` with a shared helper, and append the two new functions:

```typescript
const DEFAULT_UNLOCK_CAP = 5;
const DEFAULT_TRANSLATE_CAP = 5;
const DEFAULT_GLOBAL_TRANSLATE_CAP = 500;
const DEFAULT_PDF_CAP = 10;

function capFromEnv(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}
```

Change `consumeUnlock` to use `capFromEnv("DEMO_UNLOCK_PER_IP_PER_DAY", DEFAULT_UNLOCK_CAP)` in place of `unlockCap()` (delete `unlockCap`). Then append:

```typescript
export interface TranslateLimit {
  allowed: boolean;
  reason?: "ip" | "global";
  ipCount: number;
  globalCount: number;
}

/**
 * Atomically increment the per-IP and global daily translate counters and decide
 * whether this request may proceed. The global counter is the daily circuit
 * breaker bounding worst-case OpenAI spend. Fails open on infra errors.
 */
export async function consumeTranslate(ip: string): Promise<TranslateLimit> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("increment_demo_translate", { p_ip_hash: hashIp(ip) });
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row || typeof row.ip_count !== "number" || typeof row.global_count !== "number") {
    console.error("[demo] translate rate-limit counter failed, failing open", error);
    return { allowed: true, ipCount: 0, globalCount: 0 };
  }
  const counts = { ipCount: row.ip_count, globalCount: row.global_count };
  if (row.ip_count > capFromEnv("DEMO_TRANSLATE_PER_IP_PER_DAY", DEFAULT_TRANSLATE_CAP)) {
    return { allowed: false, reason: "ip", ...counts };
  }
  if (row.global_count > capFromEnv("DEMO_GLOBAL_TRANSLATE_PER_DAY", DEFAULT_GLOBAL_TRANSLATE_CAP)) {
    return { allowed: false, reason: "global", ...counts };
  }
  return { allowed: true, ...counts };
}

/** Per-IP daily cap on demo PDF renders (sample and upload alike). Fails open. */
export async function consumePdf(ip: string): Promise<{ allowed: boolean; count: number }> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("increment_demo_pdf", { p_ip_hash: hashIp(ip) });
  if (error || typeof data !== "number") {
    console.error("[demo] pdf rate-limit counter failed, failing open", error);
    return { allowed: true, count: 0 };
  }
  return { allowed: data <= capFromEnv("DEMO_PDF_PER_IP_PER_DAY", DEFAULT_PDF_CAP), count: data };
}
```

- [ ] **Step 4: Run -> PASS** (whole file: the pre-existing unlock tests must stay green too).

- [ ] **Step 5: Commit**

```bash
git add lib/demo/rate-limit.ts tests/integration/lib/demo-rate-limit.test.ts
git commit -m "feat(landing-demo): translate rate limiter with global breaker + pdf cap"
```

---

## Task 5: Upload-lane copy (pl + en, no dashes)

**Files:**
- Modify: `lib/landing/copy.ts`
- Test: extend `tests/integration/lib/landing-copy.test.ts`

- [ ] **Step 1: Add the failing assertions** to the existing `describe("landingCopy", ...)`:

```typescript
  it("has the demo upload-lane copy on both locales", () => {
    for (const loc of [landingCopy.pl, landingCopy.en]) {
      expect(loc.demo.uploadLink).toBeTruthy();
      expect(loc.demo.uploadDropLabel).toBeTruthy();
      expect(loc.demo.uploadHint).toBeTruthy();
      expect(loc.demo.uploadBusy).toBeTruthy();
      expect(loc.demo.uploadErrUnsupported).toBeTruthy();
      expect(loc.demo.uploadErrTooLarge).toBeTruthy();
      expect(loc.demo.uploadErrParse).toBeTruthy();
      expect(loc.demo.uploadErrBreaker).toBeTruthy();
      expect(loc.demo.uploadErrTurnstile).toBeTruthy();
      expect(loc.demo.uploadErrTranslate).toBeTruthy();
      expect(loc.demo.pdfFailed).toBeTruthy();
    }
  });
```

(The existing "contains no em or en dashes" test runs over `JSON.stringify(landingCopy)`, so it automatically covers the new strings.)

- [ ] **Step 2: Run -> FAIL.**

- [ ] **Step 3: Extend the `demo` group** in both locales (keep all existing keys; 429 reuses the existing `rateLimited` string). PL, after `rateLimited`:

```typescript
      uploadLink: "albo wgraj własną fakturę",
      uploadDropLabel: "Przeciągnij plik tutaj albo kliknij, aby wybrać",
      uploadHint: "XML lub PDF z KSeF. Maks 1 MB dla XML, 8 MB dla PDF.",
      uploadBusy: "Tłumaczymy Twoją fakturę...",
      uploadErrUnsupported: "Obsługujemy pliki XML i PDF z KSeF.",
      uploadErrTooLarge: "Plik jest za duży. Maks 1 MB dla XML, 8 MB dla PDF.",
      uploadErrParse: "Nie udało się odczytać tej faktury. Upewnij się, że to plik FA(3) z KSeF.",
      uploadErrBreaker: "Demo chwilowo przeciążone. Załóż darmowe konto, aby przetłumaczyć własną fakturę.",
      uploadErrTurnstile: "Weryfikacja nie powiodła się. Odśwież stronę i spróbuj ponownie.",
      uploadErrTranslate: "Coś poszło nie tak przy tłumaczeniu. Spróbuj ponownie za chwilę.",
      pdfFailed: "Nie udało się wygenerować PDF. Spróbuj ponownie."
```

EN, after `rateLimited`:

```typescript
      uploadLink: "or upload your own invoice",
      uploadDropLabel: "Drag a file here or click to choose",
      uploadHint: "XML or PDF from KSeF. Max 1 MB for XML, 8 MB for PDF.",
      uploadBusy: "Translating your invoice...",
      uploadErrUnsupported: "We support XML and PDF files from KSeF.",
      uploadErrTooLarge: "The file is too large. Max 1 MB for XML, 8 MB for PDF.",
      uploadErrParse: "We could not read this invoice. Make sure it is an FA(3) file from KSeF.",
      uploadErrBreaker: "The demo is temporarily overloaded. Create a free account to translate your own invoice.",
      uploadErrTurnstile: "Verification failed. Refresh the page and try again.",
      uploadErrTranslate: "Something went wrong while translating. Please try again in a moment.",
      pdfFailed: "We could not generate the PDF. Please try again."
```

- [ ] **Step 4: Run -> PASS** (`npx vitest run tests/integration/lib/landing-copy.test.ts`; the parity + no-dash tests stay green).

- [ ] **Step 5: Commit**

```bash
git add lib/landing/copy.ts tests/integration/lib/landing-copy.test.ts
git commit -m "feat(landing-demo): upload lane copy (pl + en)"
```

---

## Task 6: `POST /api/demo/translate`

**Files:**
- Create: `app/api/demo/translate/route.ts`
- Modify: `.env.example`
- Test: `tests/integration/api/demo-translate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/integration/api/demo-translate.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const verifyTurnstile = vi.fn();
const consumeTranslate = vi.fn();
const translateInvoiceFreeText = vi.fn();
const parseKsefPdf = vi.fn();
vi.mock("@/lib/demo/turnstile", () => ({ verifyTurnstile }));
vi.mock("@/lib/demo/rate-limit", () => ({ consumeTranslate, clientIpFrom: () => "1.2.3.4" }));
vi.mock("@/lib/translation/engine", () => ({ translateInvoiceFreeText }));
vi.mock("@/lib/pdf/parser", () => ({ parseKsefPdf }));

import { POST } from "@/app/api/demo/translate/route";
import { verifyUploadToken, demoContentHash } from "@/lib/demo/upload-token";
import { maxXmlBytes } from "@/lib/demo/upload-limits";

const SAMPLE_XML = readFileSync(join(process.cwd(), "public/sample-data/demo-fa3-export.xml"), "utf8");

function post(fields: { file?: File; lang?: string; turnstileToken?: string }) {
  const form = new FormData();
  if (fields.file) form.set("file", fields.file);
  if (fields.lang) form.set("lang", fields.lang);
  if (fields.turnstileToken) form.set("turnstileToken", fields.turnstileToken);
  return new Request("http://x/api/demo/translate", { method: "POST", body: form });
}

function xmlFile(content: string = SAMPLE_XML, name = "faktura.xml") {
  return new File([content], name, { type: "application/xml" });
}

beforeEach(() => {
  verifyTurnstile.mockReset().mockResolvedValue({ ok: true });
  consumeTranslate.mockReset().mockResolvedValue({ allowed: true, ipCount: 1, globalCount: 1 });
  translateInvoiceFreeText
    .mockReset()
    .mockImplementation(async (invoice: object, language: string) => ({ ...invoice, language }));
  parseKsefPdf.mockReset();
  process.env.DEMO_TOKEN_SECRET = "unit-secret";
});

describe("POST /api/demo/translate", () => {
  it("translates a valid XML upload and returns invoice + sourceXml + a binding uploadToken", async () => {
    const res = await POST(post({ file: xmlFile(), lang: "de", turnstileToken: "t" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.invoice.language).toBe("de");
    expect(json.sourceXml).toBe(SAMPLE_XML);
    expect(translateInvoiceFreeText).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceNumber: "FV 2026/05/0142" }),
      "de"
    );
    const verdict = verifyUploadToken(json.uploadToken);
    expect(verdict.valid).toBe(true);
    expect(verdict.payload?.lang).toBe("de");
    expect(verdict.payload?.hash).toBe(await demoContentHash(json.invoice, json.sourceXml));
  });

  it("builds the KSeF QR verification link for XML uploads (same fidelity as the app upload path)", async () => {
    const res = await POST(post({ file: xmlFile(), lang: "en", turnstileToken: "t" }));
    const json = await res.json();
    expect(json.invoice.verification?.qrLink).toContain("https://qr.ksef.mf.gov.pl/invoice/");
  });

  it("translates a PDF upload through parseKsefPdf and returns a synthetic sourceXml", async () => {
    parseKsefPdf.mockResolvedValueOnce({
      ok: true,
      warnings: [],
      invoice: {
        invoiceNumber: "FV 9/2026",
        issueDate: "2026-06-01",
        currency: "PLN",
        seller: { name: "Test Sp. z o.o.", vatId: "1111111111" },
        buyer: { name: "Buyer GmbH" },
        items: [{ name: "Usługa", quantity: 1, unit: "szt", unitPrice: 100, netValue: 100, vatRate: "23", grossValue: 123 }],
        totals: { net: 100, vat: 23, gross: 123 }
      }
    });
    const pdfFile = new File(["%PDF-1.7"], "faktura.pdf", { type: "application/pdf" });
    const res = await POST(post({ file: pdfFile, lang: "en", turnstileToken: "t" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(typeof json.sourceXml).toBe("string");
    expect(json.sourceXml).toContain("Faktura");
  });

  it("returns 403 when Turnstile fails (and never consumes the cap)", async () => {
    verifyTurnstile.mockResolvedValueOnce({ ok: false });
    const res = await POST(post({ file: xmlFile(), lang: "en", turnstileToken: "bad" }));
    expect(res.status).toBe(403);
    expect(consumeTranslate).not.toHaveBeenCalled();
  });

  it("returns 429 with code rate_limited past the per-IP cap", async () => {
    consumeTranslate.mockResolvedValueOnce({ allowed: false, reason: "ip", ipCount: 6, globalCount: 10 });
    const res = await POST(post({ file: xmlFile(), lang: "en", turnstileToken: "t" }));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("rate_limited");
  });

  it("returns 503 with code circuit_breaker past the global cap", async () => {
    consumeTranslate.mockResolvedValueOnce({ allowed: false, reason: "global", ipCount: 1, globalCount: 501 });
    const res = await POST(post({ file: xmlFile(), lang: "en", turnstileToken: "t" }));
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("circuit_breaker");
  });

  it("returns 415 for an unsupported file type (after the cap is consumed, per the locked spec order)", async () => {
    const res = await POST(post({ file: new File(["x"], "notes.txt", { type: "text/plain" }), lang: "en", turnstileToken: "t" }));
    expect(res.status).toBe(415);
    expect(consumeTranslate).toHaveBeenCalled();
    expect(translateInvoiceFreeText).not.toHaveBeenCalled();
  });

  it("returns 413 for an oversized XML", async () => {
    const big = "a".repeat(maxXmlBytes() + 1);
    const res = await POST(post({ file: xmlFile(big), lang: "en", turnstileToken: "t" }));
    expect(res.status).toBe(413);
    expect(translateInvoiceFreeText).not.toHaveBeenCalled();
  });

  it("returns 422 for XML that does not parse as FA(3)", async () => {
    const res = await POST(post({ file: xmlFile("<not-an-invoice>"), lang: "en", turnstileToken: "t" }));
    expect(res.status).toBe(422);
    expect(translateInvoiceFreeText).not.toHaveBeenCalled();
  });

  it("returns 502 when the translation engine fails", async () => {
    translateInvoiceFreeText.mockRejectedValueOnce(new Error("openai down"));
    const res = await POST(post({ file: xmlFile(), lang: "en", turnstileToken: "t" }));
    expect(res.status).toBe(502);
  });

  it("returns 400 for a missing file or unsupported language", async () => {
    expect((await POST(post({ lang: "en", turnstileToken: "t" }))).status).toBe(400);
    expect((await POST(post({ file: xmlFile(), lang: "xx", turnstileToken: "t" }))).status).toBe(400);
  });
});
```

- [ ] **Step 2: Run -> FAIL** (`npx vitest run tests/integration/api/demo-translate.test.ts`, module missing).

- [ ] **Step 3: Implement**

Create `app/api/demo/translate/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_LANGS } from "@/lib/landing/demo-sample";
import { verifyTurnstile } from "@/lib/demo/turnstile";
import { consumeTranslate, clientIpFrom } from "@/lib/demo/rate-limit";
import { demoContentHash, signUploadToken } from "@/lib/demo/upload-token";
import { detectDemoUploadType, maxBytesFor, type DemoUploadType } from "@/lib/demo/upload-limits";
import { parseKsefXml } from "@/lib/xml/parser";
import { buildKsefXmlVerificationLink } from "@/lib/xml/verification";
import { buildSyntheticFa3Xml } from "@/lib/mf-fa3/invoice-to-fa3-xml";
import { translateInvoiceFreeText } from "@/lib/translation/engine";
import type { Invoice, LanguageCode } from "@/types/invoice";

export const runtime = "nodejs";

const DEMO_LANG_CODES = DEMO_LANGS.map((l) => l.code) as [string, ...string[]];

const fieldsSchema = z.object({
  lang: z.enum(DEMO_LANG_CODES),
  turnstileToken: z.string().min(1)
});

/**
 * Stateless Lane 2 endpoint: nothing the visitor uploads is ever persisted.
 * Guard order is locked by the design spec (section 12):
 * Turnstile -> per-IP cap + global breaker -> MIME/extension + size -> parse -> translate.
 */
export async function POST(request: Request) {
  if (!process.env.DEMO_TOKEN_SECRET) {
    return NextResponse.json({ error: "Demo upload is not configured" }, { status: 500 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const parsed = fieldsSchema.safeParse({
    lang: form?.get("lang"),
    turnstileToken: form?.get("turnstileToken")
  });
  if (!parsed.success || !(file instanceof File)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { lang, turnstileToken } = parsed.data;
  const ip = clientIpFrom(request);

  const turnstile = await verifyTurnstile(turnstileToken, ip);
  if (!turnstile.ok) {
    return NextResponse.json({ error: "Verification failed", code: "turnstile" }, { status: 403 });
  }

  const limit = await consumeTranslate(ip);
  if (!limit.allowed) {
    if (limit.reason === "global") {
      return NextResponse.json({ error: "Demo is over capacity today", code: "circuit_breaker" }, { status: 503 });
    }
    return NextResponse.json({ error: "Daily demo limit reached", code: "rate_limited" }, { status: 429 });
  }

  const type = detectDemoUploadType(file.name, file.type);
  if (!type) {
    return NextResponse.json({ error: "Unsupported file type", code: "unsupported" }, { status: 415 });
  }
  if (file.size > maxBytesFor(type)) {
    return NextResponse.json({ error: "File too large", code: "too_large" }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const sourced = await parseUpload(type, bytes);
  if (!sourced.ok) {
    console.warn("[demo] upload parse failed", sourced.error);
    return NextResponse.json({ error: "Could not read this invoice", code: "parse_failed" }, { status: 422 });
  }

  let invoice;
  try {
    invoice = await translateInvoiceFreeText(sourced.invoice, lang as LanguageCode);
  } catch (error) {
    console.error("[demo] translate failed", error);
    return NextResponse.json({ error: "Translation failed", code: "translate_failed" }, { status: 502 });
  }

  // Bind the exact response payload into a signed token so /api/demo/pdf can
  // verify it renders only what this pipeline produced (see the plan's
  // security decision). Nothing is persisted.
  const uploadToken = signUploadToken({ hash: await demoContentHash(invoice, sourced.sourceXml), lang });
  return NextResponse.json({ invoice, sourceXml: sourced.sourceXml, uploadToken });
}

type ParsedUpload = { ok: true; invoice: Invoice; sourceXml: string } | { ok: false; error: string };

async function parseUpload(type: DemoUploadType, bytes: Buffer): Promise<ParsedUpload> {
  if (type === "xml") {
    const xml = new TextDecoder().decode(bytes);
    const parsed = parseKsefXml(xml);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    // Same QR-link fidelity as the authenticated upload path (pure, no network).
    const qrLink = await buildKsefXmlVerificationLink(
      new Uint8Array(bytes).buffer,
      parsed.invoice.issueDate,
      parsed.invoice.seller.vatId
    );
    const invoice = qrLink
      ? { ...parsed.invoice, verification: { ...parsed.invoice.verification, qrLink } }
      : parsed.invoice;
    return { ok: true, invoice, sourceXml: xml };
  }
  const { parseKsefPdf } = await import("@/lib/pdf/parser");
  const parsed = await parseKsefPdf(bytes);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  return { ok: true, invoice: parsed.invoice, sourceXml: buildSyntheticFa3Xml(parsed.invoice) };
}
```

- [ ] **Step 4: Run -> PASS.** Then `npx tsc --noEmit` (no new errors).

- [ ] **Step 5: Document the demo env vars** — append to `.env.example`:

```
# ── Landing demo (public, stateless) ───────────────────────────────────
# Turnstile keys; without them, local dev bypasses verification (non-production only).
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
# HMAC secret for demo download/upload tokens and salt for IP hashing.
DEMO_TOKEN_SECRET=
DEMO_IP_SALT=
# Optional cap overrides (defaults shown).
DEMO_UNLOCK_PER_IP_PER_DAY=5
DEMO_TRANSLATE_PER_IP_PER_DAY=5
DEMO_GLOBAL_TRANSLATE_PER_DAY=500
DEMO_PDF_PER_IP_PER_DAY=10
DEMO_MAX_XML_BYTES=1048576
DEMO_MAX_PDF_BYTES=8388608
```

- [ ] **Step 6: Commit**

```bash
git add app/api/demo/translate/route.ts tests/integration/api/demo-translate.test.ts .env.example
git commit -m "feat(landing-demo): stateless /api/demo/translate (guards + parse + translate)"
```

---

## Task 7: `/api/demo/pdf` upload rendering + pdf cap; `/api/demo/unlock` source

**Files:**
- Modify: `app/api/demo/pdf/route.ts`, `app/api/demo/unlock/route.ts`
- Test: extend `tests/integration/api/demo-pdf.test.ts`, `tests/integration/api/demo-unlock.test.ts`

- [ ] **Step 1: Extend the failing tests.** In `tests/integration/api/demo-pdf.test.ts`, add the rate-limit mock next to the existing renderer mock (the route now calls `consumePdf`):

```typescript
const consumePdf = vi.fn();
vi.mock("@/lib/demo/rate-limit", () => ({ consumePdf, clientIpFrom: () => "1.2.3.4" }));
```

add to `beforeEach`: `consumePdf.mockReset().mockResolvedValue({ allowed: true, count: 1 });`, add imports:

```typescript
import { buildDemoInvoice } from "@/lib/landing/demo-sample";
import { signUploadToken, demoContentHash } from "@/lib/demo/upload-token";
```

and append these tests:

```typescript
describe("POST /api/demo/pdf (upload source)", () => {
  const UPLOAD_XML = "<Faktura><Fa><P_2>FV 7/2026</P_2></Fa></Faktura>";

  async function uploadBody(overrides: Partial<{ invoice: unknown; sourceXml: string; uploadToken: string }> = {}) {
    const invoice = overrides.invoice ?? buildDemoInvoice("de");
    const sourceXml = overrides.sourceXml ?? UPLOAD_XML;
    const uploadToken =
      overrides.uploadToken ?? signUploadToken({ hash: await demoContentHash(invoice, sourceXml), lang: "de" });
    return { downloadToken: signDownloadToken({ lang: "de", source: "upload" }), invoice, sourceXml, uploadToken };
  }

  it("renders the exact uploaded invoice for a valid token pair", async () => {
    const res = await POST(post(await uploadBody()));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const arg = renderOfficialFa3Pdf.mock.calls[0][0];
    expect(arg.sourceXml).toBe(UPLOAD_XML);
    expect(arg.language).toBe("de");
    expect(arg.translated).toBe(true);
    expect(arg.bilingual).toBe(false);
    expect(arg.invoice.items[1].translatedName).toBe("Eichenstuhl „Helena”");
  });

  it("rejects a hash mismatch (tampered invoice) with 401", async () => {
    const body = await uploadBody();
    const tampered = JSON.parse(JSON.stringify(body.invoice)) as { items: { name: string }[] };
    tampered.items[0].name = "EVIL CONTENT";
    const res = await POST(post({ ...body, invoice: tampered }));
    expect(res.status).toBe(401);
    expect(renderOfficialFa3Pdf).not.toHaveBeenCalled();
  });

  it("rejects a missing upload payload with 400", async () => {
    const res = await POST(post({ downloadToken: signDownloadToken({ lang: "de", source: "upload" }) }));
    expect(res.status).toBe(400);
  });

  it("rejects an expired uploadToken with 401", async () => {
    const invoice = buildDemoInvoice("de");
    const stale = signUploadToken(
      { hash: await demoContentHash(invoice, UPLOAD_XML), lang: "de" },
      Date.now() - 2 * 60 * 60_000
    );
    const res = await POST(post(await uploadBody({ uploadToken: stale })));
    expect(res.status).toBe(401);
  });

  it("rejects hash-matching but schema-invalid invoice JSON with 400", async () => {
    const junk = { totally: "not-an-invoice" };
    const res = await POST(post(await uploadBody({ invoice: junk })));
    expect(res.status).toBe(400);
    expect(renderOfficialFa3Pdf).not.toHaveBeenCalled();
  });

  it("returns 429 when the per-IP pdf cap is hit (sample and upload alike)", async () => {
    consumePdf.mockResolvedValueOnce({ allowed: false, count: 99 });
    const res = await POST(post({ downloadToken: signDownloadToken({ lang: "de", source: "sample" }) }));
    expect(res.status).toBe(429);
    expect(renderOfficialFa3Pdf).not.toHaveBeenCalled();
  });
});
```

In `tests/integration/api/demo-unlock.test.ts`, add:

```typescript
  it("signs source upload into the download token when requested", async () => {
    const res = await POST(post({ email: "a@b.com", lang: "de", turnstileToken: "t", source: "upload" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(verifyDownloadToken(json.downloadToken).payload).toMatchObject({ lang: "de", source: "upload" });
  });

  it("rejects an unknown source (400)", async () => {
    const res = await POST(post({ email: "a@b.com", lang: "de", turnstileToken: "t", source: "evil" }));
    expect(res.status).toBe(400);
  });
```

- [ ] **Step 2: Run -> FAIL** (`npx vitest run tests/integration/api/demo-pdf.test.ts tests/integration/api/demo-unlock.test.ts`).

- [ ] **Step 3: Implement the unlock change.** In `app/api/demo/unlock/route.ts`, add `source: z.enum(["sample", "upload"]).optional()` to `bodySchema`, destructure it, and change the signing line to:

```typescript
  const downloadToken = signDownloadToken({ lang, source: source ?? "sample" });
```

- [ ] **Step 4: Implement the pdf route.** Replace `app/api/demo/pdf/route.ts` with:

```typescript
import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { verifyDownloadToken } from "@/lib/demo/download-token";
import { verifyUploadToken, demoContentHash } from "@/lib/demo/upload-token";
import { consumePdf, clientIpFrom } from "@/lib/demo/rate-limit";
import { invoiceSchema } from "@/lib/invoice/schema";
import { buildDemoInvoice, DEMO_LANGS, type DemoLang } from "@/lib/landing/demo-sample";
import { renderOfficialFa3Pdf } from "@/lib/mf-fa3/official-renderer";
import type { Invoice, LanguageCode } from "@/types/invoice";

export const runtime = "nodejs";

const bodySchema = z.object({
  downloadToken: z.string().min(1),
  // Upload lane (stateless): the client re-sends exactly what /api/demo/translate
  // returned, plus the content-binding uploadToken issued there.
  invoice: z.record(z.unknown()).optional(),
  sourceXml: z.string().min(1).optional(),
  uploadToken: z.string().min(1).optional()
});

// Read the matching FA(3) source XML once per process (it never changes).
let cachedXml: string | null = null;
function demoSourceXml(): string {
  if (cachedXml === null) {
    cachedXml = readFileSync(join(process.cwd(), "public/sample-data/demo-fa3-export.xml"), "utf8");
  }
  return cachedXml;
}

export async function POST(request: Request) {
  // The token system requires this secret; without it, verification cannot run.
  if (!process.env.DEMO_TOKEN_SECRET) {
    return NextResponse.json({ error: "Demo download is not configured" }, { status: 500 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  const verdict = verifyDownloadToken(parsed.data.downloadToken);
  if (!verdict.valid || !verdict.payload) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const limit = await consumePdf(clientIpFrom(request));
  if (!limit.allowed) {
    return NextResponse.json({ error: "Daily demo limit reached", code: "rate_limited" }, { status: 429 });
  }

  const input =
    verdict.payload.source === "upload" ? await uploadRenderInput(parsed.data) : sampleRenderInput(verdict.payload.lang);
  if ("status" in input) {
    return NextResponse.json({ error: input.error }, { status: input.status });
  }

  let pdf: Buffer;
  try {
    pdf = await renderOfficialFa3Pdf({
      sourceXml: input.sourceXml,
      invoice: input.invoice,
      language: input.lang as LanguageCode,
      bilingual: false,
      translated: true
    });
  } catch (error) {
    console.error("[demo] PDF render failed", error);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="tlumaczksef-demo-${input.lang}.pdf"`,
      "Cache-Control": "no-store"
    }
  });
}

type RenderInput = { invoice: Invoice; sourceXml: string; lang: string };
type RenderError = { status: number; error: string };

function sampleRenderInput(lang: string): RenderInput | RenderError {
  // Defense in depth: only render a language we actually ship, even though the
  // unlock route already enum-validates it before signing.
  if (!DEMO_LANGS.some((l) => l.code === lang)) {
    return { status: 401, error: "Invalid or expired token" };
  }
  return { invoice: buildDemoInvoice(lang as DemoLang), sourceXml: demoSourceXml(), lang };
}

/**
 * Renders only content the translate pipeline produced: the uploadToken binds a
 * sha256 of the exact { invoice, sourceXml } issued by /api/demo/translate, and
 * the invoice is re-validated against invoiceSchema before rendering. The lang
 * comes from the uploadToken (the language the content was translated into).
 */
async function uploadRenderInput(body: z.infer<typeof bodySchema>): Promise<RenderInput | RenderError> {
  const { invoice, sourceXml, uploadToken } = body;
  if (!invoice || !sourceXml || !uploadToken) {
    return { status: 400, error: "Missing upload payload" };
  }
  const verdict = verifyUploadToken(uploadToken);
  if (!verdict.valid || !verdict.payload) {
    return { status: 401, error: "Invalid or expired token" };
  }
  const { hash, lang } = verdict.payload;
  if (!DEMO_LANGS.some((l) => l.code === lang)) {
    return { status: 401, error: "Invalid or expired token" };
  }
  if ((await demoContentHash(invoice, sourceXml)) !== hash) {
    return { status: 401, error: "Invalid or expired token" };
  }
  const checked = invoiceSchema.safeParse(invoice);
  if (!checked.success) {
    return { status: 400, error: "Invalid invoice" };
  }
  return { invoice: checked.data as Invoice, sourceXml, lang };
}
```

- [ ] **Step 5: Run -> PASS** (both API test files, including all pre-existing sample-source tests). Then `npx tsc --noEmit`.

- [ ] **Step 6: Commit**

```bash
git add app/api/demo/pdf/route.ts app/api/demo/unlock/route.ts tests/integration/api/demo-pdf.test.ts tests/integration/api/demo-unlock.test.ts
git commit -m "feat(landing-demo): hash-bound upload rendering + per-IP pdf cap"
```

---

## Task 8: `InvoiceStage` renders an uploaded invoice

**Files:**
- Modify: `components/landing/demo/invoice-stage.tsx`
- Test: extend `tests/components/landing/invoice-stage.test.tsx`

- [ ] **Step 1: Add the failing test** to `tests/components/landing/invoice-stage.test.tsx` (follow the file's existing render/matchMedia conventions):

```tsx
  it("renders a provided uploaded invoice instead of the baked sample", () => {
    const uploaded = {
      ...buildDemoInvoice("de"),
      items: [
        {
          name: "Deska tarasowa modrzewiowa",
          translatedName: "Lärchen-Terrassendiele",
          quantity: 10,
          unit: "szt",
          translatedUnit: "Stk.",
          unitPrice: 50,
          netValue: 500,
          vatRate: "0",
          grossValue: 500
        }
      ]
    };
    render(<InvoiceStage lang="en" watermark="PODGLĄD" upload={{ invoice: uploaded, lang: "de" }} />);
    expect(screen.getByText("Lärchen-Terrassendiele")).toBeInTheDocument();
    expect(screen.queryByText('Oak chair „Helena”')).not.toBeInTheDocument();
  });
```

Add `import { buildDemoInvoice } from "@/lib/landing/demo-sample";` to the test file if missing.

- [ ] **Step 2: Run -> FAIL** (`npx vitest run tests/components/landing/invoice-stage.test.tsx`).

- [ ] **Step 3: Implement.** In `components/landing/demo/invoice-stage.tsx`:

Add to the imports: `import type { Invoice } from "@/types/invoice";`

Extend the props:

```tsx
export interface InvoiceStageUpload {
  invoice: Invoice;
  /** The language the upload was translated into (may trail the chips if a re-translate failed). */
  lang: DemoLang;
}

export interface InvoiceStageProps {
  lang: DemoLang;
  watermark: string;
  upload?: InvoiceStageUpload | null;
}
```

In the component signature accept `upload`, and replace the `<InvoicePreview ... />` line with:

```tsx
          <InvoicePreview
            invoice={upload ? upload.invoice : buildDemoInvoice(lang)}
            language={upload ? upload.lang : lang}
            bilingual={false}
            translated
          />
```

Also replay the swap shimmer when the upload changes: change the shimmer effect dependency array from `[lang]` to `[lang, upload]`.

- [ ] **Step 4: Run -> PASS** (whole file: pre-existing stage tests stay green).

- [ ] **Step 5: Commit**

```bash
git add components/landing/demo/invoice-stage.tsx tests/components/landing/invoice-stage.test.tsx
git commit -m "feat(landing-demo): invoice stage renders an uploaded invoice"
```

---

## Task 9: The upload panel

**Files:**
- Create: `components/landing/demo/upload-panel.tsx`
- Test: `tests/components/landing/upload-panel.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/landing/upload-panel.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UploadPanel } from "@/components/landing/demo/upload-panel";
import { buildDemoInvoice } from "@/lib/landing/demo-sample";
import { maxXmlBytes } from "@/lib/demo/upload-limits";

// No NEXT_PUBLIC_TURNSTILE_SITE_KEY in tests -> widget skipped, token "dev".
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function copy() {
  return {
    uploadLink: "albo wgraj własną fakturę",
    uploadDropLabel: "Przeciągnij plik tutaj albo kliknij, aby wybrać",
    uploadHint: "XML lub PDF z KSeF.",
    uploadBusy: "Tłumaczymy...",
    rateLimited: "Limit.",
    uploadErrUnsupported: "Tylko XML i PDF.",
    uploadErrTooLarge: "Za duży.",
    uploadErrParse: "Nie odczytano.",
    uploadErrBreaker: "Przeciążone.",
    uploadErrTurnstile: "Weryfikacja.",
    uploadErrTranslate: "Błąd tłumaczenia."
  };
}

function okResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({ invoice: buildDemoInvoice("en"), sourceXml: "<Faktura/>", uploadToken: "tok" })
  };
}

function selectFile(file: File) {
  const input = screen.getByLabelText("Przeciągnij plik tutaj albo kliknij, aby wybrać");
  fireEvent.change(input, { target: { files: [file] } });
}

function openPanel() {
  fireEvent.click(screen.getByRole("button", { name: "albo wgraj własną fakturę" }));
}

describe("<UploadPanel>", () => {
  it("shows only the reveal link until clicked, then the dropzone", () => {
    render(<UploadPanel lang="en" t={copy()} onResult={vi.fn()} />);
    expect(screen.queryByText("XML lub PDF z KSeF.")).not.toBeInTheDocument();
    openPanel();
    expect(screen.getByText("XML lub PDF z KSeF.")).toBeInTheDocument();
  });

  it("rejects an unsupported file client-side without calling the API", () => {
    render(<UploadPanel lang="en" t={copy()} onResult={vi.fn()} />);
    openPanel();
    selectFile(new File(["x"], "notes.txt", { type: "text/plain" }));
    expect(screen.getByText("Tylko XML i PDF.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an oversized XML client-side without calling the API", () => {
    render(<UploadPanel lang="en" t={copy()} onResult={vi.fn()} />);
    openPanel();
    const big = new File([new Uint8Array(maxXmlBytes() + 1)], "faktura.xml", { type: "application/xml" });
    selectFile(big);
    expect(screen.getByText("Za duży.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uploads a valid file and reports the result up", async () => {
    fetchMock.mockResolvedValueOnce(okResponse());
    const onResult = vi.fn();
    render(<UploadPanel lang="en" t={copy()} onResult={onResult} />);
    openPanel();
    selectFile(new File(["<Faktura/>"], "faktura.xml", { type: "application/xml" }));
    await waitFor(() => expect(onResult).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/demo/translate");
    const body = fetchMock.mock.calls[0][1].body as FormData;
    expect(body.get("lang")).toBe("en");
    expect(body.get("turnstileToken")).toBe("dev");
    expect((body.get("file") as File).name).toBe("faktura.xml");
    expect(onResult.mock.calls[0][0]).toMatchObject({ sourceXml: "<Faktura/>", uploadToken: "tok", lang: "en" });
  });

  it.each([
    [422, "Nie odczytano."],
    [429, "Limit."],
    [503, "Przeciążone."],
    [403, "Weryfikacja."],
    [502, "Błąd tłumaczenia."]
  ])("maps a %s response to its message", async (status, message) => {
    fetchMock.mockResolvedValueOnce({ ok: false, status, json: async () => ({}) });
    render(<UploadPanel lang="en" t={copy()} onResult={vi.fn()} />);
    openPanel();
    selectFile(new File(["<x/>"], "faktura.xml", { type: "application/xml" }));
    await waitFor(() => expect(screen.getByText(message)).toBeInTheDocument());
  });

  it("re-translates the retained file when the language prop changes", async () => {
    fetchMock.mockResolvedValue(okResponse());
    const onResult = vi.fn();
    const view = render(<UploadPanel lang="en" t={copy()} onResult={onResult} />);
    openPanel();
    selectFile(new File(["<Faktura/>"], "faktura.xml", { type: "application/xml" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));
    view.rerender(<UploadPanel lang="de" t={copy()} onResult={onResult} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect((fetchMock.mock.calls[1][1].body as FormData).get("lang")).toBe("de");
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(2));
    expect(onResult.mock.calls[1][0].lang).toBe("de");
  });

  it("does not re-translate on language change before any upload", () => {
    const view = render(<UploadPanel lang="en" t={copy()} onResult={vi.fn()} />);
    view.rerender(<UploadPanel lang="de" t={copy()} onResult={vi.fn()} />);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run -> FAIL** (`npx vitest run tests/components/landing/upload-panel.test.tsx`).

- [ ] **Step 3: Implement**

Create `components/landing/demo/upload-panel.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import type { Invoice } from "@/types/invoice";
import type { DemoLang } from "@/lib/landing/demo-sample";
import { DEMO_UPLOAD_ACCEPT, detectDemoUploadType, maxBytesFor } from "@/lib/demo/upload-limits";
import { cn } from "@/lib/utils";

/** What Lane 2 hands to the stage and the download gate. Held only in client memory. */
export interface DemoUpload {
  invoice: Invoice;
  sourceXml: string;
  uploadToken: string;
  lang: DemoLang;
}

export interface UploadPanelCopy {
  uploadLink: string;
  uploadDropLabel: string;
  uploadHint: string;
  uploadBusy: string;
  rateLimited: string;
  uploadErrUnsupported: string;
  uploadErrTooLarge: string;
  uploadErrParse: string;
  uploadErrBreaker: string;
  uploadErrTurnstile: string;
  uploadErrTranslate: string;
}

type ErrorKey =
  | "uploadErrUnsupported"
  | "uploadErrTooLarge"
  | "uploadErrParse"
  | "rateLimited"
  | "uploadErrBreaker"
  | "uploadErrTurnstile"
  | "uploadErrTranslate";

const STATUS_ERRORS: Record<number, ErrorKey> = {
  415: "uploadErrUnsupported",
  413: "uploadErrTooLarge",
  422: "uploadErrParse",
  429: "rateLimited",
  503: "uploadErrBreaker",
  403: "uploadErrTurnstile"
};

export interface UploadPanelProps {
  lang: DemoLang;
  t: UploadPanelCopy;
  onResult: (upload: DemoUpload) => void;
}

export function UploadPanel({ lang, t, onResult }: UploadPanelProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<ErrorKey | null>(null);
  const [token, setToken] = useState(siteKey ? "" : "dev");
  const [pendingLang, setPendingLang] = useState<DemoLang | null>(null);
  const fileRef = useRef<File | null>(null);
  const translatedLangRef = useRef<DemoLang | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Spec: switching language after an upload re-translates the retained file
  // (each call counts against the per-IP cap). On failure the previous result
  // stays on the stage and an inline error explains why.
  useEffect(() => {
    if (fileRef.current && translatedLangRef.current && translatedLangRef.current !== lang) {
      void translate(fileRef.current, lang);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  function handleFiles(list: FileList | null) {
    const file = list?.[0];
    if (!file) return;
    const type = detectDemoUploadType(file.name, file.type);
    if (!type) {
      setErrorKey("uploadErrUnsupported");
      return;
    }
    if (file.size > maxBytesFor(type)) {
      setErrorKey("uploadErrTooLarge");
      return;
    }
    fileRef.current = file;
    void translate(file, lang);
  }

  async function translate(file: File, target: DemoLang) {
    if (siteKey && !token) {
      // Tokens are single use and the widget re-solves after each reset; queue
      // the request and let onToken fire it when a fresh token lands.
      setBusy(true);
      setErrorKey(null);
      setPendingLang(target);
      return;
    }
    await doTranslate(file, target, token);
  }

  async function doTranslate(file: File, target: DemoLang, turnstileToken: string) {
    if (siteKey) {
      turnstileRef.current?.reset();
      setToken("");
    }
    setBusy(true);
    setErrorKey(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("lang", target);
      form.set("turnstileToken", turnstileToken);
      const res = await fetch("/api/demo/translate", { method: "POST", body: form });
      if (!res.ok) {
        setErrorKey(STATUS_ERRORS[res.status] ?? "uploadErrTranslate");
        return;
      }
      const data = (await res.json()) as { invoice: Invoice; sourceXml: string; uploadToken: string };
      translatedLangRef.current = target;
      onResult({ invoice: data.invoice, sourceXml: data.sourceXml, uploadToken: data.uploadToken, lang: target });
    } catch {
      setErrorKey("uploadErrTranslate");
    } finally {
      setBusy(false);
    }
  }

  function onToken(next: string) {
    setToken(next);
    if (pendingLang && fileRef.current) {
      const target = pendingLang;
      setPendingLang(null);
      void doTranslate(fileRef.current, target, next);
    }
  }

  if (!open) {
    return (
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[14px] font-medium text-white/70 underline underline-offset-4 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
        >
          {t.uploadLink}
        </button>
      </div>
    );
  }

  const softError = errorKey === "rateLimited" || errorKey === "uploadErrBreaker";

  return (
    <div className="mx-auto mt-6 flex w-full max-w-sm flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        disabled={busy}
        aria-busy={busy}
        className={cn(
          "w-full rounded-2xl border border-dashed border-white/25 bg-ink-panel px-6 py-7 text-center transition-colors hover:border-white/50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ink",
          busy && "opacity-60"
        )}
      >
        <span className="block text-[14px] font-medium text-white/85">{busy ? t.uploadBusy : t.uploadDropLabel}</span>
        <span className="mt-1 block text-[12px] text-white/50">{t.uploadHint}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={DEMO_UPLOAD_ACCEPT}
        aria-label={t.uploadDropLabel}
        className="sr-only"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {siteKey ? (
        <Turnstile
          ref={turnstileRef}
          siteKey={siteKey}
          onSuccess={onToken}
          onExpire={() => setToken("")}
          onError={() => setToken("")}
          options={{ theme: "dark" }}
        />
      ) : null}
      {errorKey ? (
        <p role="alert" className={cn("text-center text-[12px]", softError ? "text-white/80" : "text-negative")}>
          {t[errorKey]}
        </p>
      ) : null}
    </div>
  );
}

export default UploadPanel;
```

- [ ] **Step 4: Run -> PASS.** Then `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add components/landing/demo/upload-panel.tsx tests/components/landing/upload-panel.test.tsx
git commit -m "feat(landing-demo): upload panel (dropzone + validation + translate calls)"
```

---

## Task 10: Download gate sends the upload payload

**Files:**
- Modify: `components/landing/demo/download-gate.tsx`
- Test: extend `tests/components/landing/download-gate.test.tsx`

- [ ] **Step 1: Extend the failing tests.** In `tests/components/landing/download-gate.test.tsx`, add `pdfFailed: "Błąd PDF."` to the `copy()` helper, add `import { buildDemoInvoice } from "@/lib/landing/demo-sample";`, and append:

```tsx
  it("unlocks with source upload and re-sends the upload payload to /api/demo/pdf", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ downloadToken: "tok" }) })
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(["%PDF"]) });
    const upload = { invoice: buildDemoInvoice("de"), sourceXml: "<Faktura/>", uploadToken: "utok", lang: "de" as const };
    render(<DownloadGate lang="de" t={copy()} upload={upload} />);
    fireEvent.change(screen.getByLabelText("Adres e-mail"), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Wyślij i pobierz" }));
    await waitFor(() => expect(screen.getByText("Gotowe.")).toBeInTheDocument());
    const unlockBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(unlockBody.source).toBe("upload");
    const pdfBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(pdfBody).toMatchObject({ downloadToken: "tok", sourceXml: "<Faktura/>", uploadToken: "utok" });
    expect(pdfBody.invoice.invoiceNumber).toBe("FV 2026/05/0142");
  });

  it("sends source sample and no upload payload without an upload", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ downloadToken: "tok" }) })
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(["%PDF"]) });
    render(<DownloadGate lang="en" t={copy()} />);
    fireEvent.change(screen.getByLabelText("Adres e-mail"), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Wyślij i pobierz" }));
    await waitFor(() => expect(screen.getByText("Gotowe.")).toBeInTheDocument());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).source).toBe("sample");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ downloadToken: "tok" });
  });

  it("shows the rate-limit message when the pdf route returns 429", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ downloadToken: "tok" }) })
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ code: "rate_limited" }) });
    render(<DownloadGate lang="en" t={copy()} />);
    fireEvent.change(screen.getByLabelText("Adres e-mail"), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Wyślij i pobierz" }));
    await waitFor(() => expect(screen.getByText("Limit.")).toBeInTheDocument());
  });

  it("shows the pdf-failed message when rendering fails", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ downloadToken: "tok" }) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    render(<DownloadGate lang="en" t={copy()} />);
    fireEvent.change(screen.getByLabelText("Adres e-mail"), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Wyślij i pobierz" }));
    await waitFor(() => expect(screen.getByText("Błąd PDF.")).toBeInTheDocument());
  });
```

- [ ] **Step 2: Run -> FAIL** (`npx vitest run tests/components/landing/download-gate.test.tsx`).

- [ ] **Step 3: Implement** in `components/landing/demo/download-gate.tsx`:

Add the import: `import type { DemoUpload } from "@/components/landing/demo/upload-panel";`

Extend the copy interface and props:

```tsx
export interface DownloadGateCopy {
  gateHeading: string;
  emailLabel: string;
  emailPlaceholder: string;
  consent: string;
  marketingOptIn: string;
  submit: string;
  success: string;
  gateError: string;
  rateLimited: string;
  pdfFailed: string;
}

type Status = "idle" | "submitting" | "success" | "error" | "rate_limited" | "pdf_failed";

export interface DownloadGateProps {
  lang: DemoLang;
  t: DownloadGateCopy;
  upload?: DemoUpload | null;
}
```

Update `fail` to accept the wider union: `function fail(next: "error" | "rate_limited" | "pdf_failed")`. In `submit`, change the unlock body to:

```tsx
        body: JSON.stringify({
          email,
          lang,
          turnstileToken: token,
          marketingOptIn,
          source: upload ? "upload" : "sample"
        })
```

and the pdf call + handling to:

```tsx
      const pdf = await fetch("/api/demo/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          upload
            ? { downloadToken, invoice: upload.invoice, sourceXml: upload.sourceXml, uploadToken: upload.uploadToken }
            : { downloadToken }
        )
      });
      if (pdf.status === 429) return fail("rate_limited");
      if (!pdf.ok) return fail("pdf_failed");
      triggerDownload(await pdf.blob(), `tlumaczksef-demo-${upload ? upload.lang : lang}.pdf`);
```

(Remember to destructure `upload` in the component signature: `export function DownloadGate({ lang, t, upload }: DownloadGateProps)`.) Add the message render next to the existing error lines:

```tsx
      {status === "pdf_failed" ? <p role="alert" className="text-center text-[12px] text-negative">{t.pdfFailed}</p> : null}
```

- [ ] **Step 4: Run -> PASS** (whole file: all pre-existing gate tests stay green). Then `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add components/landing/demo/download-gate.tsx tests/components/landing/download-gate.test.tsx
git commit -m "feat(landing-demo): gate unlocks and downloads the uploaded invoice"
```

---

## Task 11: Wire Lane 2 into the demo section + e2e + full verification

**Files:**
- Modify: `components/landing/demo/demo-section.tsx`
- Test: extend `tests/components/landing/demo-section.test.tsx`, `tests/e2e/landing-rebuild-preview.spec.ts`

- [ ] **Step 1: Add the failing component test** to `tests/components/landing/demo-section.test.tsx`. Add imports `waitFor` (from `@testing-library/react`) and `buildDemoInvoice` (from `@/lib/landing/demo-sample`), then:

```tsx
  it("reveals the upload dropzone and renders the uploaded invoice in the stage", async () => {
    const uploaded = {
      ...buildDemoInvoice("en"),
      items: [
        {
          name: "Deska tarasowa modrzewiowa",
          translatedName: "Larch decking board",
          quantity: 10,
          unit: "szt",
          translatedUnit: "pcs",
          unitPrice: 50,
          netValue: 500,
          vatRate: "0",
          grossValue: 500
        }
      ]
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ invoice: uploaded, sourceXml: "<Faktura/>", uploadToken: "tok" })
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<DemoSection locale="pl" />);
    expect(screen.queryByLabelText("Przeciągnij plik tutaj albo kliknij, aby wybrać")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "albo wgraj własną fakturę" }));
    const input = screen.getByLabelText("Przeciągnij plik tutaj albo kliknij, aby wybrać");
    fireEvent.change(input, { target: { files: [new File(["<Faktura/>"], "faktura.xml", { type: "application/xml" })] } });
    await waitFor(() => expect(screen.getByText("Larch decking board")).toBeInTheDocument());
    expect(screen.queryByText('Oak chair „Helena”')).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run -> FAIL** (`npx vitest run tests/components/landing/demo-section.test.tsx`).

- [ ] **Step 3: Implement the wiring** in `components/landing/demo/demo-section.tsx`:

Add imports:

```tsx
import { UploadPanel, type DemoUpload } from "@/components/landing/demo/upload-panel";
```

Add state next to `gateOpen`:

```tsx
  const [upload, setUpload] = useState<DemoUpload | null>(null);
```

Pass the upload to the stage and insert the panel between the stage and the CTA block (spec §9: the link sits under the paper):

```tsx
        <div className="mt-9">
          <InvoiceStage
            lang={lang}
            watermark={t.watermark}
            upload={upload ? { invoice: upload.invoice, lang: upload.lang } : null}
          />
        </div>

        <UploadPanel lang={lang} t={t} onResult={setUpload} />
```

And pass it to the gate: `<DownloadGate lang={lang} t={t} upload={upload} />`.

- [ ] **Step 4: Run the component tests -> PASS**

```bash
npx vitest run tests/components/landing/demo-section.test.tsx tests/components/landing/upload-panel.test.tsx tests/components/landing/download-gate.test.tsx tests/components/landing/invoice-stage.test.tsx
```

- [ ] **Step 5: Extend the e2e spec.** Append to `tests/e2e/landing-rebuild-preview.spec.ts`:

```typescript
test("demo upload lane renders an uploaded invoice through the mocked translate API", async ({ page }) => {
  const uploadedInvoice = {
    invoiceNumber: "FV 2026/06/0007",
    invoiceType: "VAT",
    issueDate: "2026-06-01",
    saleDate: "2026-06-01",
    currency: "EUR",
    seller: { name: "Tartak Modrzew Sp. z o.o.", vatId: "5252389632", address: "ul. Leśna 2, 10-100 Olsztyn, PL" },
    buyer: { name: "Nordholz GmbH", vatId: "DE129273398", address: "Holzweg 8, 20095 Hamburg, DE" },
    items: [
      {
        name: "Deska tarasowa modrzewiowa",
        translatedName: "Larch decking board",
        quantity: 100,
        unit: "szt",
        translatedUnit: "pcs",
        unitPrice: 18,
        netValue: 1800,
        vatRate: "0",
        grossValue: 1800
      }
    ],
    totals: { net: 1800, vat: 0, gross: 1800 }
  };
  await page.route("**/api/demo/translate", (route) =>
    route.fulfill({ json: { invoice: uploadedInvoice, sourceXml: "<Faktura/>", uploadToken: "e2e-token" } })
  );
  await page.goto("/landing-preview");
  const demo = page.locator("#demo");
  await demo.getByRole("button", { name: "albo wgraj własną fakturę" }).click();
  await demo
    .locator('input[type="file"]')
    .setInputFiles({ name: "faktura.xml", mimeType: "application/xml", buffer: Buffer.from("<Faktura/>") });
  await expect(demo.getByText("Larch decking board")).toBeVisible();
  await expect(demo.getByText('Oak chair „Helena”')).not.toBeVisible();
});
```

- [ ] **Step 6: Full verification**

```bash
npx vitest run tests/integration/lib tests/integration/api tests/components/landing
npx tsc --noEmit
npx playwright test tests/e2e/landing-rebuild-preview.spec.ts
```

Expected: all green, no new TS errors. The controller then does a live RWD pass on `/landing-preview` via the Claude_Preview MCP at 375/768/1024/1440: reveal the dropzone, confirm it fits the dark stage with visible focus rings, upload the sample XML (`public/sample-data/demo-fa3-export.xml`) with no Turnstile keys configured (dev token path), watch the stage swap to the uploaded invoice, switch a language chip (a second translate call fires), and open the gate (source upload path reachable).

- [ ] **Step 7: Commit**

```bash
git add components/landing/demo/demo-section.tsx tests/components/landing/demo-section.test.tsx tests/e2e/landing-rebuild-preview.spec.ts
git commit -m "feat(landing-demo): wire the upload lane into the demo section"
```

---

## Out of scope (later)

- The final `/` and `/en` swap (its own plan, after this PR merges): point the routes at `LandingRebuild`, repoint hero CTAs, retire `components/marketing/**`.
- Cleanup of now-unused `demo.cta`/`ctaHref`/`moreHref` copy keys (deferred fast-follow from Sprint B; do not bundle here).

## Self-review notes

- **Spec coverage:** Lane 2 data flow §5 (Tasks 6, 9, 10, 11), privacy §6 (nothing persisted; only counters: Tasks 1, 4, 6), abuse §7 (Turnstile Task 6; per-IP translate cap + global breaker Tasks 1/4/6; size caps Tasks 2/6/9; MIME 415 Tasks 2/6; download token unchanged; NEW pdf cap Tasks 1/4/7), errors §11 (copy Task 5; mappings Tasks 6/7/9/10), §12 Sprint C scope complete, language-switch-counts-against-cap (§5.6, Task 9 effect + test).
- **Security decision:** both halves implemented and tested (uploadToken binding: Tasks 3/6/7; pdf cap: Tasks 1/4/7). `/api/demo/pdf` renders upload content only when (download token valid) AND (uploadToken valid, unexpired) AND (hash matches the posted payload) AND (invoiceSchema accepts it).
- **Type consistency:** `DemoUpload { invoice, sourceXml, uploadToken, lang }` (Task 9) consumed by Tasks 10/11; `InvoiceStageUpload { invoice, lang }` (Task 8) built from it in Task 11; `UploadTokenPayload { hash, lang }` (Task 3) used in Tasks 6/7; `TranslateLimit { allowed, reason?, ipCount, globalCount }` (Task 4) consumed in Task 6; `source?: "sample" | "upload"` accepted by unlock (Task 7) and sent by the gate (Task 10); copy keys added in Task 5 match the `UploadPanelCopy`/`DownloadGateCopy` interfaces in Tasks 9/10.
- **Dev/test ergonomics:** everything runs without Turnstile/secret env vars except `DEMO_TOKEN_SECRET`, which tests set themselves (same as Sprint B); the `"dev"` token path keeps jsdom and e2e simple; e2e mocks `/api/demo/translate` so no OpenAI key is needed.
- **No persistence:** the translate route never writes the file, the parsed invoice, or the PDF anywhere; the only DB writes are the salted-IP-hash counters (and the `__global__` sentinel row).
