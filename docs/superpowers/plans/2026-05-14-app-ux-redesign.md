# KSeF SaaS — `/app` UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the authenticated `/app` workspace so users can top up credits in one click, start a new invoice in one click, and switch between translated languages with cached state visible — addressing the seven UX issues called out in `docs/superpowers/specs/2026-05-14-app-ux-redesign.md`.

**Architecture:** The current monolithic `<TranslatorWorkspace>` splits into focused sub-components (empty state, invoice view, sticky bottom toolbar). The workflow hook lifts `currentLanguage` and `bilingual` out of the page component and gains `cachedLanguages` (a `Set<LanguageCode>` tracking which translations have been done this session). A new `<LanguagePills>` component replaces the language `<select>` and surfaces cached-state via checkmarks. The `<BalanceChip>` becomes a link to `/billing` with an amber zero-balance variant. A new `<LowBalanceBanner>` renders above the workspace when both balances are zero. No API contract changes; no SQL migrations.

**Tech Stack:** Next.js 15 App Router (existing), React 19 client components, `lucide-react` icons, Tailwind, shadcn-style local `Button` primitive, Vitest + `@testing-library/react` under jsdom for component tests (`tests/components/**`), Playwright for E2E updates.

---

## File Structure

### New files
- `components/billing/low-balance-banner.tsx` — client component, sessionStorage-dismissable banner shown when balance is zero
- `components/workspace/language-pills.tsx` — horizontal language picker with cached-state checkmarks + "+" overflow
- `components/workspace/workspace-empty-state.tsx` — drop zone + onboarding side panel
- `components/workspace/workspace-invoice-view.tsx` — invoice preview wrapper that mounts the sticky toolbar
- `components/workspace/workspace-toolbar.tsx` — sticky bottom action bar (language pills, bilingual, Download, New invoice)
- `tests/components/billing/balance-chip.test.tsx`
- `tests/components/billing/low-balance-banner.test.tsx`
- `tests/components/workspace/language-pills.test.tsx`
- `tests/components/workspace/use-translator-workflow.test.tsx`
- `tests/e2e/app-ux-redesign.spec.ts`

### Modified files
- `components/billing/balance-chip.tsx` — wrap in `<Link>`, add zero-balance amber variant
- `components/workspace/use-translator-workflow.ts` — lift `currentLanguage` + `bilingual`, add `cachedLanguages`, `setCurrentLanguage`
- `components/workspace/translator-workspace.tsx` — slim down to orchestrator
- `app/(protected)/layout.tsx` — pass balance values to `<BalanceChip>` (no shape change beyond accepting initial values it already gets)
- `app/(protected)/app/page.tsx` — wrap workspace in a fragment with `<LowBalanceBanner>` above it; pass `uiLanguage` + initial balance for the banner
- `lib/workspace/copy.ts` — new PL/EN copy keys
- `tests/e2e/workspace.spec.ts` — update selectors for the new toolbar

### Files NOT touched
- API routes (`/api/upload`, `/api/translate`, `/api/pdf`, `/api/me/balance`) — no contract changes.
- SQL schema — no migrations needed.
- `lib/translation/languages.ts` — read-only consumer.
- `components/invoice-preview.tsx` — embedded as-is.

---

## Tasks

### Task 1: Copy strings (PL + EN)

**Files:**
- Modify: `lib/workspace/copy.ts`

- [ ] **Step 1: Add new keys to both locale blocks**

Open `lib/workspace/copy.ts`. Both `pl` and `en` objects need new entries appended at the end of each block (after the existing Phase 4 billing copy entries, before the closing `}` of that locale).

For `pl`:

```ts
    topUp: "Doładuj",
    creditsExhaustedShort: "Brak kredytów",
    lowBalanceBannerTitle: "Brak kredytów",
    lowBalanceBannerBody:
      "Wykorzystałeś darmową fakturę w tym miesiącu i nie masz pakietu kredytów. Kup pakiet, aby przesłać kolejną fakturę.",
    newInvoice: "Nowa faktura",
    tryWithSample: "Spróbuj z przykładową fakturą",
    onboardingTitle: "Co dostajesz",
    onboardingItem1: "1 darmowa faktura w miesiącu",
    onboardingItem2: "Tłumaczenie do 20+ języków",
    onboardingItem3: "Dwujęzyczny PDF z kodem QR KSeF",
    onboardingItem4: "Bez logowania do KSeF, bez integracji",
    cached: "zapisane",
    moreLanguages: "Więcej języków"
```

For `en`:

```ts
    topUp: "Top up",
    creditsExhaustedShort: "Out of credits",
    lowBalanceBannerTitle: "Out of credits",
    lowBalanceBannerBody:
      "You have used your free invoice this month and have no credit pack. Buy a pack to upload another invoice.",
    newInvoice: "New invoice",
    tryWithSample: "Try with sample invoice",
    onboardingTitle: "What you get",
    onboardingItem1: "1 free invoice per month",
    onboardingItem2: "Translation to 20+ languages",
    onboardingItem3: "Bilingual PDF with KSeF QR",
    onboardingItem4: "No KSeF login, no integration required",
    cached: "cached",
    moreLanguages: "More languages"
```

Match existing indent + double-quote style. The last existing entry in each block (`paymentCancelledBody` from Phase 4) needs a trailing comma added if missing.

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/workspace/copy.ts
git commit -m "feat(workspace): add UX redesign copy (PL + EN)"
```

---

### Task 2: `<BalanceChip>` becomes a clickable Link with zero-balance variant

**Files:**
- Modify: `components/billing/balance-chip.tsx`
- Create: `tests/components/billing/balance-chip.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/billing/balance-chip.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BalanceChip } from "@/components/billing/balance-chip";

