# Tłumacz — Workspace Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`. Each task uses `- [ ]` checkbox syntax for tracking and assumes RED → GREEN → REFACTOR → COMMIT discipline. Model: **Opus, max effort** for every subagent (per `CLAUDE.md`). Branch off **`main`** only.

**Goal:** Implement the redesign specified in `docs/superpowers/specs/2026-05-20-tlumacz-workspace-redesign.md` — a three-step wizard (`/translate`) that supports batch translation with per-file progress, explicit credit cost preview, and no surprise auto-translation.

**Spec reference:** `docs/superpowers/specs/2026-05-20-tlumacz-workspace-redesign.md`.

**Branch:** `claude/translate-redesign` off `origin/main`. Do **NOT** branch off `claude/ui-overhaul-sprint-1` or any other in-flight branch.

**Estimated PRs:** 5 (one per phase). Each PR is independently shippable and behind the `NEXT_PUBLIC_TRANSLATE_V2` flag until the final cutover PR.

**Feature flag:** `NEXT_PUBLIC_TRANSLATE_V2` (string `"1"` = on; absent or any other value = off). Read in `app/(protected)/translate/page.tsx`; if off, renders a `redirect("/app")`.

---

## File structure (all phases)

### Modified
- `app/globals.css` — add `--warning` / `--warning-soft` CSS variables (Phase 1)
- `tailwind.config.ts` — register `warning` colors (Phase 1)
- `lib/workspace/copy.ts` — add new wizard copy keys (Phase 2)
- `lib/billing/credit-enforcement.ts` — add `refundForInvoice()` (Phase 3)
- `app/api/upload/route.ts` — remove credit consumption (gated by flag) (Phase 3)
- `app/api/translate/route.ts` — add credit consumption + refund on failure (gated by flag) (Phase 3)
- `components/layout/protected-sidebar.tsx` (or whatever Sprint 1 named it) — relabel + relink nav items (Phase 5)
- `app/(protected)/app/page.tsx` — convert to `redirect("/translate")` (Phase 5)
- `app/(protected)/app/history/page.tsx` — convert to `redirect("/translate/history")` (Phase 5)

### New — tokens & primitives (Phase 1)
- `components/ui/stepper.tsx` — semantic stepper (`nav` + `ol`)
- `tests/components/ui/stepper.test.tsx`

### New — wizard state + steps (Phase 2)
- `components/translate/use-translation-wizard.ts` — state hook
- `components/translate/translator-wizard.tsx` — orchestrator
- `components/translate/upload-step.tsx`
- `components/translate/upload-file-row.tsx`
- `components/translate/language-step.tsx`
- `components/translate/language-picker.tsx`
- `components/translate/format-picker.tsx`
- `components/translate/cost-preview.tsx`
- `components/translate/delivery-step.tsx`
- `components/translate/delivery-single.tsx`
- `components/translate/delivery-batch.tsx`
- `components/translate/translation-row.tsx`
- `components/translate/data-immutable-notice.tsx`
- `app/(protected)/translate/page.tsx`
- `app/(protected)/translate/history/page.tsx` (re-uses existing `<HistoryPage>` from Sprint 3)
- `app/(protected)/tlumaczenie/page.tsx` — 308 redirect to `/translate`
- Tests under `tests/components/translate/*.test.tsx` mirroring each component

### New — batch backend (Phase 3)
- `app/api/upload-batch/route.ts` — multi-file upload, no credit consumption
- `app/api/translate/batch/route.ts` — coordinate per-item translate calls (or thin wrapper around `/api/translate` invoked in parallel by the client — see Phase 3 Task 1 for the decision)
- `app/api/translate/zip/route.ts` — server-side zip of multiple PDFs by `invoiceId[]`
- `lib/translation/batch-runner.ts` — utility that wraps `Promise.allSettled` with concurrency cap
- Tests under `tests/integration/api/upload-batch.test.ts`, `.../translate-batch.test.ts`, `.../translate-zip.test.ts`

### New — E2E
- `tests/e2e/translate-wizard.spec.ts` — single-file and batch happy paths + low-credit redirect

