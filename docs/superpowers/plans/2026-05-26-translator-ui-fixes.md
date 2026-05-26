# Translator UI Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix six post-launch UX bugs in the `/translate` workspace: broken "Nowe Tłumaczenie" navigation, truncated duplicate warnings, history-table responsiveness and header inconsistency, recent-list overcrowding, untranslated Polish strings in the EN header, and an audit of the translation editor against the AI-translated fields.

**Architecture:** Each issue is scoped to one file or one small cluster of files; we land them as separate tasks on a single bug-fix branch so they share one PR. Tests are written first (TDD per `~/.claude/rules/common/testing.md`); UI changes are verified in the dev server with `preview_*` tools before commit. We add no new abstractions — these are surgical fixes to existing components.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind, Vitest + React Testing Library for unit/component tests, Playwright for E2E (existing only — no new E2E required).

**Branching:** Per `CLAUDE.md`, branch off `main`:
```bash
git fetch origin main && git checkout -b claude/translator-ui-fixes origin/main
```

**Reference docs:**
- Spec for the workspace: [docs/superpowers/specs/2026-05-20-tlumacz-workspace-redesign.md](../specs/2026-05-20-tlumacz-workspace-redesign.md)
- Coding style (immutability, file size, error handling): `~/.claude/rules/common/coding-style.md`
- Testing rigor (80% coverage, TDD): `~/.claude/rules/common/testing.md`

---

## Issue Inventory

| # | Issue | Files touched | Root cause |
|---|-------|--------------|------------|
| 1 | "+ Nowe Tłumaczenie" sidebar button is a no-op when navigating from `/translate?invoiceId=…` to `/translate` | `components/workspace/recent-invoices-sidebar.tsx`, `components/workspace/collapsible-sidebar.tsx`, new `components/workspace/new-translation-link.tsx` | Both `<Link href="/translate">` instances rely on App Router same-pathname navigation; the page server-component re-renders but the in-flight wizard's `useReducer` lazy-init only runs on first mount. The `key` prop (`preloaded?.invoiceId ?? "fresh"`) should remount it, but the Router Cache can serve stale data so the new `preloaded=null` prop never reaches the client. Fix: client-side button that calls `router.push("/translate")` + `router.refresh()`. |
| 2 | Duplicate-warning row text is truncated with "…" | `components/translate/upload-file-row.tsx` | The secondary line uses `truncate` (single-line clip) for all statuses. Duplicate messages are long and need to wrap. Fix: drop `truncate` for `duplicate` and `error` statuses; keep it on `ready`/`parsing` where the secondary is short. |
| 3 | History table doesn't use full width, headers look inconsistent, no mobile story | `components/history/invoice-table.tsx`, `components/history/history-page.tsx`, `tests/components/history/invoice-table.test.tsx` | Header cells use `text-micro` with no `whitespace-nowrap`, so "Data wystawienia" wraps to two lines and visually outweighs single-line headers. The table is wrapped in a fixed-width container at the page level. No mobile card layout exists. Fix: (a) `whitespace-nowrap` on every `<th>`; (b) explicit column widths via `<colgroup>` so the table fills width predictably; (c) hide low-priority columns at `sm:`/`md:`; (d) render a card list at `<md` so nothing overflows. |
| 4 | Recent column shows up to 8 invoices, should show 3 newest | `components/workspace/recent-invoices-sidebar.tsx` | The `RECENT_LIMIT` constant is `8`; flip to `3`. Update sibling tests. |
| 5 | English UI still has Polish words in the authenticated header | `components/layout/authenticated-header.tsx`, `app/(protected)/layout.tsx`, `lib/workspace/copy.ts`, `tests/components/layout/authenticated-header.test.tsx` | Header hard-codes "Workspace", "Historia", "Wyloguj". Fix: thread `uiLanguage` through, add nav-link/logout copy keys (`navWorkspace`, `navHistory`, `signOut`) to both locales. |
| 6 | Editable fields in translation editor must mirror AI-translated fields | `components/translate/translation-editor.tsx`, `lib/translation/apply-edits.ts`, `app/api/translate/edit/route.ts`, `tests/integration/lib/apply-translation-edits.test.ts` | Audit pass: every AI-translated field on the Invoice type must (a) appear in the editor, (b) round-trip through `applyTranslationEdits`, and (c) survive PDF regen. One concrete sync gap: editing `correction.translatedReason`/`translatedPeriod` does not update the underlying `translationFragments[*].translated` for `kind=correction_reason`/`correction_period`. Fix: in `applyTranslationEdits`, when `edits.correction` is present, also mirror the value onto the matching fragment so the two stay consistent. Add a focused unit test. |

---

## File Structure

**New files:**
- `components/workspace/new-translation-link.tsx` — tiny client component that uses `useRouter()` to push + refresh `/translate`. Replaces the two `<Link href="/translate">` instances in `recent-invoices-sidebar.tsx` (expanded + collapsed rails).

**Modified files:**
- `components/workspace/recent-invoices-sidebar.tsx` — use `<NewTranslationLink>`, drop `RECENT_LIMIT` from `8` to `3`.
- `components/workspace/collapsible-sidebar.tsx` — use `<NewTranslationLink>` in the collapsed rail.
- `components/translate/upload-file-row.tsx` — make `truncate` conditional on slot status.
- `components/history/invoice-table.tsx` — `whitespace-nowrap` headers, responsive layout (table at md+, card list at <md).
- `components/history/history-page.tsx` — add mobile-card copy keys (`tableNumberHeaderShort`, `mobileLabelDate`, `mobileLabelSeller`, `mobileLabelAmount`, `mobileLabelLanguages`).
- `components/layout/authenticated-header.tsx` — accept localized nav labels via props.
- `app/(protected)/layout.tsx` — pass localized labels into `<AuthenticatedHeader>`.
- `lib/workspace/copy.ts` — add `navWorkspace`, `navHistory`, `signOut` keys to both `pl` and `en` blocks.
- `lib/translation/apply-edits.ts` — mirror correction edits onto the matching fragments.
- `tests/components/translate/upload-file-row.test.tsx` — assert wrapping behavior for duplicate/error.
- `tests/components/history/invoice-table.test.tsx` — assert `whitespace-nowrap` on headers; assert mobile card markup.
- `tests/components/workspace/recent-invoices-sidebar.test.tsx` — assert 3-row cap.
- `tests/components/layout/authenticated-header.test.tsx` — assert localized labels for PL + EN.
- `tests/integration/lib/apply-translation-edits.test.ts` — assert correction edits mirror onto fragments.