describe("<BalanceChip>", () => {
  const baseProps = {
    freeLabel: "Free credit",
    paidLabel: "credits",
    topUpLabel: "Top up",
    outOfCreditsLabel: "Out of credits"
  };

  it("renders as a link to /billing", () => {
    render(<BalanceChip initialFree={1} initialPaid={5} {...baseProps} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/billing");
  });

  it("shows the balance in the default state", () => {
    render(<BalanceChip initialFree={1} initialPaid={5} {...baseProps} />);
    expect(screen.getByText(/1 free credit/i)).toBeInTheDocument();
    expect(screen.getByText(/5 credits/i)).toBeInTheDocument();
  });

  it("shows the zero-balance variant when both balances are 0", () => {
    render(<BalanceChip initialFree={0} initialPaid={0} {...baseProps} />);
    expect(screen.getByText(/Out of credits/i)).toBeInTheDocument();
    expect(screen.queryByText(/0 free credit/i)).not.toBeInTheDocument();
  });

  it("includes an accessible label naming the action", () => {
    render(<BalanceChip initialFree={1} initialPaid={5} {...baseProps} />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("aria-label")).toMatch(/Top up/i);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- balance-chip`
Expected: FAIL — the component renders a `<span>`, not a link; doesn't accept `topUpLabel` or `outOfCreditsLabel`; no zero-balance branch.

- [ ] **Step 3: Replace the component**

Replace `components/billing/balance-chip.tsx` entirely with:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, ChevronRight, CreditCard, Loader2, Plus } from "lucide-react";

export interface BalanceChipProps {
  initialFree: number;
  initialPaid: number;
  /** "Free credit" or "Darmowy kredyt" */
  freeLabel: string;
  /** "credits" or "kredytów" */
  paidLabel: string;
  /** "Top up" or "Doładuj" — used in the accessible label */
  topUpLabel: string;
  /** "Out of credits" or "Brak kredytów" — used in the zero-balance variant */
  outOfCreditsLabel: string;
}

interface BalanceResponse {
  freeCreditsRemaining: number;
  paidCredits: number;
}

export function BalanceChip({
  initialFree,
  initialPaid,
  freeLabel,
  paidLabel,
  topUpLabel,
  outOfCreditsLabel
}: BalanceChipProps) {
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

  const isZero = free === 0 && paid === 0;
  const ariaLabel = isZero
    ? `${outOfCreditsLabel}. ${topUpLabel}.`
    : `${free} ${freeLabel}, ${paid} ${paidLabel}. ${topUpLabel}.`;

  const containerClass = isZero
    ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50";

  return (
    <Link
      href="/billing"
      aria-label={ariaLabel}
      className={`group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${containerClass}`}
    >
      {refreshing ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
      ) : isZero ? (
        <AlertCircle className="h-3.5 w-3.5 text-amber-700" />
      ) : (
        <>
          <CreditCard className="h-3.5 w-3.5 text-cyan-700 group-hover:hidden" />
          <Plus className="hidden h-3.5 w-3.5 text-cyan-700 group-hover:block" />
        </>
      )}
      {isZero ? (
        <span>{outOfCreditsLabel}</span>
      ) : (
        <>
          <span>
            {free} {freeLabel.toLowerCase()}
          </span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span>
            {paid} {paidLabel}
          </span>
        </>
      )}
      <ChevronRight className="h-3.5 w-3.5 opacity-60 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}
```

- [ ] **Step 4: Update the layout to pass the new props**

Open `app/(protected)/layout.tsx`. Find the `<BalanceChip ... />` block and update it:

```tsx
<BalanceChip
  initialFree={balance?.free_credits_remaining ?? 0}
  initialPaid={balance?.paid_credits ?? 0}
  freeLabel={String(t.balanceFree)}
  paidLabel={String(t.balanceFreePaid)}
  topUpLabel={String(t.topUp)}
  outOfCreditsLabel={String(t.creditsExhaustedShort)}
/>
```

- [ ] **Step 5: Run, expect pass**

Run: `npm test -- balance-chip && npm run typecheck`
Expected: 4 tests passing, typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add components/billing/balance-chip.tsx tests/components/billing/balance-chip.test.tsx 'app/(protected)/layout.tsx'
git commit -m "feat(billing): BalanceChip becomes a clickable Link with zero-balance variant"
```

---

### Task 3: `useTranslatorWorkflow` lifts `currentLanguage` + `bilingual`, adds `cachedLanguages`

**Files:**
- Modify: `components/workspace/use-translator-workflow.ts`
- Create: `tests/components/workspace/use-translator-workflow.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/workspace/use-translator-workflow.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTranslatorWorkflow } from "@/components/workspace/use-translator-workflow";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe("useTranslatorWorkflow", () => {
  it("defaults currentLanguage to 'en' and bilingual to true", () => {
    const { result } = renderHook(() => useTranslatorWorkflow());
    expect(result.current.currentLanguage).toBe("en");
    expect(result.current.bilingual).toBe(true);
    expect(result.current.cachedLanguages.size).toBe(0);
  });

  it("setCurrentLanguage updates the value", () => {
    const { result } = renderHook(() => useTranslatorWorkflow());
    act(() => {
      result.current.setCurrentLanguage("de");
    });
    expect(result.current.currentLanguage).toBe("de");
  });

  it("setBilingual updates the value", () => {
    const { result } = renderHook(() => useTranslatorWorkflow());
    act(() => {
      result.current.setBilingual(false);
    });
    expect(result.current.bilingual).toBe(false);
  });

  it("adds a language to cachedLanguages after a successful translate", async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          invoice: { id: "i1", invoiceNumber: "F-1" },
          invoiceId: "i1",
          isNew: true,
          warnings: []
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ invoice: { id: "i1", invoiceNumber: "F-1" } })
      });

    const { result } = renderHook(() => useTranslatorWorkflow());

    await act(async () => {
      await result.current.upload(new File(["<x/>"], "x.xml", { type: "application/xml" }));
    });
    expect(result.current.invoiceId).toBe("i1");
    expect(result.current.cachedLanguages.size).toBe(0);

    await act(async () => {
      await result.current.translateCurrent();
    });
    expect(result.current.cachedLanguages.has("en")).toBe(true);
  });

  it("translateCurrent is a no-op when the current language is already cached", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        invoice: { id: "i2", invoiceNumber: "F-2" },
        invoiceId: "i2",
        isNew: true,
        warnings: []
      })
    });

    const { result } = renderHook(() => useTranslatorWorkflow());
    await act(async () => {
      await result.current.upload(new File(["<x/>"], "x.xml", { type: "application/xml" }));
    });

    // Seed the cache.
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ invoice: { id: "i2" } })
    });
    await act(async () => {
      await result.current.translateCurrent();
    });
    expect(result.current.cachedLanguages.has("en")).toBe(true);

    fetchMock.mockClear();
    await act(async () => {
      await result.current.translateCurrent();
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reset clears invoice, messages, status, and cachedLanguages", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        invoice: { id: "i3" },
        invoiceId: "i3",
        isNew: true,
        warnings: []
      })
    });
    const { result } = renderHook(() => useTranslatorWorkflow());
    await act(async () => {
      await result.current.upload(new File(["<x/>"], "x.xml"));
    });
    expect(result.current.invoiceId).toBe("i3");

    act(() => {
      result.current.reset();
    });
    expect(result.current.invoiceId).toBeNull();
    expect(result.current.cachedLanguages.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- use-translator-workflow`
Expected: FAIL — `currentLanguage`, `setCurrentLanguage`, `bilingual`, `setBilingual`, `translateCurrent`, `cachedLanguages` don't exist on the hook.

- [ ] **Step 3: Replace the hook**

Replace `components/workspace/use-translator-workflow.ts` with:

```ts
"use client";

import { useCallback, useState } from "react";
import type { Invoice, LanguageCode } from "@/types/invoice";

export type WorkflowStatus = "idle" | "uploading" | "translating" | "generating-pdf";

export interface UseTranslatorWorkflowResult {
  invoice: Invoice | null;
  invoiceId: string | null;
  status: WorkflowStatus;
  messages: string[];
  insufficientCredit: boolean;
  currentLanguage: LanguageCode;
  bilingual: boolean;
  cachedLanguages: Set<LanguageCode>;
  setCurrentLanguage(lang: LanguageCode): void;
  setBilingual(value: boolean): void;
  upload(file: File): Promise<void>;
  translateCurrent(): Promise<void>;
  downloadPdf(): Promise<void>;
  dismissInsufficientCredit(): void;
  reset(): void;
}

const DEFAULT_LANGUAGE: LanguageCode = "en";

export function useTranslatorWorkflow(): UseTranslatorWorkflowResult {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [status, setStatus] = useState<WorkflowStatus>("idle");
  const [messages, setMessages] = useState<string[]>([]);
  const [insufficientCredit, setInsufficientCredit] = useState(false);
  const [currentLanguage, setCurrentLanguageState] = useState<LanguageCode>(DEFAULT_LANGUAGE);
  const [bilingual, setBilingualState] = useState(true);
  const [cachedLanguages, setCachedLanguages] = useState<Set<LanguageCode>>(new Set());

  function notifyBalanceChanged() {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("credit-balance-changed"));
    }
  }

  const setCurrentLanguage = useCallback((lang: LanguageCode) => {
    setCurrentLanguageState(lang);
  }, []);

  const setBilingual = useCallback((value: boolean) => {
    setBilingualState(value);
  }, []);

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
      setCachedLanguages(new Set());
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

  async function translateCurrent() {
    if (!invoiceId) return;
    if (cachedLanguages.has(currentLanguage)) return; // no-op when cached

    setStatus("translating");
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, language: currentLanguage, bilingual })
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error ?? "Translation failed");
      }
      setInvoice(payload.invoice);
      setCachedLanguages((prev) => {
        const next = new Set(prev);
        next.add(currentLanguage);
        return next;
      });
    } catch (error) {
      setMessages([error instanceof Error ? error.message : "Translation failed"]);
    } finally {
      setStatus("idle");
    }
  }

  async function downloadPdf() {
    if (!invoiceId || !invoice) return;
    setStatus("generating-pdf");
    try {
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, language: currentLanguage, bilingual })
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
    setCurrentLanguageState(DEFAULT_LANGUAGE);
    setBilingualState(true);
    setCachedLanguages(new Set());
  }

  return {
    invoice,
    invoiceId,
    status,
    messages,
    insufficientCredit,
    currentLanguage,
    bilingual,
    cachedLanguages,
    setCurrentLanguage,
    setBilingual,
    upload,
    translateCurrent,
    downloadPdf,
    dismissInsufficientCredit,
    reset
  };
}
```

Note: the old public API (`translate(lang, bilingual)`, `downloadPdf(lang, bilingual)`) is gone. Task 7 updates `<TranslatorWorkspace>` and Task 8 updates the `<LanguagePills>` consumer to use the new API. Until those land, the existing `<TranslatorWorkspace>` will break — that's OK because it gets rewritten in Task 7.

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- use-translator-workflow`
Expected: 6 tests passing.

