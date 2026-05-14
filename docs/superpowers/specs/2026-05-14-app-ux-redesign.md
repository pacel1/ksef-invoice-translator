# KSeF SaaS — `/app` UX Redesign Spec

**Date:** 2026-05-14
**Status:** Draft for review
**Owner:** Jakub Śledź
**Scope:** `/app` workspace + protected layout header. **Not** the marketing page, not `/account`, not `/billing`, not the future history page.

## 1. Goal

Make the authenticated workspace feel like a deliberate product, not a thin wrapper around an API. Specifically:

- Buying credits must be a one-click action from anywhere in the dashboard.
- After uploading and translating one invoice, uploading the next must take one click — not a page refresh.
- Translating one invoice to multiple languages must take one click per language, not three.
- Users with zero balance must see the option to buy upfront, not via a reactive modal mid-upload.

Out of scope: history page (Phase 5), keyboard shortcuts, onboarding tour.

## 2. Problem statement (what's wrong today)

The authenticated workspace at `/app` is a single client component that renders three states inline (empty → uploading → invoice-loaded). Several issues compound:

- **`<BalanceChip>` is decorative.** It shows the user's balance but isn't clickable. To buy credits, users must know `/billing` exists and navigate there manually.
- **No "upload another" action.** After a successful upload, the drop zone is replaced by the invoice preview. The workflow hook has a `reset()` function but no UI surface invokes it.
- **Multi-language workflow is verbose.** Translating one invoice to two languages requires six clicks (pick language → Translate → Download × 2). Cached translations exist in the `translations` table but the UI gives no indication that a previously-translated language will load instantly.
- **Action toolbar sits at the top.** Once the invoice preview is rendered, users scroll down to read it and the Translate/Download buttons disappear off-screen.
- **Empty state has zero context.** First-time users see only "Wgraj KSeF FA(3) XML lub PDF" with no explanation of pricing, capabilities, or workflow.
- **No proactive low-balance prompt.** The insufficient-credit modal fires only on a 402 response. A user with zero credits gets no signal until they've already picked a file.

## 3. Approach

Workflow-focused redesign (Approach B from the brainstorming session). Touches the workspace component + protected header + a handful of new sub-components. Preserves the existing API surface (`/api/upload`, `/api/translate`, `/api/pdf`) and the SQL schema.

## 4. Component changes

### 4.1 `<BalanceChip>` → clickable button

The chip in `app/(protected)/layout.tsx` becomes a `<Link>` to `/billing`.

Visual states:
- **Default** (free ≥ 1 OR paid ≥ 1): white background, slate border, cyan `CreditCard` icon, balance text, faint `›` chevron on the right.
- **Hover/focus**: slate-50 background, icon swaps to `Plus`, label "Doładuj" / "Top up" appears as a tooltip.
- **Zero-balance** (free === 0 AND paid === 0): amber border + amber-50 background, `AlertCircle` icon, text reads `Brak kredytów / Out of credits` instead of `0 free · 0 credits`.

Accessibility:
- Real `<Link href="/billing">` so right-click/middle-click work.
- `aria-label` includes the full balance breakdown ("1 free credit and 35 paid credits — click to top up").
- Keyboard focusable; visible focus ring.

The chip's auto-refresh behaviour on the `credit-balance-changed` window event stays exactly as-is. The component file grows slightly but stays focused on one thing.

### 4.2 `<TranslatorWorkspace>` → split into states with a sticky toolbar

The current monolithic component (~150 lines) becomes:

- `<TranslatorWorkspace>` — the orchestrator. Owns the workflow hook. Decides which child to render.
- `<WorkspaceEmptyState>` — shown when no invoice is loaded. The drop zone (60% width) sits next to an onboarding side panel (40%). On mobile, stacks vertically.
- `<WorkspaceInvoiceView>` — shown when an invoice is loaded. Wraps `<InvoicePreview>` and provides the sticky bottom toolbar.
- `<WorkspaceToolbar>` — the sticky action bar. Contains the language pills, bilingual toggle, Download, and "Nowa faktura" / "New invoice" buttons. Pinned to `bottom: 0` with `position: sticky` and a translucent backdrop blur so the invoice text underneath stays slightly visible.