### Deleted (final cutover, Phase 5)
- `components/workspace/translator-workspace.tsx`
- `components/workspace/workspace-toolbar.tsx`
- `components/workspace/workspace-invoice-view.tsx`
- `components/workspace/workspace-empty-state.tsx`
- `components/workspace/use-translator-workflow.ts`
- `components/workspace/language-pills.tsx` (replaced by `<LanguagePicker>`)
- `components/workspace/insufficient-credit-modal.tsx` (replaced by Step 2 inline state)
- `app/(protected)/app/` directory entirely
- `components/workspace/recent-invoices-sidebar.tsx` is **kept** (still used by Sprint 1 layout) but its links repoint to `/translate`.

---

## Branch & PR cadence

| PR | Phase | Branch off | Title prefix | Mergeable independently? |
|----|-------|-----------|--------------|--------------------------|
| #A | 1 | `main` | `feat(translate): foundation tokens + stepper primitive` | Yes (additive) |
| #B | 2 | `main` (rebased after #A merges) | `feat(translate): wizard shell + three-step UI behind flag` | Yes (flag-gated) |
| #C | 3 | `main` (rebased after #B merges) | `feat(translate): batch upload + parallel translate + zip download` | Yes (flag-gated) |
| #D | 4 | `main` (rebased after #C merges) | `feat(translate): polish, a11y, edge cases, E2E coverage` | Yes (flag-gated) |
| #E | 5 | `main` (rebased after #D merges) | `feat(translate): cutover — flip flag, redirect /app, delete legacy` | The cutover |

**Rule per `CLAUDE.md`:** Sprint N+1 cannot start until Sprint N's PR merges to `main`. Apply the same here — Phase 2 does not start until Phase 1's PR is merged.

---

# Phase 1 — Foundation tokens + stepper primitive

Tiny, low-risk PR. Lands the new color token and the reusable stepper.

## Task 1.1: Add `warning` semantic color token

**Files:**
- Modify: `app/globals.css`
- Modify: `tailwind.config.ts`
- Test: `tests/styles/tokens.test.ts` (new, smoke-tests the Tailwind config exports)

Acceptance: `bg-warning` and `bg-warning-soft` Tailwind utilities work; CSS variables resolve correctly in both light and dark `:root` blocks (currently only light defined — keep mirror discipline).

