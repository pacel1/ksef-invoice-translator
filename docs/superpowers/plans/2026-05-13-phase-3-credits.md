# KSeF SaaS Phase 3: Credits & Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing credit SQL functions into the `/api/upload` flow so every successful upload consumes one credit (free-first then paid), surface the user's current balance in the protected header, and show an insufficient-credit modal in the workspace that points to a placeholder `/billing` route.

**Architecture:** `/api/upload` becomes the single gatekeeper. Before parsing it calls `ensure_free_credit_for_period` (grants the monthly free credit if needed) then reads `credit_balances`; if both balances are zero it returns HTTP 402 with a structured error envelope. After a successful insert with `isNew: true`, it calls `consume_credit`. Dedupe hits (`isNew: false`) never consume. A new `GET /api/me/balance` endpoint exposes the current balance to a `<BalanceChip>` client component mounted in `app/(protected)/layout.tsx`; the workspace dispatches a `credit-balance-changed` `CustomEvent` after each successful upload so the chip re-fetches. When the upload route returns 402, the workspace shows `<InsufficientCreditModal>` with a "Kup pakiet / Buy credits" link to `/billing`.

**Tech Stack:** Next.js 15 Route Handlers + Server Components, `@supabase/ssr`, existing Phase 1 SQL functions (`ensure_free_credit_for_period`, `consume_credit`), no new migrations. Zod for the balance response shape. Vitest unit tests for the credit-enforcement helper; Playwright E2E for the full flow.