**Why this split:** Each fix is scoped to one or two existing files; no file grows past 400 lines after the changes. The one new file (`new-translation-link.tsx`) is ~25 lines and exists because the parent (`recent-invoices-sidebar.tsx`) is a server component and we need `useRouter` in a client island.

---

## Pre-Task Setup

- [ ] **Step 0a: Branch off main**

```bash
git fetch origin main && git checkout -b claude/translator-ui-fixes origin/main
```

- [ ] **Step 0b: Verify clean state and existing tests pass**

```bash
npm run lint
npm run test
```

Expected: lint passes, all existing tests green. If any test is already failing on `origin/main`, stop and flag it before proceeding.

---

## Task 1: Fix sidebar "Nowe Tłumaczenie" button stuck on preview page

**Files:**
- Create: `components/workspace/new-translation-link.tsx`
- Modify: `components/workspace/recent-invoices-sidebar.tsx`
- Modify: `components/workspace/collapsible-sidebar.tsx`
- Test: `tests/components/workspace/new-translation-link.test.tsx`

**Root cause recap:** Clicking `<Link href="/translate">` from `/translate?invoiceId=<uuid>` does a same-pathname soft navigation. The server component re-renders with `preloaded=null` and the wizard component receives `key="fresh"`, which *should* force a remount — but Next.js 15's Router Cache (`staleTimes.dynamic`) can serve cached payloads on same-path navigations, so the client tree never sees the new key. Calling `router.refresh()` after `router.push()` forces the server payload to be re-fetched and the cache invalidated.

- [ ] **Step 1: Write the failing test for the new client component**

Create `tests/components/workspace/new-translation-link.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NewTranslationLink } from "@/components/workspace/new-translation-link";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh })
}));

describe("<NewTranslationLink>", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
  });

  it("renders the supplied label", () => {
    render(
      <NewTranslationLink label="+ Nowe tłumaczenie" variant="full" />
    );
    expect(
      screen.getByRole("button", { name: /Nowe tłumaczenie/i })
    ).toBeInTheDocument();
  });

  it("on click, pushes /translate then refreshes", () => {
    render(
      <NewTranslationLink label="+ Nowe tłumaczenie" variant="full" />
    );
    fireEvent.click(screen.getByRole("button", { name: /Nowe tłumaczenie/i }));
    expect(push).toHaveBeenCalledWith("/translate");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("collapsed variant renders an icon-only button with the label as aria-label", () => {
    render(
      <NewTranslationLink label="+ Nowe tłumaczenie" variant="collapsed" />
    );
    const btn = screen.getByRole("button", { name: /Nowe tłumaczenie/i });
    expect(btn).toBeInTheDocument();
    // The visible "+ " prefix is dropped in collapsed mode; only an icon shows.
    expect(btn.textContent?.trim()).toBe("");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- new-translation-link`
Expected: FAIL — `Cannot find module '@/components/workspace/new-translation-link'`.

- [ ] **Step 3: Create the new client component**

Create `components/workspace/new-translation-link.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export interface NewTranslationLinkProps {
  /** Localized label, e.g. "+ Nowe tłumaczenie" or "+ New translation". */
  label: string;
  /**
   * "full" → wide pill (sidebar expanded). "collapsed" → 40px square icon
   * button (sidebar collapsed rail). Both behave identically on click.
   */
  variant: "full" | "collapsed";
}

/**
 * Always-fresh navigation to the wizard. Plain <Link href="/translate"> is
 * insufficient: when the user is currently on /translate?invoiceId=<uuid>,
 * App Router's same-pathname soft nav can serve the cached server payload
 * via the Router Cache, leaving the wizard mounted on the delivery step.
 * router.push + router.refresh guarantees both URL change AND server re-fetch.
 */
export function NewTranslationLink({ label, variant }: NewTranslationLinkProps) {
  const router = useRouter();

  function handleClick() {
    router.push("/translate");
    router.refresh();
  }

  if (variant === "collapsed") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={label}
        title={label}
        className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md bg-accent text-white shadow-sm transition-colors duration-hover hover:bg-accent-hover"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={label}
      className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-1 rounded-md bg-accent px-4 text-small font-semibold text-white shadow-sm transition-colors duration-hover ease-out hover:bg-accent-hover"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      {label.replace(/^\+\s*/, "")}
    </button>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- new-translation-link`
Expected: PASS.

- [ ] **Step 5: Replace the expanded-sidebar Link**

Edit `components/workspace/recent-invoices-sidebar.tsx` — replace the existing `<Link href="/translate">` block inside `RecentInvoicesSidebarView` (lines 93–101 — the wrapping `<div className="px-4">`):

```tsx
import { NewTranslationLink } from "./new-translation-link";
// …keep existing imports; remove Plus from lucide-react import since the new component owns it
```

Replace the block:

```tsx
<div className="px-4">
  <Link
    href="/translate"
    className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-1 rounded-md bg-accent px-4 text-small font-semibold text-white shadow-sm transition-colors duration-hover ease-out hover:bg-accent-hover"
  >
    <Plus className="h-4 w-4" aria-hidden="true" />
    {labels.newInvoiceLabel.replace(/^\+\s*/, "")}
  </Link>
</div>
```

with:

```tsx
<div className="px-4">
  <NewTranslationLink label={labels.newInvoiceLabel} variant="full" />
</div>
```

- [ ] **Step 6: Replace the collapsed-rail Link**

Edit `components/workspace/collapsible-sidebar.tsx` — replace the `<Link href="/translate">` inside `CollapsedRail` (lines 106–113):

Add import at the top:

```tsx
import { NewTranslationLink } from "./new-translation-link";
```

Replace:

```tsx
<Link
  href="/translate"
  aria-label={labels.newInvoiceLabel}
  title={labels.newInvoiceLabel}
  className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md bg-accent text-white shadow-sm transition-colors duration-hover hover:bg-accent-hover"
>
  <Plus className="h-4 w-4" aria-hidden="true" />
</Link>
```

with:

```tsx
<NewTranslationLink label={labels.newInvoiceLabel} variant="collapsed" />
```