```bash
npm run typecheck
```

Expected: FAIL because `translator-workspace.tsx` still imports the old `translate(lang, bilingual)` signature. That's expected; Task 7 fixes it. Don't commit yet — chain Task 3 and Task 7 commits if you want, OR mark this task DONE_WITH_CONCERNS noting the typecheck depends on Task 7 and proceed.

- [ ] **Step 5: Commit**

```bash
git add components/workspace/use-translator-workflow.ts tests/components/workspace/use-translator-workflow.test.tsx
git commit -m "feat(workspace): lift currentLanguage + bilingual into hook, add cachedLanguages"
```

The build is temporarily broken — Task 7 unblocks it.

---

### Task 4: `<LanguagePills>` component

**Files:**
- Create: `components/workspace/language-pills.tsx`
- Create: `tests/components/workspace/language-pills.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/workspace/language-pills.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguagePills } from "@/components/workspace/language-pills";

const baseProps = {
  current: "en" as const,
  cached: new Set<string>(["en"]),
  translating: false,
  onSelect: vi.fn(),
  cachedLabel: "cached",
  moreLanguagesLabel: "More languages",
  allLanguageOptions: [
    { code: "en", label: "English" },
    { code: "de", label: "German" },
    { code: "fr", label: "French" },
    { code: "es", label: "Spanish" },
    { code: "it", label: "Italian" },
    { code: "nl", label: "Dutch" }
  ]
};

describe("<LanguagePills>", () => {
  it("renders the 5 default visible pills + the 'more' overflow", () => {
    render(<LanguagePills {...baseProps} onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^EN/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^DE/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^FR/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^ES/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^IT/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /More languages/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^NL/ })).not.toBeInTheDocument();
  });

  it("marks the current pill with aria-pressed", () => {
    render(<LanguagePills {...baseProps} onSelect={vi.fn()} />);
    const en = screen.getByRole("button", { name: /^EN/ });
    expect(en.getAttribute("aria-pressed")).toBe("true");
    const de = screen.getByRole("button", { name: /^DE/ });
    expect(de.getAttribute("aria-pressed")).toBe("false");
  });

  it("calls onSelect with the language code when a pill is clicked", () => {
    const onSelect = vi.fn();
    render(<LanguagePills {...baseProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /^DE/ }));
    expect(onSelect).toHaveBeenCalledWith("de");
  });

  it("shows a spinner on the current pill when translating", () => {
    render(<LanguagePills {...baseProps} translating={true} onSelect={vi.fn()} />);
    const en = screen.getByRole("button", { name: /^EN/ });
    expect(en.querySelector('[data-testid="pill-spinner"]')).not.toBeNull();
  });

  it("renders cached indicator only on cached pills", () => {
    const cached = new Set(["en", "fr"]);
    render(<LanguagePills {...baseProps} cached={cached} onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^EN/ }).getAttribute("data-cached")).toBe("true");
    expect(screen.getByRole("button", { name: /^DE/ }).getAttribute("data-cached")).toBe("false");
    expect(screen.getByRole("button", { name: /^FR/ }).getAttribute("data-cached")).toBe("true");
  });

  it("opens the more-languages popover and selects a language from it", () => {
    const onSelect = vi.fn();
    render(<LanguagePills {...baseProps} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /More languages/i }));
    const nl = screen.getByRole("option", { name: /Dutch/i });
    fireEvent.click(nl);
    expect(onSelect).toHaveBeenCalledWith("nl");
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- language-pills`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `components/workspace/language-pills.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import type { LanguageCode } from "@/types/invoice";

export interface LanguageOption {
  code: LanguageCode;
  label: string;
}

export interface LanguagePillsProps {
  current: LanguageCode;
  cached: Set<LanguageCode>;
  translating: boolean;
  onSelect: (code: LanguageCode) => void;
  cachedLabel: string;
  moreLanguagesLabel: string;
  allLanguageOptions: ReadonlyArray<LanguageOption>;
}

const DEFAULT_VISIBLE: LanguageCode[] = ["en", "de", "fr", "es", "it"];

export function LanguagePills({
  current,
  cached,
  translating,
  onSelect,
  cachedLabel,
  moreLanguagesLabel,
  allLanguageOptions
}: LanguagePillsProps) {
  const [overflowOpen, setOverflowOpen] = useState(false);

  const visibleCodes = new Set<LanguageCode>(DEFAULT_VISIBLE);
  // If the current language isn't in the default 5, surface it as a 6th pill so the user
  // doesn't see "no pill is active" when they've picked something exotic from the overflow.
  if (!visibleCodes.has(current)) {
    visibleCodes.add(current);
  }

  const visiblePills = allLanguageOptions.filter((option) => visibleCodes.has(option.code));
  const overflowPills = allLanguageOptions.filter((option) => !visibleCodes.has(option.code));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {visiblePills.map((option) => {
        const isActive = option.code === current;
        const isCached = cached.has(option.code);
        const showSpinner = translating && isActive;
        const display = option.code.toUpperCase();
        return (
          <button
            key={option.code}
            type="button"
            onClick={() => onSelect(option.code)}
            aria-pressed={isActive}
            aria-label={`${display} — ${option.label}${isCached ? ` (${cachedLabel})` : ""}`}
            data-cached={isCached ? "true" : "false"}
            className={pillClass(isActive, isCached)}
          >
            <span className="font-semibold">{display}</span>
            {showSpinner ? (
              <Loader2 data-testid="pill-spinner" className="h-3.5 w-3.5 animate-spin" />
            ) : isCached ? (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            ) : null}
          </button>
        );
      })}

      <div className="relative">
        <button
          type="button"
          onClick={() => setOverflowOpen((open) => !open)}
          aria-haspopup="listbox"
          aria-expanded={overflowOpen}
          className="inline-flex h-9 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {moreLanguagesLabel}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        {overflowOpen ? (
          <ul
            role="listbox"
            className="absolute right-0 z-20 mt-2 max-h-72 w-56 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          >
            {overflowPills.map((option) => {
              const isCached = cached.has(option.code);
              return (
                <li key={option.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => {
                      onSelect(option.code);
                      setOverflowOpen(false);
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <span>
                      <span className="mr-2 inline-block w-8 font-semibold uppercase">{option.code}</span>
                      {option.label}
                    </span>
                    {isCached ? <Check className="h-3.5 w-3.5 text-cyan-700" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function pillClass(active: boolean, cached: boolean): string {
  const base =
    "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors";
  if (active) {
    return `${base} border-cyan-700 bg-cyan-700 text-white shadow-sm`;
  }
  if (cached) {
    return `${base} border-slate-200 bg-slate-100 text-slate-900 hover:border-slate-300`;
  }
  return `${base} border-slate-200 bg-white text-slate-700 hover:border-cyan-700 hover:bg-cyan-50/40`;
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- language-pills`
Expected: 6 tests passing.