The decomposition keeps each file small (~80 lines each) and lets us test the empty state and the loaded state independently.

### 4.3 New: `<LanguagePills>` replaces the language `<select>`

A horizontal row of pill-shaped buttons for the user's commonly-used languages:

```
┌─────────────┐ ┌─────────────┐ ┌──────────┐ ┌──────────┐ ┌─────┐
│  EN  ✓      │ │  DE  ✓      │ │  FR      │ │  ES      │ │  +  │
└─────────────┘ └─────────────┘ └──────────┘ └──────────┘ └─────┘
   active        cached         uncached    uncached     more
```

- Pill = a language code + checkmark when that translation is cached for the current invoice.
- The active pill (currently displayed) has a filled cyan background.
- Inactive cached pills have a slate-100 background.
- Inactive uncached pills have a white background with slate border.
- The "+" pill opens a popover with the full 20-language list from `getLanguageOptions`.

Clicking any pill switches the displayed language. Implementation-wise, clicking a pill calls the existing `translate(language, bilingual)` workflow function — which already hits `/api/translate` with `invoiceId`, and the route already uses the translation cache. If the translation is cached, the response is near-instant. The pill checkmark appears once the response succeeds.

The default visible pills are: EN, DE, FR, ES, IT (matching the most common contractor-language pattern for Polish businesses). Adding 6+ pills clutters the toolbar; the "+" overflow handles the long tail.

Bilingual toggle stays as a separate checkbox in the toolbar, since it's a different concept from language selection.

### 4.4 New: `<LowBalanceBanner>` — proactive zero-balance prompt

When the server-rendered workspace page detects that `free_credits_remaining === 0 && paid_credits === 0`, it renders a banner above the workspace:

```
⚠️  Brak kredytów. Wykorzystałeś darmową fakturę w tym miesiącu.
    Kup pakiet, aby przesłać kolejną.                    [Kup pakiet →]
```

PL/EN copy via the existing `lib/workspace/copy.ts` (add new keys).

Dismissable per session via `sessionStorage`. If dismissed, doesn't re-appear until the next page load. Doesn't block uploads — the `<InsufficientCreditModal>` still handles the 402 case if a user dismisses the banner and tries anyway.

### 4.5 `useTranslatorWorkflow` gains `cachedLanguages`

The hook gets a new piece of state: `cachedLanguages: Set<LanguageCode>`. Initialized from a server-side prop on the workspace page (cached translations for the current invoice, queried at SSR time). Updated client-side after each successful `translate()` response.

The hook also exposes the existing `reset()` for the "Nowa faktura" button.

API surface:

```ts
interface UseTranslatorWorkflowResult {
  invoice: Invoice | null;
  invoiceId: string | null;
  status: WorkflowStatus;
  messages: string[];
  insufficientCredit: boolean;
  cachedLanguages: Set<LanguageCode>;          // new
  currentLanguage: LanguageCode;               // new — moved from local state in the component
  setCurrentLanguage(lang: LanguageCode): void; // new — handles "click pill" => translate if needed
  bilingual: boolean;                           // new — moved from local state
  setBilingual(value: boolean): void;           // new
  upload(file: File): Promise<void>;
  downloadPdf(): Promise<void>;                 // signature simplified — uses currentLanguage + bilingual
  dismissInsufficientCredit(): void;
  reset(): void;
}
```

`setCurrentLanguage` does the right thing: if the language is cached, it just updates the displayed view (sets `currentLanguage`) and the component re-renders the existing translated invoice. If not cached, it triggers `/api/translate` and shows a loading state on the pill.

The hook stops being a pure-state hook and becomes the single source of truth for the workspace's interactive state. That's appropriate — putting `currentLanguage` and `bilingual` in the component felt fine when the component was monolithic, but with the new sub-components they'd need to be lifted up anyway.

### 4.6 No SSR query for cached translations (v1)

The workspace doesn't currently persist "currently open invoice" — no `invoiceId` in the URL or session state. Page refresh clears the workspace. Therefore `cachedLanguages` starts empty on every visit and gets populated client-side as the user clicks pills.