Then remove the now-unused `Plus` import from the file (`lucide-react`).

- [ ] **Step 7: Update the sidebar's existing test to reflect the role change**

Edit `tests/components/workspace/recent-invoices-sidebar.test.tsx` — the test "renders the New Translation CTA pointing at /translate" currently uses `getByRole("link", ...).toHaveAttribute("href", "/translate")`. Replace with a check that the New Translation button exists:

```tsx
it("renders the New Translation CTA", () => {
  render(<RecentInvoicesSidebarView invoices={[]} labels={baseLabels} />);
  expect(
    screen.getByRole("button", { name: /Nowe tłumaczenie/i })
  ).toBeInTheDocument();
});
```

- [ ] **Step 8: Run the affected tests to verify they pass**

Run: `npm run test -- new-translation-link recent-invoices-sidebar collapsible-sidebar`
Expected: PASS for all three suites.

- [ ] **Step 9: Verify in browser**

Start dev server with `preview_start`. Open `/translate?invoiceId=<any-valid-uuid-from-history>` to land in the delivery step. Click the "+ Nowe tłumaczenie" button in the sidebar (both expanded and collapsed rails). Verify the URL becomes `/translate` and the wizard now shows the upload step (Step 1 — "Wybierz pliki KSeF do tłumaczenia"). Capture a `preview_screenshot` for the PR.

- [ ] **Step 10: Commit**

```bash
git add components/workspace/new-translation-link.tsx \
        components/workspace/recent-invoices-sidebar.tsx \
        components/workspace/collapsible-sidebar.tsx \
        tests/components/workspace/new-translation-link.test.tsx \
        tests/components/workspace/recent-invoices-sidebar.test.tsx
git commit -m "fix(workspace): force fresh nav on Nowe Tłumaczenie so preview yields to upload step"
```

---

## Task 2: Allow duplicate-warning row to wrap (not truncate)

**Files:**
- Modify: `components/translate/upload-file-row.tsx`
- Test: `tests/components/translate/upload-file-row.test.tsx`

- [ ] **Step 1: Write the failing test**

Add this case to `tests/components/translate/upload-file-row.test.tsx` (next to the existing duplicate-state assertions):

```tsx
it("renders the duplicate secondary line WITHOUT the truncate utility (full text visible)", () => {
  render(
    <UploadFileRow
      slot={makeSlot({
        status: "duplicate",
        isContentDuplicate: false,
        otherWithSameNumber: 3,
        invoiceNumber: "FA/30/05/2026"
      })}
      copy={t}
      onRemove={vi.fn()}
    />
  );
  const expected = String(t.duplicateNumberRow)
    .replace("{count}", "3")
    .replace("{invoiceNumber}", "FA/30/05/2026");
  const secondary = screen.getByText(expected);
  expect(secondary.className).not.toMatch(/truncate/);
});

it("renders the error secondary line WITHOUT the truncate utility", () => {
  render(
    <UploadFileRow
      slot={makeSlot({ status: "error", errorMessage: "Long error message that should never be truncated mid-sentence" })}
      copy={t}
      onRemove={vi.fn()}
    />
  );
  const secondary = screen.getByText(/Long error message/);
  expect(secondary.className).not.toMatch(/truncate/);
});

it("KEEPS truncate on the parsing and ready secondary lines (short text, room is tight)", () => {
  const { rerender } = render(
    <UploadFileRow
      slot={makeSlot({ status: "parsing" })}
      copy={t}
      onRemove={vi.fn()}
    />
  );
  expect(screen.getByText(String(t.parsingRow)).className).toMatch(/truncate/);

  rerender(
    <UploadFileRow
      slot={makeSlot({ status: "ready" })}
      copy={t}
      onRemove={vi.fn()}
    />
  );
  // The ready secondary line wraps filename + size in a single <span> child of
  // the <p>; the <p>'s class is what we assert.
  const ready = screen.getByText(/FA-2026-0001\.xml/).closest("p");
  expect(ready?.className).toMatch(/truncate/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- upload-file-row`
Expected: FAIL on the two new "WITHOUT truncate" assertions — current code always emits `truncate`.

- [ ] **Step 3: Make the secondary-line class conditional**

Edit `components/translate/upload-file-row.tsx`. In the JSX (around line 49), replace:

```tsx
<p className="truncate text-small text-text-muted">
  <SecondaryLine slot={slot} copy={copy} />
</p>
```

with:

```tsx
<p
  className={cn(
    "text-small text-text-muted",
    // Short status messages don't need to wrap; long ones (duplicate /
    // error explanations) MUST be fully visible or the user can't act
    // on the warning.
    (slot.status === "parsing" || slot.status === "ready") && "truncate",
    (slot.status === "duplicate" || slot.status === "error") && "break-words"
  )}
>
  <SecondaryLine slot={slot} copy={copy} />
</p>
```

The `cn` helper is already imported at the top of the file.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- upload-file-row`
Expected: PASS.

- [ ] **Step 5: Verify in browser**

In the dev server, upload an invoice whose number matches another invoice you already have (so the duplicate-number warning fires). Confirm the full sentence is visible across multiple lines instead of clipping with "…". Take a `preview_screenshot`.

- [ ] **Step 6: Commit**

```bash
git add components/translate/upload-file-row.tsx \
        tests/components/translate/upload-file-row.test.tsx
git commit -m "fix(upload): let duplicate and error warnings wrap instead of truncating"
```

---

## Task 3: Responsive history table with consistent headers

**Files:**
- Modify: `components/history/invoice-table.tsx`
- Modify: `components/history/history-page.tsx`
- Test: `tests/components/history/invoice-table.test.tsx`

**Design:**
- **≥ md (768px+):** Table layout, `<table className="w-full">` already does that. Add `<colgroup>` with explicit percentage widths so columns are predictable and don't collapse weirdly. Add `whitespace-nowrap` to every `<th>` so headers stay on one line. Reduce `text-micro` letter-spacing slightly if needed for compact headers.
- **< md (mobile):** Hide the `<table>`. Render a `<ul>` of cards instead — one card per invoice, two-column inline label/value grid for date/seller/amount, language pills on a separate line, "Otwórz →" link at the bottom.

- [ ] **Step 1: Write failing tests**

Add to `tests/components/history/invoice-table.test.tsx`:

```tsx
it("every column header is marked whitespace-nowrap so DATE doesn't break to two lines", () => {
  render(<InvoiceTable rows={sample} labels={labels} />);
  const headers = screen.getAllByRole("columnheader");
  for (const th of headers) {
    expect(th.className).toMatch(/whitespace-nowrap/);
  }
});

