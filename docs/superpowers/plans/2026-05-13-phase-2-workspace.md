# KSeF SaaS Phase 2: Workspace Behind Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the parse → translate → PDF flow into the authenticated `/app` workspace, persist every uploaded invoice and every translation in Supabase, and strip the workspace UI off the public landing page so `/` is purely marketing with a "Sign in" CTA.

**Architecture:** A new server-only `lib/invoice/upload-service.ts` does the heavy lifting — SHA-256 fingerprinting, server-side XML or PDF parsing, KSeF QR verification, and upsert into the `invoices` table with the per-user dedupe constraint we added in Phase 1. `/api/upload` is a thin auth-gated wrapper around it. `/api/translate` and `/api/pdf` learn a second mode: when called with `{ invoiceId }` and a valid session, they read from / write to the `translations` cache; the existing inline `{ invoice }` path keeps working for backwards compatibility and a future demo route. The workspace UI is lifted out of `app/page.tsx` into a reusable client component used by `/app/(protected)/app/page.tsx`.

**Tech Stack:** Next.js 15 Route Handlers + Server Components, `@supabase/ssr`, `@supabase/supabase-js` admin client, existing `lib/xml/parser.ts` and `lib/pdf/parser.ts`, Vitest for unit/integration tests, Playwright for E2E. Zod for input validation on the upload endpoint.

**Out of scope for this phase:**
- Credit enforcement on upload (Phase 3).
- The history page at `/app/history` (Phase 5).
- The anonymous "Try with sample" demo route (deferred to Phase 6).
- Rate limiting (Phase 7).

---

## File Structure

### New files

- `lib/invoice/source-hash.ts` — `sha256Hex(bytes: ArrayBuffer | Buffer): string`. Pure util, no DB.
- `lib/invoice/upload-service.ts` — `uploadInvoiceForUser({ userId, file, supabase })`. Server-only; hashes, dedupes, parses XML/PDF, applies KSeF verification, upserts row. Returns `{ invoice, invoiceId, isNew, warnings }`.
- `lib/translation/translation-cache.ts` — `getOrCreateTranslation({ supabase, invoice, invoiceId, language, bilingual })`. Looks up `translations` row; if missing, runs `translateInvoiceFreeText`, persists, returns translated invoice.
- `app/api/upload/route.ts` — auth-gated route handler. Calls upload service. Returns `{ invoice, invoiceId, isNew, warnings }`.
- `components/workspace/translator-workspace.tsx` — client component containing the upload zone, language picker, translate button, PDF download button, and `<InvoicePreview>`. Takes a `mode` prop so the same surface can power both the persisted /app flow and a future demo flow.
- `components/workspace/use-translator-workflow.ts` — hook that owns the workspace state machine (parsing / translating / generating-pdf flags, error messages) and the fetch calls. Keeps the component focused on rendering.
- `lib/workspace/copy.ts` — extracted PL/EN copy dictionary from `app/page.tsx`. Both the landing page and the workspace component import strings from here.
- `tests/integration/lib/source-hash.test.ts`
- `tests/integration/lib/upload-service.test.ts`
- `tests/integration/lib/translation-cache.test.ts`
- `tests/integration/api/upload.test.ts`
- `tests/e2e/workspace.spec.ts`

### Modified files

- `app/page.tsx` — strip the workspace section (upload zone, parse/translate/download logic) and replace with a "Get started" CTA pointing to `/login`. Marketing content stays.
- `app/(protected)/app/page.tsx` — replace the placeholder with `<TranslatorWorkspace mode="authenticated" />`.
- `app/api/translate/route.ts` — accept either `{ invoice, language, bilingual }` (existing inline mode) or `{ invoiceId, language, bilingual }` (new auth+cache mode).
- `app/api/pdf/route.ts` — same dual-mode treatment.

### Files intentionally NOT touched

- `app/api/parse-pdf/route.ts`, `app/api/verify-ksef/route.ts` — both stay anonymous and unchanged. The upload service uses the underlying lib functions directly rather than calling these routes; the routes remain because the existing landing-page flow used them and removing them would break any external bookmarks. They become unused after this phase but are tiny; deletion is for a later cleanup phase.
- `lib/pdf/parser.ts`, `lib/xml/parser.ts`, `lib/translation/engine.ts`, `lib/pdf/invoice-pdfmake.ts`, `lib/ksef/*`, `lib/translation/dictionaries.ts`, `lib/translation/languages.ts` — all reused as-is.

---

## Tasks

### Task 1: Source-hash utility

**Files:**
- Create: `lib/invoice/source-hash.ts`
- Test: `tests/integration/lib/source-hash.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { sha256Hex } from "@/lib/invoice/source-hash";

describe("sha256Hex", () => {
  it("returns the lowercase hex digest of a Buffer", async () => {
    const buf = Buffer.from("hello", "utf8");
    const hex = await sha256Hex(buf);
    expect(hex).toBe("2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  });

  it("returns the same digest for an ArrayBuffer view of the same bytes", async () => {
    const buf = Buffer.from("hello world", "utf8");
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    expect(await sha256Hex(buf)).toBe(await sha256Hex(ab));
  });

  it("is deterministic across calls", async () => {
    const buf = Buffer.from("sample-fa3-xml", "utf8");
    const a = await sha256Hex(buf);
    const b = await sha256Hex(buf);
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- source-hash`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import { createHash } from "node:crypto";