**Out of scope for this phase:**
- The real `/billing` page with the slider, Stripe Checkout, purchase history (Phase 4).
- Rate limiting on `/api/upload` (Phase 7).
- The balance chip showing live updates from a websocket / Supabase realtime channel — the event-based re-fetch is the simple approach; realtime is Phase 6 polish.
- Refunds from Stripe (Phase 4).
- Background job to grant the monthly free credit on the 1st (the existing `ensure_free_credit_for_period` is called lazily on every upload attempt — that's by design).

---

## File Structure

### New files

- `lib/billing/credit-enforcement.ts` — server-only helpers: `assertCreditAvailable({ supabase, userId })` (throws `InsufficientCreditError` if balance is zero) and `consumeCreditForInvoice({ supabase, userId, invoiceId })` (calls the SQL function; throws if it raises `insufficient_credit`). Pulls all the credit logic out of the route handler so it can be unit-tested directly.
- `app/api/me/balance/route.ts` — `GET` returns `{ freeCreditsRemaining, paidCredits, freeCreditsPeriodStart }`. Auth-required.
- `components/billing/balance-chip.tsx` — client component that fetches `/api/me/balance` on mount and on a window `credit-balance-changed` event. Renders e.g. `1 free · 35 paid`.
- `components/workspace/insufficient-credit-modal.tsx` — client component, rendered when `/api/upload` returns 402. Polish/English copy via `lib/workspace/copy.ts`; "Buy credits" link to `/billing`; "Cancel" button closes the modal.
- `app/(protected)/billing/page.tsx` — placeholder page so the modal's link doesn't 404. Phase 4 builds the real page on top of this.
- `tests/integration/lib/credit-enforcement.test.ts`
- `tests/e2e/credit-enforcement.spec.ts`

### Modified files

- `app/api/upload/route.ts` — call `assertCreditAvailable` before parsing; call `consumeCreditForInvoice` after a new insert; return 402 with `{ error, code: "insufficient_credit" }` when blocked.
- `app/(protected)/layout.tsx` — render `<BalanceChip>` in the nav.
- `components/workspace/use-translator-workflow.ts` — recognise the 402 response; expose an `insufficientCredit` flag in the workflow state; dispatch the `credit-balance-changed` event after a successful upload.
- `components/workspace/translator-workspace.tsx` — render the `<InsufficientCreditModal>` when `insufficientCredit` is true.
- `lib/workspace/copy.ts` — add the new strings (`balanceFree`, `balanceFreePaid`, `outOfCreditsTitle`, `outOfCreditsBody`, `buyCredits`, `cancel`, `billingPlaceholderTitle`, `billingPlaceholderBody`).

### Files intentionally NOT touched

- `lib/invoice/upload-service.ts` — stays a pure parse-and-persist service. Credits don't belong here.
- The SQL functions — `ensure_free_credit_for_period`, `consume_credit`, `grant_paid_credits`, `refund_paid_credits` already do the right thing.
- `app/api/translate/route.ts`, `app/api/pdf/route.ts` — translations and PDF generation remain free per the spec.

---

## Tasks

### Task 1: Credit-enforcement helper module

**Files:**
- Create: `lib/billing/credit-enforcement.ts`
- Test: `tests/integration/lib/credit-enforcement.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, afterEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  InsufficientCreditError,
  assertCreditAvailable,
  consumeCreditForInvoice
} from "@/lib/billing/credit-enforcement";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const createdUserIds: string[] = [];

async function newUser(label: string) {
  const email = `credit-${label}-${Date.now()}@example.test`;
  const { data } = await admin.auth.admin.createUser({ email, email_confirm: true });
  const id = data.user!.id;
  createdUserIds.push(id);
  return id;
}

async function newInvoice(userId: string) {
  const { data } = await admin
    .from("invoices")
    .insert({
      user_id: userId,
      source_type: "xml",
      source_hash: `h-${Date.now()}-${Math.random()}`,
      source_size: 1,
      source_data: {}
    })
    .select("id")
    .single();
  return data!.id;
}

afterEach(async () => {
  while (createdUserIds.length > 0) {
    const id = createdUserIds.pop()!;
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
});

describe("assertCreditAvailable", () => {
  it("allows a brand-new user (free credit auto-granted)", async () => {
    const userId = await newUser("fresh");
    await expect(assertCreditAvailable({ supabase: admin, userId })).resolves.toBeUndefined();
  });

  it("throws InsufficientCreditError when both balances are zero", async () => {
    const userId = await newUser("drained");
    // Ensure the row exists with the initial free grant.
    await admin.rpc("ensure_free_credit_for_period", { p_user: userId });
    // Drain it directly to simulate a user who has consumed their free credit.
    await admin
      .from("credit_balances")
      .update({ free_credits_remaining: 0, paid_credits: 0 })
      .eq("user_id", userId);

    await expect(assertCreditAvailable({ supabase: admin, userId })).rejects.toBeInstanceOf(
      InsufficientCreditError
    );
  });

  it("allows when paid_credits > 0 even if free is zero", async () => {
    const userId = await newUser("paid-only");
    await admin.rpc("ensure_free_credit_for_period", { p_user: userId });
    await admin
      .from("credit_balances")
      .update({ free_credits_remaining: 0, paid_credits: 5 })
      .eq("user_id", userId);

    await expect(assertCreditAvailable({ supabase: admin, userId })).resolves.toBeUndefined();
  });
});

describe("consumeCreditForInvoice", () => {
  it("decrements free credits and inserts a ledger entry", async () => {
    const userId = await newUser("consume");
    const invoiceId = await newInvoice(userId);

    await consumeCreditForInvoice({ supabase: admin, userId, invoiceId });

    const { data: bal } = await admin
      .from("credit_balances")
      .select("free_credits_remaining, paid_credits")
      .eq("user_id", userId)
      .single();
    expect(bal).toMatchObject({ free_credits_remaining: 0, paid_credits: 0 });

    const { data: ledger } = await admin
      .from("credit_ledger")
      .select("event_type, delta_free, invoice_id")
      .eq("user_id", userId)
      .eq("event_type", "consume");
    expect(ledger).toEqual([
      { event_type: "consume", delta_free: -1, invoice_id: invoiceId }
    ]);
  });

  it("throws InsufficientCreditError when nothing is left to consume", async () => {
    const userId = await newUser("consume-empty");
    const invoiceId = await newInvoice(userId);
    await admin.rpc("ensure_free_credit_for_period", { p_user: userId });
    await admin
      .from("credit_balances")
      .update({ free_credits_remaining: 0, paid_credits: 0 })
      .eq("user_id", userId);

    await expect(
      consumeCreditForInvoice({ supabase: admin, userId, invoiceId })
    ).rejects.toBeInstanceOf(InsufficientCreditError);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- credit-enforcement`
Expected: FAIL — module `@/lib/billing/credit-enforcement` not found.

- [ ] **Step 3: Implement**

Create `lib/billing/credit-enforcement.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export class InsufficientCreditError extends Error {
  constructor(message = "insufficient_credit") {
    super(message);
    this.name = "InsufficientCreditError";
  }
}

export interface CreditCheckOptions {
  supabase: SupabaseClient<Database>;
  userId: string;
}

export interface CreditConsumeOptions {
  supabase: SupabaseClient<Database>;
  userId: string;
  invoiceId: string;
}

/**
 * Ensures the monthly free credit has been granted for the current period,
 * then verifies the user has at least one credit (free or paid). Throws
 * InsufficientCreditError if the balance is zero. Otherwise resolves silently.
 *
 * Side effect: may insert/refresh the `credit_balances` row via
 * `ensure_free_credit_for_period`. Safe to call on every upload attempt.
 */
export async function assertCreditAvailable({ supabase, userId }: CreditCheckOptions): Promise<void> {
  const ensure = await supabase.rpc("ensure_free_credit_for_period", { p_user: userId });
  if (ensure.error) {
    console.error("[credit] ensure_free_credit_for_period failed:", ensure.error);
    throw new Error("Failed to verify credit balance");
  }

  const balance = await supabase
    .from("credit_balances")
    .select("free_credits_remaining, paid_credits")
    .eq("user_id", userId)
    .maybeSingle();

  if (balance.error) {
    console.error("[credit] balance lookup failed:", balance.error);
    throw new Error("Failed to verify credit balance");
  }

  const total = (balance.data?.free_credits_remaining ?? 0) + (balance.data?.paid_credits ?? 0);
  if (total <= 0) {
    throw new InsufficientCreditError();
  }
}

/**
 * Consumes one credit (free-first, then paid) for the given invoice. Atomic at
 * the SQL function level. Throws InsufficientCreditError when the underlying
 * SQL function raises `insufficient_credit`.
 */
export async function consumeCreditForInvoice({
  supabase,
  userId,
  invoiceId
}: CreditConsumeOptions): Promise<void> {
  const result = await supabase.rpc("consume_credit", {
    p_user: userId,
    p_invoice: invoiceId
  });

  if (result.error) {
    if (result.error.message?.includes("insufficient_credit")) {
      throw new InsufficientCreditError();
    }
    console.error("[credit] consume_credit failed:", result.error);
    throw new Error("Failed to consume credit");
  }
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- credit-enforcement`
Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/billing/credit-enforcement.ts tests/integration/lib/credit-enforcement.test.ts
git commit -m "feat(billing): credit-enforcement helpers (assert + consume)"
```

---

### Task 2: Wire credit enforcement into `/api/upload`

**Files:**
- Modify: `app/api/upload/route.ts`

- [ ] **Step 1: Replace the route body**

Replace the contents of `app/api/upload/route.ts` with:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { uploadInvoiceForUser, UploadError } from "@/lib/invoice/upload-service";
import {
  InsufficientCreditError,
  assertCreditAvailable,
  consumeCreditForInvoice
} from "@/lib/billing/credit-enforcement";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();

  // Pre-check: refuse fast (HTTP 402) if the user has zero credits, before parsing.
  try {
    await assertCreditAvailable({ supabase: admin, userId: userData.user.id });
  } catch (error) {
    if (error instanceof InsufficientCreditError) {
      return NextResponse.json(
        { error: "Out of credits", code: "insufficient_credit" },
        { status: 402 }
      );
    }
    console.error("[api/upload] credit pre-check failed:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
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

  let result;
  try {
    result = await uploadInvoiceForUser({
      userId: userData.user.id,
      file,
      supabase: admin
    });
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[api/upload] unexpected error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  // Only consume a credit for genuinely new invoices. Dedupe hits cost nothing.
  if (result.isNew) {
    try {
      await consumeCreditForInvoice({
        supabase: admin,
        userId: userData.user.id,
        invoiceId: result.invoiceId
      });
    } catch (error) {
      if (error instanceof InsufficientCreditError) {
        // Race: another concurrent upload drained the balance between our pre-check
        // and the consume. Soft-delete the just-inserted row so the user can retry
        // cleanly after topping up.
        await admin
          .from("invoices")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", result.invoiceId);
        return NextResponse.json(
          { error: "Out of credits", code: "insufficient_credit" },
          { status: 402 }
        );
      }
      console.error("[api/upload] credit consumption failed:", error);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  }

  return NextResponse.json(result);
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/api/upload/route.ts
git commit -m "feat(api): /api/upload pre-checks balance and consumes credit on isNew"
```

---

### Task 3: `GET /api/me/balance` endpoint

**Files:**
- Create: `app/api/me/balance/route.ts`

- [ ] **Step 1: Write the route**

Create `app/api/me/balance/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();

  // Ensure the row exists and the monthly free grant has happened before reading.
  const ensure = await admin.rpc("ensure_free_credit_for_period", { p_user: userData.user.id });
  if (ensure.error) {
    console.error("[api/me/balance] ensure failed:", ensure.error);
    return NextResponse.json({ error: "Balance unavailable" }, { status: 500 });
  }

  const balance = await admin
    .from("credit_balances")
    .select("free_credits_remaining, paid_credits, free_credits_period_start")
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (balance.error) {
    console.error("[api/me/balance] read failed:", balance.error);
    return NextResponse.json({ error: "Balance unavailable" }, { status: 500 });
  }

  return NextResponse.json({
    freeCreditsRemaining: balance.data?.free_credits_remaining ?? 0,
    paidCredits: balance.data?.paid_credits ?? 0,
    freeCreditsPeriodStart: balance.data?.free_credits_period_start ?? null
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/api/me/balance/route.ts
git commit -m "feat(api): GET /api/me/balance returns current credit balance"
```

---

### Task 4: Extend the copy dictionary

**Files:**
- Modify: `lib/workspace/copy.ts`

- [ ] **Step 1: Add the new keys**

Inside `lib/workspace/copy.ts`, both the `pl` and `en` sub-objects need new entries. Open the file and add these entries at the end of each block (just before the closing `}`):

For `pl`:

```ts
    balanceFree: "Darmowy kredyt",
    balanceFreePaid: "kredytów",
    outOfCreditsTitle: "Brak kredytów",
    outOfCreditsBody:
      "Wykorzystałeś darmową fakturę w tym miesiącu i nie masz pakietu kredytów. Kup pakiet, aby kontynuować — pierwszy kredyt darmowy odnawia się 1. dnia każdego miesiąca.",
    buyCredits: "Kup pakiet",
    cancel: "Anuluj",
    billingPlaceholderTitle: "Pakiety kredytów",
    billingPlaceholderBody: "Sklep z pakietami będzie dostępny w następnej fazie."
```

For `en`:

```ts
    balanceFree: "Free credit",
    balanceFreePaid: "credits",
    outOfCreditsTitle: "Out of credits",
    outOfCreditsBody:
      "You have used your free invoice for this month and have no credit pack. Buy a pack to continue — the free credit refreshes on the 1st of each month.",
    buyCredits: "Buy credits",
    cancel: "Cancel",
    billingPlaceholderTitle: "Credit packs",
    billingPlaceholderBody: "The credit-pack store will be available in the next phase."
```

Make sure the trailing commas before the new entries match the existing block style.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/workspace/copy.ts
git commit -m "feat(workspace): add credit-related PL/EN copy"
```

---

### Task 5: `<BalanceChip>` client component

**Files:**
- Create: `components/billing/balance-chip.tsx`

- [ ] **Step 1: Write the component**

Create `components/billing/balance-chip.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";

export interface BalanceChipProps {
  initialFree: number;
  initialPaid: number;
  /** "Free credit" or "Darmowy kredyt" */
  freeLabel: string;
  /** "credits" or "kredytów" */
  paidLabel: string;
}

interface BalanceResponse {
  freeCreditsRemaining: number;
  paidCredits: number;
}

export function BalanceChip({ initialFree, initialPaid, freeLabel, paidLabel }: BalanceChipProps) {
  const [free, setFree] = useState(initialFree);
  const [paid, setPaid] = useState(initialPaid);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    async function refetch() {
      setRefreshing(true);
      try {
        const res = await fetch("/api/me/balance");
        if (!res.ok) return;
        const payload = (await res.json()) as BalanceResponse;
        setFree(payload.freeCreditsRemaining);
        setPaid(payload.paidCredits);
      } finally {
        setRefreshing(false);
      }
    }

    function onCreditChange() {
      void refetch();
    }

    window.addEventListener("credit-balance-changed", onCreditChange);
    return () => window.removeEventListener("credit-balance-changed", onCreditChange);
  }, []);

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
      {refreshing ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
      ) : (
        <CreditCard className="h-3.5 w-3.5 text-cyan-700" />
      )}
      <span aria-label={`${free} ${freeLabel}`}>
        {free} {freeLabel.toLowerCase()}
      </span>
      <span aria-hidden="true" className="text-slate-300">·</span>
      <span aria-label={`${paid} ${paidLabel}`}>
        {paid} {paidLabel}
      </span>
    </span>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/billing/balance-chip.tsx