- [ ] **Step 5: Commit**

```bash
git add components/workspace/language-pills.tsx tests/components/workspace/language-pills.test.tsx
git commit -m "feat(workspace): LanguagePills with cached state + overflow popover"
```

---

### Task 5: `<WorkspaceToolbar>` (sticky bottom action bar)

**Files:**
- Create: `components/workspace/workspace-toolbar.tsx`

- [ ] **Step 1: Write the component**

Create `components/workspace/workspace-toolbar.tsx`:

```tsx
"use client";

import { Download, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguagePills, type LanguageOption } from "./language-pills";
import type { LanguageCode } from "@/types/invoice";
import type { WorkflowStatus } from "./use-translator-workflow";

export interface WorkspaceToolbarProps {
  currentLanguage: LanguageCode;
  cachedLanguages: Set<LanguageCode>;
  bilingual: boolean;
  status: WorkflowStatus;
  onSelectLanguage(code: LanguageCode): void;
  onToggleBilingual(value: boolean): void;
  onDownloadPdf(): void;
  onNewInvoice(): void;
  bilingualLabel: string;
  downloadLabel: string;
  newInvoiceLabel: string;
  cachedLabel: string;
  moreLanguagesLabel: string;
  languageOptions: ReadonlyArray<LanguageOption>;
}

export function WorkspaceToolbar({
  currentLanguage,
  cachedLanguages,
  bilingual,
  status,
  onSelectLanguage,
  onToggleBilingual,
  onDownloadPdf,
  onNewInvoice,
  bilingualLabel,
  downloadLabel,
  newInvoiceLabel,
  cachedLabel,
  moreLanguagesLabel,
  languageOptions
}: WorkspaceToolbarProps) {
  const translating = status === "translating";
  const generatingPdf = status === "generating-pdf";

  return (
    <div
      role="region"
      aria-label={downloadLabel}
      className="sticky bottom-0 z-10 -mx-5 mt-4 border-t border-slate-200 bg-white/95 px-5 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/70 md:-mx-8 md:px-8"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <LanguagePills
          current={currentLanguage}
          cached={cachedLanguages}
          translating={translating}
          onSelect={onSelectLanguage}
          cachedLabel={cachedLabel}
          moreLanguagesLabel={moreLanguagesLabel}
          allLanguageOptions={languageOptions}
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex h-9 items-center gap-2 rounded-md border border-cyan-200 bg-cyan-50 px-3 text-sm font-medium text-cyan-900">
            <input
              type="checkbox"
              checked={bilingual}
              onChange={(event) => onToggleBilingual(event.target.checked)}
              className="h-4 w-4 rounded border-cyan-300 text-cyan-700 focus:ring-cyan-700"
            />
            {bilingualLabel}
          </label>
          <Button variant="outline" onClick={onNewInvoice}>
            <Plus className="h-4 w-4" />
            {newInvoiceLabel}
          </Button>
          <Button onClick={onDownloadPdf} disabled={generatingPdf}>
            {generatingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {downloadLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: still fails (Task 3 introduced the breaking change). The new toolbar is consistent with the new hook API.

- [ ] **Step 3: Commit**

```bash
git add components/workspace/workspace-toolbar.tsx
git commit -m "feat(workspace): WorkspaceToolbar sticky action bar"
```

---

### Task 6: `<WorkspaceEmptyState>` (drop zone + onboarding side panel)

**Files:**
- Create: `components/workspace/workspace-empty-state.tsx`

- [ ] **Step 1: Write the component**

Create `components/workspace/workspace-empty-state.tsx`:

```tsx
"use client";