This means a user who uploads, translates to EN, refreshes the page, would lose the EN checkmark visual — but the underlying server-side cache still works, so clicking EN remains near-instant. Acceptable v1 fidelity.

If we later add `/app?invoice=<id>` for shareable invoice URLs (likely in or after the Phase 5 history page), we add the SSR query then. For this redesign, no new API or SSR work is needed.

## 5. Data flow (revised)

1. User lands on `/app`. SSR renders the protected layout with the current balance (already happens).
2. If balance is zero, `<LowBalanceBanner>` renders above `<TranslatorWorkspace>`.
3. Workspace shows `<WorkspaceEmptyState>` with drop zone + side panel.
4. User uploads → `useTranslatorWorkflow.upload()` runs as today. On success, the workspace switches to `<WorkspaceInvoiceView>` and the sticky `<WorkspaceToolbar>` becomes visible.
5. The default `currentLanguage` is the user's profile locale (read from the existing SSR locale prop) — auto-translate fires immediately on upload. The first pill ("EN" or "DE" depending on locale) shows a spinner until the translation completes; then the checkmark appears and the pill becomes active.
6. User clicks a different language pill → `setCurrentLanguage(lang)`:
   - If cached: instant switch.
   - If not: triggers `/api/translate`, pill spinner, checkmark on success.
7. User clicks "Pobierz PDF" → `/api/pdf` with the current `invoiceId + language + bilingual`. PDF download.
8. User clicks "Nowa faktura" → `reset()`. Workspace returns to empty state.

## 6. Files affected

### New
- `components/workspace/workspace-empty-state.tsx`
- `components/workspace/workspace-invoice-view.tsx`
- `components/workspace/workspace-toolbar.tsx`
- `components/workspace/language-pills.tsx`
- `components/billing/low-balance-banner.tsx`

### Modified
- `components/billing/balance-chip.tsx` — wrap in `<Link>`, add zero-balance variant
- `components/workspace/translator-workspace.tsx` — slim down to orchestrator (~40 lines)
- `components/workspace/use-translator-workflow.ts` — add `cachedLanguages`, lift `currentLanguage` and `bilingual` from the component, expose `reset()`
- `app/(protected)/layout.tsx` — pass zero-balance state to `<BalanceChip>` (it already gets the balance values; just one extra prop)
- `app/(protected)/app/page.tsx` — render `<LowBalanceBanner>` conditionally
- `lib/workspace/copy.ts` — new keys (`topUp`, `outOfCreditsBanner`, `outOfCreditsBannerBody`, `newInvoice`, `tryWithSample`, `whatYouGet`, `whatYouGetItems`, `recentActivity`, `recentActivityEmpty`, etc.)

### NOT touched
- `app/page.tsx` (marketing page) — out of scope.
- `app/(protected)/billing/page.tsx` — already redesigned in Phase 4.
- `app/(protected)/account/page.tsx` — out of scope.
- The API routes — no contract changes.
- The SQL schema — no migrations needed.

## 7. Visual identity

Keeping the current cyan + slate palette and shadcn-style primitives. The implementation plan will invoke `frontend-design:frontend-design` for the visual polish on the new components — specifically `<LanguagePills>` (which has the most novel shape), `<WorkspaceToolbar>` (the sticky-blur backdrop is a meaningful new pattern), and the new empty-state side panel layout.

## 8. Accessibility considerations

- All new interactive elements (pills, buttons, banner CTAs) keyboard-navigable.
- The sticky toolbar uses `role="region"` with an `aria-label`.
- The language pills have `aria-pressed` states. Active pill announces "currently selected".
- The low-balance banner has `role="status"` + `aria-live="polite"` for screen-reader announcement on appearance.
- Touch targets ≥ 44×44px on mobile per WCAG.

## 9. Mobile considerations

- Sticky toolbar collapses into a bottom sheet on `<md` viewports.
- Language pills horizontally scroll if more than 4 fit; "+" pill stays anchored on the right.
- Empty-state side panel stacks below the drop zone.

## 10. Error states

- Upload error: existing red banner above the drop zone. Unchanged.
- Translate error: pill stays uncached, error shown in the toolbar messages strip.
- PDF error: existing toast. Unchanged.
- Insufficient credit during upload: existing `<InsufficientCreditModal>` still fires. The proactive banner doesn't replace it — both can coexist.