- [ ] **Step 1: Write failing test** — `tests/styles/tokens.test.ts` imports the resolved Tailwind config and asserts `theme.colors.warning` and `theme.colors["warning-soft"]` exist with expected HSL values. Run; expect failure (token not yet defined).
- [ ] **Step 2: Add CSS variables** — `app/globals.css`: add `--warning: 38 92% 50%;` and `--warning-soft: 38 92% 95%;` inside the existing `:root` block (and `.dark` if present — currently isn't; skip).
- [ ] **Step 3: Register in Tailwind** — `tailwind.config.ts`: add `warning: "hsl(var(--warning))"` and `"warning-soft": "hsl(var(--warning-soft))"` under `theme.extend.colors`.
- [ ] **Step 4: Run test** — passes. Commit.
- [ ] **Step 5: Verification** — `pnpm tsc --noEmit && pnpm build` — must succeed (Tailwind picks up new colors on build).

**Verification gate:** Cannot proceed to 1.2 until build is green.

## Task 1.2: `<Stepper>` primitive

**Files:**
- Create: `components/ui/stepper.tsx`
- Test: `tests/components/ui/stepper.test.tsx`

A semantic, server-renderable stepper. Props: `steps: { id: string; label: string }[]`, `current: string`, optional `completedIds?: Set<string>`, optional `onJumpBack?(id) => void`.

Behavior:
- Renders `<nav aria-label>` + `<ol>` + `<li>` per step.
- Active step gets `aria-current="step"`.
- Completed steps get a checkmark icon (use `lucide-react` `Check`).
- Future steps are not interactive (no `onClick` wired).
- Completed steps clickable iff `onJumpBack` is provided (uses a `<button>` with proper focus styles).
- Respects `prefers-reduced-motion` (no transitions on the connector lines).
- No emojis. Icons via `lucide-react`.

- [ ] **Step 1: Write failing test** — `tests/components/ui/stepper.test.tsx`:
  - renders correct number of `<li>` items
  - `aria-current="step"` on the active step
  - clicking a completed step calls `onJumpBack` with its id
  - clicking the active or a future step does not call `onJumpBack`
  - has `cursor-pointer` on completed steps when `onJumpBack` is provided
  - lacks `cursor-pointer` on future steps
- [ ] **Step 2: Implement** `components/ui/stepper.tsx`. Use Tailwind tokens: `accent` for active, `success` for completed, `text-muted` for future.
- [ ] **Step 3: Run tests** — green. Commit.
- [ ] **Step 4: Visual smoke** — temporarily render in `app/(protected)/account/page.tsx` to eyeball; remove before commit.

**Verification gate:** All Vitest tests pass; `pnpm tsc --noEmit` clean.

## Task 1.3: PR #A

- [ ] Push branch, open PR titled `feat(translate): foundation tokens + stepper primitive`.
- [ ] PR body lists §5.5 of the spec (token additions + stepper) and links the spec doc.
- [ ] Wait for merge before starting Phase 2.

---

# Phase 2 — Wizard shell + three-step UI behind flag

The bulk of the front-end work. Flag-gated, so the existing `/app` still ships.

## Task 2.1: Copy keys

**Files:**
- Modify: `lib/workspace/copy.ts`

Add (under both `pl` and `en` blocks):
- `wizardStepUpload: "Wybierz pliki" / "Choose files"`
- `wizardStepLanguage: "Język i format" / "Language & format"`
- `wizardStepDelivery: "Tłumaczenie" / "Translation"`
- `uploadHeading: "Wybierz pliki KSeF do tłumaczenia" / "Choose KSeF invoices to translate"`
- `uploadHelpMulti: "Wgraj jedną lub wiele faktur FA(3) XML lub PDF." / "Upload one or many FA(3) XML or PDF invoices."`
- `uploadCta: "Wybierz pliki" / "Choose files"`
- `addMoreFiles: "Dodaj pliki" / "Add files"`
- `filesReadyCountSingular: "1 plik gotowy do tłumaczenia" / "1 file ready to translate"`
- `filesReadyCountPlural: "{count} plików gotowych do tłumaczenia" / "{count} files ready to translate"`
- `parsingRow: "Sprawdzam..." / "Parsing..."`
- `removeFileLabel: "Usuń {filename}" / "Remove {filename}"`
- `continueCta: "Dalej" / "Continue"`
- `backCta: "Wstecz" / "Back"`
- `clearAllCta: "Wyczyść" / "Clear"`
- `languageHeading: "Wybierz język i format" / "Choose language and format"`
- `languageHeadingFor: "Dla {count} faktur" / "For {count} invoices"`
- `targetLangLabel: "Język docelowy" / "Target language"`
- `formatLabel: "Format PDF" / "PDF format"`
- `formatMono: "Tylko tłumaczenie" / "Translation only"`
- `formatMonoHelp: "Faktura w jednym języku (np. angielskim)." / "Invoice in a single language (e.g. English)."`
- `formatBilingualHelp: "Wybrany język + polski — po jednej kolumnie obok siebie." / "Chosen language + Polish — side by side."`
- `costLabel: "Koszt" / "Cost"`
- `balanceLabel: "Stan" / "Balance"`
- `afterLabel: "Po" / "After"`
- `creditsUnit: "kredytów" / "credits"`
- `translateCtaSingular: "Tłumacz fakturę" / "Translate invoice"`
- `translateCtaPlural: "Tłumacz {count} faktur" / "Translate {count} invoices"`
- `insufficientCreditsCta: "Doładuj kredyty" / "Top up credits"`
- `deliveryReadyTitle: "Tłumaczenie gotowe" / "Translation ready"`
- `deliveryBatchTitle: "Tłumaczę {count} faktur" / "Translating {count} invoices"`
- `progressCount: "{done} / {total} ukończonych" / "{done} / {total} done"`
- `queuedLabel: "w kolejce" / "queued"`
- `translatingLabel: "tłumaczę..." / "translating..."`
- `retryCta: "Ponów" / "Retry"`
- `previewCta: "Podgląd" / "Preview"`
- `downloadAllZipCta: "Pobierz wszystkie (.zip)" / "Download all (.zip)"`
- `translateAgainCta: "Tłumacz ten zestaw w innym języku" / "Translate this set in another language"`
- `newTranslationCta: "Nowe tłumaczenie" / "New translation"`
- `changeLanguageCta: "Zmień język" / "Change language"`
- `dataImmutableNotice: "Kwoty, NIP, IBAN i numery faktur NIE są tłumaczone przez AI." / "Amounts, tax IDs, IBANs and invoice numbers are NOT translated by AI."`
- `polishSourceLocked: "Polski jest językiem źródłowym — wybierz inny język docelowy." / "Polish is the source language — choose a different target."`
- `cacheHitBadge: "Z cache — bez opłaty" / "From cache — free"`

(No test for copy — it's a constant. Type-check will catch missing keys when consumers reference them.)

- [ ] **Step 1:** Add the keys under both `pl` and `en`.
- [ ] **Step 2:** Run `pnpm tsc --noEmit` — passes (no consumer yet).
- [ ] **Step 3:** Commit.

## Task 2.2: `useTranslationWizard` hook (state machine)

**Files:**
- Create: `components/translate/use-translation-wizard.ts`
- Test: `tests/components/translate/use-translation-wizard.test.ts`

Implements the state model in spec §6.1. Pure state transitions (immutable). All side effects (fetch calls) injected via a small `wizardApi` object so tests can mock.

```typescript
interface WizardApi {
  uploadBatch(files: File[]): Promise<UploadBatchResponse>;
  translate(invoiceId: string, lang: LanguageCode, bilingual: boolean): Promise<TranslateResponse>;
  generatePdf(invoiceId: string, lang: WorkspaceLanguageCode, bilingual: boolean): Promise<Blob>;
  downloadZip(invoiceIds: string[], lang: LanguageCode, bilingual: boolean): Promise<Blob>;
}
```

- [ ] **Step 1: Write failing tests** covering:
  - initial state is `{ step: "upload", files: [], language: null, bilingual: false, jobItems: [] }`
  - `addFiles([f1, f2])` mutates only `files`, all with `status: "parsing"`
  - after mock `uploadBatch` resolves, files transition to `ready` with their `invoiceId`
  - `goNext()` from upload step requires every file to be `ready` (else no-op)
  - `goNext()` from upload step lands in `language` step
  - `setLanguage("pl")` is rejected (PL is forbidden as target)
  - `startTranslation()` from language step requires `language !== null`
  - `startTranslation()` constructs `jobItems` with status `queued`, then transitions one to `translating`, then `done` as the mocked translate resolves
  - `retryItem(id)` re-issues translate for a single item
  - cost calculation: `files.length * 1` (one credit per file)
  - immutability: returned state objects are different references after each transition
- [ ] **Step 2: Implement** the hook with discriminated-union reducer pattern. Use `useReducer` for clarity. Concurrency cap of 3 via a tiny internal in-flight counter (no extra dep).
- [ ] **Step 3:** Tests green. Commit.

**No `useEffect` triggers translation.** The user clicks "Tłumacz" and `startTranslation()` is called explicitly.

## Task 2.3: `<Stepper>` integration in shell

**Files:**
- Create: `components/translate/translator-wizard.tsx`
- Test: `tests/components/translate/translator-wizard.test.tsx`

The orchestrator. Renders `<Stepper>` + the active step component. Pure composition — no business logic of its own.

- [ ] **Step 1: Write failing test** — renders stepper with 3 items; current matches state.step; switches to the next step component when `goNext` fires.
- [ ] **Step 2: Implement.**
- [ ] **Step 3:** Tests green. Commit.

## Task 2.4: `<UploadStep>` + `<UploadFileRow>`

**Files:**
- Create: `components/translate/upload-step.tsx`
- Create: `components/translate/upload-file-row.tsx`
- Test: `tests/components/translate/upload-step.test.tsx`
- Test: `tests/components/translate/upload-file-row.test.tsx`

`<UploadStep>`: empty state (drop zone hero) vs files-listed state (left = small drop zone, right = file list).

`<UploadFileRow>`: per-file row with status icon + name + size + remove button + (in error state) error reason.

- [ ] **Step 1: Write failing tests** for both:
  - `UploadStep` shows hero drop zone when `files.length === 0`
  - `UploadStep` shows file-list layout when `files.length > 0`
  - `UploadStep` clicking "Dalej →" calls `onNext` only when all files are ready
  - `UploadStep` "Wyczyść" button clears all files
  - `UploadFileRow` renders spinner for `parsing` status
  - `UploadFileRow` renders check + name + size for `ready` status
  - `UploadFileRow` renders danger icon + reason for `error` status
  - `UploadFileRow` remove button has correct `aria-label`
- [ ] **Step 2: Implement** using the existing `WorkspaceEmptyState` as a starting point — port the keyboard handlers verbatim.
- [ ] **Step 3:** Tests green. Commit.

## Task 2.5: `<LanguageStep>` (picker + format + cost preview)

**Files:**
- Create: `components/translate/language-step.tsx`
- Create: `components/translate/language-picker.tsx`
- Create: `components/translate/format-picker.tsx`
- Create: `components/translate/cost-preview.tsx`
- Tests for each in `tests/components/translate/`

`<LanguagePicker>`: a Combobox with search + the 4 most-used quick-pick chips (EN, DE, FR, ES — sourced from `getLanguageOptions(uiLanguage)` minus `pl`). Polish is excluded from the list. Keyboard-navigable.

`<FormatPicker>`: pure two-radio component.

`<CostPreview>`: reads `balance` (initial via prop, listens to `credit-balance-changed` event for updates). Calculates `cost = files.length`, `after = balance - cost`. Flips to danger styling when `after < 0`.

`<LanguageStep>`: composes the three, manages "Wstecz" / "Tłumacz N faktur →" footer.

- [ ] **Step 1:** Failing tests per component covering: PL filtering, keyboard nav, cost math, low-balance CTA swap.
- [ ] **Step 2:** Implement each.
- [ ] **Step 3:** Tests green. Commit.

## Task 2.6: `<DeliveryStep>` (single + batch branches)

**Files:**
- Create: `components/translate/delivery-step.tsx`
- Create: `components/translate/delivery-single.tsx`
- Create: `components/translate/delivery-batch.tsx`
- Create: `components/translate/translation-row.tsx`
- Tests for each

`<DeliveryStep>` branches on `jobItems.length === 1` → `<DeliverySingle>` else `<DeliveryBatch>`.

`<DeliverySingle>` re-uses the existing `OfficialPdfPreview` machinery (extract from `workspace-invoice-view.tsx` into a standalone component in this phase or wait for Phase 5 cleanup; choose extract now).

`<DeliveryBatch>` renders progress bar + `<TranslationRow>` list + zip download CTA + "translate again" CTA.

`<TranslationRow>`: per-item row, mirror of `<UploadFileRow>` but for translate state.

- [ ] **Step 1:** Failing tests per component.
- [ ] **Step 2:** Extract `OfficialPdfPreview` to `components/translate/official-pdf-preview.tsx` (was inlined in `workspace-invoice-view.tsx`). Re-export from old path for Phase 5 to clean up.
- [ ] **Step 3:** Implement all four.
- [ ] **Step 4:** Tests green. Commit.

## Task 2.7: Route + Polish-route alias

**Files:**
- Create: `app/(protected)/translate/page.tsx`
- Create: `app/(protected)/translate/history/page.tsx`
- Create: `app/(protected)/tlumaczenie/page.tsx`

`/translate/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { TranslatorWizard } from "@/components/translate/translator-wizard";
import { LowBalanceBanner } from "@/components/billing/low-balance-banner";
import { RecentInvoicesSidebar } from "@/components/workspace/recent-invoices-sidebar";
import { requireUser } from "@/lib/auth/require-user";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { getCurrentBalance } from "@/lib/billing/get-current-balance";

const FLAG_ON = process.env.NEXT_PUBLIC_TRANSLATE_V2 === "1";

export default async function TranslatePage() {
  if (!FLAG_ON) redirect("/app");
  const user = await requireUser();
  const { uiLanguage } = await getCurrentProfile(user.id);
  const balance = await getCurrentBalance(user.id);
  return (
    <div className="...same shell as /app/page.tsx...">
      <RecentInvoicesSidebar userId={user.id} uiLanguage={uiLanguage} />
      <main className="...">
        <LowBalanceBanner ... />
        <TranslatorWizard uiLanguage={uiLanguage} initialBalance={balance} />
      </main>
    </div>
  );
}
```

`/translate/history/page.tsx`: re-imports the Sprint 3 history page composition. (We may relocate the components in Phase 5 cleanup; the route just renders them.)

`/tlumaczenie/page.tsx`: one-liner `redirect("/translate", "replace")` with `permanent: true`.

- [ ] **Step 1:** Build the three route files.
- [ ] **Step 2:** Manual smoke (locally with `NEXT_PUBLIC_TRANSLATE_V2=1 pnpm dev`) — wizard renders, sidebar still works.
- [ ] **Step 3:** Commit.

## Task 2.8: PR #B

- [ ] Open PR `feat(translate): wizard shell + three-step UI behind flag`.
- [ ] PR description: link the spec, list files added, note the flag is **off** by default.
- [ ] Confirm CI green, merge, then start Phase 3.

---

# Phase 3 — Batch upload + credit-shift + zip download

## Task 3.1: Decide batch transport — single endpoint vs N parallel client requests

Single endpoint chosen per spec §6.4. (Captured here for the implementer record — no design alternatives to reopen.)

## Task 3.2: `POST /api/upload-batch`

**Files:**
- Create: `app/api/upload-batch/route.ts`
- Test: `tests/integration/api/upload-batch.test.ts`

Multipart form with up to 20 `file` fields. Loops `uploadInvoiceForUser` per file. **Does NOT consume credit.** Returns `{ results: Array<{ ok: true; invoiceId; invoiceNumber; warnings; isNew } | { ok: false; filename; error }> }`.

- [ ] **Step 1:** Failing integration test using the existing test harness (real Supabase, real admin client):
  - posts 3 files, gets 3 results
  - 4th file with unsupported MIME → individual error result, other 3 still succeed
  - 21st file in one request → 413 response with all 21 rejected
  - confirms NO `credit_ledger` row written
- [ ] **Step 2:** Implement.
- [ ] **Step 3:** Tests green. Commit.

## Task 3.3: Remove credit consumption from `/api/upload`

**Files:**
- Modify: `app/api/upload/route.ts`
- Modify: `tests/integration/api/upload.test.ts` (if exists)

Behind the flag. Strategy:

```typescript
const TRANSLATE_V2 = process.env.NEXT_PUBLIC_TRANSLATE_V2 === "1";
// ...
if (result.isNew && !TRANSLATE_V2) {
  await consumeCreditForInvoice(...);
}
```

The flag is **public** by Next.js convention but read on the server here — that's fine for boolean read-only access.

- [ ] **Step 1:** Update existing upload integration test to assert: with `TRANSLATE_V2=1`, no ledger row is written; with the flag absent, behavior is unchanged.
- [ ] **Step 2:** Implement the guard.
- [ ] **Step 3:** Run both branches of the test. Green. Commit.

## Task 3.4: Add credit consumption + refund to `/api/translate`

**Files:**
- Modify: `lib/billing/credit-enforcement.ts` — add `refundForInvoice()`
- Modify: `app/api/translate/route.ts`
- Test: `tests/integration/lib/credit-enforcement-refund.test.ts`
- Test: `tests/integration/api/translate.test.ts` (extend)

`refundForInvoice` inserts a `credit_ledger` row with `delta_paid: +1` (or `delta_free` if the original consume was a free credit — look up the original row to determine which bucket).

`/api/translate` flow with flag on:
1. Authenticate.
2. Look up invoice; if its `invoice_id` already has a `translation` row for `(language, bilingual)`, return cached **without** consuming.
3. Consume credit (use existing `consumeCreditForInvoice`).
4. Call translation engine.
5. On failure (5xx after retries), `refundForInvoice` and return 502.
6. On success, persist translation and return.

- [ ] **Step 1:** Failing tests for refund helper + translate endpoint covering: cache hit → no consume, fresh success → consume only, failure → consume + refund (net zero), low credits → 402 before consume.
- [ ] **Step 2:** Implement.
- [ ] **Step 3:** Green. Commit.

## Task 3.5: `<TranslatorWizard>` wires up the real API

**Files:**
- Modify: `components/translate/use-translation-wizard.ts` (the `wizardApi` default impl)
- Test: extend `use-translation-wizard.test.ts`

The default impl posts to `/api/upload-batch`, `/api/translate`, `/api/pdf` for previews. Concurrency cap of 3 enforced client-side.

- [ ] **Step 1:** Extend tests for the wire-up (mock `fetch` per call).
- [ ] **Step 2:** Implement.
- [ ] **Step 3:** Green. Commit.

## Task 3.6: `POST /api/translate/zip`

**Files:**
- Create: `app/api/translate/zip/route.ts`
- Test: `tests/integration/api/translate-zip.test.ts`

Input: `{ invoiceIds: string[], language, bilingual }`. For each id, generate the PDF (re-use the `/api/pdf` codepath), stream into a zip. Use `jszip` (already a transitive dep? check; if not, add — small footprint).

- [ ] **Step 1:** Failing test: post a small batch, assert response is a valid zip with N entries, each entry decodes to a valid PDF.
- [ ] **Step 2:** Implement; ensure auth + ownership check on every invoice id (no IDOR).
- [ ] **Step 3:** Green. Commit.

## Task 3.7: PR #C

- [ ] Open PR `feat(translate): batch upload + parallel translate + zip download`.
- [ ] Note schema unchanged; flag still off.
- [ ] Merge, start Phase 4.

---

# Phase 4 — Polish, a11y, edge cases, E2E

## Task 4.1: A11y audit (per spec §8)

- [ ] Add `eslint-plugin-jsx-a11y` rules if missing; resolve all warnings in `components/translate/*`.
- [ ] Manual NVDA / VoiceOver pass on Step 1, Step 2, Step 3 (single + batch).
- [ ] Add Playwright `@axe-core/playwright` step that runs against `/translate` with flag on; gate CI on zero serious/critical violations.
- [ ] Commit fixes incrementally.

## Task 4.2: Edge case coverage (per spec §7)

For each row in the matrix:

- [ ] Unit test or E2E test that exercises the behavior.
- [ ] Implementation tweak if behavior diverges.
- [ ] Commit per row or per logical group.

Focus rows for v1:
- Unsupported file rejection (per-row)
- Mid-batch credit exhaustion → graceful degradation
- Same-file duplicate in one batch → client dedupe
- Cache-hit retry shows the "Z cache — bez opłaty" badge
- PDF preview iframe fallback to `<InvoicePreview>` still works

## Task 4.3: E2E happy path

**Files:**
- Create: `tests/e2e/translate-wizard.spec.ts`

Two top-level cases:

1. Single-file: log in as a credited user, upload 1 sample XML, pick EN, monolingual, translate, see preview, click download.
2. Batch: log in, upload 3 sample XMLs (use the sample file path that already exists), pick DE, bilingual, translate, watch progress complete, download zip.

Plus:
3. Low credit: log in as a 0-credit user, get redirected to /billing from Step 2.

- [ ] Write the spec file using the Sprint 3 Playwright patterns as a template.
- [ ] Run locally with `NEXT_PUBLIC_TRANSLATE_V2=1 pnpm test:e2e -- translate-wizard.spec.ts`.
- [ ] Add to the CI matrix.

## Task 4.4: PR #D

- [ ] Open PR `feat(translate): polish, a11y, edge cases, E2E coverage`.
- [ ] Include axe results screenshot in PR description.
- [ ] Merge.

---

# Phase 5 — Cutover

## Task 5.1: Sidebar relabel + relink

**Files:**
- Modify: `components/layout/protected-sidebar.tsx` (whatever file owns sidebar nav)

Repoint the primary CTA to `/translate`, rename "Nowa faktura" → "+ Nowe tłumaczenie", relabel archive link "Historia."

- [ ] **Step 1:** Update labels via `copy.ts` keys (most already exist; verify).
- [ ] **Step 2:** Update hrefs.
- [ ] **Step 3:** Snapshot test (if sidebar has one) updated.
- [ ] **Step 4:** Commit.

## Task 5.2: `/app` redirects + delete legacy

**Files:**
- Modify: `app/(protected)/app/page.tsx` → `redirect("/translate")` (one-liner)
- Modify: `app/(protected)/app/history/page.tsx` → `redirect("/translate/history")`
- Delete: `components/workspace/translator-workspace.tsx`
- Delete: `components/workspace/workspace-toolbar.tsx`
- Delete: `components/workspace/workspace-invoice-view.tsx` (after confirming `OfficialPdfPreview` was extracted in 2.6)
- Delete: `components/workspace/workspace-empty-state.tsx`
- Delete: `components/workspace/use-translator-workflow.ts`
- Delete: `components/workspace/language-pills.tsx`
- Delete: `components/workspace/insufficient-credit-modal.tsx`
- Delete: all `tests/components/workspace/*.test.tsx` covering the above
- Keep: `components/workspace/recent-invoices-sidebar.tsx` (re-used; just relink its anchor hrefs)

- [ ] **Step 1:** Replace page contents with redirects.
- [ ] **Step 2:** Delete files.
- [ ] **Step 3:** `pnpm tsc --noEmit` to find dangling imports; fix.
- [ ] **Step 4:** `pnpm test` — all green.
- [ ] **Step 5:** Commit.

## Task 5.3: Flip the flag — default ON

**Files:**
- Modify: `app/(protected)/translate/page.tsx` — delete the `if (!FLAG_ON) redirect("/app");` lines.
- Modify: `app/api/upload/route.ts` — delete the `TRANSLATE_V2` guard; new behavior is the only behavior.
- Modify: `app/api/translate/route.ts` — same.
- Optionally remove the `NEXT_PUBLIC_TRANSLATE_V2` from `.env.example`.

- [ ] **Step 1:** Delete flag reads.
- [ ] **Step 2:** Run full test suite + E2E.
- [ ] **Step 3:** Commit.

## Task 5.4: PR #E — cutover

- [ ] Open PR `feat(translate): cutover — flip flag, redirect /app, delete legacy`.
- [ ] PR body includes the user-facing changelog (PL + EN one-liners) for the release notes.
- [ ] Merge.
- [ ] Tag release `v0.X.0` (next minor).

---

# Verification gates (apply at every PR boundary)

Before opening any PR:

- [ ] `pnpm tsc --noEmit` clean (no `// @ts-expect-error` regressions, no `any` introduced).
- [ ] `pnpm lint` clean (or only auto-fixable warnings).
- [ ] `pnpm test` — 100% passing, **and** coverage on changed files ≥ 80% (per `~/.claude/rules/common/testing.md`).
- [ ] `pnpm build` succeeds.
- [ ] If the PR touches `/translate`: `pnpm test:e2e -- translate-wizard.spec.ts` green locally.
- [ ] Manual smoke in dev with `NEXT_PUBLIC_TRANSLATE_V2=1`.
- [ ] No `console.log` left behind (the user's hook will flag these — pre-check anyway).

# Out of scope (defer to v2)

- Persistent batch jobs (survive reload).
- Streaming SSE progress instead of polling-by-completion.
- "Translate again in another language" pre-population from history rows.
- Multi-target translation in one job (e.g., "EN + DE in one go").
- Custom PDF templates / branding (Enterprise tier).
- Webhook notification when a long batch completes.

# Acceptance demo (for the user — what we'll record at the end)

A 90-second screencast showing:
1. Empty `/translate`. Drop 3 XML files.
2. See per-file parse status.
3. Continue to Step 2. Pick German + bilingual.
4. See cost preview "3 kredyty, po: 7."
5. Click translate. Watch progress.
6. Download one PDF mid-flight; download zip when done.
7. Click "Nowe tłumaczenie" — empty state again. Sidebar shows the just-finished batch in "Ostatnie."