import { CheckCircle2, Loader2, UploadCloud } from "lucide-react";

export interface WorkspaceEmptyStateProps {
  uploading: boolean;
  onFile(file?: File): void;
  uploadTitle: string;
  uploadHelp: string;
  parsingLabel: string;
  onboardingTitle: string;
  onboardingItems: ReadonlyArray<string>;
}

export function WorkspaceEmptyState({
  uploading,
  onFile,
  uploadTitle,
  uploadHelp,
  parsingLabel,
  onboardingTitle,
  onboardingItems
}: WorkspaceEmptyStateProps) {
  return (
    <div className="grid gap-6 md:grid-cols-[3fr_2fr]">
      <DropZone
        uploading={uploading}
        onFile={onFile}
        title={uploadTitle}
        help={uploadHelp}
        parsingLabel={parsingLabel}
      />
      <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {onboardingTitle}
        </h2>
        <ul className="mt-4 space-y-3 text-sm text-slate-700">
          {onboardingItems.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}

function DropZone({
  uploading,
  onFile,
  title,
  help,
  parsingLabel
}: {
  uploading: boolean;
  onFile: (file?: File) => void;
  title: string;
  help: string;
  parsingLabel: string;
}) {
  if (uploading) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-600">
        <div>
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-cyan-700" />
          {parsingLabel}
        </div>
      </div>
    );
  }
  return (
    <label
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onFile(event.dataTransfer.files[0]);
      }}
      className="flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center transition-colors hover:border-cyan-700 hover:bg-cyan-50/40"
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
        onChange={(event) => onFile(event.target.files?.[0])}
      />
    </label>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: still fails on the workspace orchestrator. Task 7 closes this.

- [ ] **Step 3: Commit**

```bash
git add components/workspace/workspace-empty-state.tsx
git commit -m "feat(workspace): WorkspaceEmptyState with drop zone + onboarding panel"
```

---

### Task 7: Slim `<TranslatorWorkspace>` to an orchestrator + `<WorkspaceInvoiceView>`

**Files:**
- Create: `components/workspace/workspace-invoice-view.tsx`
- Modify: `components/workspace/translator-workspace.tsx`

- [ ] **Step 1: Write `<WorkspaceInvoiceView>`**

Create `components/workspace/workspace-invoice-view.tsx`:

```tsx
"use client";

import { InvoicePreview } from "@/components/invoice-preview";
import { WorkspaceToolbar } from "./workspace-toolbar";
import type { LanguageOption } from "./language-pills";
import type { Invoice, LanguageCode } from "@/types/invoice";
import type { WorkflowStatus } from "./use-translator-workflow";

export interface WorkspaceInvoiceViewProps {
  invoice: Invoice;
  currentLanguage: LanguageCode;
  cachedLanguages: Set<LanguageCode>;
  bilingual: boolean;
  status: WorkflowStatus;
  onSelectLanguage(code: LanguageCode): void;
  onToggleBilingual(value: boolean): void;
  onDownloadPdf(): void;
  onNewInvoice(): void;
  bilingualLabel: string;
  downloadLabel: string;
  newInvoiceLabel: string;
  cachedLabel: string;
  moreLanguagesLabel: string;
  languageOptions: ReadonlyArray<LanguageOption>;
}

export function WorkspaceInvoiceView(props: WorkspaceInvoiceViewProps) {
  return (
    <div className="flex flex-col gap-4">
      <InvoicePreview
        invoice={props.invoice}
        language={props.currentLanguage}
        bilingual={props.bilingual}
      />
      <WorkspaceToolbar
        currentLanguage={props.currentLanguage}
        cachedLanguages={props.cachedLanguages}
        bilingual={props.bilingual}
        status={props.status}
        onSelectLanguage={props.onSelectLanguage}
        onToggleBilingual={props.onToggleBilingual}
        onDownloadPdf={props.onDownloadPdf}
        onNewInvoice={props.onNewInvoice}
        bilingualLabel={props.bilingualLabel}
        downloadLabel={props.downloadLabel}
        newInvoiceLabel={props.newInvoiceLabel}
        cachedLabel={props.cachedLabel}
        moreLanguagesLabel={props.moreLanguagesLabel}
        languageOptions={props.languageOptions}
      />
    </div>
  );
}
```

