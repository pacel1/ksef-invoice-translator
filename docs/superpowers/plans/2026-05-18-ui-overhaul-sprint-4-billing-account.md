# UI Overhaul Sprint 4 — Billing + Account + RODO + Inline Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Each task uses checkbox (`- [ ]`) syntax for tracking.

**Goal:** Final sprint of the UI overhaul. Rebuild `/billing` with new tokens + stat band, rebuild `/account` with editable profile + RODO data export + danger zone, ship two new backend endpoints (`POST /api/me/export`, `DELETE /api/me/account`), and add the inline `<CreditPurchaseDrawer>` that replaces the banner/modal navigations to `/billing`.

**Architecture:** `/billing` keeps its existing components (`CreditSlider`, `PurchaseHistory`, `BillingStatusToast`) but gets a wholesale visual refresh — the components are restyled in-place, the page composition is rebuilt with a big stat-band header. `/account` becomes a 3-section page: editable profile (server action), RODO data export (POST endpoint + blob download), danger zone (cascading delete with email-confirmation modal). The inline drawer mounts in the protected layout, listens for a `open-credit-drawer` custom event, and contains the same `<CreditSlider>` reused inside a slide-in panel — single source of truth for the purchase flow.

**Tech Stack:** Next.js 15 App Router (server components + server actions), React 19, TypeScript, Tailwind (Sprint 1 tokens), Vitest + jsdom for components, Playwright for E2E. Backend: Supabase admin for cascading delete, JSON streaming for the export.

**Spec reference:** `docs/superpowers/specs/2026-05-18-ui-overhaul-design.md` §6.1 (inline drawer mention), §6.3 (billing), §6.4 (account), §7 (Sprint 4 row).

**Branch:** Continues on `claude/ui-overhaul-sprint-1` (all four sprints stack into PR #12).

---

## File Structure

### Modified files
- `app/(protected)/billing/page.tsx` — rebuild composition with stat band + restyled blocks
- `app/(protected)/account/page.tsx` — rebuild composition with profile + export + danger zone
- `components/billing/credit-slider.tsx` — visual restyle (preserve API)
- `components/billing/purchase-history.tsx` — visual restyle (preserve API)
- `components/billing/billing-status-toast.tsx` — visual restyle
- `components/billing/low-balance-banner.tsx` — CTA changes from Link to button + dispatches event
- `components/workspace/insufficient-credit-modal.tsx` — same CTA change
- `tests/components/billing/low-balance-banner.test.tsx` — update assertions for button + dispatched event
- `app/(protected)/layout.tsx` — mount `<CreditPurchaseDrawer>`
- `lib/workspace/copy.ts` — add ~12 new keys for billing stat band + account sections

### New files — backend
- `app/api/me/export/route.ts` — POST: streams JSON dump
- `app/api/me/account/route.ts` — DELETE: cascading delete with email-confirm body
- `app/actions/profile.ts` — server action `updateProfile`

### New files — UI components
- `components/billing/credit-balance-band.tsx` — stat-band header for /billing
- `components/account/profile-section.tsx` — email + locale + display name (editable)
- `components/account/data-export-section.tsx` — RODO download button
- `components/account/danger-zone.tsx` — delete invoices + delete account
- `components/account/delete-account-modal.tsx` — confirm-by-typing-email modal
- `components/billing/credit-purchase-drawer.tsx` — slide-in panel hosting CreditSlider

### New tests
- `tests/integration/api/me-export.test.ts`
- `tests/integration/api/me-account-delete.test.ts`
- `tests/components/billing/credit-balance-band.test.tsx`
- `tests/components/account/profile-section.test.tsx`
- `tests/components/account/data-export-section.test.tsx`
- `tests/components/account/delete-account-modal.test.tsx`
- `tests/components/billing/credit-purchase-drawer.test.tsx`
- `tests/components/billing/low-balance-banner.test.tsx` (UPDATE existing — buy-CTA assertions change from `link` to `button` + event dispatch)
- `tests/e2e/sprint-4-billing-account.spec.ts`

---

## Task 1: `POST /api/me/export` — RODO JSON dump

**Files:**
- Create: `app/api/me/export/route.ts`
- Test: `tests/integration/api/me-export.test.ts`

Authenticated endpoint that returns the user's entire data footprint as a single JSON object: `{ profile, balance, invoices, translations, purchases }`. For Sprint 4 MVP we stream JSON directly (no signed-URL queue) since the dataset is small per-user.

- [ ] **Step 1: Write failing test**

`tests/integration/api/me-export.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

beforeAll(async () => {
  const ping = await fetch(`${APP}/`).catch(() => null);
  if (!ping) {
    throw new Error(`Next dev server not reachable at ${APP}.`);
  }
});

describe("POST /api/me/export", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await fetch(`${APP}/api/me/export`, { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("rejects GET (POST only)", async () => {
    const res = await fetch(`${APP}/api/me/export`);
    expect([404, 405]).toContain(res.status);
  });
});
```

- [ ] **Step 2: Run-fail**

```bash
tmux kill-session -t dev 2>/dev/null
tmux new-session -d -s dev "npx next dev"
sleep 8
npm test -- --run tests/integration/api/me-export.test.ts
```

- [ ] **Step 3: Create `app/api/me/export/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

interface ExportEnvelope {
  generatedAt: string;
  schemaVersion: string;
  profile: unknown;
  balance: unknown;
  invoices: unknown[];
  translations: unknown[];
  purchases: unknown[];
}

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const userId = userData.user.id;
  const admin = getSupabaseAdminClient();

  const [profileRes, balanceRes, invoicesRes, translationsRes, purchasesRes] = await Promise.all([
    admin.from("profiles").select("*").eq("id", userId).single(),
    admin.from("credit_balances").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("invoices").select("*").eq("user_id", userId).is("deleted_at", null),
    admin
      .from("translations")
      .select("*, invoices!inner(user_id)")
      .eq("invoices.user_id", userId),
    admin.from("stripe_purchases").select("*").eq("user_id", userId)
  ]);

  const envelope: ExportEnvelope = {
    generatedAt: new Date().toISOString(),
    schemaVersion: "1",
    profile: profileRes.data ?? null,
    balance: balanceRes.data ?? null,
    invoices: invoicesRes.data ?? [],
    translations: translationsRes.data ?? [],
    purchases: purchasesRes.data ?? []
  };

  const json = JSON.stringify(envelope, null, 2);
  return new NextResponse(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="tlumaczksef-export-${userId}-${Date.now()}.json"`
    }
  });
}
```

- [ ] **Step 4: Run-pass**

```bash
npm test -- --run tests/integration/api/me-export.test.ts
```

Expected: 2/2 passing.

- [ ] **Step 5: Commit**

```bash
git add app/api/me/export/route.ts tests/integration/api/me-export.test.ts
git commit -m "feat(api): POST /api/me/export — RODO Art. 20 JSON data dump"
```

---

## Task 2: `DELETE /api/me/account` — cascading delete with confirmation

**Files:**
- Create: `app/api/me/account/route.ts`
- Test: `tests/integration/api/me-account-delete.test.ts`

Body requires `{ confirmEmail: string }` matching the user's auth email. On match, calls `admin.auth.admin.deleteUser(userId)` which cascades to profiles + credit_balances + invoices + translations + stripe_purchases per existing FK constraints. Returns 204 on success.

- [ ] **Step 1: Write failing test**

`tests/integration/api/me-account-delete.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";

const APP = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

beforeAll(async () => {
  const ping = await fetch(`${APP}/`).catch(() => null);
  if (!ping) {
    throw new Error(`Next dev server not reachable at ${APP}.`);
  }
});