git commit -m "feat(billing): BalanceChip client component with auto-refresh"
```

---

### Task 6: Mount `<BalanceChip>` in the protected layout

**Files:**
- Modify: `app/(protected)/layout.tsx`

- [ ] **Step 1: Replace the layout**

Replace the contents of `app/(protected)/layout.tsx` with:

```tsx
import Link from "next/link";
import { FileText } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { signOut } from "@/app/actions/auth";
import { BalanceChip } from "@/components/billing/balance-chip";
import { copy, type UiLanguage } from "@/lib/workspace/copy";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("locale")
    .eq("id", user.id)
    .single();
  const uiLanguage: UiLanguage = profile?.locale === "en" ? "en" : "pl";

  const admin = getSupabaseAdminClient();
  await admin.rpc("ensure_free_credit_for_period", { p_user: user.id });
  const { data: balance } = await admin
    .from("credit_balances")
    .select("free_credits_remaining, paid_credits")
    .eq("user_id", user.id)
    .maybeSingle();

  const t = copy[uiLanguage];

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-3 md:px-8">
          <Link href="/app" className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <FileText className="h-5 w-5 text-cyan-700" />
            KSeF Invoice Translator
          </Link>
          <nav className="flex items-center gap-3 text-sm text-slate-700">
            <Link href="/app" className="rounded-md px-3 py-2 hover:bg-slate-100">Workspace</Link>
            <BalanceChip
              initialFree={balance?.free_credits_remaining ?? 0}
              initialPaid={balance?.paid_credits ?? 0}
              freeLabel={String(t.balanceFree)}
              paidLabel={String(t.balanceFreePaid)}
            />
            <Link href="/account" className="rounded-md px-3 py-2 hover:bg-slate-100">
              {user.email}
            </Link>
            <form action={signOut}>
              <button type="submit" className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                Wyloguj
              </button>
            </form>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-8 md:px-8">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add 'app/(protected)/layout.tsx'