it("renders a <colgroup> so widths are explicit and the table fills the container", () => {
  const { container } = render(<InvoiceTable rows={sample} labels={labels} />);
  const colgroup = container.querySelector("colgroup");
  expect(colgroup).not.toBeNull();
  expect(colgroup?.querySelectorAll("col").length).toBe(6);
});

it("on mobile renders a card list as the visible variant (table hidden via md:table)", () => {
  const { container } = render(<InvoiceTable rows={sample} labels={labels} />);
  const cards = container.querySelector('[data-testid="invoice-card-list"]');
  expect(cards).not.toBeNull();
  // One card per invoice
  const cardItems = cards?.querySelectorAll('[data-testid="invoice-card"]');
  expect(cardItems?.length).toBe(sample.length);
});

it("each card shows invoice number, date, seller, amount, language pills, and Open link", () => {
  const { container } = render(<InvoiceTable rows={sample} labels={labels} />);
  const firstCard = container.querySelector('[data-testid="invoice-card"]');
  expect(firstCard).not.toBeNull();
  expect(firstCard?.textContent).toContain("F/24/0148");
  expect(firstCard?.textContent).toContain("2026-05-12");
  expect(firstCard?.textContent).toContain("ACME Sp. z o.o.");
  expect(firstCard?.textContent).toContain("18597,60");
  // PL source pill always present
  expect(firstCard?.querySelector('[data-testid="lang-pill-PL"]')).not.toBeNull();
});
```

Also extend the labels object near the top of the file:

```tsx
const labels = {
  numberHeader: "Numer",
  dateHeader: "Data wystawienia",
  sellerHeader: "Sprzedawca",
  amountHeader: "Kwota",
  languagesHeader: "Języki",
  actionsHeader: "Akcje",
  openLabel: "Otwórz",
  emptyMessage: "Brak faktur do wyświetlenia.",
  mobileLabelDate: "Data",
  mobileLabelSeller: "Sprzedawca",
  mobileLabelAmount: "Kwota",
  mobileLabelLanguages: "Języki"
};
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- invoice-table`
Expected: FAIL on the new assertions (no `whitespace-nowrap`, no colgroup, no card list).

- [ ] **Step 3: Extend the label type**

Edit `components/history/invoice-table.tsx`. Extend `InvoiceTableLabels`:

```tsx
export interface InvoiceTableLabels {
  numberHeader: string;
  dateHeader: string;
  sellerHeader: string;
  amountHeader: string;
  languagesHeader: string;
  actionsHeader: string;
  openLabel: string;
  emptyMessage: string;
  duplicatesBadge?: string;
  /** Mobile-card field labels — short forms shown next to each value. */
  mobileLabelDate: string;
  mobileLabelSeller: string;
  mobileLabelAmount: string;
  mobileLabelLanguages: string;
}
```

- [ ] **Step 4: Rewrite the table body**

Replace the body of `InvoiceTable` (everything from the empty-state check onward) with:

```tsx
export function InvoiceTable({ rows, labels }: InvoiceTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface-muted px-6 py-12 text-center text-body text-text-muted">
        {labels.emptyMessage}
      </div>
    );
  }

  return (
    <>
      {/* Desktop / tablet (md+): full table with explicit column widths */}
      <div className="hidden overflow-hidden rounded-xl border border-border bg-surface shadow-sm md:block">
        <table className="w-full table-fixed">
          <colgroup>
            <col style={{ width: "18%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "24%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "18%" }} />
            <col style={{ width: "12%" }} />
          </colgroup>
          <thead className="bg-surface-muted">
            <tr>
              <th className="whitespace-nowrap px-5 py-3 text-left text-micro uppercase tracking-wide text-text-muted">
                {labels.numberHeader}
              </th>
              <th className="whitespace-nowrap px-5 py-3 text-left text-micro uppercase tracking-wide text-text-muted">
                {labels.dateHeader}
              </th>
              <th className="whitespace-nowrap px-5 py-3 text-left text-micro uppercase tracking-wide text-text-muted">
                {labels.sellerHeader}
              </th>
              <th className="whitespace-nowrap px-5 py-3 text-right text-micro uppercase tracking-wide text-text-muted">
                {labels.amountHeader}
              </th>
              <th className="whitespace-nowrap px-5 py-3 text-left text-micro uppercase tracking-wide text-text-muted">
                {labels.languagesHeader}
              </th>
              <th className="whitespace-nowrap px-5 py-3 text-right text-micro uppercase tracking-wide text-text-muted">
                <span className="sr-only">{labels.actionsHeader}</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-surface-muted">
                <td className="px-5 py-3 font-mono text-small text-text-strong">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate">{row.invoiceNumber ?? "—"}</span>
                    {row.duplicateCount > 0 && labels.duplicatesBadge ? (
                      <span
                        className="inline-flex h-5 items-center rounded-full bg-warning/15 px-2 text-[10px] font-semibold tracking-wide text-warning"
                        data-testid="duplicate-badge"
                      >
                        {labels.duplicatesBadge.replace(
                          "{count}",
                          String(row.duplicateCount)
                        )}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-small text-text">
                  {row.issueDate ?? "—"}
                </td>
                <td className="px-5 py-3 text-small text-text">
                  <span className="line-clamp-2">{row.sellerName ?? "—"}</span>
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-right text-small tabular-nums text-text">
                  {formatAmount(row.totalGross, row.currency)}
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-wrap gap-1">
                    <span
                      data-testid="lang-pill-PL"
                      className="inline-flex h-5 items-center rounded-full bg-accent-soft px-2 text-[10px] font-semibold tracking-wide text-accent"
                    >
                      PL
                    </span>
                    {row.translatedLanguages.map((lang) => (
                      <span
                        key={lang}
                        className="inline-flex h-5 items-center rounded-full bg-surface-muted px-2 text-[10px] font-semibold tracking-wide text-text"
                      >
                        {lang.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-right">
                  <Link
                    href={`/translate?invoiceId=${row.id}`}
                    className="cursor-pointer text-small font-medium text-accent hover:text-accent-hover"
                  >
                    {labels.openLabel} →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile (< md): card list so nothing overflows the viewport */}
      <ul
        data-testid="invoice-card-list"
        className="flex flex-col gap-3 md:hidden"
      >
        {rows.map((row) => (
          <li
            key={row.id}
            data-testid="invoice-card"
            className="rounded-xl border border-border bg-surface p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-small text-text-strong">
                  {row.invoiceNumber ?? "—"}
                </p>
                {row.duplicateCount > 0 && labels.duplicatesBadge ? (
                  <span className="mt-1 inline-flex h-5 items-center rounded-full bg-warning/15 px-2 text-[10px] font-semibold tracking-wide text-warning">
                    {labels.duplicatesBadge.replace(
                      "{count}",
                      String(row.duplicateCount)
                    )}
                  </span>
                ) : null}
              </div>
              <Link
                href={`/translate?invoiceId=${row.id}`}
                className="shrink-0 cursor-pointer text-small font-medium text-accent hover:text-accent-hover"
              >
                {labels.openLabel} →
              </Link>
            </div>
            <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1.5 text-small">
              <dt className="text-text-muted">{labels.mobileLabelDate}</dt>
              <dd className="text-text">{row.issueDate ?? "—"}</dd>
              <dt className="text-text-muted">{labels.mobileLabelSeller}</dt>
              <dd className="text-text">{row.sellerName ?? "—"}</dd>
              <dt className="text-text-muted">{labels.mobileLabelAmount}</dt>
              <dd className="text-right tabular-nums text-text">
                {formatAmount(row.totalGross, row.currency)}
              </dd>
              <dt className="text-text-muted">{labels.mobileLabelLanguages}</dt>
              <dd>
                <div className="flex flex-wrap gap-1">
                  <span
                    data-testid="lang-pill-PL"
                    className="inline-flex h-5 items-center rounded-full bg-accent-soft px-2 text-[10px] font-semibold tracking-wide text-accent"
                  >
                    PL
                  </span>
                  {row.translatedLanguages.map((lang) => (
                    <span
                      key={lang}
                      className="inline-flex h-5 items-center rounded-full bg-surface-muted px-2 text-[10px] font-semibold tracking-wide text-text"
                    >
                      {lang.toUpperCase()}
                    </span>
                  ))}
                </div>
              </dd>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
```

- [ ] **Step 5: Add the mobile-card copy keys**

Edit `components/history/history-page.tsx`. In the `COPY` constant, extend both locale blocks:

```tsx
pl: {
  // …existing keys…
  tableEmptyMessage: "Brak faktur do wyświetlenia.",
  tableDuplicatesBadge: "+{count} kopie",
  mobileLabelDate: "Data",
  mobileLabelSeller: "Sprzedawca",
  mobileLabelAmount: "Kwota",
  mobileLabelLanguages: "Języki"
},
en: {
  // …existing keys…
  tableEmptyMessage: "No invoices to show.",
  tableDuplicatesBadge: "+{count} copies",
  mobileLabelDate: "Date",
  mobileLabelSeller: "Seller",
  mobileLabelAmount: "Amount",
  mobileLabelLanguages: "Languages"
}
```

And in the `<InvoiceTable>` props block, pass them through:

```tsx
<InvoiceTable
  rows={data.rows}
  labels={{
    numberHeader: t.tableNumberHeader,
    dateHeader: t.tableDateHeader,
    sellerHeader: t.tableSellerHeader,
    amountHeader: t.tableAmountHeader,
    languagesHeader: t.tableLanguagesHeader,
    actionsHeader: t.tableActionsHeader,
    openLabel: t.tableOpenLabel,
    emptyMessage: t.tableEmptyMessage,
    duplicatesBadge: t.tableDuplicatesBadge,
    mobileLabelDate: t.mobileLabelDate,
    mobileLabelSeller: t.mobileLabelSeller,
    mobileLabelAmount: t.mobileLabelAmount,
    mobileLabelLanguages: t.mobileLabelLanguages
  }}
/>
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run test -- invoice-table history-page`
Expected: PASS.

- [ ] **Step 7: Verify in browser**

Visit `/translate/history`. At desktop width, confirm all columns sit on one line and the table fills the main content width. Use `preview_resize` to shrink to ~375px (iPhone SE) and confirm the card layout renders cleanly with no horizontal overflow. Capture `preview_screenshot` at both widths.

- [ ] **Step 8: Commit**

```bash
git add components/history/invoice-table.tsx \
        components/history/history-page.tsx \
        tests/components/history/invoice-table.test.tsx
git commit -m "fix(history): responsive table with consistent header line-height and mobile cards"
```

---

## Task 4: Cap recent-invoices sidebar at 3

**Files:**
- Modify: `components/workspace/recent-invoices-sidebar.tsx`
- Test: `tests/components/workspace/recent-invoices-sidebar.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `tests/components/workspace/recent-invoices-sidebar.test.tsx`:

```tsx
it("RECENT_LIMIT is 3 — only the 3 newest invoices are passed to the view", async () => {
  // The View takes a pre-trimmed array; the limit lives in the server wrapper.
  // We assert it indirectly by importing the constant.
  const sidebarModule = await import("@/components/workspace/recent-invoices-sidebar");
  // Re-export RECENT_LIMIT for the test to read.
  expect(sidebarModule.RECENT_LIMIT).toBe(3);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- recent-invoices-sidebar`
Expected: FAIL — `RECENT_LIMIT` either isn't exported or is `8`.

- [ ] **Step 3: Update the constant and export it for the test**

Edit `components/workspace/recent-invoices-sidebar.tsx`:

```tsx
// Export so tests can pin this value. Three is enough for "just used" — the
// rest live in /translate/history.
export const RECENT_LIMIT = 3;
```

(Replace the existing `const RECENT_LIMIT = 8;` line with the above.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- recent-invoices-sidebar`
Expected: PASS.

- [ ] **Step 5: Verify in browser**

Visit `/translate` with a user who has ≥4 invoices. Confirm the "Ostatnie" section shows exactly 3 cards and the "Historia →" link is still visible underneath. `preview_screenshot`.

- [ ] **Step 6: Commit**

```bash
git add components/workspace/recent-invoices-sidebar.tsx \
        tests/components/workspace/recent-invoices-sidebar.test.tsx
git commit -m "fix(workspace): cap Ostatnie sidebar at 3 newest; rest is in history"
```

---

## Task 5: Localize authenticated header (no more Polish in EN)

**Files:**
- Modify: `lib/workspace/copy.ts`
- Modify: `components/layout/authenticated-header.tsx`
- Modify: `app/(protected)/layout.tsx`
- Test: `tests/components/layout/authenticated-header.test.tsx`

- [ ] **Step 1: Add the copy keys**

Edit `lib/workspace/copy.ts`. Add to the `pl` block:

```tsx
navWorkspace: "Workspace",
navHistory: "Historia",
signOut: "Wyloguj",
```

Add to the `en` block:

```tsx
navWorkspace: "Workspace",
navHistory: "History",
signOut: "Log out",
```

Insert near the existing `accountTitle` / nav-related keys for clustering. The `satisfies Record<UiLanguage, …>` assertion at the bottom of the file enforces parity, so adding to one locale and forgetting the other will fail typecheck.

- [ ] **Step 2: Make `<AuthenticatedHeader>` accept labels**

Edit `components/layout/authenticated-header.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLockup } from "@/components/brand/brand-lockup";

export interface AuthenticatedHeaderLabels {
  workspace: string;
  history: string;
  signOut: string;
}

export interface AuthenticatedHeaderProps {
  email: string;
  balanceSlot: ReactNode;
  signOutAction: () => Promise<void> | void;
  labels: AuthenticatedHeaderLabels;
}

export function AuthenticatedHeader({
  email,
  balanceSlot,
  signOutAction,
  labels
}: AuthenticatedHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-3 md:px-8">
        <BrandLockup href="/app" size="md" />
        <nav className="flex items-center gap-3 text-small text-text">
          <Link href="/app" className="rounded-md px-3 py-2 hover:bg-surface-muted">
            {labels.workspace}
          </Link>
          <Link
            href="/app/history"
            className="rounded-md px-3 py-2 hover:bg-surface-muted"
          >
            {labels.history}
          </Link>
          {balanceSlot}
          <Link href="/account" className="rounded-md px-3 py-2 hover:bg-surface-muted">
            {email}
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-md px-3 py-2 text-small text-text hover:bg-surface-muted"
            >
              {labels.signOut}
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Pass labels from the protected layout**

Edit `app/(protected)/layout.tsx`. Update the `<AuthenticatedHeader>` invocation:

```tsx
<AuthenticatedHeader
  email={user.email ?? ""}
  balanceSlot={balanceSlot}
  signOutAction={signOut}
  labels={{
    workspace: String(t.navWorkspace),
    history: String(t.navHistory),
    signOut: String(t.signOut)
  }}
/>
```

- [ ] **Step 4: Update the existing header test for both locales**

Replace `tests/components/layout/authenticated-header.test.tsx` with:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthenticatedHeader } from "@/components/layout/authenticated-header";

const balanceChip = <span data-testid="balance-chip-mock">25 kredytów</span>;
const signOutAction = vi.fn();

describe("<AuthenticatedHeader>", () => {
  it("renders the brand lockup linking to /app", () => {
    render(
      <AuthenticatedHeader
        email="jane@firma.pl"
        balanceSlot={balanceChip}
        signOutAction={signOutAction}
        labels={{ workspace: "Workspace", history: "Historia", signOut: "Wyloguj" }}
      />
    );
    expect(
      screen.getByRole("link", { name: /Tłumacz Faktur KSeF/i })
    ).toHaveAttribute("href", "/app");
  });

  it("renders the Polish nav labels when given the PL label set", () => {
    render(
      <AuthenticatedHeader
        email="jane@firma.pl"
        balanceSlot={balanceChip}
        signOutAction={signOutAction}
        labels={{ workspace: "Workspace", history: "Historia", signOut: "Wyloguj" }}
      />
    );
    expect(screen.getByRole("link", { name: "Workspace" })).toHaveAttribute(
      "href",
      "/app"
    );
    expect(screen.getByRole("link", { name: "Historia" })).toHaveAttribute(
      "href",
      "/app/history"
    );
    expect(screen.getByRole("button", { name: "Wyloguj" })).toBeInTheDocument();
  });

  it("renders the English nav labels when given the EN label set", () => {
    render(
      <AuthenticatedHeader
        email="jane@firma.pl"
        balanceSlot={balanceChip}
        signOutAction={signOutAction}
        labels={{ workspace: "Workspace", history: "History", signOut: "Log out" }}
      />
    );
    expect(screen.getByRole("link", { name: "Workspace" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "History" })).toHaveAttribute(
      "href",
      "/app/history"
    );
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });

  it("renders the balance slot and email link", () => {
    render(
      <AuthenticatedHeader
        email="jane@firma.pl"
        balanceSlot={balanceChip}
        signOutAction={signOutAction}
        labels={{ workspace: "Workspace", history: "Historia", signOut: "Wyloguj" }}
      />
    );
    expect(screen.getByTestId("balance-chip-mock")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "jane@firma.pl" })).toHaveAttribute(
      "href",
      "/account"
    );
  });
});
```

- [ ] **Step 5: Hunt for other hardcoded Polish strings in the protected area**

Run:

```bash
grep -rn "Historia\|Wyloguj\|Nowa faktura\|Cały archiwum" components/ app/ --include="*.tsx" --include="*.ts" | grep -v ".test." | grep -v "lib/workspace/copy.ts"
```

Expected output after the fix: nothing in `components/layout/authenticated-header.tsx` (or any other authenticated chrome). If any new hits remain (e.g. in marketing pages), record them in a follow-up TODO but do NOT widen scope in this PR.

- [ ] **Step 6: Run the affected tests to verify they pass**

Run: `npm run test -- authenticated-header`
Expected: PASS for all four cases above.

- [ ] **Step 7: Verify in browser**

In the dev server, sign in as a user with `uiLanguage: "en"` (you can flip it in `/account`). Confirm the header shows "Workspace / History / Log out" instead of any Polish. Flip back to `pl` and confirm "Workspace / Historia / Wyloguj". `preview_screenshot` both states.

- [ ] **Step 8: Commit**

```bash
git add lib/workspace/copy.ts \
        components/layout/authenticated-header.tsx \
        app/(protected)/layout.tsx \
        tests/components/layout/authenticated-header.test.tsx
git commit -m "fix(i18n): localize authenticated header nav labels and signout"
```

---

## Task 6: Audit + fix translation editor field coverage

**Files:**
- Modify: `lib/translation/apply-edits.ts`
- Test: `tests/integration/lib/apply-translation-edits.test.ts`

**Audit summary** (read this before changing anything):

The translation engine (`lib/translation/engine.ts`) AI-translates exactly these `Invoice` fields:

| Translated field | Source task | Editor field today | Status |
|------------------|-------------|--------------------|--------|
| `items[i].translatedName` | `line_items` task | `editorItemNameLabel` | ✓ covered |
| `items[i].translatedUnit` | `units` map (keyed by `item.unit`) | `editorItemUnitLabel` | ✓ covered |
| `orders[i].lines[j].translatedName` | `line_items` task | `editorOrderLineNameLabel` | ✓ covered |
| `orders[i].lines[j].translatedUnit` | `units` map | `editorOrderLineUnitLabel` | ✓ covered |
| `additionalDescriptions[i].translatedKey` | `invoice_annotations` task | `editorAdditionalKeyLabel` | ✓ covered |
| `additionalDescriptions[i].translatedValue` | `invoice_annotations` task | `editorAdditionalValueLabel` | ✓ covered |
| `settlements.charges[i].translatedReason` | `invoice_annotations` task | `editorSettlementChargeLabel` | ✓ covered |
| `settlements.deductions[i].translatedReason` | `invoice_annotations` task | `editorSettlementDeductionLabel` | ✓ covered |
| `translatedNotes` | `invoice_annotations` task (`notes`) | `editorNotesLabel` | ✓ covered |
| `footer.translatedText` | `invoice_annotations` task (`footer`) | `editorFooterLabel` | ✓ covered |
| `translationFragments[i].translated` (generic) | `document_fragments` task | `editorFragmentsLabel` | ✓ covered |
| `correction.translatedReason` | DERIVED from fragment with `kind=correction_reason` | `editorCorrectionReasonLabel` | ⚠️ edit doesn't mirror back onto the fragment |
| `correction.translatedPeriod` | DERIVED from fragment with `kind=correction_period` | `editorCorrectionPeriodLabel` | ⚠️ edit doesn't mirror back onto the fragment |
| `payment.methodLabel` | Dictionary (`payment-methods.ts`) | (none) | ✓ correctly excluded — not AI text |
| `payment.partialPayments[i].method` | Dictionary | (none) | ✓ correctly excluded |

**Conclusion:** Editor coverage is 1:1 with AI-translated fields. The only correctness gap is the correction/fragment sync. The PDF reads `correction.translatedReason` directly (verified in `lib/pdf/invoice-pdfmake.ts:358`), so user edits *do* reach the PDF — but the underlying fragment goes stale. If any downstream code reads the fragment, it will see the original AI text. This task closes that gap by writing both fields in `applyTranslationEdits`.

- [ ] **Step 1: Write the failing test**

Add to `tests/integration/lib/apply-translation-edits.test.ts` (use whatever existing setup pattern the file uses — match its existing imports and `describe` block):

```ts
import { applyTranslationEdits } from "@/lib/translation/apply-edits";
import type { Invoice } from "@/types/invoice";

function baseInvoiceWithCorrection(): Invoice {
  return {
    invoiceNumber: "FA/1",
    issueDate: "2026-05-01",
    currency: "PLN",
    seller: { name: "Acme" },
    buyer: { name: "Beta" },
    items: [],
    totals: { net: 100, vat: 23, gross: 123 },
    correction: {
      reason: "Błąd w stawce VAT",
      translatedReason: "VAT rate error (AI)",
      period: "2026-04",
      translatedPeriod: "April 2026 (AI)"
    },
    translationFragments: [
      {
        id: "fragment-correction-reason-1",
        kind: "correction_reason",
        source: "Błąd w stawce VAT",
        translated: "VAT rate error (AI)",
        xmlPath: ["Fa", "Korekta", "Przyczyna"]
      },
      {
        id: "fragment-correction-period-1",
        kind: "correction_period",
        source: "2026-04",
        translated: "April 2026 (AI)",
        xmlPath: ["Fa", "Korekta", "Okres"]
      }
    ]
  };
}

describe("applyTranslationEdits — correction/fragment sync", () => {
  it("mirrors correction.translatedReason onto the matching translationFragment", () => {
    const before = baseInvoiceWithCorrection();
    const after = applyTranslationEdits(before, {
      correction: { translatedReason: "VAT rate error (corrected by user)" }
    });
    expect(after.correction?.translatedReason).toBe(
      "VAT rate error (corrected by user)"
    );
    const fragment = after.translationFragments?.find(
      (f) => f.kind === "correction_reason"
    );
    expect(fragment?.translated).toBe("VAT rate error (corrected by user)");
  });

  it("mirrors correction.translatedPeriod onto the matching fragment", () => {
    const before = baseInvoiceWithCorrection();
    const after = applyTranslationEdits(before, {
      correction: { translatedPeriod: "April 2026 (user)" }
    });
    expect(after.correction?.translatedPeriod).toBe("April 2026 (user)");
    const fragment = after.translationFragments?.find(
      (f) => f.kind === "correction_period"
    );
    expect(fragment?.translated).toBe("April 2026 (user)");
  });

  it("clearing the correction reason ALSO clears the matching fragment translation", () => {
    const before = baseInvoiceWithCorrection();
    const after = applyTranslationEdits(before, {
      correction: { translatedReason: "" }
    });
    expect(after.correction?.translatedReason).toBeUndefined();
    const fragment = after.translationFragments?.find(
      (f) => f.kind === "correction_reason"
    );
    expect(fragment?.translated).toBeUndefined();
  });

  it("when no correction edits are present, fragments are left untouched", () => {
    const before = baseInvoiceWithCorrection();
    const after = applyTranslationEdits(before, {
      translatedNotes: "Just notes"
    });
    const fragmentsBefore = before.translationFragments ?? [];
    const fragmentsAfter = after.translationFragments ?? [];
    expect(fragmentsAfter).toEqual(fragmentsBefore);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- apply-translation-edits`
Expected: FAIL on the two "mirrors onto fragment" cases — current code only writes `correction.translated*`.

- [ ] **Step 3: Extend `applyTranslationEdits` to mirror correction edits onto fragments**

Edit `lib/translation/apply-edits.ts`. In the block starting `if (edits.correction && next.correction)` (around line 152), add a mirror pass AFTER the existing assignments to `nextCorrection`:

Find:

```tsx
if (edits.correction && next.correction) {
  const nextCorrection = { ...next.correction };
  // …existing translatedReason and translatedPeriod assignments…
  next.correction = nextCorrection;
}
```

Replace the whole `if` block with:

```tsx
if (edits.correction && next.correction) {
  const nextCorrection = { ...next.correction };
  if (edits.correction.translatedReason !== undefined) {
    if (
      edits.correction.translatedReason === null ||
      edits.correction.translatedReason.trim() === ""
    ) {
      delete nextCorrection.translatedReason;
    } else {
      nextCorrection.translatedReason = edits.correction.translatedReason;
    }
  }
  if (edits.correction.translatedPeriod !== undefined) {
    if (
      edits.correction.translatedPeriod === null ||
      edits.correction.translatedPeriod.trim() === ""
    ) {
      delete nextCorrection.translatedPeriod;
    } else {
      nextCorrection.translatedPeriod = edits.correction.translatedPeriod;
    }
  }
  next.correction = nextCorrection;

  // Mirror the correction edit onto the underlying translationFragments so
  // anything that reads fragments (test fixtures, future renderers, exports)
  // stays consistent with what we just wrote to invoice.correction.
  if (next.translationFragments) {
    next.translationFragments = next.translationFragments.map((fragment) => {
      if (
        fragment.kind === "correction_reason" &&
        edits.correction?.translatedReason !== undefined
      ) {
        const nextFragment = { ...fragment };
        if (
          edits.correction.translatedReason === null ||
          edits.correction.translatedReason.trim() === ""
        ) {
          delete nextFragment.translated;
        } else {
          nextFragment.translated = edits.correction.translatedReason;
        }
        return nextFragment;
      }
      if (
        fragment.kind === "correction_period" &&
        edits.correction?.translatedPeriod !== undefined
      ) {
        const nextFragment = { ...fragment };
        if (
          edits.correction.translatedPeriod === null ||
          edits.correction.translatedPeriod.trim() === ""
        ) {
          delete nextFragment.translated;
        } else {
          nextFragment.translated = edits.correction.translatedPeriod;
        }
        return nextFragment;
      }
      return fragment;
    });
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- apply-translation-edits`
Expected: PASS on all four new cases.

- [ ] **Step 5: Quick verification in browser**

In the dev server, open an invoice that has a correction. Open the editor, change the "Powód korekty" / "Correction reason" field, save. Re-open the editor and confirm the new value is shown. Download the PDF and confirm the correction reason renders the edited text. `preview_screenshot` if anything looks off.

- [ ] **Step 6: Commit**

```bash
git add lib/translation/apply-edits.ts \
        tests/integration/lib/apply-translation-edits.test.ts
git commit -m "fix(translation-edits): mirror correction edits onto underlying fragments"
```

---

## Final Verification

- [ ] **Step F1: Full test suite green**

Run: `npm run test`
Expected: all tests pass. If anything fails that wasn't touched by this PR, investigate before opening the PR — do not skip with `.skip`.

- [ ] **Step F2: Lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step F3: Manual smoke in dev server**

For each of the six issues, walk the user flow that originally triggered the bug and confirm it now behaves correctly. Use `preview_screenshot` for each before/after pair where the change is visual (issues 1, 2, 3, 4, 5).

- [ ] **Step F4: Push and open PR**

```bash
git push -u origin claude/translator-ui-fixes
gh pr create --title "Translator UI fixes: nav, duplicate copy, history table, header i18n, editor audit" \
  --body "$(cat <<'EOF'
## Summary
- Fix "+ Nowe Tłumaczenie" sidebar button so it always resets the wizard, even when navigating from `/translate?invoiceId=…`.
- Let duplicate / error warning rows wrap so the user can read the whole sentence.
- Make the history table responsive with consistent header line-heights (table at md+, card list at mobile).
- Cap the "Ostatnie" sidebar at 3 newest invoices; the rest live in `/translate/history`.
- Localize the authenticated header — no more Polish "Historia / Wyloguj" in the English UI.
- Audit translation-editor field coverage against AI-translated fields; close one sync gap so correction edits mirror onto the underlying translation fragments.

## Test plan
- [ ] `npm run test` is green
- [ ] `npm run lint` is green
- [ ] `/translate?invoiceId=<uuid>` → click "+ Nowe tłumaczenie" → lands on the upload step
- [ ] Upload a duplicate-number invoice → full warning visible (no "…")
- [ ] `/translate/history` at desktop → all columns one line, table fills width
- [ ] `/translate/history` at ~375px → card list, no horizontal overflow
- [ ] Sidebar shows exactly 3 recent rows when the user has ≥4 invoices
- [ ] Set profile language to `en` → header reads "Workspace / History / Log out"
- [ ] Edit `correction.translatedReason` → re-render → both editor field and PDF reflect the new value
EOF
)"
```

Print the PR URL when done.

---

## Self-Review Notes

**Spec coverage:** Six issues, six tasks. No issue is left without a dedicated task.

**Placeholder scan:** No `TBD`, `TODO`, `implement later`. Every step has real code or a real command. The one "fill in details" risk is the lint/tsc step at the end — but those commands are concrete.

**Type consistency:** `NewTranslationLinkProps`, `InvoiceTableLabels`, and `AuthenticatedHeaderLabels` are defined in one task each and used consistently in their respective tasks. The new copy keys (`navWorkspace`, `navHistory`, `signOut`, `mobileLabel*`) are added in their task and consumed in the same task — no forward references.

**Risk hotspots:**
1. Task 1's diagnosis assumes Router Cache is the culprit. If it's actually a deeper Next.js issue, `router.refresh()` should still fix it — `refresh` invalidates the cache for the current segment.
2. Task 6's correction-fragment mirror could theoretically affect anything else that reads fragments; that downstream surface is small (PDF doesn't use fragments for correction — verified) but the new test ensures the change is bounded.
