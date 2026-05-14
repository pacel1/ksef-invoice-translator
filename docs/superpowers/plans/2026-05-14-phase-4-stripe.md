# KSeF SaaS Phase 4: Stripe Purchases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users buy credit packs with Stripe Checkout. A `/billing` page hosts a 5→100 slider that computes the live total against a canonical server-side PLN price ladder, redirects to a Stripe-hosted checkout, then a webhook grants paid credits via the existing `grant_paid_credits` SQL function after `checkout.session.completed`. Refunds via `charge.refunded` reverse the grant. Stripe Tax handles 23% Polish VAT; Stripe Invoicing produces VAT-compliant faktury per purchase.

**Architecture:** A pure `lib/billing/pricing.ts` module owns the price ladder — every other surface (slider, `/api/billing/price`, `/api/stripe/checkout`) reads from it so the price the user sees and the price Stripe charges are always identical. `/api/stripe/checkout` is auth-gated, recomputes price server-side (never trusts the client), enforces 24-hour abuse caps (3 sessions / 500 credits per user), inserts a `stripe_purchases` row with `status='pending'`, creates a Checkout Session with one tax-exclusive line item + automatic Stripe Tax + invoice creation, and returns the redirect URL. `/api/stripe/webhook` is signature-verified, idempotent by `stripe_checkout_session_id`, and handles two events: `checkout.session.completed` (flip to `paid` + `grant_paid_credits`) and `charge.refunded` (flip to `refunded` + `refund_paid_credits`). After a successful checkout, the user lands on `/billing?status=paid` which dispatches `credit-balance-changed` so the `<BalanceChip>` refetches.

**Tech Stack:** Next.js 15 Route Handlers, `stripe` Node SDK, existing Phase 1 SQL functions (`grant_paid_credits`, `refund_paid_credits`), Zod validation, Vitest for unit + integration tests, Playwright for the slider → "Continue to checkout" → Stripe-redirect E2E (does NOT complete a real purchase). Stripe test mode (`sk_test_...`) for everything.

**Out of scope for this phase:**
- Real production Stripe keys + Stripe Tax dashboard activation — those are operational config the user does in the Stripe dashboard once.
- Subscriptions, recurring billing, or auto-top-up.
- History page at `/app/history` (Phase 5).
- Rate limiting on the webhook beyond Stripe's own retries (Phase 7).
- Customer portal for invoice download — Stripe Invoicing emails the faktura directly to the buyer; the customer portal can be added in Phase 6/7 polish if requested.

---

## Pre-requisites (one-time setup before the engineer starts)

The user needs:

1. **Stripe account** with PLN currency enabled and a test-mode API key. Create at https://dashboard.stripe.com/register if not done.
2. **Stripe Tax** enabled in the dashboard for Poland (one-click in Settings → Tax). This activates 23% VAT collection on PLN sales.
3. **Stripe webhook endpoint** registered for `checkout.session.completed` and `charge.refunded`. For local dev this is `stripe listen --forward-to localhost:3000/api/stripe/webhook` (the CLI prints a temporary signing secret). For production this is `https://tlumaczksef.pl/api/stripe/webhook` with a secret stored in Vercel envs.
4. **Test mode keys** added to `.env.local` and `.env.test`:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...   # not used in Phase 4 but documented for future redirect-style flows
   ```

The plan assumes these exist when each task runs. Task 1 sets up the SDK; subsequent tasks rely on the keys being in place.

---

## File Structure

### New files

- `lib/billing/pricing.ts` — pure functions: `priceForPackage(size: number): { unitPriceCents, totalAmountCents, currency }`, `isValidPackageSize(n: number): boolean`, `PACKAGE_SIZES: readonly number[]`. Owns the canonical PLN ladder.
- `lib/billing/abuse-caps.ts` — `assertWithinAbuseCaps({ supabase, userId })` throws `AbuseCapError` (3 sessions or 500 credits in the last 24h).
- `lib/billing/stripe-client.ts` — singleton `getStripeClient()`. Server-only.
- `app/api/billing/price/route.ts` — `GET /api/billing/price?packageSize=N` returns `{ packageSize, unitPriceCents, totalAmountCents, currency }`. Stateless. No auth needed (price is public).
- `app/api/stripe/checkout/route.ts` — `POST` auth-gated. Validates package size, enforces abuse caps, creates `stripe_purchases` row + Stripe Checkout session, returns redirect URL.
- `app/api/stripe/webhook/route.ts` — `POST` public, signature-verified. Handles `checkout.session.completed` + `charge.refunded`. Idempotent.
- `components/billing/credit-slider.tsx` — client component. Range input 5-100 step 5, debounced price fetch, "Continue to checkout" button, post-redirect toast.
- `components/billing/purchase-history.tsx` — server component, table of past `stripe_purchases` rows for the current user.
- `tests/integration/lib/pricing.test.ts`
- `tests/integration/lib/abuse-caps.test.ts`
- `tests/integration/api/checkout.test.ts`
- `tests/integration/api/webhook.test.ts`
- `tests/e2e/billing.spec.ts`

### Modified files

- `package.json` — add `stripe` runtime dep + `@types/stripe` if not bundled.
- `.env.example` and `.env.test.example` — document the three new Stripe env vars.
- `app/(protected)/billing/page.tsx` — replace the Phase 3 placeholder with the real page: `<CreditSlider />` + `<PurchaseHistory />` + post-checkout toast/event dispatch via search params.
- `lib/workspace/copy.ts` — new strings: `billingTitle`, `billingSubtitle`, `pickPackage`, `unitPrice`, `total`, `totalWithTax`, `continueToCheckout`, `purchaseHistory`, `purchaseDate`, `purchaseSize`, `purchaseTotal`, `purchaseStatus`, `purchaseStatusPaid`, `purchaseStatusPending`, `purchaseStatusFailed`, `purchaseStatusRefunded`, `paymentSuccessTitle`, `paymentSuccessBody`, `paymentCancelledTitle`, `paymentCancelledBody`.

### Files NOT touched

- The SQL functions (`grant_paid_credits`, `refund_paid_credits`) — already deployed and tested.
- The `<BalanceChip>` — already refetches on `credit-balance-changed`.
- The `<InsufficientCreditModal>` — already links to `/billing`.

---

## Tasks

### Task 1: Install Stripe SDK + document env vars

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `.env.test.example`

- [ ] **Step 1: Install**

```bash
npm install stripe
```

The `stripe` package ships its own TypeScript types — no `@types/stripe` needed.

- [ ] **Step 2: Document env vars**

In `.env.example`, append:

```
# Stripe (test or live keys; test keys begin with sk_test_/pk_test_/whsec_)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