describe("DELETE /api/me/account", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await fetch(`${APP}/api/me/account`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmEmail: "any@example.test" })
    });
    expect(res.status).toBe(401);
  });

  it("rejects POST (DELETE only)", async () => {
    const res = await fetch(`${APP}/api/me/account`, { method: "POST" });
    expect([404, 405]).toContain(res.status);
  });

  it("returns 400 when confirmEmail body is missing", async () => {
    const res = await fetch(`${APP}/api/me/account`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    // 401 if no auth runs first, 400 if validation runs first. Both are valid.
    expect([400, 401]).toContain(res.status);
  });
});
```

- [ ] **Step 2: Run-fail**

```bash
npm test -- --run tests/integration/api/me-account-delete.test.ts
```

- [ ] **Step 3: Create `app/api/me/account/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

interface DeleteBody {
  confirmEmail?: string;
}

export async function DELETE(request: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  const user = userData.user;

  let body: DeleteBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.confirmEmail || typeof body.confirmEmail !== "string") {
    return NextResponse.json({ error: "confirmEmail is required" }, { status: 400 });
  }

  if (body.confirmEmail.trim().toLowerCase() !== (user.email ?? "").toLowerCase()) {
    return NextResponse.json(
      { error: "confirmEmail does not match the authenticated user" },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdminClient();
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("[me/account] delete failed:", deleteError);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
```

- [ ] **Step 4: Run-pass**

```bash
npm test -- --run tests/integration/api/me-account-delete.test.ts
tmux kill-session -t dev 2>/dev/null
```

Expected: 3/3 passing.

- [ ] **Step 5: Commit**

```bash
git add app/api/me/account/route.ts tests/integration/api/me-account-delete.test.ts
git commit -m "feat(api): DELETE /api/me/account — cascading delete with email confirmation"
```

---

## Task 3: Restyle `<CreditSlider>` against new tokens

**Files:**
- Modify: `components/billing/credit-slider.tsx`

Visual-only refactor. The component's API (props, behavior, Stripe checkout call) stays exactly the same. Replace cyan/slate Tailwind classes with the Stripe-purple token system.

- [ ] **Step 1: Read the existing component**

```bash
cat components/billing/credit-slider.tsx
```

Note the existing prop interface — preserve EXACTLY (don't rename, don't remove). Note the existing tests at `tests/components/billing/credit-slider.test.tsx` if they exist — they must keep passing.

- [ ] **Step 2: Find every Tailwind color/sizing class and rewrite**

Search the file for these patterns and replace:

| Old class | New class |
|---|---|
| `bg-cyan-700`, `bg-cyan-800`, `bg-cyan-600` | `bg-accent` |
| `hover:bg-cyan-800` | `hover:bg-accent-hover` |
| `text-cyan-700`, `text-cyan-800` | `text-accent` |
| `border-cyan-200`, `border-cyan-300` | `border-accent-soft` |
| `bg-cyan-50` | `bg-accent-soft` |
| `text-slate-900`, `text-slate-950` | `text-text-strong` |
| `text-slate-600`, `text-slate-700` | `text-text` |
| `text-slate-500`, `text-slate-400` | `text-text-muted` |
| `border-slate-200`, `border-slate-300` | `border-border` |
| `bg-slate-50` | `bg-surface-muted` |
| `bg-white` | `bg-surface` |
| `text-2xl`, `text-3xl` (heading-like) | `text-h2` or `text-h1` |
| `text-4xl`, `text-5xl` (price displays) | `text-number-xl` |
| `text-sm` | `text-small` |
| `text-xs` | `text-micro` |
| `text-base` | `text-body` |
| `shadow-soft` | `shadow-sm` |
| `rounded-lg` (cards) | `rounded-xl` (12px hero modules) |

Preserve all logic, state, fetch calls, props — only touch className strings.

Add `tabular-nums` class to any element rendering numbers (slider value, total, per-invoice price) for the new pricing-display feel.

- [ ] **Step 3: Run existing tests + typecheck**

```bash
npm test -- --run tests/components/billing/ 2>&1 | tail -10
npm run typecheck 2>&1 | tail -5
```

Expected: all existing tests pass (visual-only change, no behavior diff).

- [ ] **Step 4: Commit**

```bash
git add components/billing/credit-slider.tsx
git commit -m "refactor(billing): restyle CreditSlider against Stripe-purple tokens"
```

---

## Task 4: Restyle `<PurchaseHistory>` + `<BillingStatusToast>`

**Files:**
- Modify: `components/billing/purchase-history.tsx`
- Modify: `components/billing/billing-status-toast.tsx`

Same visual-only refactor as Task 3 — replace cyan/slate classes with the new token system. Preserve all logic, fetches, and props.

- [ ] **Step 1: Read both files**

```bash
cat components/billing/purchase-history.tsx components/billing/billing-status-toast.tsx
```

- [ ] **Step 2: Apply the same class-replacement table from Task 3**

Reuse the table from Task 3:
- `bg-cyan-*` → `bg-accent`
- `text-cyan-*` → `text-accent`
- `text-slate-900/950` → `text-text-strong`
- `text-slate-600/700` → `text-text`
- `text-slate-400/500` → `text-text-muted`
- `border-slate-200/300` → `border-border`
- `bg-white` → `bg-surface`
- `bg-slate-50` → `bg-surface-muted`
- `text-sm` → `text-small`
- `text-xs` → `text-micro`
- `rounded-lg` (cards) → `rounded-xl`
- `shadow-soft` → `shadow-sm`

For status-toast emerald/success colors:
- `bg-emerald-50`, `text-emerald-700`, etc. → `bg-success/10` (use the success token, low opacity background) + `text-success`

For status-toast danger/red:
- `bg-rose-50`, `text-rose-700`, etc. → `bg-danger/10` + `text-danger`

For table rows in PurchaseHistory, use `divide-y divide-border` on the table body.

- [ ] **Step 3: Verify**

```bash
npm test -- --run tests/components/billing/ 2>&1 | tail -10
npm run typecheck 2>&1 | tail -5
```

Expected: all billing component tests still pass.

- [ ] **Step 4: Commit**

```bash
git add components/billing/purchase-history.tsx components/billing/billing-status-toast.tsx
git commit -m "refactor(billing): restyle PurchaseHistory + BillingStatusToast against new tokens"
```

---

## Task 5: `<CreditBalanceBand>` stat header for /billing

**Files:**
- Create: `components/billing/credit-balance-band.tsx`
- Modify: `lib/workspace/copy.ts` (add 6 keys to PL+EN)
- Test: `tests/components/billing/credit-balance-band.test.tsx`

Big stat band at the top of /billing. Shows current paid credits (large tabular number), free credit, and the next free-refresh date.

- [ ] **Step 1: Add copy keys to `lib/workspace/copy.ts`**

In the `pl` block, near other billing keys:
```typescript
    billingBandPaidLabel: "kredytów",
    billingBandFreeLabel: "darmowy w tym miesiącu",
    billingBandNextFreeLabel: "Następne darmowe odnowienie:",
    billingIncludedHeading: "Co dostajesz w cenie?",
    billingVatNote: "Wszystkie ceny netto. VAT 23% naliczany przy zakupie.",
    billingRefundPolicy: "Niewykorzystane kredyty nie wygasają. Zwroty na życzenie w 14 dni.",
```

In the `en` block:
```typescript
    billingBandPaidLabel: "credits",
    billingBandFreeLabel: "free this month",
    billingBandNextFreeLabel: "Next free credit refreshes:",
    billingIncludedHeading: "What's included?",
    billingVatNote: "All prices net of VAT. 23% VAT added at checkout.",
    billingRefundPolicy: "Unused credits never expire. Refunds on request within 14 days.",
```

- [ ] **Step 2: Write failing test**

`tests/components/billing/credit-balance-band.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CreditBalanceBand } from "@/components/billing/credit-balance-band";

const labels = {
  paidLabel: "kredytów",
  freeLabel: "darmowy w tym miesiącu",
  nextFreeLabel: "Następne darmowe odnowienie:"
};

describe("<CreditBalanceBand>", () => {
  it("renders the paid balance as a big tabular number", () => {
    render(
      <CreditBalanceBand
        paidCredits={25}
        freeCreditsRemaining={1}
        nextFreeAt="2026-06-01"
        labels={labels}
      />
    );
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByText(/kredytów/i)).toBeInTheDocument();
  });

  it("renders the free credit sub-row when free credit is remaining", () => {
    render(
      <CreditBalanceBand
        paidCredits={25}
        freeCreditsRemaining={1}
        nextFreeAt="2026-06-01"
        labels={labels}
      />
    );
    expect(screen.getByText(/1\s+darmowy w tym miesiącu/i)).toBeInTheDocument();
  });

  it("renders the next-free refresh date", () => {
    render(
      <CreditBalanceBand
        paidCredits={25}
        freeCreditsRemaining={0}
        nextFreeAt="2026-06-01"
        labels={labels}
      />
    );
    expect(screen.getByText(/Następne darmowe odnowienie/i)).toBeInTheDocument();
    expect(screen.getByText(/2026-06-01/)).toBeInTheDocument();
  });

  it("renders 0 paid credits clearly (not blank)", () => {
    render(
      <CreditBalanceBand
        paidCredits={0}
        freeCreditsRemaining={0}
        nextFreeAt="2026-06-01"
        labels={labels}
      />
    );
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run-fail**

```bash
npm test -- --run tests/components/billing/credit-balance-band.test.tsx
```

- [ ] **Step 4: Create the component**

`components/billing/credit-balance-band.tsx`:

```tsx
export interface CreditBalanceBandLabels {
  paidLabel: string;
  freeLabel: string;
  nextFreeLabel: string;
}

export interface CreditBalanceBandProps {
  paidCredits: number;
  freeCreditsRemaining: number;
  nextFreeAt: string;
  labels: CreditBalanceBandLabels;
}

export function CreditBalanceBand({
  paidCredits,
  freeCreditsRemaining,
  nextFreeAt,
  labels
}: CreditBalanceBandProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex flex-col items-baseline gap-2 sm:flex-row sm:gap-4">
        <span className="text-number-xl tabular-nums text-text-strong">{paidCredits}</span>
        <span className="text-body text-text-muted">{labels.paidLabel}</span>
      </div>
      <p className="mt-2 text-small text-text">
        <span className="font-semibold text-text-strong">{freeCreditsRemaining}</span>{" "}
        {labels.freeLabel}
      </p>
      <p className="mt-3 text-micro text-text-muted">
        {labels.nextFreeLabel} <time dateTime={nextFreeAt}>{nextFreeAt}</time>
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Run-pass**

```bash
npm test -- --run tests/components/billing/credit-balance-band.test.tsx
```

Expected: 4/4 passing.

- [ ] **Step 6: Commit**

```bash
git add components/billing/credit-balance-band.tsx tests/components/billing/credit-balance-band.test.tsx lib/workspace/copy.ts
git commit -m "feat(billing): CreditBalanceBand — stat header for /billing page"
```

---

## Task 6: Rebuild `/billing` page composition

**Files:**
- Modify: `app/(protected)/billing/page.tsx`

Composes stat band + slider + included list + status toast + history + VAT/refund notes. Reads balance via the existing `getCurrentBalance` cache helper. Reuses the existing `<CreditSlider>` and `<PurchaseHistory>` (now restyled in Tasks 3+4).

- [ ] **Step 1: Compute "next free refresh" date helper**

The free credit refreshes on the 1st of each month. Add a helper to compute the next 1st:

Inline within the page file (small enough):

```typescript
function nextFreeRefreshDate(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.toISOString().slice(0, 10); // "YYYY-MM-DD"
}
```

- [ ] **Step 2: Replace `app/(protected)/billing/page.tsx`**

```tsx
import { CheckCircle2 } from "lucide-react";
import { CreditSlider } from "@/components/billing/credit-slider";
import { PurchaseHistory } from "@/components/billing/purchase-history";
import { BillingStatusToast } from "@/components/billing/billing-status-toast";
import { CreditBalanceBand } from "@/components/billing/credit-balance-band";
import { requireUser } from "@/lib/auth/require-user";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { getCurrentBalance } from "@/lib/billing/get-current-balance";
import { copy } from "@/lib/workspace/copy";

function nextFreeRefreshDate(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return next.toISOString().slice(0, 10);
}

export default async function BillingPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireUser();
  const { uiLanguage } = await getCurrentProfile(user.id);
  const balance = await getCurrentBalance(user.id);
  const t = copy[uiLanguage];

  const params = await searchParams;
  const status = params.status === "paid" || params.status === "cancelled" ? params.status : undefined;

  const includedItems = [
    "Tłumaczenie treści faktury (towary, usługi, opisy)",
    "MF-compliant PDF (schemat FA(3) 2025-06-25)",
    "QR code KSeF zachowany",
    "Opcja dwujęzyczna (PL + język docelowy)"
  ];
  const includedItemsEn = [
    "Translation of invoice content (items, services, descriptions)",
    "MF-compliant PDF (FA(3) 2025-06-25 schema)",
    "KSeF QR code preserved",
    "Bilingual option (PL + target language)"
  ];
  const items = uiLanguage === "pl" ? includedItems : includedItemsEn;

  return (
    <section className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-h1 text-text-strong">{String(t.billingTitle)}</h1>
        <p className="mt-2 max-w-2xl text-body text-text-muted">{String(t.billingSubtitle)}</p>
      </div>

      <CreditBalanceBand
        paidCredits={balance.paidCredits}
        freeCreditsRemaining={balance.freeCreditsRemaining}
        nextFreeAt={nextFreeRefreshDate()}
        labels={{
          paidLabel: String(t.billingBandPaidLabel),
          freeLabel: String(t.billingBandFreeLabel),
          nextFreeLabel: String(t.billingBandNextFreeLabel)
        }}
      />

      <CreditSlider
        pickPackageLabel={String(t.pickPackage)}
        unitPriceLabel={String(t.unitPrice)}
        totalLabel={String(t.total)}
        totalWithTaxLabel={String(t.totalWithTax)}
        continueLabel={String(t.continueToCheckout)}
      />

      <div>
        <h2 className="text-h2 text-text-strong">{String(t.billingIncludedHeading)}</h2>
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-3 text-body text-text">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

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

      <div className="space-y-1 text-micro text-text-muted">
        <p>{String(t.billingVatNote)}</p>
        <p>{String(t.billingRefundPolicy)}</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Build + run existing billing E2E**

```bash
tmux kill-session -t dev 2>/dev/null
npm run build 2>&1 | tail -10
npm run test:e2e -- billing 2>&1 | tail -10
```

Expected: build clean, billing E2E 3/3 passing.

- [ ] **Step 4: Commit**

```bash
git add 'app/(protected)/billing/page.tsx'
git commit -m "feat(billing): rebuild /billing composition with stat band + included list"
```

---

## Task 7: `<ProfileSection>` — editable email + locale + display name

**Files:**
- Create: `components/account/profile-section.tsx`
- Create: `app/actions/profile.ts` — server action `updateProfile`
- Modify: `lib/workspace/copy.ts` — add account copy keys
- Test: `tests/components/account/profile-section.test.tsx`

Profile section: email (immutable, monospace), locale toggle (PL/EN), display name (optional, the `profiles.display_name` column already exists). On submit, calls a server action that updates the row.

- [ ] **Step 1: Add account copy keys**

PL block additions:
```typescript
    accountTitle: "Konto",
    accountProfileHeading: "Profil",
    accountEmailLabel: "E-mail",
    accountEmailHelp: "E-mail logowania nie można zmienić.",
    accountLocaleLabel: "Język interfejsu",
    accountDisplayNameLabel: "Nazwa wyświetlana (opcjonalnie)",
    accountDisplayNameHelp: "Używana w transakcyjnych e-mailach.",
    accountSaveButton: "Zapisz zmiany",
    accountSavingButton: "Zapisuję…",
    accountSaveSuccess: "Zapisano.",
    accountSaveError: "Nie udało się zapisać zmian.",
    accountExportHeading: "Eksport danych (RODO)",
    accountExportBody: "Pobierz pełny eksport swoich danych w formacie JSON.",
    accountExportButton: "Pobierz dane (JSON)",
    accountExportPreparing: "Przygotowuję…",
    accountDangerHeading: "Strefa niebezpieczna",
    accountDeleteAccountTitle: "Usuń konto",
    accountDeleteAccountBody: "Wszystkie twoje dane (faktury, tłumaczenia, historia zakupów) zostaną trwale usunięte.",
    accountDeleteAccountButton: "Usuń konto",
    accountDeleteConfirmTitle: "Potwierdź usunięcie konta",
    accountDeleteConfirmBody: "Wpisz swój adres e-mail, aby potwierdzić. Tej operacji nie można cofnąć.",
    accountDeleteConfirmPlaceholder: "Wpisz adres e-mail",
    accountDeleteConfirmAction: "Tak, usuń trwale moje konto",
    accountDeleteCancel: "Anuluj",
```

EN block additions:
```typescript
    accountTitle: "Account",
    accountProfileHeading: "Profile",
    accountEmailLabel: "Email",
    accountEmailHelp: "Sign-in email cannot be changed.",
    accountLocaleLabel: "Interface language",
    accountDisplayNameLabel: "Display name (optional)",
    accountDisplayNameHelp: "Used in transactional emails.",
    accountSaveButton: "Save changes",
    accountSavingButton: "Saving…",
    accountSaveSuccess: "Saved.",
    accountSaveError: "Could not save changes.",
    accountExportHeading: "Data export (GDPR)",
    accountExportBody: "Download a full export of your data in JSON format.",
    accountExportButton: "Download data (JSON)",
    accountExportPreparing: "Preparing…",
    accountDangerHeading: "Danger zone",
    accountDeleteAccountTitle: "Delete account",
    accountDeleteAccountBody: "All your data (invoices, translations, purchase history) will be permanently deleted.",
    accountDeleteAccountButton: "Delete account",
    accountDeleteConfirmTitle: "Confirm account deletion",
    accountDeleteConfirmBody: "Type your email address to confirm. This action cannot be undone.",
    accountDeleteConfirmPlaceholder: "Type your email address",
    accountDeleteConfirmAction: "Yes, permanently delete my account",
    accountDeleteCancel: "Cancel",
```

- [ ] **Step 2: Create `app/actions/profile.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/require-user";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export interface UpdateProfileInput {
  locale?: "pl" | "en";
  displayName?: string | null;
}

export async function updateProfile(input: UpdateProfileInput): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const admin = getSupabaseAdminClient();

  const updates: { locale?: string; display_name?: string | null } = {};
  if (input.locale === "pl" || input.locale === "en") updates.locale = input.locale;
  if (input.displayName !== undefined) {
    updates.display_name = input.displayName?.trim() || null;
  }

  if (Object.keys(updates).length === 0) {
    return { ok: true };
  }

  const { error } = await admin.from("profiles").update(updates).eq("id", user.id);
  if (error) {
    console.error("[updateProfile] failed:", error);
    return { ok: false, error: error.message };
  }

  revalidatePath("/account");
  return { ok: true };
}
```

- [ ] **Step 3: Write failing test**

`tests/components/account/profile-section.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProfileSection } from "@/components/account/profile-section";

const updateProfileMock = vi.fn();

vi.mock("@/app/actions/profile", () => ({
  updateProfile: (input: unknown) => updateProfileMock(input)
}));

const baseProps = {
  email: "user@firma.pl",
  initialLocale: "pl" as const,
  initialDisplayName: "Jan Kowalski",
  labels: {
    heading: "Profil",
    emailLabel: "E-mail",
    emailHelp: "E-mail logowania nie można zmienić.",
    localeLabel: "Język interfejsu",
    displayNameLabel: "Nazwa wyświetlana (opcjonalnie)",
    displayNameHelp: "Używana w transakcyjnych e-mailach.",
    saveButton: "Zapisz zmiany",
    savingButton: "Zapisuję…",
    saveSuccess: "Zapisano.",
    saveError: "Nie udało się zapisać zmian."
  }
};

beforeEach(() => {
  updateProfileMock.mockReset();
});

describe("<ProfileSection>", () => {
  it("renders email as immutable monospace with help text", () => {
    render(<ProfileSection {...baseProps} />);
    expect(screen.getByText("user@firma.pl")).toBeInTheDocument();
    expect(screen.getByText(/E-mail logowania nie można zmienić/i)).toBeInTheDocument();
  });

  it("renders locale toggle preselected to PL", () => {
    render(<ProfileSection {...baseProps} />);
    const pl = screen.getByRole("radio", { name: /pl/i }) as HTMLInputElement;
    expect(pl.checked).toBe(true);
  });

  it("renders display-name field preloaded with the initial value", () => {
    render(<ProfileSection {...baseProps} />);
    const input = screen.getByLabelText(/Nazwa wyświetlana/i) as HTMLInputElement;
    expect(input.value).toBe("Jan Kowalski");
  });

  it("calls updateProfile with new locale + displayName on submit", async () => {
    updateProfileMock.mockResolvedValue({ ok: true });
    render(<ProfileSection {...baseProps} />);
    fireEvent.click(screen.getByRole("radio", { name: /en/i }));
    fireEvent.change(screen.getByLabelText(/Nazwa wyświetlana/i), {
      target: { value: "Anna Nowak" }
    });
    fireEvent.click(screen.getByRole("button", { name: /Zapisz zmiany/i }));

    await waitFor(() => {
      expect(updateProfileMock).toHaveBeenCalledWith({
        locale: "en",
        displayName: "Anna Nowak"
      });
    });
    await waitFor(() => {
      expect(screen.getByText(/Zapisano/)).toBeInTheDocument();
    });
  });

  it("shows error message on failure", async () => {
    updateProfileMock.mockResolvedValue({ ok: false, error: "boom" });
    render(<ProfileSection {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Zapisz zmiany/i }));
    await waitFor(() => {
      expect(screen.getByText(/Nie udało się zapisać zmian/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 4: Run-fail**

```bash
npm test -- --run tests/components/account/profile-section.test.tsx
```

- [ ] **Step 5: Create the component**

`components/account/profile-section.tsx`:

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { updateProfile } from "@/app/actions/profile";

export interface ProfileSectionLabels {
  heading: string;
  emailLabel: string;
  emailHelp: string;
  localeLabel: string;
  displayNameLabel: string;
  displayNameHelp: string;
  saveButton: string;
  savingButton: string;
  saveSuccess: string;
  saveError: string;
}

export interface ProfileSectionProps {
  email: string;
  initialLocale: "pl" | "en";
  initialDisplayName: string;
  labels: ProfileSectionLabels;
}

type Status = "idle" | "saving" | "saved" | "error";

export function ProfileSection({ email, initialLocale, initialDisplayName, labels }: ProfileSectionProps) {
  const [locale, setLocale] = useState<"pl" | "en">(initialLocale);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [status, setStatus] = useState<Status>("idle");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    const result = await updateProfile({ locale, displayName });
    if (result.ok) {
      setStatus("saved");
    } else {
      setStatus("error");
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-h2 text-text-strong">{labels.heading}</h2>

      <div className="mt-6 space-y-5">
        <div>
          <label className="text-small font-medium text-text">{labels.emailLabel}</label>
          <p className="mt-1 font-mono text-body text-text-strong">{email}</p>
          <p className="mt-1 text-micro text-text-muted">{labels.emailHelp}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <fieldset>
            <legend className="text-small font-medium text-text">{labels.localeLabel}</legend>
            <div className="mt-2 inline-flex rounded-md border border-border bg-surface">
              {(["pl", "en"] as const).map((value) => (
                <label
                  key={value}
                  className={`cursor-pointer px-4 py-2 text-small font-medium uppercase ${
                    locale === value ? "bg-accent text-white" : "text-text"
                  }`}
                >
                  <input
                    type="radio"
                    name="locale"
                    value={value}
                    checked={locale === value}
                    onChange={() => setLocale(value)}
                    className="sr-only"
                  />
                  {value}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex flex-col gap-1.5 text-small">
            <span className="font-medium text-text">{labels.displayNameLabel}</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="h-11 rounded-md border border-border bg-surface px-4 text-body text-text-strong outline-none transition-colors duration-hover ease-out focus:border-accent focus:ring-2 focus:ring-accent-soft"
            />
            <span className="text-micro text-text-muted">{labels.displayNameHelp}</span>
          </label>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={status === "saving"}
              className="inline-flex h-10 items-center justify-center rounded-md bg-accent px-5 text-small font-semibold text-white shadow-sm transition-colors duration-hover ease-out hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "saving" ? labels.savingButton : labels.saveButton}
            </button>
            {status === "saved" ? <span className="text-small text-success">{labels.saveSuccess}</span> : null}
            {status === "error" ? <span className="text-small text-danger">{labels.saveError}</span> : null}
          </div>
        </form>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Run-pass**

```bash
npm test -- --run tests/components/account/profile-section.test.tsx
```

Expected: 5/5 passing.

- [ ] **Step 7: Commit**

```bash
git add components/account/profile-section.tsx app/actions/profile.ts tests/components/account/profile-section.test.tsx lib/workspace/copy.ts
git commit -m "feat(account): ProfileSection — editable locale + display name with server action"
```

---

## Task 8: `<DataExportSection>` — RODO download button

**Files:**
- Create: `components/account/data-export-section.tsx`
- Test: `tests/components/account/data-export-section.test.tsx`

Client component. Single button → POST `/api/me/export` → triggers a blob download.

- [ ] **Step 1: Test**

`tests/components/account/data-export-section.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DataExportSection } from "@/components/account/data-export-section";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  // jsdom: stub createObjectURL + revokeObjectURL
  if (!("createObjectURL" in URL)) {
    Object.defineProperty(URL, "createObjectURL", { value: vi.fn(() => "blob:mock"), configurable: true });
  }
  if (!("revokeObjectURL" in URL)) {
    Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true });
  }
  fetchMock.mockReset();
});

