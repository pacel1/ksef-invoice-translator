# Landing Demo Sprint B (the download gate) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a download-for-email gate to the landing demo: the visitor enters an email, an instant PDF of the demo invoice (in the chosen language) downloads, and a passwordless magic-link signup fires in the background, all behind Cloudflare Turnstile + an IP-hash rate limit + a signed short-lived token, fully stateless.

**Architecture:** A new `download-gate` panel in the demo section collects email + consent + a Turnstile token. On submit it calls `POST /api/demo/unlock`, which verifies Turnstile, enforces a per-IP daily cap (a `demo_usage` table written by the service-role client), fires a server-side passwordless `signInWithOtp` via a fresh anon client, and returns an HMAC-signed short-lived download token. The client then calls `POST /api/demo/pdf` with that token; the route validates it and streams a PDF produced statelessly by `renderOfficialFa3Pdf({ sourceXml, invoice: buildDemoInvoice(lang), ... })` (no DB, no OpenAI). Nothing is persisted except the per-IP-hash counter.

**Tech Stack:** Next.js 15 App Router (`runtime = "nodejs"` route handlers), React 19, TypeScript, TailwindCSS, Supabase (service-role admin client + a SQL function), `@marsidev/react-turnstile` (new dep), `node:crypto` HMAC, Resend-backed Supabase auth email hook (existing), Vitest + Testing Library (jsdom), Playwright.

**Branch:** `claude/landing-demo-gate` (already created off `main`, carries Sprint A + the clipping fix). One PR for this sprint.

**Reuse (do not modify):** `renderOfficialFa3Pdf` (`lib/mf-fa3/official-renderer.ts`), `buildDemoInvoice`/`DEMO_LANGS`/`DemoLang` (`lib/landing/demo-sample.ts`), the demo `sourceXml` asset (`public/sample-data/demo-fa3-export.xml`, whose `P_2` matches `DEMO_SAMPLE_INVOICE.invoiceNumber`), `getSupabaseAdminClient` (`lib/supabase/admin.ts`), the auth email hook + `/auth/callback` (existing), `landingCopy` (`lib/landing/copy.ts`), the no-dash copy test.

---

## Environment variables (document in README/`.env.example` as part of Task 1)

| Var | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | client | Turnstile widget site key (public). |
| `TURNSTILE_SECRET_KEY` | server | Turnstile server-side verify secret. |
| `DEMO_TOKEN_SECRET` | server | HMAC secret for the download token. |
| `DEMO_IP_SALT` | server | Salt for hashing the caller IP. |
| `NEXT_PUBLIC_APP_URL` | server | Existing. Used for `emailRedirectTo`. |

**Dev/test behavior (must be explicit, not implied):** when `TURNSTILE_SECRET_KEY` is unset AND `process.env.NODE_ENV !== "production"`, Turnstile verification returns `ok: true` (so local `/landing-preview` and tests work without keys). When unset in production it fails closed. Same idea for the client widget: when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is unset, the gate renders no widget and submits a literal `"dev"` token, which the server accepts only under the dev bypass above.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `supabase/migrations/20260610000001_demo_usage.sql` (create) | `demo_usage` table (per IP-hash daily counters) + `increment_demo_unlock(text)` SQL function. RLS on, no anon/authenticated policies (service-role only). |
| `lib/supabase/database.types.ts` (regenerate) | Typed for `demo_usage` after the migration. |
| `lib/demo/rate-limit.ts` (create) | `hashIp(ip)`, `clientIpFrom(request)`, `consumeUnlock(ip)` -> `{ allowed, count }`. |
| `lib/demo/turnstile.ts` (create) | `verifyTurnstile(token, ip?)` -> `{ ok }` with the dev bypass. |
| `lib/demo/download-token.ts` (create) | `signDownloadToken(payload, now?)`, `verifyDownloadToken(token, now?)` (HMAC-SHA256 + exp + timing-safe compare). |
| `lib/demo/send-demo-otp.ts` (create) | Server-side passwordless `signInWithOtp` via a fresh anon client (no cookies); never throws. |
| `app/api/demo/unlock/route.ts` (create) | Turnstile -> rate limit -> OTP -> issue token. |
| `app/api/demo/pdf/route.ts` (create) | Validate token -> render demo PDF statelessly -> stream. |
| `lib/landing/copy.ts` (modify) | Extend the `demo` copy group with gate strings (pl + en, no dashes). |
| `components/landing/demo/download-gate.tsx` (create) | The gate panel: email + consent + marketing opt-in + Turnstile + submit + states. |
| `components/landing/demo/demo-section.tsx` (modify) | Hold gate-open state; the CTA and "+ więcej" open the gate. |
| Tests under `tests/integration/lib/`, `tests/integration/api/`, `tests/components/landing/`, `tests/e2e/`. | Per task. |

---

## Task 1: `demo_usage` table + rate-limit SQL function

**Files:**
- Create: `supabase/migrations/20260610000001_demo_usage.sql`
- Regenerate: `lib/supabase/database.types.ts`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260610000001_demo_usage.sql`:

```sql
-- Per IP-hash daily counters for the public landing demo rate limit.
-- Written only by the service role; RLS denies anon/authenticated entirely.
create table public.demo_usage (
  ip_hash text not null,
  day date not null,
  translate_count integer not null default 0,
  unlock_count integer not null default 0,
  primary key (ip_hash, day)
);