git commit -m "feat(app): render BalanceChip in protected header"
```

---

### Task 7: `<InsufficientCreditModal>` client component

**Files:**
- Create: `components/workspace/insufficient-credit-modal.tsx`

- [ ] **Step 1: Write the component**

Create `components/workspace/insufficient-credit-modal.tsx`:

```tsx
"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface InsufficientCreditModalProps {
  open: boolean;
  title: string;
  body: string;
  buyLabel: string;
  cancelLabel: string;
  onClose: () => void;
}

export function InsufficientCreditModal({
  open,
  title,
  body,
  buyLabel,
  cancelLabel,
  onClose
}: InsufficientCreditModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="insufficient-credit-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="insufficient-credit-title" className="text-lg font-semibold text-slate-950">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={cancelLabel}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Link
            href="/billing"
            className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-900"
          >
            {buyLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/workspace/insufficient-credit-modal.tsx
git commit -m "feat(workspace): InsufficientCreditModal client component"
```

---

### Task 8: Wire the 402 path + balance-changed event into the workflow hook

**Files:**
- Modify: `components/workspace/use-translator-workflow.ts`

- [ ] **Step 1: Replace the hook**

Replace `components/workspace/use-translator-workflow.ts` with:

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
  insufficientCredit: boolean;
  upload(file: File): Promise<void>;
  translate(language: LanguageCode, bilingual: boolean): Promise<void>;
  downloadPdf(language: LanguageCode, bilingual: boolean): Promise<void>;
  dismissInsufficientCredit(): void;
  reset(): void;
}

export function useTranslatorWorkflow(): UseTranslatorWorkflowResult {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [status, setStatus] = useState<WorkflowStatus>("idle");
  const [messages, setMessages] = useState<string[]>([]);
  const [insufficientCredit, setInsufficientCredit] = useState(false);

  function notifyBalanceChanged() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("credit-balance-changed"));
    }
  }

  async function upload(file: File) {
    setMessages([]);
    setStatus("uploading");
    setInsufficientCredit(false);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });

      if (res.status === 402) {
        setInsufficientCredit(true);
        return;
      }

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error ?? "Upload failed");
      }

      setInvoice(payload.invoice);
      setInvoiceId(payload.invoiceId);
      setMessages(payload.warnings ?? []);
      if (payload.isNew) {
        notifyBalanceChanged();
      }
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

  function dismissInsufficientCredit() {
    setInsufficientCredit(false);
  }

  function reset() {
    setInvoice(null);
    setInvoiceId(null);
    setMessages([]);
    setStatus("idle");
    setInsufficientCredit(false);
  }

  return {
    invoice,
    invoiceId,
    status,
    messages,
    insufficientCredit,
    upload,
    translate,
    downloadPdf,
    dismissInsufficientCredit,
    reset
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/workspace/use-translator-workflow.ts
git commit -m "feat(workspace): handle 402 + dispatch credit-balance-changed event"
```

---

### Task 9: Render the modal in the workspace

**Files:**
- Modify: `components/workspace/translator-workspace.tsx`

- [ ] **Step 1: Update imports + render the modal**

Find the existing imports block in `components/workspace/translator-workspace.tsx` and add this import alongside the other components:

```tsx
import { InsufficientCreditModal } from "./insufficient-credit-modal";
```

Then in the body of `TranslatorWorkspace`, destructure the new hook fields:

```tsx
  const {
    invoice,
    status,
    messages,
    insufficientCredit,
    upload,
    translate,
    downloadPdf,
    dismissInsufficientCredit
  } = useTranslatorWorkflow();
```

Replacing the existing destructure (which previously was `const { invoice, status, messages, upload, translate, downloadPdf } = useTranslatorWorkflow();`).

Then, just before the closing `</section>` at the end of the returned JSX, add the modal:

```tsx
      <InsufficientCreditModal
        open={insufficientCredit}
        title={String(t.outOfCreditsTitle)}
        body={String(t.outOfCreditsBody)}
        buyLabel={String(t.buyCredits)}
        cancelLabel={String(t.cancel)}
        onClose={dismissInsufficientCredit}
      />
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/workspace/translator-workspace.tsx
git commit -m "feat(workspace): render InsufficientCreditModal on 402"
```

---

### Task 10: `/billing` placeholder page

**Files:**
- Create: `app/(protected)/billing/page.tsx`

- [ ] **Step 1: Write the placeholder**

Create `app/(protected)/billing/page.tsx`:

```tsx
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { copy, type UiLanguage } from "@/lib/workspace/copy";

export default async function BillingPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("locale")
    .eq("id", user.id)
    .single();
  const uiLanguage: UiLanguage = profile?.locale === "en" ? "en" : "pl";
  const t = copy[uiLanguage];

  return (
    <section className="mx-auto max-w-2xl">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-8 py-16 text-center shadow-soft">
        <CreditCard className="mx-auto mb-4 h-10 w-10 text-cyan-700" />
        <h1 className="text-2xl font-semibold text-slate-950">{String(t.billingPlaceholderTitle)}</h1>
        <p className="mx-auto mt-3 max-w-md text-slate-600">{String(t.billingPlaceholderBody)}</p>
        <div className="mt-6">
          <Link
            href="/app"
            className="inline-flex h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            ← Workspace
          </Link>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS. `/billing` should appear in the build output among the route list.

- [ ] **Step 3: Commit**

```bash
git add 'app/(protected)/billing'
git commit -m "feat(billing): placeholder /billing page for credit-pack store"
```

---

### Task 11: E2E — credit enforcement flow

**Files:**
- Create: `tests/e2e/credit-enforcement.spec.ts`

- [ ] **Step 1: Write the spec**

Create `tests/e2e/credit-enforcement.spec.ts`:

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

async function userIdFor(email: string) {
  const { data } = await admin.auth.admin.listUsers();
  return data.users.find((u) => u.email === email)?.id ?? null;
}

async function deleteUser(email: string) {
  const id = await userIdFor(email);
  if (id) await admin.auth.admin.deleteUser(id);
}

test("free credit is consumed on the first new upload", async ({ page }) => {
  const email = `credit-free-${Date.now()}@example.test`;
  await admin.auth.admin.createUser({ email, email_confirm: true });
  await signInViaTokenHash(page, email);

  // Header shows "1 darmowy kredyt / free credit · 0 kredytów / credits" pre-upload.
  await expect(page.getByText(/1 (darmowy kredyt|free credit)/i).first()).toBeVisible();

  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByText(/Wgraj KSeF FA\(3\) XML lub PDF/i).click();
  const chooser = await chooserPromise;
  const [uploadResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/upload") && r.request().method() === "POST"),
    chooser.setFiles(samplePath)
  ]);
  expect(uploadResponse.status()).toBe(200);

  // Balance should drop to "0 free credit". The chip refetches on credit-balance-changed.
  await expect(page.getByText(/0 (darmowy kredyt|free credit)/i).first()).toBeVisible({ timeout: 5_000 });

  const userId = (await userIdFor(email))!;
  const { data: bal } = await admin
    .from("credit_balances")
    .select("free_credits_remaining, paid_credits")
    .eq("user_id", userId)
    .single();
  expect(bal).toMatchObject({ free_credits_remaining: 0, paid_credits: 0 });

  await deleteUser(email);
});

test("dedupe re-upload does not consume a credit", async ({ page }) => {
  const email = `credit-dedupe-${Date.now()}@example.test`;
  await admin.auth.admin.createUser({ email, email_confirm: true });
  // Pre-give the user paid credits so the first upload uses paid, and we can
  // still upload a second time without bumping into the free-tier reset logic.
  const userId = (await userIdFor(email))!;
  await admin.rpc("ensure_free_credit_for_period", { p_user: userId });
  await admin
    .from("credit_balances")
    .update({ free_credits_remaining: 0, paid_credits: 3 })
    .eq("user_id", userId);

  await signInViaTokenHash(page, email);

  // First upload — consumes one paid credit.
  let chooserPromise = page.waitForEvent("filechooser");
  await page.getByText(/Wgraj KSeF FA\(3\) XML lub PDF/i).click();
  let chooser = await chooserPromise;
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/upload") && r.request().method() === "POST"),
    chooser.setFiles(samplePath)
  ]);
  // Reload to clear the workspace state and re-arm the drop zone.
  await page.reload();

  // Second upload of the same bytes — dedupe hit, no credit consumed.
  chooserPromise = page.waitForEvent("filechooser");
  await page.getByText(/Wgraj KSeF FA\(3\) XML lub PDF/i).click();
  chooser = await chooserPromise;
  const [secondResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/upload") && r.request().method() === "POST"),
    chooser.setFiles(samplePath)
  ]);
  expect(secondResponse.status()).toBe(200);
  const payload = await secondResponse.json();
  expect(payload.isNew).toBe(false);

  const { data: bal } = await admin
    .from("credit_balances")
    .select("free_credits_remaining, paid_credits")
    .eq("user_id", userId)
    .single();
  expect(bal).toMatchObject({ free_credits_remaining: 0, paid_credits: 2 });

  await deleteUser(email);
});

test("upload at zero balance returns 402 and shows the modal", async ({ page }) => {
  const email = `credit-zero-${Date.now()}@example.test`;
  await admin.auth.admin.createUser({ email, email_confirm: true });
  await signInViaTokenHash(page, email);

  // Drain the balance directly.
  const userId = (await userIdFor(email))!;
  await admin.rpc("ensure_free_credit_for_period", { p_user: userId });
  await admin
    .from("credit_balances")
    .update({ free_credits_remaining: 0, paid_credits: 0 })
    .eq("user_id", userId);

  // Reload so the chip picks up the drained balance.
  await page.reload();

  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByText(/Wgraj KSeF FA\(3\) XML lub PDF/i).click();
  const chooser = await chooserPromise;
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/upload") && r.request().method() === "POST"),
    chooser.setFiles(samplePath)
  ]);
  expect(response.status()).toBe(402);
  const payload = await response.json();
  expect(payload.code).toBe("insufficient_credit");

  // Modal should be visible.
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog").getByText(/Brak kredytów|Out of credits/i)).toBeVisible();

  // The Buy-credits link should point to /billing.
  const buy = page.getByRole("link", { name: /Kup pakiet|Buy credits/i });
  await expect(buy).toHaveAttribute("href", "/billing");

  await deleteUser(email);
});
```

- [ ] **Step 2: Run the spec**

```bash
npm run test:e2e -- credit-enforcement
```

Expected: 3 passing.

If a test fails on the balance-chip text match, the chip's render may differ slightly from the expected format. Adjust the regex to be looser. If the dedupe test fails because the second upload was treated as new, check that `source_hash` is computed identically (it should be — the file bytes are unchanged).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/credit-enforcement.spec.ts
git commit -m "test(e2e): credit enforcement (free consume, dedupe, 402 modal)"
```

---

### Task 12: README — credit enforcement docs

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Append a new section after "Workspace flow (Phase 2)"**

Add this content immediately after the existing Phase 2 workspace section, before the "Third-Party References" block:

```markdown
## Credit enforcement (Phase 3)

`/api/upload` now consumes one credit per successful new upload.

- **Free tier**: every account gets 1 credit per calendar month, granted lazily on the first upload attempt of that month. Free credits do not accumulate — unused credits are lost on the 1st.
- **Paid credits** never expire and are consumed only after the free credit is gone.
- **Dedupe hits cost nothing**: re-uploading the same file (matched by SHA-256 of the bytes, per user) returns the existing row with `isNew: false`.
- **Out of credits**: `/api/upload` returns HTTP 402 with `{ "error": "Out of credits", "code": "insufficient_credit" }`. The workspace shows a modal pointing to `/billing` (placeholder until Phase 4 wires up Stripe Checkout).

The current balance is visible in the protected header (`<BalanceChip>`) and queryable at `GET /api/me/balance`. The chip refreshes automatically when the workspace dispatches a `credit-balance-changed` event after a credit-consuming upload.

All credit changes are recorded in `credit_ledger` (append-only). The `credit_balances` row is a denormalised view of the ledger sum.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: phase 3 credit enforcement"
```

---

## Verification checklist (before opening the Phase 3 PR)

- [ ] `npm run typecheck` passes
- [ ] `npm test` — all integration tests green, including the new `credit-enforcement.test.ts` (5 tests)
- [ ] `npm run test:e2e` — 7 specs total: smoke (1), auth (2), workspace (1), credit-enforcement (3)
- [ ] `npm run build` — Vercel-ready, no new lint errors
- [ ] Manual: sign in fresh, see "1 free · 0 credits" chip; upload sample XML; chip drops to "0 · 0"
- [ ] Manual: re-upload the same file → `isNew: false`, balance unchanged
- [ ] Manual: drain balance via Supabase Studio or MCP, try to upload → modal appears with "Buy credits" link to `/billing`
- [ ] `mcp__supabase__get_advisors --type security` returns no new lints

---

## What comes next

Phase 4 (Stripe purchases) is the natural follow-up:
- The slider widget on `/billing` (currently a placeholder from Task 10).
- `POST /api/stripe/checkout` that takes `{ packageSize: 5..100 step 5 }`, server-recomputes price from the canonical ladder, creates a Stripe Checkout session.
- `POST /api/stripe/webhook` that handles `checkout.session.completed` and calls `grant_paid_credits` (which the Phase 1 SQL function suite already exposes).
- Stripe Tax enabled in the dashboard for PLN VAT.
- Stripe Invoicing for VAT-compliant faktury.

Phase 3's `BalanceChip` already auto-refreshes on the `credit-balance-changed` event, so after a Stripe webhook grants credits, the workspace just needs to dispatch that event when the user lands back on `/app` from a successful checkout.