const labels = {
  heading: "Eksport danych (RODO)",
  body: "Pobierz pełny eksport swoich danych w formacie JSON.",
  button: "Pobierz dane (JSON)",
  preparing: "Przygotowuję…"
};

describe("<DataExportSection>", () => {
  it("renders the heading + body + button", () => {
    render(<DataExportSection labels={labels} />);
    expect(screen.getByRole("heading", { name: /Eksport danych/i })).toBeInTheDocument();
    expect(screen.getByText(/Pobierz pełny eksport/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pobierz dane/i })).toBeInTheDocument();
  });

  it("POSTs to /api/me/export and shows preparing state during fetch", async () => {
    let resolveFetch!: (value: unknown) => void;
    const pending = new Promise<unknown>((r) => {
      resolveFetch = r;
    });
    fetchMock.mockReturnValue(pending);

    render(<DataExportSection labels={labels} />);
    fireEvent.click(screen.getByRole("button", { name: /Pobierz dane/i }));

    await waitFor(() => {
      expect(screen.getByText(/Przygotowuję/i)).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/me/export", expect.objectContaining({ method: "POST" }));

    // Complete the fetch
    resolveFetch({
      ok: true,
      blob: async () => new Blob(["{}"], { type: "application/json" })
    });
    await waitFor(() => {
      expect(screen.queryByText(/Przygotowuję/i)).not.toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run-fail**

```bash
npm test -- --run tests/components/account/data-export-section.test.tsx
```

- [ ] **Step 3: Create the component**

`components/account/data-export-section.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

export interface DataExportLabels {
  heading: string;
  body: string;
  button: string;
  preparing: string;
}

export interface DataExportSectionProps {
  labels: DataExportLabels;
}

export function DataExportSection({ labels }: DataExportSectionProps) {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      const res = await fetch("/api/me/export", { method: "POST" });
      if (!res.ok) {
        console.warn("[export] non-OK response", res.status);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tlumaczksef-export-${Date.now()}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h2 className="text-h2 text-text-strong">{labels.heading}</h2>
      <p className="mt-2 text-body text-text-muted">{labels.body}</p>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-accent px-5 text-small font-semibold text-white shadow-sm transition-colors duration-hover ease-out hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {busy ? labels.preparing : labels.button}
      </button>
    </section>
  );
}
```

- [ ] **Step 4: Run-pass**

```bash
npm test -- --run tests/components/account/data-export-section.test.tsx
```

Expected: 2/2 passing.

- [ ] **Step 5: Commit**

```bash
git add components/account/data-export-section.tsx tests/components/account/data-export-section.test.tsx
git commit -m "feat(account): DataExportSection — POST /api/me/export + blob download"
```

---

## Task 9: `<DeleteAccountModal>` — confirm-by-typing-email modal

**Files:**
- Create: `components/account/delete-account-modal.tsx`
- Test: `tests/components/account/delete-account-modal.test.tsx`

Modal-style confirmation: user must type their email exactly to enable the destructive button. On confirm, calls `DELETE /api/me/account`. On success, redirects to `/`.

- [ ] **Step 1: Test**

`tests/components/account/delete-account-modal.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DeleteAccountModal } from "@/components/account/delete-account-modal";

const fetchMock = vi.fn();
const locationAssign = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  // jsdom doesn't allow re-assigning window.location, but we can stub assign().
  Object.defineProperty(window, "location", {
    value: { ...window.location, assign: locationAssign, href: "" },
    writable: true,
    configurable: true
  });
  fetchMock.mockReset();
  locationAssign.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const labels = {
  title: "Potwierdź usunięcie konta",
  body: "Wpisz swój adres e-mail, aby potwierdzić.",
  placeholder: "Wpisz adres e-mail",
  confirmAction: "Tak, usuń trwale moje konto",
  cancel: "Anuluj"
};

describe("<DeleteAccountModal>", () => {
  it("renders title + body + cancel + disabled confirm button initially", () => {
    render(
      <DeleteAccountModal
        open={true}
        email="user@firma.pl"
        onClose={vi.fn()}
        labels={labels}
      />
    );
    expect(screen.getByRole("heading", { name: /Potwierdź usunięcie konta/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Anuluj/i })).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: /Tak, usuń trwale/i });
    expect(confirm).toBeDisabled();
  });

  it("enables the confirm button only when the typed email matches", () => {
    render(
      <DeleteAccountModal
        open={true}
        email="user@firma.pl"
        onClose={vi.fn()}
        labels={labels}
      />
    );
    const input = screen.getByPlaceholderText(/Wpisz adres e-mail/i);
    const confirm = screen.getByRole("button", { name: /Tak, usuń trwale/i });

    fireEvent.change(input, { target: { value: "user@WRONG.pl" } });
    expect(confirm).toBeDisabled();

    fireEvent.change(input, { target: { value: "user@firma.pl" } });
    expect(confirm).not.toBeDisabled();
  });

  it("calls DELETE /api/me/account and redirects on success", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204 });
    render(
      <DeleteAccountModal
        open={true}
        email="user@firma.pl"
        onClose={vi.fn()}
        labels={labels}
      />
    );
    fireEvent.change(screen.getByPlaceholderText(/Wpisz adres e-mail/i), {
      target: { value: "user@firma.pl" }
    });
    fireEvent.click(screen.getByRole("button", { name: /Tak, usuń trwale/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/me/account",
        expect.objectContaining({
          method: "DELETE",
          body: JSON.stringify({ confirmEmail: "user@firma.pl" })
        })
      );
    });
    await waitFor(() => {
      expect(locationAssign).toHaveBeenCalledWith("/");
    });
  });

  it("does not render when open=false", () => {
    const { container } = render(
      <DeleteAccountModal
        open={false}
        email="user@firma.pl"
        onClose={vi.fn()}
        labels={labels}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("calls onClose when cancel is clicked", () => {
    const onClose = vi.fn();
    render(
      <DeleteAccountModal
        open={true}
        email="user@firma.pl"
        onClose={onClose}
        labels={labels}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Anuluj/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run-fail**

```bash
npm test -- --run tests/components/account/delete-account-modal.test.tsx
```

- [ ] **Step 3: Create**

`components/account/delete-account-modal.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export interface DeleteAccountModalLabels {
  title: string;
  body: string;
  placeholder: string;
  confirmAction: string;
  cancel: string;
}

export interface DeleteAccountModalProps {
  open: boolean;
  email: string;
  onClose: () => void;
  labels: DeleteAccountModalLabels;
}

export function DeleteAccountModal({ open, email, onClose, labels }: DeleteAccountModalProps) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  async function confirm() {
    setBusy(true);
    try {
      const res = await fetch("/api/me/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: typed })
      });
      if (res.ok) {
        window.location.assign("/");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-text-strong/40 p-4"
    >
      <div className="w-full max-w-md rounded-xl border border-danger/30 bg-surface p-6 shadow-lg">
        <h2 id="delete-account-title" className="text-h3 text-text-strong">
          {labels.title}
        </h2>
        <p className="mt-2 text-small text-text">{labels.body}</p>
        <input
          type="email"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={labels.placeholder}
          className="mt-4 h-11 w-full rounded-md border border-border bg-surface px-4 text-body text-text-strong outline-none focus:border-danger focus:ring-2 focus:ring-danger/20"
        />
        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-surface px-4 text-small font-medium text-text hover:bg-surface-muted"
          >
            {labels.cancel}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!matches || busy}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-danger px-4 text-small font-semibold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {labels.confirmAction}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run-pass**

```bash
npm test -- --run tests/components/account/delete-account-modal.test.tsx
```

Expected: 5/5 passing.

- [ ] **Step 5: Commit**

```bash
git add components/account/delete-account-modal.tsx tests/components/account/delete-account-modal.test.tsx
git commit -m "feat(account): DeleteAccountModal — type-email-to-confirm + DELETE /api/me/account"
```

---

## Task 10: `<DangerZone>` wrapper + rebuild `/account` page

**Files:**
- Create: `components/account/danger-zone.tsx`
- Modify: `app/(protected)/account/page.tsx`

DangerZone wraps the DeleteAccountModal trigger. The account page composes ProfileSection + DataExportSection + DangerZone.

- [ ] **Step 1: Create `components/account/danger-zone.tsx`**

```tsx
"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { DeleteAccountModal, type DeleteAccountModalLabels } from "@/components/account/delete-account-modal";

export interface DangerZoneLabels {
  heading: string;
  deleteTitle: string;
  deleteBody: string;
  deleteButton: string;
  modal: DeleteAccountModalLabels;
}

export interface DangerZoneProps {
  email: string;
  labels: DangerZoneLabels;
}

export function DangerZone({ email, labels }: DangerZoneProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <section className="rounded-xl border border-danger/30 bg-surface p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-1 h-5 w-5 shrink-0 text-danger" aria-hidden="true" />
        <div className="flex-1">
          <h2 className="text-h2 text-danger">{labels.heading}</h2>
        </div>
      </div>
      <div className="mt-6 rounded-lg border border-border bg-surface-muted p-4">
        <p className="text-body font-medium text-text-strong">{labels.deleteTitle}</p>
        <p className="mt-1 text-small text-text-muted">{labels.deleteBody}</p>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="mt-4 inline-flex h-10 items-center justify-center rounded-md border border-danger bg-surface px-5 text-small font-semibold text-danger hover:bg-danger hover:text-white"
        >
          {labels.deleteButton}
        </button>
      </div>
      <DeleteAccountModal
        open={modalOpen}
        email={email}
        onClose={() => setModalOpen(false)}
        labels={labels.modal}
      />
    </section>
  );
}
```

- [ ] **Step 2: Replace `app/(protected)/account/page.tsx`**

```tsx
import { requireUser } from "@/lib/auth/require-user";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { ProfileSection } from "@/components/account/profile-section";
import { DataExportSection } from "@/components/account/data-export-section";
import { DangerZone } from "@/components/account/danger-zone";
import { copy } from "@/lib/workspace/copy";

export default async function AccountPage() {
  const user = await requireUser();
  const { uiLanguage } = await getCurrentProfile(user.id);

  const admin = getSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("display_name, locale")
    .eq("id", user.id)
    .single();

  const t = copy[uiLanguage];

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-h1 text-text-strong">{String(t.accountTitle)}</h1>

      <ProfileSection
        email={user.email ?? ""}
        initialLocale={uiLanguage}
        initialDisplayName={profile?.display_name ?? ""}
        labels={{
          heading: String(t.accountProfileHeading),
          emailLabel: String(t.accountEmailLabel),
          emailHelp: String(t.accountEmailHelp),
          localeLabel: String(t.accountLocaleLabel),
          displayNameLabel: String(t.accountDisplayNameLabel),
          displayNameHelp: String(t.accountDisplayNameHelp),
          saveButton: String(t.accountSaveButton),
          savingButton: String(t.accountSavingButton),
          saveSuccess: String(t.accountSaveSuccess),
          saveError: String(t.accountSaveError)
        }}
      />

      <DataExportSection
        labels={{
          heading: String(t.accountExportHeading),
          body: String(t.accountExportBody),
          button: String(t.accountExportButton),
          preparing: String(t.accountExportPreparing)
        }}
      />

      <DangerZone
        email={user.email ?? ""}
        labels={{
          heading: String(t.accountDangerHeading),
          deleteTitle: String(t.accountDeleteAccountTitle),
          deleteBody: String(t.accountDeleteAccountBody),
          deleteButton: String(t.accountDeleteAccountButton),
          modal: {
            title: String(t.accountDeleteConfirmTitle),
            body: String(t.accountDeleteConfirmBody),
            placeholder: String(t.accountDeleteConfirmPlaceholder),
            confirmAction: String(t.accountDeleteConfirmAction),
            cancel: String(t.accountDeleteCancel)
          }
        }}
      />
    </section>
  );
}
```

- [ ] **Step 3: Typecheck + build**

```bash
npm run typecheck && npm run build 2>&1 | tail -10
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add components/account/danger-zone.tsx 'app/(protected)/account/page.tsx'
git commit -m "feat(account): rebuild /account with Profile + Export + DangerZone"
```

---

## Task 11: `<CreditPurchaseDrawer>` slide-in panel

**Files:**
- Create: `components/billing/credit-purchase-drawer.tsx`
- Test: `tests/components/billing/credit-purchase-drawer.test.tsx`

Slide-in panel (400 px from the right) hosting the existing `<CreditSlider>`. Listens for `open-credit-drawer` custom events. Closes via X button or Escape.

- [ ] **Step 1: Test**

`tests/components/billing/credit-purchase-drawer.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { CreditPurchaseDrawer } from "@/components/billing/credit-purchase-drawer";

const sliderLabels = {
  pickPackageLabel: "Wybierz pakiet",
  unitPriceLabel: "za fakturę (netto)",
  totalLabel: "Razem (netto)",
  totalWithTaxLabel: "Z 23% VAT",
  continueLabel: "Przejdź do płatności"
};

const drawerLabels = {
  title: "Doładuj kredyty",
  closeLabel: "Zamknij"
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

describe("<CreditPurchaseDrawer>", () => {
  it("does not render content when closed", () => {
    const { container } = render(<CreditPurchaseDrawer sliderLabels={sliderLabels} labels={drawerLabels} />);
    // Drawer is always mounted but content area is hidden until open.
    expect(container.querySelector('[data-drawer-open="true"]')).toBeNull();
  });

  it("opens when 'open-credit-drawer' event fires", () => {
    render(<CreditPurchaseDrawer sliderLabels={sliderLabels} labels={drawerLabels} />);
    act(() => {
      window.dispatchEvent(new CustomEvent("open-credit-drawer"));
    });
    expect(document.querySelector('[data-drawer-open="true"]')).not.toBeNull();
    expect(screen.getByRole("heading", { name: /Doładuj kredyty/i })).toBeInTheDocument();
  });

  it("closes when the X button is clicked", () => {
    render(<CreditPurchaseDrawer sliderLabels={sliderLabels} labels={drawerLabels} />);
    act(() => {
      window.dispatchEvent(new CustomEvent("open-credit-drawer"));
    });
    fireEvent.click(screen.getByRole("button", { name: /Zamknij/i }));
    expect(document.querySelector('[data-drawer-open="true"]')).toBeNull();
  });

  it("renders the CreditSlider inside the drawer when open", () => {
    render(<CreditPurchaseDrawer sliderLabels={sliderLabels} labels={drawerLabels} />);
    act(() => {
      window.dispatchEvent(new CustomEvent("open-credit-drawer"));
    });
    // CreditSlider exposes the slider control
    expect(screen.getByRole("slider")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run-fail**

```bash
npm test -- --run tests/components/billing/credit-purchase-drawer.test.tsx
```

- [ ] **Step 3: Create**

`components/billing/credit-purchase-drawer.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { CreditSlider } from "@/components/billing/credit-slider";

export interface CreditSliderLabels {
  pickPackageLabel: string;
  unitPriceLabel: string;
  totalLabel: string;
  totalWithTaxLabel: string;
  continueLabel: string;
}

export interface CreditPurchaseDrawerLabels {
  title: string;
  closeLabel: string;
}

export interface CreditPurchaseDrawerProps {
  sliderLabels: CreditSliderLabels;
  labels: CreditPurchaseDrawerLabels;
}

export function CreditPurchaseDrawer({ sliderLabels, labels }: CreditPurchaseDrawerProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("open-credit-drawer", onOpen);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("open-credit-drawer", onOpen);
      window.removeEventListener("keydown", onEsc);
    };
  }, []);

  if (!open) return null;

  return (
    <>
      <div
        onClick={() => setOpen(false)}
        className="fixed inset-0 z-40 bg-text-strong/30 backdrop-blur-sm"
        aria-hidden="true"
      />
      <aside
        data-drawer-open="true"
        role="dialog"
        aria-modal="true"
        aria-labelledby="credit-drawer-title"
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-surface shadow-lg"
      >
        <header className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 id="credit-drawer-title" className="text-h3 text-text-strong">
            {labels.title}
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={labels.closeLabel}
            className="rounded-md p-2 text-text-muted hover:bg-surface-muted hover:text-text-strong"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-6">
          <CreditSlider
            pickPackageLabel={sliderLabels.pickPackageLabel}
            unitPriceLabel={sliderLabels.unitPriceLabel}
            totalLabel={sliderLabels.totalLabel}
            totalWithTaxLabel={sliderLabels.totalWithTaxLabel}
            continueLabel={sliderLabels.continueLabel}
          />
        </div>
      </aside>
    </>
  );
}
```

- [ ] **Step 4: Run-pass**

```bash
npm test -- --run tests/components/billing/credit-purchase-drawer.test.tsx
```

Expected: 4/4 passing.

- [ ] **Step 5: Commit**

```bash
git add components/billing/credit-purchase-drawer.tsx tests/components/billing/credit-purchase-drawer.test.tsx
git commit -m "feat(billing): CreditPurchaseDrawer — slide-in panel hosting CreditSlider"
```

---

## Task 12: Wire drawer + update Banner + Modal CTAs

**Files:**
- Modify: `app/(protected)/layout.tsx` — mount `<CreditPurchaseDrawer>`
- Modify: `components/billing/low-balance-banner.tsx` — change CTA from Link to button + dispatch event
- Modify: `components/workspace/insufficient-credit-modal.tsx` — same CTA change
- Modify: `tests/components/billing/low-balance-banner.test.tsx` — update CTA assertions

Drawer mounts globally in protected layout. Banner + modal CTAs become buttons that dispatch `open-credit-drawer` instead of navigating to /billing.

- [ ] **Step 1: Add drawer labels to copy**

In `lib/workspace/copy.ts`, PL block:
```typescript
    drawerTitle: "Doładuj kredyty",
```

EN block:
```typescript
    drawerTitle: "Top up credits",
```

(`close` for the closeLabel already exists in copy.)

- [ ] **Step 2: Mount drawer in protected layout**

Open `app/(protected)/layout.tsx`. Add the import:

```typescript
import { CreditPurchaseDrawer } from "@/components/billing/credit-purchase-drawer";
```

Add the mount before the closing `</div>` of the root container, after `<LegalFooter>`:

```tsx
      <LegalFooter locale={uiLanguage} />
      <CreditPurchaseDrawer
        sliderLabels={{
          pickPackageLabel: String(t.pickPackage),
          unitPriceLabel: String(t.unitPrice),
          totalLabel: String(t.total),
          totalWithTaxLabel: String(t.totalWithTax),
          continueLabel: String(t.continueToCheckout)
        }}
        labels={{
          title: String(t.drawerTitle),
          closeLabel: String(t.close)
        }}
      />
```

- [ ] **Step 3: Update `components/billing/low-balance-banner.tsx`**

Find the CTA that currently renders `<Link href="/billing">{buyLabel}</Link>`. Replace with:

```tsx
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("open-credit-drawer"));
            }
          }}
          className="inline-flex h-9 items-center rounded-md bg-amber-900 px-4 text-sm font-semibold text-white hover:bg-amber-950"
        >
          {buyLabel}
        </button>
```

Keep all other props/classes unchanged. The `closeLabel` button remains untouched.

- [ ] **Step 4: Update `tests/components/billing/low-balance-banner.test.tsx`**

The existing test "has a buy-credits link pointing at /billing" must change. Replace it with:

```tsx
  it("has a buy-credits button that dispatches open-credit-drawer", () => {
    const dispatch = vi.fn();
    const original = window.dispatchEvent;
    window.dispatchEvent = dispatch as typeof window.dispatchEvent;
    render(<LowBalanceBanner {...baseProps} />);
    const button = screen.getByRole("button", { name: /Buy credits/i });
    fireEvent.click(button);
    expect(dispatch).toHaveBeenCalled();
    const event = dispatch.mock.calls.find(([e]) => (e as CustomEvent).type === "open-credit-drawer");
    expect(event).toBeDefined();
    window.dispatchEvent = original;
  });
```

Note: the test was `screen.getByRole("link", { name: /Buy credits/i })`. Change to `getByRole("button", ...)`.

Also add `vi` to the imports at the top of the file if not already there:
```tsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
```

- [ ] **Step 5: Update `components/workspace/insufficient-credit-modal.tsx`**

Find the CTA that links to /billing. Same change — replace `<Link>` with `<button>` that dispatches the event. Keep all classes / aria intact. Also close the modal after dispatching so the drawer is the visible surface:

```tsx
        <button
          type="button"
          onClick={() => {
            onClose();
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("open-credit-drawer"));
            }
          }}
          className="inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-900"
        >
          {buyLabel}
        </button>