alter table public.demo_usage enable row level security;
-- No policies: anon/authenticated get no access. The service-role key bypasses RLS.

comment on table public.demo_usage is
  'Per IP-hash daily counters for the public landing demo rate limit. Written only by the service role; stores no personal data beyond a salted IP hash.';

-- Atomically increment the daily unlock counter for an IP hash and return the new value.
create or replace function public.increment_demo_unlock(p_ip_hash text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.demo_usage (ip_hash, day, unlock_count)
  values (p_ip_hash, current_date, 1)
  on conflict (ip_hash, day)
  do update set unlock_count = public.demo_usage.unlock_count + 1
  returning unlock_count into v_count;
  return v_count;
end;
$$;

revoke all on function public.increment_demo_unlock(text) from public, anon, authenticated;
grant execute on function public.increment_demo_unlock(text) to service_role;
```

- [ ] **Step 2: Apply the migration**

Per the project rule (Supabase via MCP or CLI only, CLI migrations are the source of truth), the file above is the source of truth. Apply it with the Supabase MCP `apply_migration` tool (name `demo_usage`, the SQL above) OR `npm run db:push` against the linked project. Confirm with `mcp ... list_migrations` or `npm run db:diff` (expect no further diff).

- [ ] **Step 3: Regenerate types**

Run: `npm run db:types`
Expected: `lib/supabase/database.types.ts` now includes a `demo_usage` row type and the `increment_demo_unlock` function. Commit the regenerated file.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260610000001_demo_usage.sql lib/supabase/database.types.ts
git commit -m "feat(landing-demo): demo_usage rate-limit table + increment function"
```

---

## Task 2: Rate-limit helper

**Files:**
- Create: `lib/demo/rate-limit.ts`
- Test: `tests/integration/lib/demo-rate-limit.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/integration/lib/demo-rate-limit.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({ rpc })
}));

import { hashIp, clientIpFrom, consumeUnlock } from "@/lib/demo/rate-limit";

beforeEach(() => {
  rpc.mockReset();
  process.env.DEMO_IP_SALT = "test-salt";
});

describe("demo rate-limit", () => {
  it("hashes the IP deterministically with the salt and never returns the raw IP", () => {
    const a = hashIp("203.0.113.7");
    const b = hashIp("203.0.113.7");
    expect(a).toBe(b);
    expect(a).not.toContain("203.0.113.7");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    process.env.DEMO_IP_SALT = "other-salt";
    expect(hashIp("203.0.113.7")).not.toBe(a);
  });

  it("reads the first x-forwarded-for hop", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "198.51.100.5, 10.0.0.1" } });
    expect(clientIpFrom(req)).toBe("198.51.100.5");
    const none = new Request("http://x");
    expect(clientIpFrom(none)).toBe("0.0.0.0");
  });

  it("allows up to the cap and blocks beyond it", async () => {
    process.env.DEMO_UNLOCK_PER_IP_PER_DAY = "3";
    rpc.mockResolvedValueOnce({ data: 3, error: null });
    expect(await consumeUnlock("1.2.3.4")).toEqual({ allowed: true, count: 3 });
    rpc.mockResolvedValueOnce({ data: 4, error: null });
    expect(await consumeUnlock("1.2.3.4")).toEqual({ allowed: false, count: 4 });
    expect(rpc).toHaveBeenLastCalledWith("increment_demo_unlock", { p_ip_hash: hashIp("1.2.3.4") });
  });

  it("fails open if the counter errors (does not block real users on infra hiccups)", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "down" } });
    expect(await consumeUnlock("1.2.3.4")).toEqual({ allowed: true, count: 0 });
  });
});
```

- [ ] **Step 2: Run it and confirm it fails** — `npx vitest run tests/integration/lib/demo-rate-limit.test.ts` -> FAIL (module missing).

- [ ] **Step 3: Implement**

Create `lib/demo/rate-limit.ts`:

```typescript
import { createHash } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const DEFAULT_UNLOCK_CAP = 5;

/** Salted SHA-256 of the caller IP. The raw IP is never stored. */
export function hashIp(ip: string): string {
  const salt = process.env.DEMO_IP_SALT ?? "";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/** First hop of x-forwarded-for, or a placeholder. */
export function clientIpFrom(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  const first = fwd?.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip")?.trim() || "0.0.0.0";
}

function unlockCap(): number {
  const raw = Number(process.env.DEMO_UNLOCK_PER_IP_PER_DAY);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_UNLOCK_CAP;
}

/**
 * Atomically increment the daily unlock counter for the IP and decide whether
 * this request is within the cap. Fails open on infra errors.
 */
export async function consumeUnlock(ip: string): Promise<{ allowed: boolean; count: number }> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("increment_demo_unlock", { p_ip_hash: hashIp(ip) });
  if (error || typeof data !== "number") {
    console.error("[demo] rate-limit counter failed, failing open", error);
    return { allowed: true, count: 0 };
  }
  return { allowed: data <= unlockCap(), count: data };
}
```

- [ ] **Step 4: Run the test -> PASS.**

- [ ] **Step 5: Commit**

```bash
git add lib/demo/rate-limit.ts tests/integration/lib/demo-rate-limit.test.ts
git commit -m "feat(landing-demo): IP-hash unlock rate limiter"
```

---

## Task 3: Turnstile server verification

**Files:**
- Create: `lib/demo/turnstile.ts`
- Test: `tests/integration/lib/demo-turnstile.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/integration/lib/demo-turnstile.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyTurnstile } from "@/lib/demo/turnstile";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  delete process.env.TURNSTILE_SECRET_KEY;
  vi.stubEnv("NODE_ENV", "test");
});
afterEach(() => vi.unstubAllEnvs());

describe("verifyTurnstile", () => {
  it("passes in dev when no secret is configured (non-production)", async () => {
    expect(await verifyTurnstile("dev")).toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed in production when no secret is configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await verifyTurnstile("anything")).toEqual({ ok: false });
  });

  it("calls siteverify and returns ok on success", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    fetchMock.mockResolvedValueOnce({ json: async () => ({ success: true }) });
    expect(await verifyTurnstile("tok", "1.2.3.4")).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("returns not-ok when siteverify rejects or the token is missing", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    expect(await verifyTurnstile("")).toEqual({ ok: false });
    fetchMock.mockResolvedValueOnce({ json: async () => ({ success: false }) });
    expect(await verifyTurnstile("tok")).toEqual({ ok: false });
  });
});
```

- [ ] **Step 2: Run it -> FAIL.**

- [ ] **Step 3: Implement**

Create `lib/demo/turnstile.ts`:

```typescript
const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Verifies a Cloudflare Turnstile token server-side. In non-production with no
 * secret configured it passes (local/preview convenience); in production with no
 * secret it fails closed.
 */
export async function verifyTurnstile(token: string, ip?: string): Promise<{ ok: boolean }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { ok: process.env.NODE_ENV !== "production" };
  }
  if (!token) return { ok: false };

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    const data = (await res.json()) as { success?: boolean };
    return { ok: data.success === true };
  } catch (error) {
    console.error("[demo] turnstile verify failed", error);
    return { ok: false };
  }
}
```

- [ ] **Step 4: Run -> PASS.**

- [ ] **Step 5: Commit**

```bash
git add lib/demo/turnstile.ts tests/integration/lib/demo-turnstile.test.ts
git commit -m "feat(landing-demo): server-side Turnstile verification"
```

---

## Task 4: Signed download token

**Files:**
- Create: `lib/demo/download-token.ts`
- Test: `tests/integration/lib/demo-download-token.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/integration/lib/demo-download-token.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { signDownloadToken, verifyDownloadToken } from "@/lib/demo/download-token";

beforeEach(() => {
  process.env.DEMO_TOKEN_SECRET = "unit-secret";
});

const NOW = 1_750_000_000_000;

describe("download token", () => {
  it("round-trips a valid token within its TTL", () => {
    const token = signDownloadToken({ lang: "de", source: "sample" }, NOW);
    const result = verifyDownloadToken(token, NOW + 60_000);
    expect(result.valid).toBe(true);
    expect(result.payload).toMatchObject({ lang: "de", source: "sample" });
  });

  it("rejects an expired token", () => {
    const token = signDownloadToken({ lang: "en", source: "sample" }, NOW);
    expect(verifyDownloadToken(token, NOW + 11 * 60_000).valid).toBe(false);
  });

  it("rejects a tampered token", () => {
    const token = signDownloadToken({ lang: "en", source: "sample" }, NOW);
    const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
    expect(verifyDownloadToken(tampered, NOW + 1000).valid).toBe(false);
  });

  it("rejects garbage", () => {
    expect(verifyDownloadToken("not-a-token", NOW).valid).toBe(false);
    expect(verifyDownloadToken("", NOW).valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run -> FAIL.**

- [ ] **Step 3: Implement**

Create `lib/demo/download-token.ts`:

```typescript
import { createHmac, timingSafeEqual } from "node:crypto";

const TTL_MS = 10 * 60 * 1000;

export interface DownloadTokenPayload {
  lang: string;
  source: "sample" | "upload";
}

interface SignedPayload extends DownloadTokenPayload {
  exp: number;
}

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

/** Returns `base64url(payload).base64url(hmac)`. `now` is injectable for tests. */
export function signDownloadToken(payload: DownloadTokenPayload, now: number = Date.now()): string {
  const full: SignedPayload = { ...payload, exp: now + TTL_MS };
  const body = b64url(JSON.stringify(full));
  return `${body}.${hmac(body)}`;
}

export function verifyDownloadToken(
  token: string,
  now: number = Date.now()
): { valid: boolean; payload?: DownloadTokenPayload } {
  const parts = token.split(".");
  if (parts.length !== 2) return { valid: false };
  const [body, sig] = parts;
  const expected = hmac(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { valid: false };
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SignedPayload;
    if (typeof parsed.exp !== "number" || parsed.exp < now) return { valid: false };
    return { valid: true, payload: { lang: parsed.lang, source: parsed.source } };
  } catch {
    return { valid: false };
  }
}
```

- [ ] **Step 4: Run -> PASS.**

- [ ] **Step 5: Commit**

```bash
git add lib/demo/download-token.ts tests/integration/lib/demo-download-token.test.ts
git commit -m "feat(landing-demo): HMAC-signed short-lived download token"
```

---

## Task 5: Server-side demo OTP sender

**Files:**
- Create: `lib/demo/send-demo-otp.ts`
- Test: `tests/integration/lib/demo-send-otp.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/integration/lib/demo-send-otp.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const signInWithOtp = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { signInWithOtp } })
}));