- [ ] **Step 2: Replace `<TranslatorWorkspace>`**

Replace `components/workspace/translator-workspace.tsx` with:

```tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { copy, type UiLanguage } from "@/lib/workspace/copy";
import { getLanguageOptions } from "@/lib/translation/languages";
import { useTranslatorWorkflow } from "./use-translator-workflow";
import { InsufficientCreditModal } from "./insufficient-credit-modal";
import { WorkspaceEmptyState } from "./workspace-empty-state";
import { WorkspaceInvoiceView } from "./workspace-invoice-view";

export interface TranslatorWorkspaceProps {
  uiLanguage?: UiLanguage;
}

export function TranslatorWorkspace({ uiLanguage = "pl" }: TranslatorWorkspaceProps) {
  const t = copy[uiLanguage];
  const {
    invoice,
    status,
    messages,
    insufficientCredit,
    currentLanguage,
    bilingual,
    cachedLanguages,
    setCurrentLanguage,
    setBilingual,
    upload,
    translateCurrent,
    downloadPdf,
    dismissInsufficientCredit,
    reset
  } = useTranslatorWorkflow();

  const languageOptions = useMemo(() => getLanguageOptions(uiLanguage), [uiLanguage]);

  // Auto-translate when the user picks a language that isn't cached yet.
  const lastTriedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!invoice) return;
    if (cachedLanguages.has(currentLanguage)) return;
    if (status !== "idle") return;
    const key = `${invoice ? "x" : ""}:${currentLanguage}`;
    if (lastTriedRef.current === key) return;
    lastTriedRef.current = key;
    void translateCurrent();
  }, [invoice, currentLanguage, cachedLanguages, status, translateCurrent]);

  const onboardingItems = [
    String(t.onboardingItem1),
    String(t.onboardingItem2),
    String(t.onboardingItem3),
    String(t.onboardingItem4)
  ];

  return (
    <section className="flex flex-col gap-6">
      {messages.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
          {messages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      ) : null}

      {invoice ? (
        <WorkspaceInvoiceView
          invoice={invoice}
          currentLanguage={currentLanguage}
          cachedLanguages={cachedLanguages}
          bilingual={bilingual}
          status={status}
          onSelectLanguage={setCurrentLanguage}
          onToggleBilingual={setBilingual}
          onDownloadPdf={downloadPdf}
          onNewInvoice={reset}
          bilingualLabel={String(t.bilingual)}
          downloadLabel={String(t.download)}
          newInvoiceLabel={String(t.newInvoice)}
          cachedLabel={String(t.cached)}
          moreLanguagesLabel={String(t.moreLanguages)}
          languageOptions={languageOptions}
        />
      ) : (
        <WorkspaceEmptyState
          uploading={status === "uploading"}
          onFile={(f) => f && upload(f)}
          uploadTitle={String(t.uploadTitle)}
          uploadHelp={String(t.uploadHelp)}
          parsingLabel={String(t.parsing)}
          onboardingTitle={String(t.onboardingTitle)}
          onboardingItems={onboardingItems}
        />
      )}

      <InsufficientCreditModal
        open={insufficientCredit}
        title={String(t.outOfCreditsTitle)}
        body={String(t.outOfCreditsBody)}
        buyLabel={String(t.buyCredits)}
        cancelLabel={String(t.cancel)}
        onClose={dismissInsufficientCredit}
      />
    </section>
  );
}
```

- [ ] **Step 3: Typecheck + build**

```bash
npm run typecheck && npm run build
```

Expected: PASS — the workspace now uses the new hook API consistently.

- [ ] **Step 4: Run all component tests**

```bash
npm test -- "components/workspace"
```

Expected: all green (balance-chip from Task 2, use-translator-workflow from Task 3, language-pills from Task 4).

- [ ] **Step 5: Commit**

```bash
git add components/workspace/translator-workspace.tsx components/workspace/workspace-invoice-view.tsx
git commit -m "feat(workspace): slim orchestrator + WorkspaceInvoiceView mounts toolbar"
```

---

### Task 8: `<LowBalanceBanner>` + page wiring

**Files:**
- Create: `components/billing/low-balance-banner.tsx`
- Create: `tests/components/billing/low-balance-banner.test.tsx`
- Modify: `app/(protected)/app/page.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/billing/low-balance-banner.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LowBalanceBanner } from "@/components/billing/low-balance-banner";

const baseProps = {
  initialFree: 0,
  initialPaid: 0,
  title: "Out of credits",
  body: "Buy a pack to upload another invoice.",
  buyLabel: "Buy credits"
};

beforeEach(() => {
  // jsdom provides sessionStorage; reset it between tests.
  sessionStorage.clear();
});

describe("<LowBalanceBanner>", () => {
  it("renders when both balances are zero", () => {
    render(<LowBalanceBanner {...baseProps} />);
    expect(screen.getByText("Out of credits")).toBeInTheDocument();
  });

  it("renders nothing when balance is non-zero", () => {
    const { container } = render(
      <LowBalanceBanner {...baseProps} initialFree={1} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("has a buy-credits link pointing at /billing", () => {
    render(<LowBalanceBanner {...baseProps} />);
    const link = screen.getByRole("link", { name: /Buy credits/i });
    expect(link).toHaveAttribute("href", "/billing");
  });

  it("dismisses on close click and remembers via sessionStorage", () => {
    const { container, rerender } = render(<LowBalanceBanner {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Close/i }));
    expect(container).toBeEmptyDOMElement();

    rerender(<LowBalanceBanner {...baseProps} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("re-appears after sessionStorage is cleared (new session)", () => {
    render(<LowBalanceBanner {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Close/i }));
    sessionStorage.clear();
    const { container } = render(<LowBalanceBanner {...baseProps} />);
    expect(container).not.toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run, expect fail**

Run: `npm test -- low-balance-banner`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `components/billing/low-balance-banner.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

export interface LowBalanceBannerProps {
  initialFree: number;
  initialPaid: number;
  title: string;
  body: string;
  buyLabel: string;
}