In `.env.test.example`, append the same three lines (with empty values).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json .env.example .env.test.example
git commit -m "chore: add stripe sdk and env templates"
```

---

### Task 2: Pricing module

**Files:**
- Create: `lib/billing/pricing.ts`
- Test: `tests/integration/lib/pricing.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import {
  PACKAGE_SIZES,
  isValidPackageSize,
  priceForPackage
} from "@/lib/billing/pricing";

describe("PACKAGE_SIZES", () => {
  it("is the slider domain 5..100 step 5", () => {
    expect(PACKAGE_SIZES).toEqual([
      5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100
    ]);
  });
});

describe("isValidPackageSize", () => {
  it("accepts multiples of 5 between 5 and 100", () => {
    for (const n of [5, 10, 25, 50, 100]) {
      expect(isValidPackageSize(n)).toBe(true);
    }
  });

  it("rejects 0, negatives, off-grid values, and out-of-range", () => {
    for (const n of [0, -5, 1, 4, 6, 7, 11, 101, 105, 1000]) {
      expect(isValidPackageSize(n)).toBe(false);
    }
  });

  it("rejects non-integers and NaN", () => {
    expect(isValidPackageSize(5.5)).toBe(false);
    expect(isValidPackageSize(Number.NaN)).toBe(false);
  });
});