import { sendDemoOtp } from "@/lib/demo/send-demo-otp";

beforeEach(() => {
  signInWithOtp.mockReset();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
});

describe("sendDemoOtp", () => {
  it("fires signInWithOtp with the callback redirect and demo metadata", async () => {
    signInWithOtp.mockResolvedValueOnce({ error: null });
    await sendDemoOtp("user@example.com", true);
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      options: {
        emailRedirectTo: "https://app.example.com/auth/callback",
        data: { source: "landing_demo", marketing_opt_in: true }
      }
    });
  });

  it("never throws when Supabase returns an error (download must not be blocked)", async () => {
    signInWithOtp.mockResolvedValueOnce({ error: { status: 429, message: "rate limited" } });
    await expect(sendDemoOtp("user@example.com", false)).resolves.toBeUndefined();
  });

  it("never throws when the client rejects", async () => {
    signInWithOtp.mockRejectedValueOnce(new Error("network"));
    await expect(sendDemoOtp("user@example.com", false)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run -> FAIL.**

- [ ] **Step 3: Implement**

Create `lib/demo/send-demo-otp.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

/**
 * Fires a passwordless magic-link signup for the demo gate. Uses a fresh anon
 * client with no session persistence (this is not logging the visitor in here;
 * the account activates when they click the emailed link). Never throws: the
 * PDF download must proceed even if Supabase rate-limits the email.
 */
export async function sendDemoOtp(email: string, marketingOptIn: boolean): Promise<void> {
  try {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        data: { source: "landing_demo", marketing_opt_in: marketingOptIn }
      }
    });
    if (error) console.warn("[demo] OTP send returned an error (ignored)", error.status, error.message);
  } catch (error) {
    console.warn("[demo] OTP send threw (ignored)", error);
  }
}
```

- [ ] **Step 4: Run -> PASS.**

- [ ] **Step 5: Commit**

```bash
git add lib/demo/send-demo-otp.ts tests/integration/lib/demo-send-otp.test.ts
git commit -m "feat(landing-demo): server-side passwordless OTP sender for the gate"
```

---

## Task 6: `POST /api/demo/unlock`

**Files:**
- Create: `app/api/demo/unlock/route.ts`
- Test: `tests/integration/api/demo-unlock.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/integration/api/demo-unlock.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const verifyTurnstile = vi.fn();
const consumeUnlock = vi.fn();
const sendDemoOtp = vi.fn();
vi.mock("@/lib/demo/turnstile", () => ({ verifyTurnstile }));
vi.mock("@/lib/demo/rate-limit", () => ({ consumeUnlock, clientIpFrom: () => "1.2.3.4" }));
vi.mock("@/lib/demo/send-demo-otp", () => ({ sendDemoOtp }));

import { POST } from "@/app/api/demo/unlock/route";
import { verifyDownloadToken } from "@/lib/demo/download-token";

function post(body: unknown) {
  return new Request("http://x/api/demo/unlock", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  verifyTurnstile.mockReset().mockResolvedValue({ ok: true });
  consumeUnlock.mockReset().mockResolvedValue({ allowed: true, count: 1 });
  sendDemoOtp.mockReset().mockResolvedValue(undefined);
  process.env.DEMO_TOKEN_SECRET = "unit-secret";
});

describe("POST /api/demo/unlock", () => {
  it("issues a valid download token and fires OTP on the happy path", async () => {
    const res = await POST(post({ email: "a@b.com", lang: "de", turnstileToken: "t", marketingOptIn: true }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(verifyDownloadToken(json.downloadToken).valid).toBe(true);
    expect(verifyDownloadToken(json.downloadToken).payload).toMatchObject({ lang: "de", source: "sample" });
    expect(sendDemoOtp).toHaveBeenCalledWith("a@b.com", true);
  });

  it("rejects an invalid email (400)", async () => {
    const res = await POST(post({ email: "nope", lang: "en", turnstileToken: "t" }));
    expect(res.status).toBe(400);
    expect(sendDemoOtp).not.toHaveBeenCalled();
  });

  it("rejects an unsupported language (400)", async () => {
    const res = await POST(post({ email: "a@b.com", lang: "xx", turnstileToken: "t" }));
    expect(res.status).toBe(400);
  });

  it("returns 403 when Turnstile fails", async () => {
    verifyTurnstile.mockResolvedValueOnce({ ok: false });
    const res = await POST(post({ email: "a@b.com", lang: "en", turnstileToken: "bad" }));
    expect(res.status).toBe(403);
    expect(consumeUnlock).not.toHaveBeenCalled();
  });

  it("returns 429 when over the rate limit", async () => {
    consumeUnlock.mockResolvedValueOnce({ allowed: false, count: 99 });
    const res = await POST(post({ email: "a@b.com", lang: "en", turnstileToken: "t" }));
    expect(res.status).toBe(429);
    expect(sendDemoOtp).not.toHaveBeenCalled();
  });

  it("still returns a token if OTP sending fails (download not blocked)", async () => {
    sendDemoOtp.mockRejectedValueOnce(new Error("boom"));
    const res = await POST(post({ email: "a@b.com", lang: "en", turnstileToken: "t" }));
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run -> FAIL.**

- [ ] **Step 3: Implement**

Create `app/api/demo/unlock/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_LANGS } from "@/lib/landing/demo-sample";
import { verifyTurnstile } from "@/lib/demo/turnstile";
import { consumeUnlock, clientIpFrom } from "@/lib/demo/rate-limit";
import { sendDemoOtp } from "@/lib/demo/send-demo-otp";
import { signDownloadToken } from "@/lib/demo/download-token";

export const runtime = "nodejs";

const DEMO_LANG_CODES = DEMO_LANGS.map((l) => l.code) as [string, ...string[]];

const bodySchema = z.object({
  email: z.string().email(),
  lang: z.enum(DEMO_LANG_CODES),
  turnstileToken: z.string().min(1),
  marketingOptIn: z.boolean().optional()
});

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { email, lang, turnstileToken, marketingOptIn } = parsed.data;
  const ip = clientIpFrom(request);

  const turnstile = await verifyTurnstile(turnstileToken, ip);
  if (!turnstile.ok) {
    return NextResponse.json({ error: "Verification failed", code: "turnstile" }, { status: 403 });
  }

  const limit = await consumeUnlock(ip);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Daily demo limit reached", code: "rate_limited" }, { status: 429 });
  }

  // Fire the passwordless signup in the background; never let it block the download.
  await sendDemoOtp(email, marketingOptIn ?? false).catch(() => undefined);

  const downloadToken = signDownloadToken({ lang, source: "sample" });
  return NextResponse.json({ downloadToken });
}
```

- [ ] **Step 4: Run -> PASS.**

- [ ] **Step 5: Commit**

```bash
git add app/api/demo/unlock/route.ts tests/integration/api/demo-unlock.test.ts
git commit -m "feat(landing-demo): /api/demo/unlock (turnstile + rate limit + OTP + token)"
```

---

## Task 7: `POST /api/demo/pdf`

**Files:**
- Create: `app/api/demo/pdf/route.ts`
- Test: `tests/integration/api/demo-pdf.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/integration/api/demo-pdf.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const renderOfficialFa3Pdf = vi.fn();
vi.mock("@/lib/mf-fa3/official-renderer", () => ({ renderOfficialFa3Pdf }));