```

- [ ] **Step 6: Update existing E2E that asserts the modal's buy-link points to /billing**

There's an existing E2E test in `tests/e2e/credit-enforcement.spec.ts` that asserts:
```ts
const buy = page.getByRole("dialog").getByRole("link", { name: /Kup pakiet|Buy credits/i });
await expect(buy).toHaveAttribute("href", "/billing");
```

Change to:
```ts
const buy = page.getByRole("dialog").getByRole("button", { name: /Kup pakiet|Buy credits/i });
await expect(buy).toBeVisible();
```

(We can't easily test the drawer-open behavior in this existing E2E without major rework — just verify the button exists. Task 13 adds dedicated drawer E2E.)

Also there's `tests/e2e/app-ux-redesign.spec.ts` test "zero-balance shows the proactive banner with a Buy credits link" which asserts the banner's "Kup pakiet" link goes to /billing. Update similarly:
```ts
  const buy = banner.getByRole("button", { name: /Kup pakiet|Buy credits/i });
  await expect(buy).toBeVisible();
```

- [ ] **Step 7: Run all affected tests**

```bash
npm test -- --run components/billing/low-balance-banner components/workspace/insufficient-credit-modal 2>&1 | tail -10
npm run typecheck 2>&1 | tail -5
tmux kill-session -t dev 2>/dev/null
npm run test:e2e -- credit-enforcement app-ux-redesign 2>&1 | tail -10
```

Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add 'app/(protected)/layout.tsx' components/billing/low-balance-banner.tsx components/workspace/insufficient-credit-modal.tsx tests/components/billing/low-balance-banner.test.tsx tests/e2e/credit-enforcement.spec.ts tests/e2e/app-ux-redesign.spec.ts lib/workspace/copy.ts
git commit -m "feat(billing): wire inline drawer + update Banner/Modal CTAs to dispatch event"
```