export async function sha256Hex(input: ArrayBuffer | Buffer | Uint8Array): Promise<string> {
  const buffer = input instanceof Buffer ? input : Buffer.from(input as ArrayBuffer);
  return createHash("sha256").update(buffer).digest("hex");
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- source-hash`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/invoice/source-hash.ts tests/integration/lib/source-hash.test.ts
git commit -m "feat(lib): sha256 hex utility for source fingerprinting"
```

---

### Task 2: Upload service — XML parse + insert path

**Files:**
- Create: `lib/invoice/upload-service.ts`
- Test: `tests/integration/lib/upload-service.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { uploadInvoiceForUser } from "@/lib/invoice/upload-service";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const samplePath = path.resolve(process.cwd(), "sample-data/sample-fa3-invoice.xml");

async function newUser(label: string) {
  const email = `upload-${label}-${Date.now()}@example.test`;
  const { data } = await admin.auth.admin.createUser({ email, email_confirm: true });
  return data.user!.id;
}

describe("uploadInvoiceForUser (XML)", () => {
  it("parses a fresh XML upload and persists an invoices row", async () => {
    const userId = await newUser("xml-new");
    const bytes = readFileSync(samplePath);
    const file = new File([bytes], "sample.xml", { type: "application/xml" });

    const result = await uploadInvoiceForUser({ userId, file, supabase: admin });

    expect(result.isNew).toBe(true);
    expect(result.invoiceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.invoice.invoiceNumber).toBeTruthy();
    expect(result.warnings).toEqual(expect.any(Array));

    const { data: row } = await admin
      .from("invoices")
      .select("source_type, source_hash, source_size, invoice_number")
      .eq("id", result.invoiceId)
      .single();
    expect(row?.source_type).toBe("xml");
    expect(row?.source_hash).toHaveLength(64);
    expect(row?.source_size).toBe(bytes.length);
    expect(row?.invoice_number).toBe(result.invoice.invoiceNumber);

    await admin.auth.admin.deleteUser(userId);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- upload-service`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { Invoice } from "@/types/invoice";
import { sha256Hex } from "@/lib/invoice/source-hash";
import { parseKsefXml } from "@/lib/xml/parser";

export interface UploadResult {
  invoice: Invoice;
  invoiceId: string;
  isNew: boolean;
  warnings: string[];
}

export interface UploadOptions {
  userId: string;
  file: File;
  supabase: SupabaseClient<Database>;
}

export class UploadError extends Error {
  constructor(message: string, public readonly status = 400) {
    super(message);
    this.name = "UploadError";
  }
}

export async function uploadInvoiceForUser({ userId, file, supabase }: UploadOptions): Promise<UploadResult> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const hash = await sha256Hex(bytes);
  const sourceType = detectSourceType(file);

  if (sourceType === "xml") {
    return uploadXml({ userId, supabase, bytes, hash });
  }
  throw new UploadError(`Unsupported source type: ${sourceType}`, 415);
}

async function uploadXml(opts: {
  userId: string;
  supabase: SupabaseClient<Database>;
  bytes: Buffer;
  hash: string;
}): Promise<UploadResult> {
  const xml = new TextDecoder().decode(opts.bytes);
  const parsed = parseKsefXml(xml);
  if (!parsed.ok) {
    throw new UploadError(parsed.error, 422);
  }

  const insert = await opts.supabase
    .from("invoices")
    .insert({
      user_id: opts.userId,
      source_type: "xml",
      source_hash: opts.hash,
      source_size: opts.bytes.length,
      invoice_number: parsed.invoice.invoiceNumber,
      issue_date: parsed.invoice.issueDate,
      currency: parsed.invoice.currency,
      total_gross: parsed.invoice.totals?.gross ?? null,
      source_data: parsed.invoice as unknown as Record<string, unknown>,
      warnings: parsed.warnings
    })
    .select("id")
    .single();

  if (insert.error || !insert.data) {
    throw new UploadError(insert.error?.message ?? "Failed to persist invoice", 500);
  }

  return {
    invoice: parsed.invoice,
    invoiceId: insert.data.id,
    isNew: true,
    warnings: parsed.warnings
  };
}