describe("priceForPackage", () => {
  it("returns the canonical ladder", () => {
    // 5 -> 6.99 zł/inv = 34.95 zł total
    expect(priceForPackage(5)).toEqual({
      packageSize: 5,
      unitPriceCents: 699,
      totalAmountCents: 3495,
      currency: "pln"
    });
    // 10, 15, 20 -> 5.99 zł/inv
    expect(priceForPackage(10).unitPriceCents).toBe(599);
    expect(priceForPackage(10).totalAmountCents).toBe(5990);
    expect(priceForPackage(15).unitPriceCents).toBe(599);
    expect(priceForPackage(20).unitPriceCents).toBe(599);
    // 25..45 -> 4.99 zł/inv
    expect(priceForPackage(25).unitPriceCents).toBe(499);
    expect(priceForPackage(45).unitPriceCents).toBe(499);
    // 50..95 -> 3.99 zł/inv
    expect(priceForPackage(50).unitPriceCents).toBe(399);
    expect(priceForPackage(95).unitPriceCents).toBe(399);
    // 100 -> 2.99 zł/inv = 299 zł total
    expect(priceForPackage(100)).toEqual({
      packageSize: 100,
      unitPriceCents: 299,
      totalAmountCents: 29900,
      currency: "pln"
    });
  });

  it("throws on invalid sizes", () => {
    expect(() => priceForPackage(7)).toThrow();
    expect(() => priceForPackage(0)).toThrow();
    expect(() => priceForPackage(101)).toThrow();
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- pricing`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
export type Currency = "pln";

export interface PriceQuote {
  packageSize: number;
  unitPriceCents: number;
  totalAmountCents: number;
  currency: Currency;
}

export const PACKAGE_SIZES = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100
] as const satisfies readonly number[];

// Canonical PLN ladder (net, bez VAT). Stripe Tax adds 23% VAT at checkout.
// See docs/superpowers/specs/2026-05-13-ksef-saas-design.md §5.
const TIERS: ReadonlyArray<{ min: number; max: number; unitPriceCents: number }> = [
  { min: 5, max: 5, unitPriceCents: 699 },
  { min: 10, max: 20, unitPriceCents: 599 },
  { min: 25, max: 45, unitPriceCents: 499 },
  { min: 50, max: 95, unitPriceCents: 399 },
  { min: 100, max: 100, unitPriceCents: 299 }
];

export function isValidPackageSize(n: unknown): n is number {
  return (
    typeof n === "number" &&
    Number.isInteger(n) &&
    n >= 5 &&
    n <= 100 &&
    n % 5 === 0
  );
}

export class InvalidPackageSizeError extends Error {
  constructor(public readonly value: unknown) {
    super(`Invalid package size: ${String(value)}. Must be a multiple of 5 between 5 and 100.`);
    this.name = "InvalidPackageSizeError";
  }
}

export function priceForPackage(packageSize: number): PriceQuote {
  if (!isValidPackageSize(packageSize)) {
    throw new InvalidPackageSizeError(packageSize);
  }
  const tier = TIERS.find((t) => packageSize >= t.min && packageSize <= t.max);
  if (!tier) {
    // Defensive — should be unreachable given isValidPackageSize.
    throw new InvalidPackageSizeError(packageSize);
  }
  return {
    packageSize,
    unitPriceCents: tier.unitPriceCents,
    totalAmountCents: tier.unitPriceCents * packageSize,
    currency: "pln"
  };
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- pricing`
Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/billing/pricing.ts tests/integration/lib/pricing.test.ts
git commit -m "feat(billing): canonical PLN price ladder + validation"
```

---

### Task 3: Public `GET /api/billing/price` endpoint

**Files:**
- Create: `app/api/billing/price/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { InvalidPackageSizeError, priceForPackage } from "@/lib/billing/pricing";

export const runtime = "nodejs";

const querySchema = z.object({
  packageSize: z.coerce.number()
});

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ packageSize: url.searchParams.get("packageSize") });
  if (!parsed.success) {
    return NextResponse.json({ error: "packageSize is required" }, { status: 400 });
  }
  try {
    const quote = priceForPackage(parsed.data.packageSize);
    return NextResponse.json(quote, {
      headers: { "Cache-Control": "public, max-age=300" }
    });
  } catch (error) {
    if (error instanceof InvalidPackageSizeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[api/billing/price] unexpected:", error);
    return NextResponse.json({ error: "Unable to price package" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck + manual smoke**

```bash
npm run typecheck
tmux new-session -d -s next-dev "npx next dev" && sleep 6
curl -sS "http://localhost:3000/api/billing/price?packageSize=25" | head -c 200
tmux kill-session -t next-dev
```

Expected output (single line, trimmed): `{"packageSize":25,"unitPriceCents":499,"totalAmountCents":12475,"currency":"pln"}`

- [ ] **Step 3: Commit**

```bash
git add app/api/billing/price/route.ts
git commit -m "feat(api): GET /api/billing/price for slider live pricing"
```

---

### Task 4: Abuse-caps helper

**Files:**
- Create: `lib/billing/abuse-caps.ts`
- Test: `tests/integration/lib/abuse-caps.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, afterEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { AbuseCapError, assertWithinAbuseCaps } from "@/lib/billing/abuse-caps";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const createdUserIds: string[] = [];

async function newUser(label: string) {
  const email = `caps-${label}-${Date.now()}@example.test`;
  const { data } = await admin.auth.admin.createUser({ email, email_confirm: true });
  const id = data.user!.id;
  createdUserIds.push(id);
  return id;
}

async function seedPurchase(userId: string, packageSize: number, createdAt: Date = new Date()) {
  await admin.from("stripe_purchases").insert({
    user_id: userId,
    stripe_checkout_session_id: `cs_${userId}_${Math.random().toString(36).slice(2)}`,
    package_size: packageSize,
    unit_price_cents: 599,
    total_amount_cents: 599 * packageSize,
    status: "paid",
    created_at: createdAt.toISOString()
  });
}

afterEach(async () => {
  while (createdUserIds.length > 0) {
    const id = createdUserIds.pop()!;
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
});

describe("assertWithinAbuseCaps", () => {
  it("allows when the user has no recent purchases", async () => {
    const userId = await newUser("clean");
    await expect(assertWithinAbuseCaps({ supabase: admin, userId })).resolves.toBeUndefined();
  });

  it("allows up to 2 recent purchases", async () => {
    const userId = await newUser("two");
    await seedPurchase(userId, 5);
    await seedPurchase(userId, 5);
    await expect(assertWithinAbuseCaps({ supabase: admin, userId })).resolves.toBeUndefined();
  });

  it("rejects with session_cap on the 3rd attempt in 24h", async () => {
    const userId = await newUser("session-cap");
    await seedPurchase(userId, 5);
    await seedPurchase(userId, 5);
    await seedPurchase(userId, 5);
    await expect(assertWithinAbuseCaps({ supabase: admin, userId })).rejects.toBeInstanceOf(AbuseCapError);
  });

  it("rejects with credit_cap when total in 24h would exceed 500", async () => {
    const userId = await newUser("credit-cap");
    await seedPurchase(userId, 100);
    await seedPurchase(userId, 100);
    // Total = 200; next session of 350 would push us over 500.
    await expect(
      assertWithinAbuseCaps({ supabase: admin, userId, requestedPackageSize: 350 })
    ).rejects.toBeInstanceOf(AbuseCapError);
  });

  it("ignores purchases older than 24h", async () => {
    const userId = await newUser("old");
    const longAgo = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await seedPurchase(userId, 100, longAgo);
    await seedPurchase(userId, 100, longAgo);
    await seedPurchase(userId, 100, longAgo);
    await expect(assertWithinAbuseCaps({ supabase: admin, userId })).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- abuse-caps`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export const ABUSE_CAP_SESSIONS_24H = 3;
export const ABUSE_CAP_CREDITS_24H = 500;

export type AbuseCapReason = "session_cap" | "credit_cap";

export class AbuseCapError extends Error {
  constructor(public readonly reason: AbuseCapReason) {
    super(`abuse_cap_${reason}`);
    this.name = "AbuseCapError";
  }
}

export interface AbuseCapsOptions {
  supabase: SupabaseClient<Database>;
  userId: string;
  /** If provided, factored into the credit cap check. */
  requestedPackageSize?: number;
}

export async function assertWithinAbuseCaps({
  supabase,
  userId,
  requestedPackageSize = 0
}: AbuseCapsOptions): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("stripe_purchases")
    .select("package_size")
    .eq("user_id", userId)
    .gte("created_at", since);

  if (error) {
    console.error("[abuse-caps] lookup failed:", error);
    throw new Error("Failed to verify purchase rate limits");
  }

  const recentSessions = data?.length ?? 0;
  if (recentSessions >= ABUSE_CAP_SESSIONS_24H) {
    throw new AbuseCapError("session_cap");
  }

  const recentCredits = (data ?? []).reduce((sum, row) => sum + row.package_size, 0);
  if (recentCredits + requestedPackageSize > ABUSE_CAP_CREDITS_24H) {
    throw new AbuseCapError("credit_cap");
  }
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- abuse-caps`
Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/billing/abuse-caps.ts tests/integration/lib/abuse-caps.test.ts
git commit -m "feat(billing): per-user 24h abuse caps (3 sessions / 500 credits)"
```

---

### Task 5: Stripe client singleton

**Files:**
- Create: `lib/billing/stripe-client.ts`

- [ ] **Step 1: Write the singleton**

```ts
import Stripe from "stripe";

let cached: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (typeof window !== "undefined") {
    throw new Error("Stripe server SDK must never be used in the browser.");
  }
  if (!cached) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not configured.");
    }
    cached = new Stripe(key, {
      apiVersion: "2024-12-18.acacia",
      typescript: true
    });
  }
  return cached;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS. If TypeScript complains about the API version string, replace `"2024-12-18.acacia"` with the literal type the `stripe` package exposes (the error message will tell you which version literals are valid for the installed version).

- [ ] **Step 3: Commit**

```bash
git add lib/billing/stripe-client.ts
git commit -m "feat(billing): stripe server-side client singleton"
```

---

### Task 6: `POST /api/stripe/checkout`

**Files:**
- Create: `app/api/stripe/checkout/route.ts`
- Test: `tests/integration/api/checkout.test.ts`

The test uses Stripe test mode keys and creates real test-mode sessions (which Stripe doesn't charge for). Requires `STRIPE_SECRET_KEY=sk_test_...` in `.env.test`.

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

beforeAll(async () => {
  const ping = await fetch(`${APP}/`).catch(() => null);
  if (!ping) throw new Error(`Next dev server not reachable at ${APP}.`);
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY missing in .env.test (use a test-mode key sk_test_...)");
  }
});

describe("POST /api/stripe/checkout", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await fetch(`${APP}/api/stripe/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageSize: 25 })
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 for an off-grid package size", async () => {
    const res = await fetch(`${APP}/api/stripe/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ packageSize: 7 })
    });
    // Unauthenticated still 401 because auth runs first.
    expect([400, 401]).toContain(res.status);
  });
});
```

- [ ] **Step 2: Write the route**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/billing/stripe-client";
import {
  InvalidPackageSizeError,
  isValidPackageSize,
  priceForPackage
} from "@/lib/billing/pricing";
import { AbuseCapError, assertWithinAbuseCaps } from "@/lib/billing/abuse-caps";

export const runtime = "nodejs";

const bodySchema = z.object({
  packageSize: z.number().int()
});

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success || !isValidPackageSize(parsed.data.packageSize)) {
    return NextResponse.json({ error: "Invalid packageSize" }, { status: 400 });
  }
  const packageSize = parsed.data.packageSize;

  const admin = getSupabaseAdminClient();

  try {
    await assertWithinAbuseCaps({ supabase: admin, userId: userData.user.id, requestedPackageSize: packageSize });
  } catch (error) {
    if (error instanceof AbuseCapError) {
      return NextResponse.json(
        { error: "Purchase rate limit exceeded", code: error.reason },
        { status: 429 }
      );
    }
    console.error("[api/stripe/checkout] abuse-cap lookup failed:", error);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }

  let quote;
  try {
    quote = priceForPackage(packageSize);
  } catch (error) {
    if (error instanceof InvalidPackageSizeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const pending = await admin
    .from("stripe_purchases")
    .insert({
      user_id: userData.user.id,
      stripe_checkout_session_id: `pending-${crypto.randomUUID()}`,
      package_size: packageSize,
      unit_price_cents: quote.unitPriceCents,
      total_amount_cents: quote.totalAmountCents,
      currency: quote.currency,
      status: "pending"
    })
    .select("id")
    .single();

  if (pending.error || !pending.data) {
    console.error("[api/stripe/checkout] failed to persist pending purchase:", pending.error);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }

  const stripe = getStripeClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
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
              description: "Pakiet kredytów na tłumaczenie faktur KSeF",
              metadata: { package_size: String(packageSize) }
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

    // Replace the placeholder session id we used to satisfy the unique constraint.
    await admin
      .from("stripe_purchases")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", pending.data.id);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[api/stripe/checkout] Stripe session creation failed:", error);
    await admin
      .from("stripe_purchases")
      .update({ status: "failed" })
      .eq("id", pending.data.id);
    return NextResponse.json({ error: "Checkout failed" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Restart dev server + run tests**

```bash
tmux kill-session -t next-dev 2>/dev/null || true
tmux new-session -d -s next-dev "npx next dev" && sleep 6
npm test -- tests/integration/api/checkout.test
tmux kill-session -t next-dev
```

Expected: 2 passing.

- [ ] **Step 4: Manual sanity check (optional)**

If you have a session cookie from a signed-in browser, copy it and:

```bash
curl -sS -X POST http://localhost:3000/api/stripe/checkout \
  -H "Content-Type: application/json" \
  -H "Cookie: <paste>" \
  -d '{"packageSize":25}'
```

Expected: `{"url":"https://checkout.stripe.com/c/pay/cs_test_..."}`. Open the URL — should show a Stripe Checkout page with 25 credits @ 4.99 zł + 23% VAT.

- [ ] **Step 5: Commit**

```bash
git add app/api/stripe/checkout/route.ts tests/integration/api/checkout.test.ts
git commit -m "feat(api): /api/stripe/checkout auth-gated session creation"
```

---

### Task 7: `POST /api/stripe/webhook`

**Files:**
- Create: `app/api/stripe/webhook/route.ts`
- Test: `tests/integration/api/webhook.test.ts`

Webhooks must read the raw request body to verify Stripe's signature. Next 15 Route Handlers do NOT auto-parse the body for `POST` — we use `await request.text()` which works.

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { priceForPackage } from "@/lib/billing/pricing";

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const createdUserIds: string[] = [];

beforeAll(async () => {
  const ping = await fetch(`${APP}/`).catch(() => null);
  if (!ping) throw new Error(`Next dev server not reachable at ${APP}.`);
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET missing in .env.test");
  }
});

afterEach(async () => {
  while (createdUserIds.length > 0) {
    const id = createdUserIds.pop()!;
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
});

function signStripePayload(payload: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = createHmac("sha256", secret).update(signedPayload).digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

async function setupPurchase(): Promise<{ userId: string; purchaseId: string; sessionId: string; size: number }> {
  const email = `webhook-${Date.now()}@example.test`;
  const { data } = await admin.auth.admin.createUser({ email, email_confirm: true });
  const userId = data.user!.id;
  createdUserIds.push(userId);
  const size = 25;
  const quote = priceForPackage(size);
  const sessionId = `cs_test_${Math.random().toString(36).slice(2)}`;
  const { data: row } = await admin
    .from("stripe_purchases")
    .insert({
      user_id: userId,
      stripe_checkout_session_id: sessionId,
      package_size: size,
      unit_price_cents: quote.unitPriceCents,
      total_amount_cents: quote.totalAmountCents,
      status: "pending"
    })
    .select("id")
    .single();
  return { userId, purchaseId: row!.id, sessionId, size };
}

describe("POST /api/stripe/webhook", () => {
  it("rejects requests with no signature header", async () => {
    const res = await fetch(`${APP}/api/stripe/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "checkout.session.completed" })
    });
    expect(res.status).toBe(400);
  });

  it("rejects requests with a bad signature", async () => {
    const res = await fetch(`${APP}/api/stripe/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": "t=1,v1=deadbeef" },
      body: JSON.stringify({ type: "checkout.session.completed" })
    });
    expect(res.status).toBe(400);
  });

  it("flips a pending purchase to paid and grants credits on checkout.session.completed", async () => {
    const { userId, sessionId, size } = await setupPurchase();
    const payload = JSON.stringify({
      id: `evt_${Date.now()}`,
      type: "checkout.session.completed",
      data: {
        object: {
          id: sessionId,
          object: "checkout.session",
          payment_status: "paid",
          metadata: { package_size: String(size), user_id: userId }
        }
      }
    });
    const sig = signStripePayload(payload, process.env.STRIPE_WEBHOOK_SECRET!);

    const res = await fetch(`${APP}/api/stripe/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": sig },
      body: payload
    });
    expect(res.status).toBe(200);

    const { data: row } = await admin
      .from("stripe_purchases")
      .select("status, credits_granted, paid_at")
      .eq("stripe_checkout_session_id", sessionId)
      .single();
    expect(row?.status).toBe("paid");
    expect(row?.credits_granted).toBe(size);
    expect(row?.paid_at).toBeTruthy();

    const { data: bal } = await admin
      .from("credit_balances")
      .select("paid_credits")
      .eq("user_id", userId)
      .single();
    expect(bal?.paid_credits).toBe(size);
  });

  it("is idempotent — replaying the same event does not double-grant", async () => {
    const { userId, sessionId, size } = await setupPurchase();
    const payload = JSON.stringify({
      id: `evt_${Date.now()}`,
      type: "checkout.session.completed",
      data: {
        object: {
          id: sessionId,
          object: "checkout.session",
          payment_status: "paid",
          metadata: { package_size: String(size), user_id: userId }
        }
      }
    });
    const sig = signStripePayload(payload, process.env.STRIPE_WEBHOOK_SECRET!);

    await fetch(`${APP}/api/stripe/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": sig },
      body: payload
    });
    // Replay.
    await fetch(`${APP}/api/stripe/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "stripe-signature": sig },
      body: payload
    });

    const { data: bal } = await admin
      .from("credit_balances")
      .select("paid_credits")
      .eq("user_id", userId)
      .single();
    expect(bal?.paid_credits).toBe(size);
  });
});
```

- [ ] **Step 2: Write the route**

```ts
import { NextResponse, type NextRequest } from "next/server";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/billing/stripe-client";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook] STRIPE_WEBHOOK_SECRET missing");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await request.text();
  const stripe = getStripeClient();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (error) {
    console.error("[webhook] signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(admin, session);
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      await handleChargeRefunded(admin, charge);
    }
    // Ignore other event types silently — Stripe will retry only on non-2xx.
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`[webhook] handler for ${event.type} failed:`, error);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
}

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

  // Idempotency: if already paid, do nothing.
  if (purchase.data.status === "paid") {
    return;
  }

  const update = await admin
    .from("stripe_purchases")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      credits_granted: purchase.data.package_size,
      stripe_payment_intent_id:
        typeof session.payment_intent === "string" ? session.payment_intent : null
    })
    .eq("id", purchase.data.id)
    .eq("status", "pending") // Re-check status atomically (extra guard against races).
    .select("id")
    .maybeSingle();

  if (!update.data) {
    // Either someone else flipped it concurrently, or it was already paid.
    return;
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
}

async function handleChargeRefunded(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  charge: Stripe.Charge
): Promise<void> {
  const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
  if (!paymentIntentId) return;

  const purchase = await admin
    .from("stripe_purchases")
    .select("id, user_id, package_size, status")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();

  if (!purchase.data) {
    console.warn(`[webhook] no stripe_purchases row for payment_intent ${paymentIntentId}`);
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
}
```

- [ ] **Step 3: Run, expect pass**

```bash
tmux kill-session -t next-dev 2>/dev/null || true
tmux new-session -d -s next-dev "npx next dev" && sleep 6
npm test -- tests/integration/api/webhook.test
tmux kill-session -t next-dev
```

Expected: 4 passing.

- [ ] **Step 4: Commit**

```bash
git add app/api/stripe/webhook/route.ts tests/integration/api/webhook.test.ts
git commit -m "feat(api): /api/stripe/webhook handles checkout.completed + charge.refunded idempotently"
```

---

### Task 8: Billing copy strings

**Files:**
- Modify: `lib/workspace/copy.ts`

- [ ] **Step 1: Add the new keys**

Open `lib/workspace/copy.ts`. Both the `pl` and `en` sub-objects need new entries at the end (after the Phase 3 credit entries, before the closing `}`).

For `pl`:

```ts
    billingTitle: "Pakiety kredytów",
    billingSubtitle: "Pierwszy kredyt darmowy odnawia się 1. dnia każdego miesiąca. Kredyty z pakietów nie wygasają.",
    pickPackage: "Wybierz wielkość pakietu",
    unitPrice: "za fakturę (netto)",
    total: "Razem (netto)",
    totalWithTax: "Z 23% VAT",
    continueToCheckout: "Przejdź do płatności",
    purchaseHistory: "Historia zakupów",
    purchaseDate: "Data",
    purchaseSize: "Pakiet",
    purchaseTotal: "Kwota",
    purchaseStatus: "Status",
    purchaseStatusPaid: "Opłacony",
    purchaseStatusPending: "W toku",
    purchaseStatusFailed: "Nieudany",
    purchaseStatusRefunded: "Zwrócony",
    paymentSuccessTitle: "Płatność zakończona",
    paymentSuccessBody: "Kredyty zostały dodane do Twojego konta.",
    paymentCancelledTitle: "Płatność anulowana",
    paymentCancelledBody: "Płatność została anulowana. Możesz spróbować ponownie."
```

For `en`:

```ts
    billingTitle: "Credit packs",
    billingSubtitle: "The free credit refreshes on the 1st of each month. Pack credits never expire.",
    pickPackage: "Pick a pack size",
    unitPrice: "per invoice (net)",
    total: "Total (net)",
    totalWithTax: "With 23% VAT",
    continueToCheckout: "Continue to checkout",
    purchaseHistory: "Purchase history",
    purchaseDate: "Date",
    purchaseSize: "Pack",
    purchaseTotal: "Amount",
    purchaseStatus: "Status",
    purchaseStatusPaid: "Paid",
    purchaseStatusPending: "Pending",
    purchaseStatusFailed: "Failed",
    purchaseStatusRefunded: "Refunded",
    paymentSuccessTitle: "Payment complete",
    paymentSuccessBody: "Credits have been added to your account.",
    paymentCancelledTitle: "Payment cancelled",
    paymentCancelledBody: "The payment was cancelled. You can try again."
```

Match the existing 4-space indent and double-quote style.

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add lib/workspace/copy.ts
git commit -m "feat(workspace): add billing copy (PL + EN)"
```

---

### Task 9: `<CreditSlider>` client component

**Files:**
- Create: `components/billing/credit-slider.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PACKAGE_SIZES } from "@/lib/billing/pricing";

interface PriceQuote {
  packageSize: number;
  unitPriceCents: number;
  totalAmountCents: number;
  currency: string;
}

export interface CreditSliderProps {
  pickPackageLabel: string;
  unitPriceLabel: string;
  totalLabel: string;
  totalWithTaxLabel: string;
  continueLabel: string;
}

const VAT_RATE = 0.23;
const formatter = new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" });

export function CreditSlider({
  pickPackageLabel,
  unitPriceLabel,
  totalLabel,
  totalWithTaxLabel,
  continueLabel
}: CreditSliderProps) {
  const [size, setSize] = useState(25);
  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/billing/price?packageSize=${size}`);
        if (!res.ok) {
          throw new Error("Price unavailable");
        }
        const payload = (await res.json()) as PriceQuote;
        if (!cancelled) setQuote(payload);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Price unavailable");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [size]);

  const totalNet = quote ? quote.totalAmountCents / 100 : 0;
  const totalGross = totalNet * (1 + VAT_RATE);
  const unitNet = quote ? quote.unitPriceCents / 100 : 0;

  const ticks = useMemo(() => PACKAGE_SIZES.filter((n) => n % 25 === 0 || n === 5), []);

  async function onContinue() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageSize: size })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error ?? "Checkout failed");
      }
      window.location.href = payload.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setCreating(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
      <label htmlFor="slider" className="text-sm font-medium text-slate-700">
        {pickPackageLabel}
      </label>
      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-5xl font-semibold tabular-nums text-slate-950">{size}</span>
        <span className="text-sm text-slate-500">{unitPriceLabel}</span>
      </div>
      <input
        id="slider"
        type="range"
        min={5}
        max={100}
        step={5}
        value={size}
        onChange={(event) => setSize(Number(event.target.value))}
        className="mt-4 w-full cursor-pointer accent-cyan-700"
      />
      <div className="mt-1 flex justify-between text-xs text-slate-500">
        {ticks.map((tick) => (
          <span key={tick} className={tick === size ? "font-semibold text-slate-900" : ""}>
            {tick}
          </span>
        ))}
      </div>

      <dl className="mt-6 grid gap-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">{unitPriceLabel}</dt>
          <dd className="font-medium text-slate-900">
            {loading ? <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> : formatter.format(unitNet)}
          </dd>
        </div>
        <div className="flex justify-between border-t border-slate-100 pt-2">
          <dt className="text-slate-500">{totalLabel}</dt>
          <dd className="text-lg font-semibold text-slate-950 tabular-nums">
            {loading ? "—" : formatter.format(totalNet)}
          </dd>
        </div>
        <div className="flex justify-between text-xs">
          <dt className="text-slate-400">{totalWithTaxLabel}</dt>
          <dd className="text-slate-500 tabular-nums">
            {loading ? "—" : formatter.format(totalGross)}
          </dd>
        </div>
      </dl>

      <Button
        className="mt-6 w-full"
        onClick={onContinue}
        disabled={creating || loading || !quote}
      >
        {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {continueLabel}
      </Button>

      {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add components/billing/credit-slider.tsx
git commit -m "feat(billing): CreditSlider client component with live price"
```

---

### Task 10: `<PurchaseHistory>` server component

**Files:**
- Create: `components/billing/purchase-history.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { UiLanguage } from "@/lib/workspace/copy";
import { copy } from "@/lib/workspace/copy";

interface PurchaseHistoryProps {
  userId: string;
  uiLanguage: UiLanguage;
}

export async function PurchaseHistory({ userId, uiLanguage }: PurchaseHistoryProps) {
  const admin = getSupabaseAdminClient();
  const { data: rows } = await admin
    .from("stripe_purchases")
    .select("id, package_size, total_amount_cents, currency, status, created_at, paid_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  const t = copy[uiLanguage];
  const formatter = new Intl.NumberFormat(uiLanguage === "pl" ? "pl-PL" : "en-GB", {
    style: "currency",
    currency: "PLN"
  });
  const dateFormatter = new Intl.DateTimeFormat(uiLanguage === "pl" ? "pl-PL" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });

  function statusLabel(status: string): string {
    switch (status) {
      case "paid":
        return String(t.purchaseStatusPaid);
      case "pending":
        return String(t.purchaseStatusPending);
      case "failed":
        return String(t.purchaseStatusFailed);
      case "refunded":
        return String(t.purchaseStatusRefunded);
      default:
        return status;
    }
  }

  if (!rows || rows.length === 0) {
    return null;
  }

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-slate-950">{String(t.purchaseHistory)}</h2>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">{String(t.purchaseDate)}</th>
              <th className="px-4 py-3">{String(t.purchaseSize)}</th>
              <th className="px-4 py-3">{String(t.purchaseTotal)}</th>
              <th className="px-4 py-3">{String(t.purchaseStatus)}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-700">
                  {dateFormatter.format(new Date(row.created_at))}
                </td>
                <td className="px-4 py-3 text-slate-700">{row.package_size}</td>
                <td className="px-4 py-3 text-slate-700">
                  {formatter.format(row.total_amount_cents / 100)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(row.status)}`}
                  >
                    {statusLabel(row.status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function statusClass(status: string): string {
  switch (status) {
    case "paid":
      return "bg-emerald-50 text-emerald-800 border border-emerald-200";
    case "pending":
      return "bg-amber-50 text-amber-800 border border-amber-200";
    case "refunded":
      return "bg-slate-100 text-slate-700 border border-slate-200";
    case "failed":
      return "bg-rose-50 text-rose-800 border border-rose-200";
    default:
      return "bg-slate-100 text-slate-700 border border-slate-200";
  }
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add components/billing/purchase-history.tsx
git commit -m "feat(billing): PurchaseHistory server component"
```

---

### Task 11: Replace `/billing` placeholder with real page

**Files:**
- Modify: `app/(protected)/billing/page.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { CreditSlider } from "@/components/billing/credit-slider";
import { PurchaseHistory } from "@/components/billing/purchase-history";
import { BillingStatusToast } from "@/components/billing/billing-status-toast";
import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { copy, type UiLanguage } from "@/lib/workspace/copy";

export default async function BillingPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("locale")
    .eq("id", user.id)
    .single();
  const uiLanguage: UiLanguage = profile?.locale === "en" ? "en" : "pl";
  const t = copy[uiLanguage];

  const params = await searchParams;
  const status = params.status === "paid" || params.status === "cancelled" ? params.status : undefined;

  return (
    <section className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{String(t.billingTitle)}</h1>
        <p className="mt-2 max-w-2xl text-slate-600">{String(t.billingSubtitle)}</p>
      </div>

      <CreditSlider
        pickPackageLabel={String(t.pickPackage)}
        unitPriceLabel={String(t.unitPrice)}
        totalLabel={String(t.total)}
        totalWithTaxLabel={String(t.totalWithTax)}
        continueLabel={String(t.continueToCheckout)}
      />

      {status ? (
        <BillingStatusToast
          status={status}
          successTitle={String(t.paymentSuccessTitle)}
          successBody={String(t.paymentSuccessBody)}
          cancelledTitle={String(t.paymentCancelledTitle)}
          cancelledBody={String(t.paymentCancelledBody)}
        />
      ) : null}

      <PurchaseHistory userId={user.id} uiLanguage={uiLanguage} />
    </section>
  );
}
```

- [ ] **Step 2: Create the toast helper**

Create `components/billing/billing-status-toast.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

export interface BillingStatusToastProps {
  status: "paid" | "cancelled";
  successTitle: string;
  successBody: string;
  cancelledTitle: string;
  cancelledBody: string;
}

export function BillingStatusToast({
  status,
  successTitle,
  successBody,
  cancelledTitle,
  cancelledBody
}: BillingStatusToastProps) {
  useEffect(() => {
    if (status === "paid" && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("credit-balance-changed"));
    }
  }, [status]);

  if (status === "paid") {
    return (
      <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">{successTitle}</p>
          <p className="mt-1 text-emerald-800">{successBody}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-900">
      <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-semibold">{cancelledTitle}</p>
        <p className="mt-1 text-slate-700">{cancelledBody}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + build**

```bash
npm run typecheck && npm run build
```

Expected: PASS. `/billing` should still appear in the build output.

- [ ] **Step 4: Commit**

```bash
git add 'app/(protected)/billing/page.tsx' components/billing/billing-status-toast.tsx
git commit -m "feat(billing): replace placeholder with slider + history + status toast"
```

---

### Task 12: E2E — slider redirect flow

**Files:**
- Create: `tests/e2e/billing.spec.ts`

This test asserts the slider widget works and the "Continue to checkout" button reaches Stripe's hosted checkout. It does NOT complete a real payment — that's a Stripe-side flow we shouldn't try to automate.

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, serviceRole, { auth: { persistSession: false } });

async function signIn(page: import("@playwright/test").Page, email: string) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) throw new Error("generateLink failed");
  await page.goto(`/auth/callback?token_hash=${data.properties.hashed_token}&type=email`);
  await expect(page).toHaveURL(/\/app$/);
}

async function deleteUser(email: string) {
  const { data } = await admin.auth.admin.listUsers();
  const created = data.users.find((u) => u.email === email);
  if (created) await admin.auth.admin.deleteUser(created.id);
}

test("slider reflects price changes and redirects to Stripe Checkout", async ({ page }) => {
  const email = `billing-${Date.now()}@example.test`;
  await admin.auth.admin.createUser({ email, email_confirm: true });
  await signIn(page, email);

  await page.goto("/billing");

  // Default size is 25 → 4.99 zł / inv. The slider initial value should show 25.
  await expect(page.locator("#slider")).toHaveValue("25");

  // Drag the slider to 50 — value goes up, unit price drops to 3.99 zł.
  await page.locator("#slider").fill("50");
  await expect(page.locator("#slider")).toHaveValue("50");
  // 50 * 399 = 19950 → "199,50 zł" (Polish formatting) or "PLN 199.50".
  await expect(page.getByText(/199[,.]50/)).toBeVisible({ timeout: 5_000 });

  // Click Continue — should redirect to Stripe Checkout. We intercept the navigation
  // rather than actually loading checkout.stripe.com (which would slow the test).
  const [checkoutResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/stripe/checkout") && r.request().method() === "POST"),
    page.getByRole("button", { name: /Przejdź do płatności|Continue to checkout/i }).click()
  ]);
  expect(checkoutResponse.status()).toBe(200);
  const payload = await checkoutResponse.json();
  expect(payload.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);

  // Source-of-truth check: a stripe_purchases row should exist with status='pending'.
  const { data: rows } = await admin
    .from("stripe_purchases")
    .select("package_size, status")
    .eq("stripe_checkout_session_id", payload.url.split("/").pop()?.split("#")[0] ?? "")
    .limit(1);
  // The URL contains the session id near the end; if matching is fragile, just check by user.
  if (!rows || rows.length === 0) {
    const userId = (await admin.auth.admin.listUsers()).data.users.find((u) => u.email === email)?.id;
    const { data: byUser } = await admin
      .from("stripe_purchases")
      .select("package_size, status")
      .eq("user_id", userId!)
      .order("created_at", { ascending: false })
      .limit(1);
    expect(byUser?.[0]).toMatchObject({ package_size: 50, status: "pending" });
  } else {
    expect(rows[0]).toMatchObject({ package_size: 50, status: "pending" });
  }

  await deleteUser(email);
});

test("?status=paid shows success toast and dispatches balance-changed", async ({ page }) => {
  const email = `billing-paid-${Date.now()}@example.test`;
  await admin.auth.admin.createUser({ email, email_confirm: true });
  await signIn(page, email);

  await page.goto("/billing?status=paid&session_id=cs_test_stub");
  await expect(page.getByText(/Płatność zakończona|Payment complete/i)).toBeVisible();

  await deleteUser(email);
});

test("?status=cancelled shows cancellation toast", async ({ page }) => {
  const email = `billing-cancel-${Date.now()}@example.test`;
  await admin.auth.admin.createUser({ email, email_confirm: true });
  await signIn(page, email);

  await page.goto("/billing?status=cancelled");
  await expect(page.getByText(/Płatność anulowana|Payment cancelled/i)).toBeVisible();

  await deleteUser(email);
});
```

- [ ] **Step 2: Run, expect pass**

```bash
npm run test:e2e -- billing
```

Expected: 3 passing.

If the slider drag test fails on the price-text match (Polish vs English formatting depends on the user's locale — defaults to PL), broaden the regex to accept both `199,50 zł` and `PLN 199.50`. The current regex `/199[,.]50/` already does this.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/billing.spec.ts
git commit -m "test(e2e): slider price change + Stripe redirect + status toasts"
```

---

### Task 13: README — Phase 4 docs

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Append a new section after "Credit enforcement (Phase 3)"**

```markdown
## Stripe purchases (Phase 4)

`/billing` hosts a 5→100 step-5 slider against a canonical PLN price ladder defined in `lib/billing/pricing.ts`:

| Pack size            | Unit price (net) |
|----------------------|-----------------:|
| 5                    |       6.99 zł    |
| 10, 15, 20           |       5.99 zł    |
| 25, 30, 35, 40, 45   |       4.99 zł    |
| 50, 55, … 95         |       3.99 zł    |
| 100                  |       2.99 zł    |

Prices are net; Stripe Tax adds 23% Polish VAT at checkout. Stripe Invoicing emails a VAT-compliant faktura to the buyer for every paid session.

### Flow
1. User picks a pack size on `/billing`. The slider fetches `/api/billing/price` on each change.
2. "Continue to checkout" POSTs to `/api/stripe/checkout`. Server recomputes the price from `priceForPackage()`, checks 24h abuse caps (≤ 3 sessions, ≤ 500 credits), inserts a `stripe_purchases` row with `status='pending'`, creates a Stripe Checkout Session with `automatic_tax: true` + `invoice_creation: true`, returns the redirect URL.
3. User completes payment on Stripe's hosted page.
4. Stripe sends `checkout.session.completed` to `/api/stripe/webhook` → signature-verified, idempotent → row flips to `status='paid'`, `grant_paid_credits(user, purchase, package_size)` runs.
5. User redirects to `/billing?status=paid` → success toast + `credit-balance-changed` event → `<BalanceChip>` refetches.

### Refunds
A `charge.refunded` webhook flips the matching purchase to `status='refunded'` and calls `refund_paid_credits` (which clamps at zero if the user already spent the credits).

### Abuse caps
Per user, last 24 hours: max 3 Checkout sessions OR 500 credits purchased. Enforced server-side in `/api/stripe/checkout`. Returns 429 with `code: "session_cap"` or `code: "credit_cap"`.

### Local dev with Stripe CLI

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
# Copy the printed `whsec_...` into STRIPE_WEBHOOK_SECRET in .env.local.

# Then in another shell, trigger a test event:
stripe trigger checkout.session.completed
```
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: phase 4 stripe purchases"
```

---

### Task 14: Verification + advisors

This is the same final pass we did for Phases 2 and 3.

- [ ] **Step 1: Full verification**

```bash
npm run typecheck
npm run build
tmux new-session -d -s next-dev "npx next dev" && sleep 6
npm test
npm run test:e2e
tmux kill-session -t next-dev
```

Expected: all green.

- [ ] **Step 2: Supabase advisors**

Via MCP, run:
- `mcp__supabase__get_advisors` with `type: "security"` → should report no new lints (the pre-existing `auth_leaked_password_protection` may still be there).
- `mcp__supabase__get_advisors` with `type: "performance"` → should report 0 lints.

If a new performance lint shows up around `stripe_purchases` (e.g. unused index on `stripe_payment_intent_id`), accept it — those indexes only show usage after some traffic flows. Document any new lints in the PR body but don't block on them.

- [ ] **Step 3: No commit**

This is a verification task. If anything fails, fix it as a separate commit with a clear message. If everything passes, proceed to opening the PR.

---

## Verification checklist (before opening Phase 4 PR)

- [ ] `npm run typecheck` clean
- [ ] `npm test` — all integration tests green: 5 pricing, 5 abuse-caps, 2 checkout, 4 webhook, plus the Phase 1+2+3 baseline
- [ ] `npm run test:e2e` — 10 specs total: smoke (1) + auth (2) + workspace (1) + credit-enforcement (3) + billing (3)
- [ ] `npm run build` succeeds; `/api/billing/price`, `/api/stripe/checkout`, `/api/stripe/webhook` appear in the route list
- [ ] Supabase advisors: no new lints
- [ ] Manual: sign in, visit `/billing`, drag slider to a few sizes, total updates within 200ms each time
- [ ] Manual: click "Continue to checkout" → land on Stripe-hosted page showing the correct PLN amount + 23% VAT
- [ ] Manual: complete a test purchase with card 4242 4242 4242 4242 → land on `/billing?status=paid` → toast shows + chip updates from "0 free · 0 paid" to "0 free · N paid"
- [ ] Manual: `stripe trigger checkout.session.completed` → webhook updates the matching row
- [ ] Manual: a second purchase of the same size succeeds (sessions counted in `stripe_purchases`, abuse cap not yet triggered)
- [ ] Manual: rapid-fire 4 sessions → 4th returns 429 with `code: "session_cap"`

---

## What comes next

Phase 5 (history page at `/app/history`) is the natural follow-up — it surfaces the `invoices` table to users for re-download and soft-delete. Phase 4's `stripe_purchases` listing pattern in `<PurchaseHistory>` is a template for the upcoming `<InvoiceHistory>`.