---

## Task 13: E2E coverage for Sprint 4 features

**Files:**
- Create: `tests/e2e/sprint-4-billing-account.spec.ts`

Five E2E tests covering: billing stat band, /account profile + export visible, danger zone modal flow (without actually deleting), drawer opens from banner, drawer renders slider.

- [ ] **Step 1: Create the spec**

```typescript
import { admin, expect, signIn, test } from "./helpers/auth";

test("billing page shows the new stat band + slider + included list", async ({ page, testUser }) => {
  await signIn(page, testUser.email);
  await page.goto("/billing");
  // Stat band: tabular paid credits + free credit sub-row + next refresh date
  await expect(page.getByText(/kredytów/i).first()).toBeVisible();
  await expect(page.getByText(/Następne darmowe odnowienie/i)).toBeVisible();
  // Slider
  await expect(page.locator("#slider")).toBeVisible();
  // Included list
  await expect(page.getByRole("heading", { name: /Co dostajesz w cenie/i })).toBeVisible();
  // VAT note at bottom
  await expect(page.getByText(/Ceny netto/i)).toBeVisible();
});

test("/account renders profile + export + danger zone sections", async ({ page, testUser }) => {
  await signIn(page, testUser.email);
  await page.goto("/account");
  await expect(page.getByRole("heading", { level: 1, name: /Konto/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Profil/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Eksport danych/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Strefa niebezpieczna/i })).toBeVisible();
  // Email is shown in monospace
  await expect(page.getByText(testUser.email)).toBeVisible();
});

test("danger zone opens delete-account modal but cancel returns safely", async ({ page, testUser }) => {
  await signIn(page, testUser.email);
  await page.goto("/account");
  const deleteBtn = page.getByRole("button", { name: /Usuń konto/i }).first();
  await deleteBtn.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Potwierdź usunięcie konta/i })).toBeVisible();
  // Cancel — modal closes, no deletion
  await page.getByRole("button", { name: /Anuluj/i }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("low-balance banner's Buy button opens the credit drawer", async ({ page, testUser }) => {
  // Drain credits so banner shows.
  await admin.rpc("ensure_free_credit_for_period", { p_user: testUser.userId });
  await admin
    .from("credit_balances")
    .update({ free_credits_remaining: 0, paid_credits: 0 })
    .eq("user_id", testUser.userId);
  await signIn(page, testUser.email);

  const banner = page.getByRole("status");
  await expect(banner).toBeVisible();
  const buy = banner.getByRole("button", { name: /Kup pakiet/i });
  await buy.click();
  // Drawer should now be visible with the slider inside.
  await expect(page.locator("[data-drawer-open='true']")).toBeVisible();
  await expect(page.locator("[data-drawer-open='true']").getByRole("slider")).toBeVisible();
});

test("credit drawer closes via X button", async ({ page, testUser }) => {
  await admin.rpc("ensure_free_credit_for_period", { p_user: testUser.userId });
  await admin
    .from("credit_balances")
    .update({ free_credits_remaining: 0, paid_credits: 0 })
    .eq("user_id", testUser.userId);
  await signIn(page, testUser.email);

  await page.getByRole("status").getByRole("button", { name: /Kup pakiet/i }).click();
  await expect(page.locator("[data-drawer-open='true']")).toBeVisible();

  await page.getByRole("button", { name: /Zamknij/i }).click();
  await expect(page.locator("[data-drawer-open='true']")).not.toBeVisible();
});
```