function detectSourceType(file: File): "xml" | "pdf" {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  return "xml";
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- upload-service`
Expected: 1 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/invoice/upload-service.ts tests/integration/lib/upload-service.test.ts
git commit -m "feat(upload): xml parse-and-persist service"
```

---

### Task 3: Upload service — dedupe path

**Files:**
- Modify: `tests/integration/lib/upload-service.test.ts`

- [ ] **Step 1: Add a second test inside the existing `describe` block**

```ts
  it("returns the existing row when the same bytes are re-uploaded by the same user", async () => {
    const userId = await newUser("xml-dupe");
    const bytes = readFileSync(samplePath);
    const file1 = new File([bytes], "sample.xml", { type: "application/xml" });
    const file2 = new File([bytes], "sample-renamed.xml", { type: "application/xml" });

    const first = await uploadInvoiceForUser({ userId, file: file1, supabase: admin });
    const second = await uploadInvoiceForUser({ userId, file: file2, supabase: admin });

    expect(second.invoiceId).toBe(first.invoiceId);
    expect(second.isNew).toBe(false);
    expect(second.invoice.invoiceNumber).toBe(first.invoice.invoiceNumber);

    const { count } = await admin
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    expect(count).toBe(1);

    await admin.auth.admin.deleteUser(userId);
  });
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- upload-service`
Expected: 1 fail — second `uploadInvoiceForUser` throws because the partial unique index rejects the duplicate insert.

- [ ] **Step 3: Update `uploadXml` to check first**

Replace the body of `uploadXml` in `lib/invoice/upload-service.ts` with this version:

```ts
async function uploadXml(opts: {
  userId: string;
  supabase: SupabaseClient<Database>;
  bytes: Buffer;
  hash: string;
}): Promise<UploadResult> {
  const existing = await opts.supabase
    .from("invoices")
    .select("id, source_data, warnings")
    .eq("user_id", opts.userId)
    .eq("source_hash", opts.hash)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing.data) {
    return {
      invoice: existing.data.source_data as unknown as Invoice,
      invoiceId: existing.data.id,
      isNew: false,
      warnings: existing.data.warnings ?? []
    };
  }

  const xml = new TextDecoder().decode(opts.bytes);
  const parsed = parseKsefXml(xml);
  if (!parsed.ok) {
    throw new UploadError(parsed.error, 422);
  }

  const insert = await opts.supabase
    .from("invoices")
    .insert({
      user_id: opts.userId,
      source_type: "xml",
      source_hash: opts.hash,
      source_size: opts.bytes.length,
      invoice_number: parsed.invoice.invoiceNumber,
      issue_date: parsed.invoice.issueDate,
      currency: parsed.invoice.currency,
      total_gross: parsed.invoice.totals?.gross ?? null,
      source_data: parsed.invoice as unknown as Record<string, unknown>,
      warnings: parsed.warnings
    })
    .select("id")
    .single();

  if (insert.error || !insert.data) {
    throw new UploadError(insert.error?.message ?? "Failed to persist invoice", 500);
  }

  return {
    invoice: parsed.invoice,
    invoiceId: insert.data.id,
    isNew: true,
    warnings: parsed.warnings
  };
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- upload-service`
Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/invoice/upload-service.ts tests/integration/lib/upload-service.test.ts
git commit -m "feat(upload): dedupe re-uploads via source_hash lookup"
```

---

### Task 4: Upload service — PDF path

**Files:**
- Modify: `lib/invoice/upload-service.ts`
- Modify: `tests/integration/lib/upload-service.test.ts`

- [ ] **Step 1: Write failing test**

Add inside the existing `describe`:

```ts
  it("parses a PDF upload and persists it", async () => {
    const userId = await newUser("pdf-new");
    // For deterministic testing we re-render the sample XML through pdfmake and ingest it.
    // The sample-data folder is XML-only so we synthesise a minimal PDF via the existing renderer.
    const { renderInvoicePdfMake } = await import("@/lib/pdf/invoice-pdfmake");
    const { parseKsefXml } = await import("@/lib/xml/parser");
    const xml = readFileSync(samplePath, "utf8");
    const parsed = parseKsefXml(xml);
    if (!parsed.ok) throw new Error("sample XML failed to parse");
    const pdfBytes = await renderInvoicePdfMake(parsed.invoice, "en", false);
    const file = new File([Buffer.from(pdfBytes)], "sample.pdf", { type: "application/pdf" });

    const result = await uploadInvoiceForUser({ userId, file, supabase: admin });

    expect(result.isNew).toBe(true);
    expect(result.invoice.invoiceNumber).toBeTruthy();

    const { data: row } = await admin
      .from("invoices")
      .select("source_type")
      .eq("id", result.invoiceId)
      .single();
    expect(row?.source_type).toBe("pdf");

    await admin.auth.admin.deleteUser(userId);
  });
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- upload-service`
Expected: 1 fail — "Unsupported source type: pdf".

- [ ] **Step 3: Implement `uploadPdf`**

In `lib/invoice/upload-service.ts`, replace the `if (sourceType === "xml") { ... } throw new UploadError(...);` block in `uploadInvoiceForUser` with:

```ts
  if (sourceType === "xml") {
    return uploadXml({ userId, supabase, bytes, hash });
  }
  if (sourceType === "pdf") {
    return uploadPdf({ userId, supabase, bytes, hash });
  }
  throw new UploadError(`Unsupported source type: ${sourceType}`, 415);
```

And add this function below `uploadXml`:

```ts
async function uploadPdf(opts: {
  userId: string;
  supabase: SupabaseClient<Database>;
  bytes: Buffer;
  hash: string;
}): Promise<UploadResult> {
  const existing = await opts.supabase
    .from("invoices")
    .select("id, source_data, warnings")
    .eq("user_id", opts.userId)
    .eq("source_hash", opts.hash)
    .is("deleted_at", null)
    .maybeSingle();

  if (existing.data) {
    return {
      invoice: existing.data.source_data as unknown as Invoice,
      invoiceId: existing.data.id,
      isNew: false,
      warnings: existing.data.warnings ?? []
    };
  }

  const { parseKsefPdf } = await import("@/lib/pdf/parser");
  const parsed = await parseKsefPdf(opts.bytes);
  if (!parsed.ok) {
    throw new UploadError(parsed.error, 422);
  }

  const insert = await opts.supabase
    .from("invoices")
    .insert({
      user_id: opts.userId,
      source_type: "pdf",
      source_hash: opts.hash,
      source_size: opts.bytes.length,
      invoice_number: parsed.invoice.invoiceNumber,
      issue_date: parsed.invoice.issueDate,
      currency: parsed.invoice.currency,
      total_gross: parsed.invoice.totals?.gross ?? null,
      source_data: parsed.invoice as unknown as Record<string, unknown>,
      warnings: parsed.warnings
    })
    .select("id")
    .single();

  if (insert.error || !insert.data) {
    throw new UploadError(insert.error?.message ?? "Failed to persist invoice", 500);
  }

  return {
    invoice: parsed.invoice,
    invoiceId: insert.data.id,
    isNew: true,
    warnings: parsed.warnings
  };
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- upload-service`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/invoice/upload-service.ts tests/integration/lib/upload-service.test.ts
git commit -m "feat(upload): pdf parse path with shared dedupe"
```

---

### Task 5: `/api/upload` route handler

**Files:**
- Create: `app/api/upload/route.ts`
- Test: `tests/integration/api/upload.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const samplePath = path.resolve(process.cwd(), "sample-data/sample-fa3-invoice.xml");

async function authedFetch(email: string, init: RequestInit, urlPath: string) {
  const password = "Test123!Test123!";
  await admin.auth.admin.createUser({ email, password, email_confirm: true });
  const user = createClient(url, anon, { auth: { persistSession: false } });
  const { data: session } = await user.auth.signInWithPassword({ email, password });
  const access = session?.session?.access_token;

  return fetch(`${APP}${urlPath}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${access}`
    }
  });
}

beforeAll(async () => {
  const ping = await fetch(`${APP}/api/upload`, { method: "OPTIONS" }).catch(() => null);
  if (!ping) {
    throw new Error(`Next dev server not reachable at ${APP}. Start it with 'npm run dev' before running this test.`);
  }
});

describe("POST /api/upload", () => {
  it("returns 401 when unauthenticated", async () => {
    const fd = new FormData();
    fd.append("file", new Blob([readFileSync(samplePath)], { type: "application/xml" }), "sample.xml");
    const res = await fetch(`${APP}/api/upload`, { method: "POST", body: fd });
    expect(res.status).toBe(401);
  });

  it("uploads, persists, and returns 200 when authenticated", async () => {
    const email = `route-up-${Date.now()}@example.test`;
    const fd = new FormData();
    fd.append("file", new Blob([readFileSync(samplePath)], { type: "application/xml" }), "sample.xml");
    const res = await authedFetch(email, { method: "POST", body: fd }, "/api/upload");
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.invoiceId).toMatch(/^[0-9a-f-]{36}$/);
    expect(payload.invoice).toBeTruthy();
    expect(payload.isNew).toBe(true);

    const { data: user } = await admin.auth.admin.listUsers();
    const created = user.users.find((u) => u.email === email);
    if (created) await admin.auth.admin.deleteUser(created.id);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Make sure the dev server is running: in a tmux session run `npm run dev`. Then:

Run: `npm test -- upload.test`
Expected: FAIL — route returns 404.

- [ ] **Step 3: Implement route**

Create `app/api/upload/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { uploadInvoiceForUser, UploadError } from "@/lib/invoice/upload-service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' field" }, { status: 400 });
  }

  try {
    const result = await uploadInvoiceForUser({
      userId: userData.user.id,
      file,
      supabase: getSupabaseAdminClient()
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run, expect pass**

Restart the dev server (Ctrl-C then `npm run dev`) so it picks up the new route.

Run: `npm test -- upload.test`
Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add app/api/upload/route.ts tests/integration/api/upload.test.ts
git commit -m "feat(api): /api/upload auth-gated route"
```

---

### Task 6: Translation cache service

**Files:**
- Create: `lib/translation/translation-cache.ts`
- Test: `tests/integration/lib/translation-cache.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { uploadInvoiceForUser } from "@/lib/invoice/upload-service";
import { getOrCreateTranslation } from "@/lib/translation/translation-cache";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const samplePath = path.resolve(process.cwd(), "sample-data/sample-fa3-invoice.xml");

async function userWithInvoice(label: string) {
  const email = `cache-${label}-${Date.now()}@example.test`;
  const { data } = await admin.auth.admin.createUser({ email, email_confirm: true });
  const userId = data.user!.id;
  const bytes = readFileSync(samplePath);
  const file = new File([bytes], "sample.xml", { type: "application/xml" });
  const upload = await uploadInvoiceForUser({ userId, file, supabase: admin });
  return { userId, invoiceId: upload.invoiceId, invoice: upload.invoice };
}

describe("getOrCreateTranslation", () => {
  it("inserts a row on cache miss and reads it back on hit", async () => {
    const { userId, invoiceId, invoice } = await userWithInvoice("hit");

    const first = await getOrCreateTranslation({
      supabase: admin,
      invoice,
      invoiceId,
      language: "en",
      bilingual: true
    });
    expect(first.cached).toBe(false);
    expect(first.invoice.invoiceNumber).toBe(invoice.invoiceNumber);

    const { count } = await admin
      .from("translations")
      .select("id", { count: "exact", head: true })
      .eq("invoice_id", invoiceId);
    expect(count).toBe(1);

    const second = await getOrCreateTranslation({
      supabase: admin,
      invoice,
      invoiceId,
      language: "en",
      bilingual: true
    });
    expect(second.cached).toBe(true);
    expect(second.invoice.invoiceNumber).toBe(invoice.invoiceNumber);

    await admin.auth.admin.deleteUser(userId);
  });

  it("treats (language, bilingual) as distinct cache keys", async () => {
    const { userId, invoiceId, invoice } = await userWithInvoice("keys");

    await getOrCreateTranslation({ supabase: admin, invoice, invoiceId, language: "en", bilingual: true });
    await getOrCreateTranslation({ supabase: admin, invoice, invoiceId, language: "en", bilingual: false });
    await getOrCreateTranslation({ supabase: admin, invoice, invoiceId, language: "de", bilingual: true });

    const { count } = await admin
      .from("translations")
      .select("id", { count: "exact", head: true })
      .eq("invoice_id", invoiceId);
    expect(count).toBe(3);

    await admin.auth.admin.deleteUser(userId);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- translation-cache`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { Invoice, LanguageCode } from "@/types/invoice";
import { translateInvoiceFreeText } from "@/lib/translation/engine";

export interface CachedTranslation {
  invoice: Invoice;
  cached: boolean;
  usedAi: boolean;
}

export interface CacheLookupOptions {
  supabase: SupabaseClient<Database>;
  invoice: Invoice;
  invoiceId: string;
  language: LanguageCode;
  bilingual: boolean;
}

export async function getOrCreateTranslation(opts: CacheLookupOptions): Promise<CachedTranslation> {
  const { supabase, invoice, invoiceId, language, bilingual } = opts;

  const hit = await supabase
    .from("translations")
    .select("translated_data, used_ai")
    .eq("invoice_id", invoiceId)
    .eq("language", language)
    .eq("bilingual", bilingual)
    .maybeSingle();

  if (hit.data) {
    return {
      invoice: hit.data.translated_data as unknown as Invoice,
      cached: true,
      usedAi: hit.data.used_ai
    };
  }

  const usedAi = Boolean(process.env.OPENAI_API_KEY);
  const translated = await translateInvoiceFreeText(invoice, language);

  const insert = await supabase
    .from("translations")
    .insert({
      invoice_id: invoiceId,
      language,
      bilingual,
      translated_data: translated as unknown as Record<string, unknown>,
      used_ai: usedAi
    })
    .select("id")
    .single();

  if (insert.error) {
    // If a concurrent request inserted the same key, fall back to the now-cached row.
    if (insert.error.code === "23505") {
      return getOrCreateTranslation(opts);
    }
    throw new Error(`Failed to persist translation: ${insert.error.message}`);
  }

  return { invoice: translated, cached: false, usedAi };
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- translation-cache`
Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/translation/translation-cache.ts tests/integration/lib/translation-cache.test.ts
git commit -m "feat(translation): per-invoice translation cache service"
```

---

### Task 7: `/api/translate` — dual-mode (invoiceId + inline)

**Files:**
- Modify: `app/api/translate/route.ts`
- Test: extend `tests/integration/api/upload.test.ts` OR a new `tests/integration/api/translate.test.ts` — prefer a new dedicated file.
- Create: `tests/integration/api/translate.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const samplePath = path.resolve(process.cwd(), "sample-data/sample-fa3-invoice.xml");

async function authedSession() {
  const email = `translate-${Date.now()}@example.test`;
  const password = "Test123!Test123!";
  await admin.auth.admin.createUser({ email, password, email_confirm: true });
  const user = createClient(url, anon, { auth: { persistSession: false } });
  const { data } = await user.auth.signInWithPassword({ email, password });
  return { email, access: data.session!.access_token };
}

async function cleanup(email: string) {
  const { data } = await admin.auth.admin.listUsers();
  const created = data.users.find((u) => u.email === email);
  if (created) await admin.auth.admin.deleteUser(created.id);
}

beforeAll(async () => {
  const ping = await fetch(`${APP}/api/translate`, { method: "OPTIONS" }).catch(() => null);
  if (!ping) throw new Error(`Next dev server not reachable at ${APP}.`);
});

describe("POST /api/translate", () => {
  it("translates and caches when called with invoiceId", async () => {
    const { email, access } = await authedSession();

    // upload first
    const fd = new FormData();
    fd.append("file", new Blob([readFileSync(samplePath)], { type: "application/xml" }), "sample.xml");
    const up = await fetch(`${APP}/api/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}` },
      body: fd
    });
    const upPayload = await up.json();
    const invoiceId = upPayload.invoiceId as string;

    const res1 = await fetch(`${APP}/api/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${access}` },
      body: JSON.stringify({ invoiceId, language: "en", bilingual: true })
    });
    expect(res1.status).toBe(200);
    const p1 = await res1.json();
    expect(p1.cached).toBe(false);

    const res2 = await fetch(`${APP}/api/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${access}` },
      body: JSON.stringify({ invoiceId, language: "en", bilingual: true })
    });
    const p2 = await res2.json();
    expect(p2.cached).toBe(true);

    await cleanup(email);
  });

  it("still supports inline {invoice} mode without auth", async () => {
    const xml = readFileSync(samplePath, "utf8");
    const { parseKsefXml } = await import("@/lib/xml/parser");
    const parsed = parseKsefXml(xml);
    if (!parsed.ok) throw new Error("sample parse failed");

    const res = await fetch(`${APP}/api/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoice: parsed.invoice, language: "en", bilingual: true })
    });
    expect(res.status).toBe(200);
    const payload = await res.json();
    expect(payload.cached).toBe(false);
    expect(payload.invoice).toBeTruthy();
  });

  it("rejects invoiceId for a different user (RLS)", async () => {
    const owner = await authedSession();
    const fd = new FormData();
    fd.append("file", new Blob([readFileSync(samplePath)], { type: "application/xml" }), "sample.xml");
    const up = await fetch(`${APP}/api/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${owner.access}` },
      body: fd
    });
    const ownersInvoiceId = (await up.json()).invoiceId;

    const intruder = await authedSession();
    const res = await fetch(`${APP}/api/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${intruder.access}` },
      body: JSON.stringify({ invoiceId: ownersInvoiceId, language: "en", bilingual: true })
    });
    expect(res.status).toBe(404);

    await cleanup(owner.email);
    await cleanup(intruder.email);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- translate.test`
Expected: failures on the `invoiceId` paths because the route still only accepts inline `invoice`.

- [ ] **Step 3: Rewrite the route**

Replace `app/api/translate/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { invoiceSchema } from "@/lib/invoice/schema";
import { supportedLanguages } from "@/lib/translation/languages";
import { translateInvoiceFreeText } from "@/lib/translation/engine";
import { getOrCreateTranslation } from "@/lib/translation/translation-cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Invoice, LanguageCode } from "@/types/invoice";

const cachedRequestSchema = z.object({
  invoiceId: z.string().uuid(),
  language: z.string(),
  bilingual: z.boolean().optional()
});

const inlineRequestSchema = z.object({
  invoice: z.unknown(),
  language: z.string(),
  bilingual: z.boolean().optional()
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const cached = cachedRequestSchema.safeParse(body);
  if (cached.success) {
    return translateCached(cached.data);
  }

  const inline = inlineRequestSchema.safeParse(body);
  if (inline.success) {
    return translateInline(inline.data);
  }

  return NextResponse.json({ error: "Provide either { invoiceId } or { invoice }" }, { status: 400 });
}

async function translateCached(params: z.infer<typeof cachedRequestSchema>) {
  if (!(params.language in supportedLanguages)) {
    return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const row = await supabase
    .from("invoices")
    .select("source_data")
    .eq("id", params.invoiceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!row.data) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const result = await getOrCreateTranslation({
    supabase: getSupabaseAdminClient(),
    invoice: row.data.source_data as unknown as Invoice,
    invoiceId: params.invoiceId,
    language: params.language as LanguageCode,
    bilingual: params.bilingual !== false
  });

  return NextResponse.json({
    invoice: result.invoice,
    cached: result.cached,
    usedAi: result.usedAi
  });
}

async function translateInline(params: z.infer<typeof inlineRequestSchema>) {
  if (!(params.language in supportedLanguages)) {
    return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
  }
  const invoice = invoiceSchema.parse(params.invoice);
  const usedAi = Boolean(process.env.OPENAI_API_KEY);
  const translated = await translateInvoiceFreeText(invoice, params.language as LanguageCode);
  return NextResponse.json({ invoice: translated, cached: false, usedAi });
}
```

- [ ] **Step 4: Restart dev server, run, expect pass**

Restart `npm run dev`, then:

Run: `npm test -- translate.test`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add app/api/translate/route.ts tests/integration/api/translate.test.ts
git commit -m "feat(api): /api/translate dual-mode with cache and RLS check"
```

---

### Task 8: `/api/pdf` — accept invoiceId with cached translation

**Files:**
- Modify: `app/api/pdf/route.ts`
- Create: `tests/integration/api/pdf.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const samplePath = path.resolve(process.cwd(), "sample-data/sample-fa3-invoice.xml");

async function authedSession() {
  const email = `pdf-${Date.now()}@example.test`;
  const password = "Test123!Test123!";
  await admin.auth.admin.createUser({ email, password, email_confirm: true });
  const user = createClient(url, anon, { auth: { persistSession: false } });
  const { data } = await user.auth.signInWithPassword({ email, password });
  return { email, access: data.session!.access_token };
}

async function cleanup(email: string) {
  const { data } = await admin.auth.admin.listUsers();
  const created = data.users.find((u) => u.email === email);
  if (created) await admin.auth.admin.deleteUser(created.id);
}

beforeAll(async () => {
  const ping = await fetch(`${APP}/api/pdf`, { method: "OPTIONS" }).catch(() => null);
  if (!ping) throw new Error(`Next dev server not reachable at ${APP}.`);
});

describe("POST /api/pdf", () => {
  it("renders a PDF for an authenticated user with invoiceId", async () => {
    const { email, access } = await authedSession();

    const fd = new FormData();
    fd.append("file", new Blob([readFileSync(samplePath)], { type: "application/xml" }), "sample.xml");
    const up = await fetch(`${APP}/api/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}` },
      body: fd
    });
    const invoiceId = (await up.json()).invoiceId;

    const res = await fetch(`${APP}/api/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${access}` },
      body: JSON.stringify({ invoiceId, language: "en", bilingual: true })
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(1000);
    expect(Buffer.from(bytes.slice(0, 4)).toString("utf8")).toBe("%PDF");

    await cleanup(email);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- pdf.test`
Expected: FAIL — the current route rejects `{ invoiceId }` because it expects `{ invoice }`.

- [ ] **Step 3: Update the route**

Replace `app/api/pdf/route.ts` with:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { invoiceSchema } from "@/lib/invoice/schema";
import { verifyPublicKsefQrUrl } from "@/lib/ksef/public-verification";
import { renderInvoicePdfMake } from "@/lib/pdf/invoice-pdfmake";
import { supportedLanguages } from "@/lib/translation/languages";
import { getOrCreateTranslation } from "@/lib/translation/translation-cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Invoice, LanguageCode } from "@/types/invoice";

export const runtime = "nodejs";

const cachedRequestSchema = z.object({
  invoiceId: z.string().uuid(),
  language: z.string(),
  bilingual: z.boolean().optional()
});

const inlineRequestSchema = z.object({
  invoice: z.unknown(),
  language: z.string(),
  bilingual: z.boolean().optional()
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const cached = cachedRequestSchema.safeParse(body);
    if (cached.success) {
      return await pdfFromCache(cached.data);
    }

    const inline = inlineRequestSchema.safeParse(body);
    if (inline.success) {
      return await pdfFromInline(inline.data);
    }

    return NextResponse.json({ error: "Provide either { invoiceId } or { invoice }" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PDF generation failed." },
      { status: 500 }
    );
  }
}

async function pdfFromCache(params: z.infer<typeof cachedRequestSchema>) {
  if (!(params.language in supportedLanguages)) {
    return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const row = await supabase
    .from("invoices")
    .select("source_data")
    .eq("id", params.invoiceId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!row.data) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const bilingual = params.bilingual !== false;
  const translation = await getOrCreateTranslation({
    supabase: getSupabaseAdminClient(),
    invoice: row.data.source_data as unknown as Invoice,
    invoiceId: params.invoiceId,
    language: params.language as LanguageCode,
    bilingual
  });

  return renderPdfResponse(translation.invoice, params.language as LanguageCode, bilingual);
}

async function pdfFromInline(params: z.infer<typeof inlineRequestSchema>) {
  if (!(params.language in supportedLanguages)) {
    return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
  }
  const invoice = invoiceSchema.parse(params.invoice);
  return renderPdfResponse(invoice, params.language as LanguageCode, params.bilingual !== false);
}

async function renderPdfResponse(invoice: Invoice, language: LanguageCode, bilingual: boolean) {
  const verificationUrl = invoice.verification?.qrLink;
  const verificationResult = verificationUrl
    ? await verifyPublicKsefQrUrl(verificationUrl)
    : { confirmed: false as const };
  const invoiceForPdf = invoiceWithConfirmedKsefVerification(invoice, verificationUrl, verificationResult);
  const pdf = await renderInvoicePdfMake(invoiceForPdf, language, bilingual);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${pdfFilename(invoice.invoiceNumber)}"`,
      "X-KSeF-Verification-Confirmed": verificationResult.confirmed ? "true" : "false",
      "X-KSeF-Verification-Status": String(verificationResult.statusCode ?? ""),
      "X-KSeF-Verification-Error": encodeHeaderValue(verificationResult.error ?? ""),
      "X-KSeF-Number": encodeHeaderValue(verificationResult.ksefNumber ?? "")
    }
  });
}

function encodeHeaderValue(value: string) {
  return encodeURIComponent(value).slice(0, 500);
}

function invoiceWithConfirmedKsefVerification(
  invoice: Invoice,
  verificationUrl: string | undefined,
  verificationResult: { confirmed: boolean; ksefNumber?: string }
): Invoice {
  if (!verificationUrl || !verificationResult.confirmed || !verificationResult.ksefNumber) {
    const { verification: _verification, ...invoiceWithoutVerification } = invoice;
    return invoiceWithoutVerification;
  }
  return {
    ...invoice,
    verification: {
      qrLink: verificationUrl,
      ksefNumber: verificationResult.ksefNumber
    }
  };
}

function pdfFilename(invoiceNumber: string) {
  const safeInvoiceNumber = invoiceNumber
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `ksef-invoice-${safeInvoiceNumber || "invoice"}.pdf`;
}
```

- [ ] **Step 4: Restart dev server, run, expect pass**

Restart `npm run dev`, then:

Run: `npm test -- pdf.test`
Expected: 1 passing.

- [ ] **Step 5: Commit**

```bash
git add app/api/pdf/route.ts tests/integration/api/pdf.test.ts
git commit -m "feat(api): /api/pdf dual-mode with cached translation lookup"
```

---

### Task 9: Lift PL/EN copy out of `app/page.tsx`

**Files:**
- Create: `lib/workspace/copy.ts`
- Modify: `app/page.tsx` (imports + remove inline `copy` object)

- [ ] **Step 1: Create `lib/workspace/copy.ts`**

Copy the entire `copy` constant from `app/page.tsx` (it's a `Record<"pl" | "en", { … }>` definition) into a new module that exports it. The file should be a verbatim move:

```ts
// Verbatim move of the bilingual copy dictionary previously inlined in app/page.tsx.
// Phase 2 lifts it here so the workspace component and the landing page can share strings.

export type UiLanguage = "pl" | "en";

export const copy = {
  pl: {
    // ... paste the entire `pl` block from app/page.tsx
  },
  en: {
    // ... paste the entire `en` block from app/page.tsx
  }
} as const satisfies Record<UiLanguage, Record<string, unknown>>;

export type Copy = (typeof copy)[UiLanguage];
```

Do not re-author the strings — copy them byte-for-byte from the current `app/page.tsx` so `git diff` is a pure move.

- [ ] **Step 2: Update `app/page.tsx`**

Near the top of `app/page.tsx`, replace the `type UiLanguage = "pl" | "en";` line and the `const copy = { … }` block with:

```tsx
import { copy, type UiLanguage } from "@/lib/workspace/copy";
```

(Place the import next to the other `@/` imports.) Everything else in `app/page.tsx` continues to work because the shape of `copy` is unchanged.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Smoke build**

Run: `npm run build`
Expected: build completes; no new errors.

- [ ] **Step 5: Commit**

```bash
git add lib/workspace/copy.ts app/page.tsx
git commit -m "refactor: extract bilingual copy dictionary into lib/workspace"
```

---

### Task 10: Extract the workspace UI into a reusable component

**Files:**
- Create: `components/workspace/translator-workspace.tsx`
- Create: `components/workspace/use-translator-workflow.ts`

This task isolates the upload-zone + language picker + translate + download UI from `app/page.tsx` into a component that can be mounted under `/app`. The component renders the existing `<InvoicePreview>` and uses the new endpoints. The landing page in the next task will lose this UI entirely; for now the new component is created but not yet used.

- [ ] **Step 1: Write the hook**

Create `components/workspace/use-translator-workflow.ts`:

```ts
"use client";

import { useState } from "react";
import type { Invoice, LanguageCode } from "@/types/invoice";

export type WorkflowStatus = "idle" | "uploading" | "translating" | "generating-pdf";

export interface UseTranslatorWorkflowResult {
  invoice: Invoice | null;
  invoiceId: string | null;
  status: WorkflowStatus;
  messages: string[];
  upload(file: File): Promise<void>;
  translate(language: LanguageCode, bilingual: boolean): Promise<void>;
  downloadPdf(language: LanguageCode, bilingual: boolean): Promise<void>;
  reset(): void;
}

export function useTranslatorWorkflow(): UseTranslatorWorkflowResult {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [status, setStatus] = useState<WorkflowStatus>("idle");
  const [messages, setMessages] = useState<string[]>([]);

  async function upload(file: File) {
    setMessages([]);
    setStatus("uploading");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error ?? "Upload failed");
      }
      setInvoice(payload.invoice);
      setInvoiceId(payload.invoiceId);
      setMessages(payload.warnings ?? []);
    } catch (error) {
      setInvoice(null);
      setInvoiceId(null);
      setMessages([error instanceof Error ? error.message : "Upload failed"]);
    } finally {
      setStatus("idle");
    }
  }

  async function translate(language: LanguageCode, bilingual: boolean) {
    if (!invoiceId) return;
    setStatus("translating");
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, language, bilingual })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error ?? "Translation failed");
      }
      setInvoice(payload.invoice);
    } catch (error) {
      setMessages([error instanceof Error ? error.message : "Translation failed"]);
    } finally {
      setStatus("idle");
    }
  }

  async function downloadPdf(language: LanguageCode, bilingual: boolean) {
    if (!invoiceId || !invoice) return;
    setStatus("generating-pdf");
    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, language, bilingual })
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error ?? "PDF generation failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ksef-invoice-${invoice.invoiceNumber}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setMessages([error instanceof Error ? error.message : "PDF generation failed"]);
    } finally {
      setStatus("idle");
    }
  }

  function reset() {
    setInvoice(null);
    setInvoiceId(null);
    setMessages([]);
    setStatus("idle");
  }

  return { invoice, invoiceId, status, messages, upload, translate, downloadPdf, reset };
}
```

- [ ] **Step 2: Write the component**

Create `components/workspace/translator-workspace.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { Download, Languages, Loader2, ScanLine, UploadCloud } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { InvoicePreview } from "@/components/invoice-preview";
import { copy, type UiLanguage } from "@/lib/workspace/copy";
import { getLanguageOptions } from "@/lib/translation/languages";
import type { LanguageCode } from "@/types/invoice";
import { useTranslatorWorkflow } from "./use-translator-workflow";