## 11. Testing strategy

- Unit tests for `<LanguagePills>` (Vitest + jsdom) — covers active/cached/uncached/click behaviour.
- Unit tests for `<BalanceChip>` zero-balance variant.
- Component test for `<WorkspaceToolbar>` — verifies the sticky positioning class is present and `aria-pressed` toggles on pill click.
- An E2E test (`tests/e2e/workspace-redesign.spec.ts`) walking the full flow: sign in → upload → translate to EN → switch to DE (uncached, longer wait) → switch back to EN (instant) → download PDF → click "Nowa faktura" → drop zone visible again.
- The existing workspace E2E spec gets updated to use the new selectors (sticky toolbar instead of top buttons).

## 12. Implementation phasing

This spec is one phase ("Phase 4.6" — the in-between of Phases 4 and 5). One implementation plan, ~8 tasks, dispatched subagent-driven the same way Phases 1–4 ran.

Rough task breakdown the writing-plans skill will produce:

1. Copy strings (new PL/EN keys in `lib/workspace/copy.ts`)
2. `<BalanceChip>` clickable + zero-balance variant
3. `useTranslatorWorkflow` refactor (lift state, add `cachedLanguages`)
4. `<LanguagePills>` component + unit tests
5. `<WorkspaceToolbar>` component
6. `<WorkspaceEmptyState>` with onboarding side panel
7. `<WorkspaceInvoiceView>` + workspace orchestrator slimming
8. `<LowBalanceBanner>` + workspace page wiring
9. Update existing workspace E2E + add the new redesign E2E spec

## 13. Decisions made on the user's behalf (per "don't stop for questions")

- **No keyboard shortcuts.** Nice-to-have; not blocking. Defer.
- **No "translate to all" button.** The language-pill UI already approaches one-click-per-language; a bulk-translate button would slam OpenAI with N requests at once for a marginal UX win. YAGNI.
- **No URL state for current invoice.** `/app?invoice=<id>` is a feature for the history page (Phase 5). Today's workspace state is in-memory; refresh clears it. Acceptable.
- **Sample-invoice button stays in scope but still consumes a credit.** Keeps the credit model uniform; users with 1 free credit can try the sample once per month.
- **Default language pills**: EN, DE, FR, ES, IT. The 5 most common contractor languages for Polish B2B services. Other 15 languages via the "+" overflow.
- **Banner uses sessionStorage for dismissal** (not localStorage). User sees it once per browsing session; re-shows on next visit. Less annoying than localStorage, more reminder than nothing.

## 14. Open risks

- **The sticky toolbar's backdrop blur may not render correctly on Safari < 17.** Mitigation: feature-detect with `@supports (backdrop-filter: blur(...))`; fall back to solid bg on older Safari. Worth one extra line of CSS.
- **Translating on language-pill click is a behavioural change.** Today the user must explicitly click "Translate". The new design auto-translates on pill click. If a user with low credits clicks several pills in quick succession before realising each costs an OpenAI call (though cached after first), they could be surprised. Mitigation: translation costs are not user-visible — only credit consumption is, and credits are consumed at upload time, not translate time. Per the current model, translate is free. So auto-translating on pill click is consistent with "translate is free, just slower the first time per language".
- **`<LanguagePills>` showing "EN ✓" cached state requires either an SSR-fetched list or an in-memory tracker.** The spec chooses in-memory (resets per session). If a user uploads, translates EN, refreshes, the EN checkmark is gone but clicking EN is still cache-fast. The visual loses fidelity across reloads. Acceptable for v1; tighten in v2 if needed.

## 15. Success criteria

After this lands, each of the following should be doable from the `/app` page in one or two clicks (no URL bar typing, no page refresh):

- [ ] Top up credits — one click on the chip
- [ ] Upload another invoice after translating one — one click on "Nowa faktura"
- [ ] Translate the current invoice to a second language — one click on the pill
- [ ] Switch the display back to a previously-translated language — one click, instant
- [ ] See your balance + a CTA to top up — visible on every authenticated page
- [ ] Know upfront if you can't upload because of zero balance — banner before clicking the drop zone