- [ ] **Step 2: Run**

```bash
tmux kill-session -t dev 2>/dev/null
npm run test:e2e -- sprint-4-billing-account 2>&1 | tail -15
```

Expected: 5/5 passing.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/sprint-4-billing-account.spec.ts
git commit -m "test(e2e): sprint 4 billing + account + drawer flows"
```

---

## Task 14: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 2: Unit + integration tests**

```bash
tmux kill-session -t dev 2>/dev/null
tmux new-session -d -s dev "npx next dev"
sleep 8 && curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/
npm test -- --run 2>&1 | tail -10
tmux kill-session -t dev 2>/dev/null
```

Expected: all pass except the two pre-existing OpenAI flakes that have been failing since Sprint 1.

- [ ] **Step 3: Full E2E**

```bash
tmux kill-session -t dev 2>/dev/null
npm run test:e2e 2>&1 | tail -25
```

Expected: 28 baseline (Sprints 1-3) + 5 new sprint-4 = 33 passing.

- [ ] **Step 4: Build**

```bash
npm run build 2>&1 | tail -20
```

Expected: clean. Routes summary shows all new endpoints (`/api/me/export`, `/api/me/account`).

- [ ] **Step 5: Manual visual smoke**

```bash
tmux kill-session -t dev 2>/dev/null
tmux new-session -d -s dev "npx next dev"
sleep 6
```

Browser checks:
- `http://localhost:3000/billing` after sign-in: big stat band with paid credits, restyled slider, included list, restyled history
- `http://localhost:3000/account`: profile section editable (change locale, change display name, click Save → "Zapisano"), export button (download triggers a JSON), danger zone with red border
- Click delete account → modal appears → type wrong email → button disabled → type correct email → button enables → cancel returns
- On any /app page with zero balance: click "Kup pakiet" in banner → drawer slides in from right with the slider inside

```bash
tmux kill-session -t dev 2>/dev/null
```

- [ ] **Step 6: No commit — verification task only**

---

## After this plan

Sprint 4 lands ~16 commits on `claude/ui-overhaul-sprint-1`. After verification, the branch is ready for the FINAL code review across all 4 sprints + PR #12 title update from "Sprint 1 — foundation" to "feat: total UI/UX overhaul (Sprints 1-4)".

## Explicit deferrals (NOT in Sprint 4)

- **Row click loads invoice in workspace.** History rows still navigate to `/app`. Loading a specific invoice into the workspace requires lifting initial state into the hook — punted post-launch.
- **Bulk actions on history.** Download-all-ZIP and CSV-export require backend work that isn't pure UI.
- **Mobile hamburger sheet.** Sidebar still `hidden md:flex`. Mobile users get single column.
- **Notification preferences UI.** Designed in spec but no UI built (toggles for receipts, monthly summary, account changes).
- **Active sessions UI.** Designed in spec but no UI built (revoke other sessions).
- **Sort by column on history.** Default date-desc; sort dropdown deferred.
- **Status filter on history.** Filter by "translated/not" deferred.

These can be addressed in a Sprint 5 "polish" pass post-launch if business demand warrants.