export interface TranslatorWorkspaceProps {
  uiLanguage?: UiLanguage;
}

export function TranslatorWorkspace({ uiLanguage = "pl" }: TranslatorWorkspaceProps) {
  const t = copy[uiLanguage];
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [bilingual, setBilingual] = useState(true);
  const { invoice, status, messages, upload, translate, downloadPdf } = useTranslatorWorkflow();

  const languageOptions = useMemo(() => getLanguageOptions(uiLanguage), [uiLanguage]);
  const selectedLanguage =
    languageOptions.find((option) => option.code === language)?.label ?? language;

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-soft md:flex-row md:items-center md:justify-between">
        <div className="grid gap-2 sm:grid-cols-[220px_auto] sm:items-center">
          <label htmlFor="language" className="text-sm font-medium text-slate-700">
            {String(t.targetLanguage)}
          </label>
          <select
            id="language"
            value={language}
            onChange={(event) => setLanguage(event.target.value as LanguageCode)}
            className="h-10 rounded-md border border-input bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {languageOptions.map((option) => (
              <option key={option.code} value={option.code}>{option.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex h-10 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-medium text-cyan-900">
            <input
              type="checkbox"
              checked={bilingual}
              onChange={(event) => setBilingual(event.target.checked)}
              className="h-4 w-4 rounded border-cyan-300 text-cyan-700 focus:ring-cyan-700"
            />
            {String(t.bilingual)}
          </label>
          <Button
            onClick={() => translate(language, bilingual)}
            disabled={!invoice || status === "translating"}
            variant="outline"
          >
            {status === "translating" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Languages className="h-4 w-4" />}
            {String(t.translate)}
          </Button>
          <Button
            onClick={() => downloadPdf(language, bilingual)}
            disabled={!invoice || status === "generating-pdf"}
          >
            {status === "generating-pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {String(t.download)}
          </Button>
        </div>
      </div>

      {messages.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
          {messages.map((message) => <p key={message}>{message}</p>)}
        </div>
      ) : null}

      {!invoice ? (
        <DropZone onFile={(f) => f && upload(f)} title={String(t.uploadTitle)} help={String(t.uploadHelp)} disabled={status === "uploading"} />
      ) : null}

      {status === "uploading" ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-600">
          <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-cyan-700" />
          {String(t.parsing)}
        </div>
      ) : invoice ? (
        <InvoicePreview invoice={invoice} language={language} bilingual={bilingual} />
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center text-slate-600">
          <ScanLine className="mx-auto mb-3 h-8 w-8 text-cyan-700" />
          {String(t.empty)} {selectedLanguage}.
          <p className="mt-4 text-xs text-slate-500">
            <Link className="font-medium underline" href="/">← {uiLanguage === "pl" ? "Strona główna" : "Home"}</Link>
          </p>
        </div>
      )}
    </section>
  );
}