import { POST } from "@/app/api/demo/pdf/route";
import { signDownloadToken } from "@/lib/demo/download-token";

function post(body: unknown) {
  return new Request("http://x/api/demo/pdf", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  renderOfficialFa3Pdf.mockReset().mockResolvedValue(Buffer.from("%PDF-1.7 demo"));
  process.env.DEMO_TOKEN_SECRET = "unit-secret";
});

describe("POST /api/demo/pdf", () => {
  it("renders and streams the demo PDF for a valid token", async () => {
    const token = signDownloadToken({ lang: "de", source: "sample" });
    const res = await POST(post({ downloadToken: token }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    // rendered statelessly with the German demo invoice + the sample sourceXml
    const arg = renderOfficialFa3Pdf.mock.calls[0][0];
    expect(arg.language).toBe("de");
    expect(arg.translated).toBe(true);
    expect(arg.bilingual).toBe(false);
    expect(typeof arg.sourceXml).toBe("string");
    expect(arg.sourceXml).toContain("FA (3)");
    expect(arg.invoice.items[1].translatedName).toBe("Eichenstuhl „Helena”");
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("rejects a missing/invalid token (401)", async () => {
    expect((await POST(post({ downloadToken: "garbage" }))).status).toBe(401);
    expect((await POST(post({}))).status).toBe(400);
  });

  it("rejects an expired token (401)", async () => {
    const token = signDownloadToken({ lang: "en", source: "sample" }, Date.now() - 60 * 60_000);
    expect((await POST(post({ downloadToken: token }))).status).toBe(401);
  });
});
```

- [ ] **Step 2: Run -> FAIL.**

- [ ] **Step 3: Implement**

Create `app/api/demo/pdf/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { verifyDownloadToken } from "@/lib/demo/download-token";
import { buildDemoInvoice, type DemoLang } from "@/lib/landing/demo-sample";
import { renderOfficialFa3Pdf } from "@/lib/mf-fa3/official-renderer";
import type { LanguageCode } from "@/types/invoice";

export const runtime = "nodejs";

const bodySchema = z.object({ downloadToken: z.string().min(1) });

// Read the matching FA(3) source XML once per process (it never changes).
let cachedXml: string | null = null;
function demoSourceXml(): string {
  if (cachedXml === null) {
    cachedXml = readFileSync(join(process.cwd(), "public/sample-data/demo-fa3-export.xml"), "utf8");
  }
  return cachedXml;
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  const verdict = verifyDownloadToken(parsed.data.downloadToken);
  if (!verdict.valid || !verdict.payload) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
  }

  const lang = verdict.payload.lang as DemoLang;
  const invoice = buildDemoInvoice(lang);
  const pdf = await renderOfficialFa3Pdf({
    sourceXml: demoSourceXml(),
    invoice,
    language: lang as LanguageCode,
    bilingual: false,
    translated: true
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="tlumaczksef-demo-${lang}.pdf"`,
      "Cache-Control": "no-store"
    }
  });
}
```

- [ ] **Step 4: Run -> PASS.**

- [ ] **Step 5: Add a real renderer smoke test** (proves the demo data actually renders, not just the wiring). Append to `tests/integration/api/demo-pdf.test.ts` a separate file `tests/integration/lib/demo-pdf-render.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderOfficialFa3Pdf } from "@/lib/mf-fa3/official-renderer";
import { buildDemoInvoice } from "@/lib/landing/demo-sample";

describe("demo PDF renders statelessly", () => {
  it("produces a non-empty PDF for the English demo invoice", async () => {
    const sourceXml = readFileSync(join(process.cwd(), "public/sample-data/demo-fa3-export.xml"), "utf8");
    const pdf = await renderOfficialFa3Pdf({
      sourceXml,
      invoice: buildDemoInvoice("en"),
      language: "en",
      bilingual: false,
      translated: true
    });
    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  }, 30_000);
});
```

Run both: `npx vitest run tests/integration/api/demo-pdf.test.ts tests/integration/lib/demo-pdf-render.test.ts` -> PASS. (If the official renderer needs the verification QR fetched, it does not here: `renderOfficialFa3Pdf` renders the QR from `invoice.verification.qrLink` locally and performs no network verification, that wrapper lives in `/api/pdf`. If a sandbox blocks the vendor font/UMD load, mark this smoke test `it.skip` with a note, but keep the mocked route test.)

- [ ] **Step 6: Commit**

```bash
git add app/api/demo/pdf/route.ts tests/integration/api/demo-pdf.test.ts tests/integration/lib/demo-pdf-render.test.ts
git commit -m "feat(landing-demo): /api/demo/pdf (token-gated stateless demo PDF)"
```

---

## Task 8: Gate copy

**Files:**
- Modify: `lib/landing/copy.ts`
- Test: `tests/integration/lib/landing-copy.test.ts`

- [ ] **Step 1: Add the failing assertions** to the existing `describe("landingCopy", ...)`:

```typescript
  it("has the demo gate copy on both locales", () => {
    for (const loc of [landingCopy.pl, landingCopy.en]) {
      expect(loc.demo.download).toBeTruthy();
      expect(loc.demo.gateHeading).toBeTruthy();
      expect(loc.demo.emailLabel).toBeTruthy();
      expect(loc.demo.emailPlaceholder).toBeTruthy();
      expect(loc.demo.consent).toBeTruthy();
      expect(loc.demo.marketingOptIn).toBeTruthy();
      expect(loc.demo.submit).toBeTruthy();
      expect(loc.demo.success).toBeTruthy();
      expect(loc.demo.gateError).toBeTruthy();
      expect(loc.demo.rateLimited).toBeTruthy();
    }
  });
```

- [ ] **Step 2: Run -> FAIL.**

- [ ] **Step 3: Extend the `demo` group** in both locales (keep existing keys; add these). The existing "+ więcej" `moreHref`/`ctaHref` stay for now but the component stops using them as navigation (Task 10). PL:

```typescript
      download: "Pobierz PDF",
      gateHeading: "Wpisz e-mail, wyślemy Ci plik",
      emailLabel: "Adres e-mail",
      emailPlaceholder: "twoj@email.pl",
      consent: "Wyślemy plik na podany adres i link do logowania. Zero spamu.",
      marketingOptIn: "Chcę dostawać wskazówki o KSeF i fakturowaniu (opcjonalnie).",
      submit: "Wyślij i pobierz",
      success: "Gotowe. Plik się pobiera, a link do konta jest w drodze na Twój e-mail.",
      gateError: "Coś poszło nie tak. Spróbuj ponownie za chwilę.",
      rateLimited: "Limit demo na dziś wyczerpany. Załóż darmowe konto, aby tłumaczyć dalej.",
```

EN:

```typescript
      download: "Download PDF",
      gateHeading: "Enter your email and we will send you the file",
      emailLabel: "Email address",
      emailPlaceholder: "you@email.com",
      consent: "We will send the file and a sign in link to this address. No spam.",
      marketingOptIn: "I want tips about KSeF and invoicing (optional).",
      submit: "Send and download",
      success: "Done. Your file is downloading and a sign in link is on the way to your email.",
      gateError: "Something went wrong. Please try again in a moment.",
      rateLimited: "Daily demo limit reached. Create a free account to keep translating.",
```

- [ ] **Step 4: Run -> PASS** (the existing no-dashes and parity tests stay green; verify there are no em/en dashes in the added strings).

- [ ] **Step 5: Commit**

```bash
git add lib/landing/copy.ts tests/integration/lib/landing-copy.test.ts
git commit -m "feat(landing-demo): download gate copy (pl + en)"
```

---

## Task 9: The download-gate component

**Files:**
- Create: `components/landing/demo/download-gate.tsx`
- Test: `tests/components/landing/download-gate.test.tsx`

The gate is a controlled panel (rendered when open). It owns email + marketingOptIn + a Turnstile token + a status state machine (`idle | submitting | success | error | rate_limited`). The Turnstile widget renders only when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set; otherwise the token defaults to `"dev"` so local/test submits work.

- [ ] **Step 1: Add the dependency**

Run: `npm install @marsidev/react-turnstile`
Commit the lockfile change with the component.

- [ ] **Step 2: Write the failing test**

Create `tests/components/landing/download-gate.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DownloadGate } from "@/components/landing/demo/download-gate";

// No NEXT_PUBLIC_TURNSTILE_SITE_KEY in tests -> widget is skipped, token defaults to "dev".
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  // jsdom: stub URL.createObjectURL / anchor click used by the download
  // @ts-expect-error jsdom
  global.URL.createObjectURL = vi.fn(() => "blob:demo");
  // @ts-expect-error jsdom
  global.URL.revokeObjectURL = vi.fn();
});

function copy() {
  return {
    gateHeading: "Wpisz e-mail",
    emailLabel: "Adres e-mail",
    emailPlaceholder: "twoj@email.pl",
    consent: "Zero spamu.",
    marketingOptIn: "Wskazówki (opcjonalnie).",
    submit: "Wyślij i pobierz",
    success: "Gotowe.",
    gateError: "Błąd.",
    rateLimited: "Limit."
  };
}

describe("<DownloadGate>", () => {
  it("submits email, unlocks, downloads the PDF, and shows success", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ downloadToken: "tok" }) }) // /unlock
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(["%PDF"]) }); // /pdf
    render(<DownloadGate lang="de" t={copy()} />);
    fireEvent.change(screen.getByLabelText("Adres e-mail"), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Wyślij i pobierz" }));
    await waitFor(() => expect(screen.getByText("Gotowe.")).toBeInTheDocument());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/demo/unlock");
    const unlockBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(unlockBody).toMatchObject({ email: "a@b.com", lang: "de", turnstileToken: "dev" });
    expect(fetchMock.mock.calls[1][0]).toBe("/api/demo/pdf");
  });

  it("shows the rate-limit message on 429", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ code: "rate_limited" }) });
    render(<DownloadGate lang="en" t={copy()} />);
    fireEvent.change(screen.getByLabelText("Adres e-mail"), { target: { value: "a@b.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Wyślij i pobierz" }));
    await waitFor(() => expect(screen.getByText("Limit.")).toBeInTheDocument());
  });

  it("requires a valid email before submitting", async () => {
    render(<DownloadGate lang="en" t={copy()} />);
    fireEvent.click(screen.getByRole("button", { name: "Wyślij i pobierz" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Implement**

Create `components/landing/demo/download-gate.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import type { DemoLang } from "@/lib/landing/demo-sample";

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
}

type Status = "idle" | "submitting" | "success" | "error" | "rate_limited";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface DownloadGateProps {
  lang: DemoLang;
  t: DownloadGateCopy;
}

export function DownloadGate({ lang, t }: DownloadGateProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [email, setEmail] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [token, setToken] = useState(siteKey ? "" : "dev");
  const [status, setStatus] = useState<Status>("idle");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!EMAIL_RE.test(email) || !token) return;
    setStatus("submitting");
    try {
      const unlock = await fetch("/api/demo/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, lang, turnstileToken: token, marketingOptIn })
      });
      if (unlock.status === 429) return setStatus("rate_limited");
      if (!unlock.ok) return setStatus("error");
      const { downloadToken } = (await unlock.json()) as { downloadToken: string };

      const pdf = await fetch("/api/demo/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ downloadToken })
      });
      if (!pdf.ok) return setStatus("error");
      triggerDownload(await pdf.blob(), `tlumaczksef-demo-${lang}.pdf`);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return <p className="text-[14px] text-white/80">{t.success}</p>;
  }

  return (
    <form onSubmit={submit} className="mx-auto flex w-full max-w-sm flex-col gap-3 text-left">
      <h3 className="text-center font-heading text-[16px] font-semibold text-white">{t.gateHeading}</h3>
      <label className="text-[12px] font-medium text-white/70" htmlFor="demo-email">{t.emailLabel}</label>
      <input
        id="demo-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t.emailPlaceholder}
        className="rounded-xl border border-white/15 bg-ink-panel px-4 py-2.5 text-[14px] text-white placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
      />
      <label className="flex items-start gap-2 text-[12px] text-white/60">
        <input type="checkbox" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} className="mt-0.5" />
        {t.marketingOptIn}
      </label>
      {siteKey ? <Turnstile siteKey={siteKey} onSuccess={setToken} options={{ theme: "dark" }} /> : null}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex items-center justify-center rounded-xl bg-brand px-6 py-3 text-[15px] font-semibold text-white shadow-brand transition-colors hover:bg-brand-hover disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
      >
        {t.submit}
      </button>
      <p className="text-center text-[12px] text-white/50">{t.consent}</p>
      {status === "error" ? <p className="text-center text-[12px] text-negative">{t.gateError}</p> : null}
      {status === "rate_limited" ? <p className="text-center text-[12px] text-white/80">{t.rateLimited}</p> : null}
    </form>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default DownloadGate;
```

- [ ] **Step 4: Run -> PASS.** Then `npx tsc --noEmit` (no new errors from the gate/types).

- [ ] **Step 5: Commit**

```bash
git add components/landing/demo/download-gate.tsx tests/components/landing/download-gate.test.tsx package.json package-lock.json
git commit -m "feat(landing-demo): download-gate panel (email + consent + Turnstile + states)"
```

---

## Task 10: Wire the gate into the demo section + e2e + verify

**Files:**
- Modify: `components/landing/demo/demo-section.tsx`
- Test: `tests/components/landing/demo-section.test.tsx`, `tests/e2e/landing-rebuild-preview.spec.ts`

- [ ] **Step 1: Update the demo-section test** to assert the CTA now OPENS the gate (button, not a `/login` link). Replace the existing "links the primary CTA to /login" test with:

```tsx
  it("opens the download gate when the primary CTA is clicked", () => {
    render(<DemoSection locale="pl" />);
    expect(screen.queryByLabelText("Adres e-mail")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pobierz PDF" }));
    expect(screen.getByLabelText("Adres e-mail")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run -> FAIL** (CTA is still a link).

- [ ] **Step 3: Implement** the wiring in `components/landing/demo/demo-section.tsx`. Add gate-open state, import the gate, swap the CTA `<a>` for a `<button>` that opens it, and point "+ więcej" at the same opener. Concretely:

- Add imports: `import { DownloadGate } from "@/components/landing/demo/download-gate";`
- Add state: `const [gateOpen, setGateOpen] = useState(false);`
- Replace the "+ więcej" `<a href={t.moreHref} ...>` with a `<button type="button" onClick={() => setGateOpen(true)} aria-label={t.moreAria} className={... same classes ...}>{t.moreLabel}</button>`.
- Replace the CTA block (the `<a href={t.ctaHref}>{t.cta}</a>` and privacy line) with:

```tsx
        <div className="mt-8 flex flex-col items-center gap-4">
          {gateOpen ? (
            <DownloadGate lang={lang} t={t} />
          ) : (
            <button
              type="button"
              onClick={() => setGateOpen(true)}
              className="inline-flex items-center justify-center rounded-xl bg-brand px-6 py-3 text-[15px] font-semibold text-white shadow-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
            >
              {t.download}
            </button>
          )}
          <p className="flex items-center gap-2 text-[13px] text-white/60">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-mint" aria-hidden="true" />
            {t.privacy}
          </p>
        </div>
```

(The `t` object passed to `DownloadGate` already contains the gate copy keys from Task 8 since `t = landingCopy[locale].demo`. `DownloadGateCopy` is a structural subset, so `t` satisfies it.)

- [ ] **Step 4: Run the component tests** -> PASS: `npx vitest run tests/components/landing/demo-section.test.tsx tests/components/landing/download-gate.test.tsx`.

- [ ] **Step 5: Update the e2e** in `tests/e2e/landing-rebuild-preview.spec.ts` (the demo CTA is no longer a `/login` link). Replace the final assertion of the demo test with:

```typescript
  // the primary CTA opens the email gate
  await demo.getByRole("button", { name: "Pobierz PDF" }).click();
  await expect(demo.getByLabel("Adres e-mail")).toBeVisible();
```

- [ ] **Step 6: Full verification.**

```bash
npx vitest run tests/integration/lib tests/integration/api tests/components/landing
npx tsc --noEmit
npx playwright test tests/e2e/landing-rebuild-preview.spec.ts
```
Expected: all demo + landing tests green; no new TS errors; all 7+ e2e pass. The controller will also do a live RWD pass on `/landing-preview` (open the gate, confirm the email field + submit render on the dark stage at 375/1280, and that with no Turnstile key configured the dev-token submit path is reachable).

- [ ] **Step 7: Commit**

```bash
git add components/landing/demo/demo-section.tsx tests/components/landing/demo-section.test.tsx tests/e2e/landing-rebuild-preview.spec.ts
git commit -m "feat(landing-demo): open the download gate from the demo CTA + more chip"
```

---

## Out of scope (Sprint C / later)

- The anonymous upload lane (`/api/demo/translate`, the global circuit breaker, `translate_count`, size/MIME caps, the upload panel). The `demo_usage.translate_count` column exists already (added in Task 1) so Sprint C needs no schema change for it.
- The final `/` and `/en` swap.

## Self-review notes

- **Spec coverage:** Turnstile on the public endpoint (§7, Task 3+6), IP-hash rate limit + `demo_usage` (§7, Task 1+2), signed short-lived download token (§7, Task 4), server-side passwordless OTP with `options.data` marketing flag (§5, §10, Task 5), stateless PDF via `renderOfficialFa3Pdf` (§5, Task 7), the gate UI with consent + separate marketing opt-in (§9, §10, Tasks 8-10), the CTA/"+ więcej" opening the gate (§12). Privacy: nothing persisted but the salted IP-hash counter (§6).
- **No persistence of invoice/email-to-invoice:** the PDF route renders the fixed demo invoice from static data + the token's `lang`; no upload, no DB write of content.
- **Dev/test ergonomics:** Turnstile dev-bypass and the `"dev"` client token keep `/landing-preview` and the whole test suite runnable without any Cloudflare keys.
- **Type consistency:** `DemoLang`, `DownloadTokenPayload {lang, source}`, `signDownloadToken/verifyDownloadToken`, `consumeUnlock {allowed,count}`, `verifyTurnstile {ok}`, `DownloadGateCopy` are used identically across tasks.
- **Open items at implementation time:** user provisions the five env vars (table above); `@marsidev/react-turnstile` is added in Task 9; the `demo_usage` migration is applied via MCP/CLI in Task 1 and `database.types.ts` regenerated.