const STORAGE_KEY = "low-balance-banner-dismissed";

export function LowBalanceBanner({
  initialFree,
  initialPaid,
  title,
  body,
  buyLabel
}: LowBalanceBannerProps) {
  const [free, setFree] = useState(initialFree);
  const [paid, setPaid] = useState(initialPaid);
  const [dismissed, setDismissed] = useState(false);

  // Read dismissal flag on mount (sessionStorage isn't available during SSR).
  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.sessionStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  // Subscribe to credit-balance-changed so the banner disappears the moment the user buys.
  useEffect(() => {
    if (typeof window === "undefined") return;
    async function refetch() {
      try {
        const res = await fetch("/api/me/balance");
        if (!res.ok) return;
        const payload = await res.json();
        setFree(payload.freeCreditsRemaining ?? 0);
        setPaid(payload.paidCredits ?? 0);
      } catch {
        // Silent — banner stays in whatever state it's in.
      }
    }
    function onChange() {
      void refetch();
    }
    window.addEventListener("credit-balance-changed", onChange);
    return () => window.removeEventListener("credit-balance-changed", onChange);
  }, []);

  const isZero = free === 0 && paid === 0;
  if (!isZero || dismissed) return null;

  function onClose() {
    setDismissed(true);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(STORAGE_KEY, "1");
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-soft sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-0.5 text-amber-800">{body}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 self-end sm:self-auto">
        <Link
          href="/billing"
          className="inline-flex h-9 items-center rounded-md bg-amber-900 px-4 text-sm font-semibold text-white hover:bg-amber-950"
        >
          {buyLabel}
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-md p-1.5 text-amber-700 hover:bg-amber-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire into the workspace page**

Modify `app/(protected)/app/page.tsx`. Replace the entire file with:

```tsx
import { TranslatorWorkspace } from "@/components/workspace/translator-workspace";
import { LowBalanceBanner } from "@/components/billing/low-balance-banner";
import { requireUser } from "@/lib/auth/require-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { copy, type UiLanguage } from "@/lib/workspace/copy";

export default async function AppPage() {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("locale")
    .eq("id", user.id)
    .single();

  const uiLanguage: UiLanguage = profile?.locale === "en" ? "en" : "pl";
  const t = copy[uiLanguage];

  const admin = getSupabaseAdminClient();
  await admin.rpc("ensure_free_credit_for_period", { p_user: user.id });
  const { data: balance } = await admin
    .from("credit_balances")
    .select("free_credits_remaining, paid_credits")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <>
      <LowBalanceBanner
        initialFree={balance?.free_credits_remaining ?? 0}
        initialPaid={balance?.paid_credits ?? 0}
        title={String(t.lowBalanceBannerTitle)}
        body={String(t.lowBalanceBannerBody)}
        buyLabel={String(t.buyCredits)}
      />
      <TranslatorWorkspace uiLanguage={uiLanguage} />
    </>
  );
}
```

- [ ] **Step 5: Typecheck + tests**

```bash
npm run typecheck
npm test -- low-balance-banner
```

Expected: typecheck clean, 5 component tests passing.

- [ ] **Step 6: Commit**

```bash
git add components/billing/low-balance-banner.tsx tests/components/billing/low-balance-banner.test.tsx 'app/(protected)/app/page.tsx'
git commit -m "feat(billing): LowBalanceBanner above workspace when balance is zero"
```

---

### Task 9: Update existing E2E + add redesign E2E

**Files:**
- Modify: `tests/e2e/workspace.spec.ts`
- Create: `tests/e2e/app-ux-redesign.spec.ts`

- [ ] **Step 1: Update the existing workspace spec**

The existing spec looks for a "Tłumacz opisy / Translate descriptions" button which no longer exists (translation is implicit on pill click) and clicks "Pobierz PDF / Download PDF". The download path still exists. Adjust the spec body — find the section that translates + downloads, replace the translate-button click with a wait for the EN pill to become active.

Open `tests/e2e/workspace.spec.ts`. Find the block:

```ts
  // Translate — wait for the translate response before clicking the PDF button so
  // OpenAI latency doesn't bleed into the PDF response timeout.
  const [translateResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/translate") && r.request().method() === "POST"),
    page.getByRole("button", { name: /Tłumacz opisy|Translate descriptions/i }).click()
  ]);
  expect(translateResponse.status()).toBe(200);
```

Replace with:

```ts
  // After upload, the workspace auto-translates to EN (the default currentLanguage).
  // Wait for that response.
  const translateResponse = await page.waitForResponse(
    (r) => r.url().includes("/api/translate") && r.request().method() === "POST",
    { timeout: 30_000 }
  );
  expect(translateResponse.status()).toBe(200);
```

That's the only change in this spec. Keep everything else — sign-in, upload, DB row check, PDF download assertion.

- [ ] **Step 2: Write the redesign E2E spec**

Create `tests/e2e/app-ux-redesign.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, serviceRole, { auth: { persistSession: false } });
const samplePath = path.resolve(process.cwd(), "sample-data/sample-fa3-invoice.xml");

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

test("balance chip links to /billing", async ({ page }) => {
  const email = `ux-chip-${Date.now()}@example.test`;
  await admin.auth.admin.createUser({ email, email_confirm: true });
  await signIn(page, email);

  const chip = page.getByRole("link", { name: /Top up|Doładuj/i });
  await expect(chip).toHaveAttribute("href", "/billing");

  await deleteUser(email);
});

test("zero-balance shows the proactive banner with a Buy credits link", async ({ page }) => {
  const email = `ux-banner-${Date.now()}@example.test`;
  await admin.auth.admin.createUser({ email, email_confirm: true });
  // Drain credits before sign-in so the banner is rendered SSR-side.
  const { data: usersData } = await admin.auth.admin.listUsers();
  const userId = usersData.users.find((u) => u.email === email)?.id!;
  await admin.rpc("ensure_free_credit_for_period", { p_user: userId });
  await admin
    .from("credit_balances")
    .update({ free_credits_remaining: 0, paid_credits: 0 })
    .eq("user_id", userId);

  await signIn(page, email);
  const banner = page.getByRole("status");
  await expect(banner).toBeVisible();
  await expect(banner.getByText(/Brak kredytów|Out of credits/i)).toBeVisible();
  const buy = banner.getByRole("link", { name: /Kup pakiet|Buy credits/i });
  await expect(buy).toHaveAttribute("href", "/billing");

  await deleteUser(email);
});

test("clicking a language pill switches the active language and caches it", async ({ page }) => {
  const email = `ux-pills-${Date.now()}@example.test`;
  await admin.auth.admin.createUser({ email, email_confirm: true });
  await signIn(page, email);

  // Upload first.
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByText(/Wgraj KSeF FA\(3\) XML lub PDF/i).click();
  const chooser = await chooserPromise;
  const [uploadResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/upload") && r.request().method() === "POST"),
    chooser.setFiles(samplePath)
  ]);
  expect(uploadResponse.status()).toBe(200);

  // Wait for the implicit EN translate.
  await page.waitForResponse(
    (r) => r.url().includes("/api/translate") && r.request().method() === "POST",
    { timeout: 30_000 }
  );

  // EN pill should now show aria-pressed=true.
  await expect(page.getByRole("button", { name: /^EN/ })).toHaveAttribute("aria-pressed", "true");

  // Click DE — should trigger another translate.
  const [secondTranslate] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/translate") && r.request().method() === "POST"
    ),
    page.getByRole("button", { name: /^DE/ }).click()
  ]);
  expect(secondTranslate.status()).toBe(200);
  await expect(page.getByRole("button", { name: /^DE/ })).toHaveAttribute("aria-pressed", "true");

  // Click back to EN — should be a no-op (cached, no new API call within 2s).
  let calls = 0;
  const listener = (response: import("@playwright/test").Response) => {
    if (response.url().includes("/api/translate")) calls++;
  };
  page.on("response", listener);
  await page.getByRole("button", { name: /^EN/ }).click();
  await page.waitForTimeout(2000);
  page.off("response", listener);
  expect(calls).toBe(0);
  await expect(page.getByRole("button", { name: /^EN/ })).toHaveAttribute("aria-pressed", "true");

  await deleteUser(email);
});

test("clicking 'New invoice' resets the workspace to the empty state", async ({ page }) => {
  const email = `ux-reset-${Date.now()}@example.test`;
  await admin.auth.admin.createUser({ email, email_confirm: true });
  await signIn(page, email);

  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByText(/Wgraj KSeF FA\(3\) XML lub PDF/i).click();
  const chooser = await chooserPromise;
  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/upload") && r.request().method() === "POST"),
    chooser.setFiles(samplePath)
  ]);
  await page.waitForResponse(
    (r) => r.url().includes("/api/translate") && r.request().method() === "POST",
    { timeout: 30_000 }
  );

  // Click New invoice.
  await page.getByRole("button", { name: /Nowa faktura|New invoice/i }).click();

  // Drop zone is back.
  await expect(page.getByText(/Wgraj KSeF FA\(3\) XML lub PDF/i)).toBeVisible();

  await deleteUser(email);
});
```

- [ ] **Step 3: Stop any stale dev servers + run**

```bash
tmux kill-session -t next-dev 2>/dev/null || true
npm run test:e2e -- app-ux-redesign workspace
```

Expected: 5 tests passing (4 new + 1 updated workspace). If the third test ("clicking a language pill...") flakes on OpenAI latency, bump the 30_000 timeout to 60_000.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/app-ux-redesign.spec.ts tests/e2e/workspace.spec.ts
git commit -m "test(e2e): app UX redesign — chip, banner, pills, new-invoice flow"
```

---

### Task 10: README — UX redesign docs

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Append a new section**

Find the location after the existing "Auth emails (Phase 4.5)" section and before "Third-Party References". Append:

```markdown
## Workspace UX (`/app`)

The authenticated `/app` workspace has two states:

1. **Empty state** — drop zone for XML/PDF + onboarding side panel listing what the user gets (1 free invoice/month, 20+ languages, bilingual PDF, KSeF QR).
2. **Invoice view** — `<InvoicePreview>` of the parsed invoice + a sticky bottom action bar (`<WorkspaceToolbar>`).

The toolbar contains:
- **Language pills** (`<LanguagePills>`) for EN/DE/FR/ES/IT plus a "More languages" overflow for the other 15. The active language has a filled cyan background; cached translations show a checkmark; clicking a pill auto-translates (or instant-switches if cached).
- **Bilingual toggle** (PL + selected language in the same PDF).
- **Download PDF** for the currently-displayed language + bilingual toggle.
- **New invoice** button that resets the workspace to the empty state without a page refresh.

### Balance chip + low-balance banner

- The header `<BalanceChip>` is a `<Link>` to `/billing`. Default state shows the free/paid breakdown; zero-balance state shows an amber "Out of credits" with the same link.
- When the user lands on `/app` with zero balance, a proactive `<LowBalanceBanner>` renders above the workspace. Dismissable per session via `sessionStorage`. Auto-disappears once a credit purchase fires the `credit-balance-changed` event.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: app UX redesign"
```

---

### Task 11: Verification

- [ ] **Step 1: Full suite**

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

Use the MCP `get_advisors` for `security` and `performance`. Expected: no new lints.

- [ ] **Step 3: No commit**

Verification task; any failures get their own fix commit.

---

## Verification checklist (before opening PR)

- [ ] `npm run typecheck` clean
- [ ] `npm test` — all green (the new component tests plus the Phase 1–4.5 baseline)
- [ ] `npm run test:e2e` — `smoke`, `auth`, `workspace`, `credit-enforcement`, `billing`, `app-ux-redesign` all pass
- [ ] `npm run build` succeeds; no new routes (this phase is UI-only)
- [ ] Manual: sign in, see chip is clickable; sign in with drained balance, see proactive banner; upload → EN translates automatically; click DE → translates; click EN → instant; click New invoice → drop zone returns; click chip → land on `/billing`
- [ ] Manual: dismiss the banner, refresh the page in the same tab → banner stays dismissed; open a new tab → banner reappears
- [ ] Supabase advisors return no new lints

---

## What comes next

Phase 5 (history page at `/app/history`) — the natural follow-up. The workspace can pick up an `?invoice=<id>` URL parameter then, and the `cachedLanguages` SSR-fetched-from-translations approach noted in §4.6 of the spec becomes worth implementing for full visual fidelity across page reloads.