function DropZone({
  onFile,
  title,
  help,
  disabled
}: {
  onFile: (file?: File) => void;
  title: string;
  help: string;
  disabled?: boolean;
}) {
  return (
    <label
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        if (!disabled) onFile(event.dataTransfer.files[0]);
      }}
      aria-disabled={disabled}
      className={`flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center transition-colors ${disabled ? "opacity-60" : "hover:border-cyan-700 hover:bg-cyan-50/40"}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-50 text-cyan-700">
        <UploadCloud className="h-6 w-6" />
      </div>
      <span className="mt-4 text-base font-semibold text-slate-950">{title}</span>
      <span className="mt-2 text-sm text-slate-500">{help}</span>
      <input
        type="file"
        accept=".xml,application/xml,text/xml,.pdf,application/pdf"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => onFile(event.target.files?.[0])}
      />
    </label>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/workspace/
git commit -m "feat(workspace): extract translator workspace into reusable component"
```

---

### Task 11: Mount the workspace under `/app`

**Files:**
- Modify: `app/(protected)/app/page.tsx`

- [ ] **Step 1: Replace the placeholder**

Replace the contents of `app/(protected)/app/page.tsx` with:

```tsx
import { TranslatorWorkspace } from "@/components/workspace/translator-workspace";
import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { UiLanguage } from "@/lib/workspace/copy";

export default async function AppPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("locale")
    .eq("id", user.id)
    .single();

  const uiLanguage: UiLanguage = profile?.locale === "en" ? "en" : "pl";

  return <TranslatorWorkspace uiLanguage={uiLanguage} />;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Manual smoke**

Start dev server (`npm run dev` in tmux), sign in via the existing flow, navigate to `/app`. Upload `sample-data/sample-fa3-invoice.xml`. Click "Tłumacz opisy". Click "Pobierz PDF". Verify the downloaded file opens and matches the legacy output.

- [ ] **Step 4: Commit**

```bash
git add 'app/(protected)/app/page.tsx'
git commit -m "feat(app): mount translator workspace on /app behind auth"
```

---

### Task 12: Strip workspace UI from the landing page

**Files:**
- Modify: `app/page.tsx`

The landing page currently has the workspace embedded between the hero and the marketing sections. Phase 2 removes that — the workspace lives at `/app` now. The landing page becomes pure marketing with a "Get started" CTA.

- [ ] **Step 1: Remove workspace state + handlers**

Open `app/page.tsx`. Delete:
- The hooks `useState` calls for `invoice`, `language`, `messages`, `bilingual`, `isParsing`, `isTranslating`, `isGeneratingPdf`.
- The `handleFile`, `verifyKsefForPreview`, `translate`, `downloadPdf` functions and any helpers they reference exclusively (e.g. `buildKsefXmlVerificationLink` import if no longer needed elsewhere).
- The `<section id="workspace">` block in the JSX.
- The unused imports the deletions create — TypeScript will flag them.

- [ ] **Step 2: Replace the workspace section with a CTA**

In place of the `<section id="workspace">` block, render this CTA section:

```tsx
<section id="workspace" className="mx-auto max-w-7xl px-5 py-12 md:px-8">
  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-8 py-16 text-center shadow-soft">
    <h2 className="text-2xl font-semibold text-slate-950 md:text-3xl">
      {uiLanguage === "pl" ? "Zacznij od zalogowania" : "Sign in to get started"}
    </h2>
    <p className="mx-auto mt-3 max-w-2xl text-slate-600">
      {uiLanguage === "pl"
        ? "Wgraj swoją pierwszą fakturę KSeF FA(3) lub PDF po zalogowaniu. Pierwsza faktura w miesiącu jest bezpłatna."
        : "Upload your first KSeF FA(3) or PDF invoice after signing in. The first invoice each month is free."}
    </p>
    <div className="mt-6 flex justify-center">
      <Link
        href="/login"
        className="inline-flex h-11 items-center rounded-md bg-slate-950 px-6 text-sm font-semibold text-white shadow-sm hover:bg-slate-900"
      >
        {uiLanguage === "pl" ? "Zaloguj się" : "Sign in"}
      </Link>
    </div>
  </div>
</section>
```

- [ ] **Step 3: Drop any imports that are no longer used**

After Step 2, `npm run typecheck` will list unused imports (e.g. `parseKsefXml`, `Invoice`, possibly `Loader2`, `Languages`, `Download`, `ScanLine`, `UploadCloud`). Remove them. Keep imports that are still used elsewhere in the file.

- [ ] **Step 4: Verify typecheck + build**

Run: `npm run typecheck`
Expected: PASS.

Run: `npm run build`
Expected: build completes with no errors and no new lint warnings on this file.

- [ ] **Step 5: Manual smoke**

Start dev server, open `/`, confirm the landing page renders without the workspace; the CTA button takes you to `/login`. Then sign in and confirm `/app` still works end-to-end.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx
git commit -m "refactor: strip workspace UI off landing page, replace with sign-in CTA"
```

---

### Task 13: E2E — signed-in workspace flow

**Files:**
- Create: `tests/e2e/workspace.spec.ts`

- [ ] **Step 1: Write spec**

```ts
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, serviceRole, { auth: { persistSession: false } });
const samplePath = path.resolve(process.cwd(), "sample-data/sample-fa3-invoice.xml");

async function signInViaTokenHash(page: import("@playwright/test").Page, email: string) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) {
    throw new Error("generateLink failed");
  }
  await page.goto(`/auth/callback?token_hash=${data.properties.hashed_token}&type=email`);
  await expect(page).toHaveURL(/\/app$/);
}

async function deleteUser(email: string) {
  const { data } = await admin.auth.admin.listUsers();
  const created = data.users.find((u) => u.email === email);
  if (created) await admin.auth.admin.deleteUser(created.id);
}

test("authenticated user can upload, translate, and download an invoice", async ({ page }) => {
  const email = `workspace-${Date.now()}@example.test`;
  await admin.auth.admin.createUser({ email, email_confirm: true });
  await signInViaTokenHash(page, email);

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByText(/Wgraj KSeF FA\(3\) XML lub PDF/i).click();
  const chooser = await fileChooserPromise;
  await chooser.setFiles(samplePath);

  await expect(page.getByText(/Faktura|Invoice/)).toBeVisible({ timeout: 20_000 });
  // Source-of-truth check: the row should exist for this user.
  const { data: invoiceRows } = await admin
    .from("invoices")
    .select("id, source_type")
    .order("created_at", { ascending: false })
    .limit(5);
  expect(invoiceRows?.[0]?.source_type).toBe("xml");

  // Translate.
  await page.getByRole("button", { name: /Tłumacz opisy|Translate descriptions/i }).click();

  // Download PDF — assert the network response.
  const [downloadResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/pdf") && r.request().method() === "POST"),
    page.getByRole("button", { name: /Pobierz PDF|Download PDF/i }).click()
  ]);
  expect(downloadResponse.status()).toBe(200);
  expect(downloadResponse.headers()["content-type"]).toContain("application/pdf");

  await deleteUser(email);
});
```

- [ ] **Step 2: Run, expect pass**

Make sure the dev server is up (Playwright auto-boots it). Then:

Run: `npm run test:e2e -- workspace`
Expected: 1 passing.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/workspace.spec.ts
git commit -m "test(e2e): signed-in upload + translate + download flow"
```

---

### Task 14: README — workspace docs

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Append a workspace section**

After the existing "Supabase development setup" section, append:

```markdown
## Workspace flow (Phase 2)

After signing in, the translator workspace lives at `/app`. The flow:

1. Upload an XML or PDF KSeF invoice. The server computes a SHA-256 hash; if the same bytes were uploaded before by the same user, the existing row is reused (no duplicate persistence).
2. Parsing happens server-side (`lib/invoice/upload-service.ts`). The parsed invoice is stored in `invoices.source_data`.
3. Translation goes through `/api/translate` with `{ invoiceId, language, bilingual }`. The first request triggers `translateInvoiceFreeText`; subsequent identical requests are served from `translations` (cached forever).
4. PDF generation goes through `/api/pdf` with `{ invoiceId, language, bilingual }`. It uses the cached translation if present.

Anonymous callers can still use `/api/translate` and `/api/pdf` with `{ invoice }` (inline mode) — credits are not consumed yet (Phase 3 wires that up).

The public landing page at `/` is marketing only; the "Sign in" CTA is the only entry point to the workspace.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: phase 2 workspace flow"
```

---

## Verification Checklist (run before opening the Phase 2 PR)

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` either passes or only reports the pre-existing `next/core-web-vitals` worktree issue
- [ ] `npm test` — every test file under `tests/integration/` is green (the new ones plus the Phase 1 baseline)
- [ ] `npm run test:e2e` — `smoke`, `auth`, and `workspace` specs all pass
- [ ] `npm run build` succeeds
- [ ] Manual: sign in, upload XML at `/app`, translate, download PDF, verify it opens. Re-upload the same XML and confirm it returns immediately with `isNew: false` (check the network panel).
- [ ] Manual: `/` renders cleanly without the workspace section, CTA goes to `/login`
- [ ] Manual: `/app/account` still renders correctly
- [ ] Manual: an unsigned-in user hitting `/api/upload` gets a 401
- [ ] Supabase advisor (security + performance) returns no new lints after the test runs leave their rows behind

---

## What comes next

Phase 3 (credits enforcement) is the immediate follow-up:
- Wire `consume_credit(p_user, p_invoice)` into `/api/upload` so a successful upload reserves a credit. Track in the `credit_ledger`.
- Surface the balance chip in the protected header.
- Build the insufficient-credit modal with a "Buy credits" link to `/billing` (which doesn't exist yet — Phase 4 builds it).

The Phase 2 endpoints are designed so Phase 3 is a localized change inside `/api/upload` and `app/(protected)/layout.tsx` only.
