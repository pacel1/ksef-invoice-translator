# Tłumacz — Workspace Redesign Spec

**Date:** 2026-05-20
**Author:** UX/UI Pro Max session (Claude Opus, max effort)
**Status:** Draft awaiting user confirm
**Supersedes:** `2026-05-14-app-ux-redesign.md` and the `/app` half of `2026-05-18-ui-overhaul-design.md` §6.1 (workspace)
**Continues to honor:** Stripe-minimal palette + Inter typography established in `2026-05-18-ui-overhaul-design.md` §3 (do **not** churn tokens)

---

## 1. Why we're rebuilding

### 1.1 What's actually broken in the current `/app`

After auditing `app/(protected)/app/page.tsx`, `components/workspace/translator-workspace.tsx`, `use-translator-workflow.ts`, `workspace-empty-state.tsx`, `workspace-invoice-view.tsx`, and `workspace-toolbar.tsx`:

| # | Defect | User-visible consequence |
|---|--------|---------------------------|
| 1 | Default `currentLanguage === "pl"` after upload — the app immediately renders the Polish source as the "preview" | The Polish-speaking user uploaded a Polish invoice and is now staring at a Polish invoice. Zero value delivered. The product *is* a translator; the first frame must reflect that. |
| 2 | The toolbar mixes target-language pills, bilingual checkbox, "Nowa faktura", and "Pobierz PDF" in one sticky strip at the bottom | Cognitive overload. No hierarchy. Power users can use it, new users don't know what to do first. |
| 3 | Translation auto-fires from a `useEffect` watching `currentLanguage` | Implicit charge: a user taps "DE" to *try it* and a credit silently disappears. Confidence-destroying. |
| 4 | Single-file only at every layer (component, hook, `/api/upload`) | Polish accountants routinely close 20–60 invoices per VAT period. The product forces them to re-upload one-by-one. |
| 5 | No visible cost preview before committing | User has 3 credits, uploads a batch of 10. Discovers mid-flow that 7 will fail. |
| 6 | The shell calls itself "Workspace" / "Konwerter faktury" | "Workspace" is meaningless without context. "Konwerter" understates the AI work. Neither describes what the user is here to do. |
| 7 | "Nowa faktura" lives in the toolbar next to "Pobierz PDF" — same visual weight as the primary action | Layout teaches the user that finishing and starting over are equally important. |
| 8 | The empty state and the loaded state are different layouts entirely | The user re-learns the page after every upload. |
| 9 | Bilingual toggle is a faint cyan checkbox squeezed next to the download button | A core differentiator (PL + foreign side-by-side) is presented as a niche option. |
| 10 | Errors from translation/PDF generation land in a yellow amber bar above everything, unscoped to which file or step caused them | Batch processing would amplify this into noise. |

### 1.2 The mental model we want users to have

> *"I have one or more KSeF invoices. I want them translated to a specific language so I can send them to a foreign contractor. Show me the steps, tell me what it costs, then do it."*

The current UI requires the user to internalize: "this is a viewer that happens to translate when I click the right pill." We're inverting that — **this is a translator that happens to also preview**.

---

## 2. Rename + IA decision

### 2.1 New name

**Route:** `/app` → **`/translate`** (English route name, keeps URL terse and bookmarkable; Stripe/Notion/Linear precedent — localize labels not URLs).
**Sidebar/nav label:** **"Tłumaczenie"** (PL) / **"Translate"** (EN) — verb-form, action-oriented, matches the user's job-to-be-done.
**Component family:** `<TranslatorWizard>`, `<UploadStep>`, `<LanguageStep>`, `<DeliveryStep>` (replaces `<TranslatorWorkspace>` and friends).
**Internal slug for analytics + URLs:** `translate`. Friendly Polish slug `/tlumaczenie` is added as a redirect for branding-conscious links.

We are **not** renaming the project ("KSeF Invoice Translator" stays). We are renaming **the working surface inside the app**.

### 2.2 Persistent shell (unchanged from Sprint 1 — reuse)

The protected layout (`app/(protected)/layout.tsx`) already gives us topbar + sidebar + main. We keep it. The sidebar nav items become:

```
+ Nowe tłumaczenie       ← primary CTA (returns wizard to Step 1)
─────────────────────────
  Ostatnie               ← last 5 invoices/batches (collapsible)
  Historia               ← full archive (existing /app/history → /translate/history)
─────────────────────────
  Doładuj kredyty        ← /billing (existing)
  Konto                  ← /account (existing)
  Pomoc & Kontakt
```

Top-right (already present): credit balance badge + user menu. The "low balance" banner stays at the top of `/translate` only, with copy refreshed for the new flow.

---

## 3. The three-step wizard

This is the spine of the redesign. Every state below is concrete and tied to a component.

### 3.1 State machine

```
                             ┌─────────────────────────────────────────┐
                             │  Wizard idle (no files yet)             │
                             │  Step 1: Upload — empty drop zone       │
                             └─────────────┬───────────────────────────┘
                                           │  user drops/picks N files
                                           ▼
                             ┌─────────────────────────────────────────┐
                             │  Step 1: Upload — files listed          │
                             │  per-file parse status streams in       │
                             │  "Add more" / "Continue →"              │
                             └─────────────┬───────────────────────────┘
                                           │  all files parsed, user clicks Continue
                                           ▼
                             ┌─────────────────────────────────────────┐
                             │  Step 2: Language & format              │
                             │  pick target language + bilingual y/n   │
                             │  shows cost preview vs balance          │
                             │  "← Back" / "Tłumacz N faktur →"        │
                             └─────────────┬───────────────────────────┘
                                           │  user clicks "Tłumacz"
                                           ▼
                             ┌─────────────────────────────────────────┐
                             │  Step 3: Delivery                       │
                             │  N=1 → single preview + download        │
                             │  N>1 → batch progress + per-file list   │
                             │  + "Pobierz wszystkie (.zip)"           │
                             │  + "Tłumacz ponownie w innym języku"    │
                             │  + "Nowe tłumaczenie"                   │
                             └─────────────────────────────────────────┘
```

### 3.2 Step indicator (always visible at top of main pane)

```
┌──────────────────────────────────────────────────────────────────┐
│  ●━━━━━━━━━━━━━━━○━━━━━━━━━━━━━━━○                              │
│  1. Wybierz pliki    2. Język i format    3. Tłumaczenie         │
└──────────────────────────────────────────────────────────────────┘
```

- Active step: filled circle + bold label, color `accent`.
- Completed step: filled with check icon, color `success`.
- Future step: outline circle, color `text-muted`.
- Clicking a completed step **navigates back** (preserves later state). Clicking a future step is a no-op.

Implements `aria-current="step"` on the active node; full step list exposed as an ordered list for screen readers (`<nav aria-label="Wizard progress">` + `<ol>`).

### 3.3 Step 1: Upload — wireframe

Single (idle) and multiple variants render through the **same** component — only the right column changes between "drop hint" and "file list."

**Idle (no files):**

```
┌──────────────────────────────────────────────────────────────────┐
│  Wybierz pliki KSeF do tłumaczenia                               │
│  Wgraj jedną lub wiele faktur FA(3) XML lub PDF.                 │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │                                                              ││
│  │                    ⬆️  (svg upload icon)                       ││
│  │                                                              ││
│  │              Przeciągnij pliki lub wybierz z dysku           ││
│  │                                                              ││
│  │              [ Wybierz pliki ]   lub   Przykład →            ││
│  │                                                              ││
│  │           Obsługujemy XML FA(3) i PDF KSeF (max 10 MB / plik)││
│  │                                                              ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ℹ  Kwoty, NIP, IBAN i numery faktur NIE są tłumaczone przez AI. │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Files added:**

```
┌──────────────────────────────────────────────────────────────────┐
│  Wybierz pliki KSeF do tłumaczenia                               │
│                                                                  │
│  ┌──────────────────────────┐  ┌─────────────────────────────────┐│
│  │ + Dodaj pliki (drag/drop)│  │ 7 plików gotowych do tłumaczenia││
│  │                          │  │                                  │
│  │  Małe pole drop zone     │  │ ✓ FA-2026-0001.xml   13 KB      │
│  │                          │  │ ✓ FA-2026-0002.xml   11 KB      │
│  └──────────────────────────┘  │ ✓ FA-2026-0003.pdf  104 KB      │
│                                │ ⟳ FA-2026-0004.xml   (parsing…) │
│  ⚠ FA-2026-0005.pdf            │ ✓ FA-2026-0006.xml   14 KB      │
│  Nieobsługiwany format         │ ✓ FA-2026-0007.xml   12 KB      │
│  — usuń lub wgraj inny plik    │ ✓ FA-2026-0008.xml   13 KB      │
│                                │                                  │
│                                │      [ Wyczyść ]  [ Dalej → ]   │
│                                └─────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

**Per-file row states:**
- `parsing` — spinner + filename + size
- `ready` — checkmark + filename + size + small "×" remove control
- `error` — red dot + filename + truncated reason + "×" remove control
- `duplicate` — info dot + "Już była tłumaczona — wybierz inną" (server returned dedupe hit; user can keep it free, will not consume credit)

**Validation:** "Dalej →" disabled until every row is `ready` (or removed); shows tooltip "Poczekaj, aż wszystkie pliki zostaną sprawdzone."

**No credit consumed at this step** — current `/api/upload` consumes on dedupe-miss; we'll shift that to Step 3 (see §6.2).

### 3.4 Step 2: Language & format — wireframe

```
┌──────────────────────────────────────────────────────────────────┐
│  Wybierz język i format                                          │
│  Dla 7 faktur                                                    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Język docelowy                                              │  │
│  │                                                              │  │
│  │ [🔍 Szukaj języka...]                                       │  │
│  │ ┌──────┬──────┬──────┬──────┐                              │  │
│  │ │  EN  │  DE  │  FR  │  ES  │   ← top 4 most common        │  │
│  │ └──────┴──────┴──────┴──────┘                              │  │
│  │   Pokaż wszystkie 22 →                                      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Format PDF                                                  │  │
│  │                                                              │  │
│  │ ◉  Tylko tłumaczenie                                        │  │
│  │    Faktura w jednym języku (np. angielskim).                │  │
│  │                                                              │  │
│  │ ○  Dwujęzycznie                                             │  │
│  │    Wybrany język + polski — po jednej kolumnie obok siebie. │  │
│  │    Polecane dla kontrahenta + dokumentacji wewnętrznej.     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Koszt:    7 kredytów                                       │  │
│  │  Stan:     12 kredytów dostępnych                           │  │
│  │  Po:       5 kredytów                                       │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│              [ ← Wstecz ]      [ Tłumacz 7 faktur → ]            │
└──────────────────────────────────────────────────────────────────┘
```

**Insufficient credits state** — the cost card flips to red, "Po:" shows negative, and the primary CTA changes to **"Doładuj kredyty"** (`Link` to `/billing?return=/translate&pending=N`), with a secondary `"← Wstecz"`.

**Pricing always per-invoice.** Bilingual is the same cost as monolingual (it's one render of the same translation cache — already true in `/api/pdf`).

**The cost card** uses real-time balance — listens to the existing `credit-balance-changed` window event the rest of the app already fires.

### 3.5 Step 3: Delivery — wireframe

**Single-file mode (N=1):**

```
┌──────────────────────────────────────────────────────────────────┐
│  Tłumaczenie gotowe                            ✓ Zapisane        │
│  FA-2026-0001 · angielski + polski · dwujęzycznie                │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                                                              │  │
│  │         [PDF preview — iframe, A4 ratio, ~80vh]              │  │
│  │                                                              │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [ Pobierz PDF ]   [ Zmień język ]   [ Nowe tłumaczenie ]        │
└──────────────────────────────────────────────────────────────────┘
```

- "Pobierz PDF" — primary button.
- "Zmień język" — returns to Step 2 with the same file loaded (no re-upload, no extra credit; just re-renders with a different cached/uncached language).
- "Nowe tłumaczenie" — resets to Step 1.

**Batch mode (N>1):**

```
┌──────────────────────────────────────────────────────────────────┐
│  Tłumaczę 7 faktur na angielski (dwujęzycznie)                   │
│                                                                  │
│  ████████████████████░░░░░░░░░░  4 / 7 ukończonych  ~32 s        │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ✓ FA-2026-0001  · 12 s · [Podgląd] [Pobierz]                │  │
│  │ ✓ FA-2026-0002  · 14 s · [Podgląd] [Pobierz]                │  │
│  │ ✓ FA-2026-0003  ·  9 s · [Podgląd] [Pobierz]                │  │
│  │ ✓ FA-2026-0004  · 11 s · [Podgląd] [Pobierz]                │  │
│  │ ⟳ FA-2026-0005  · tłumaczę...                                │  │
│  │ … FA-2026-0006  · w kolejce                                  │  │
│  │ … FA-2026-0007  · w kolejce                                  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  [ Pobierz wszystkie (.zip) ]  ← enabled when ≥1 done            │
│  [ Tłumacz ten zestaw w innym języku ]                           │
│  [ Nowe tłumaczenie ]                                            │
└──────────────────────────────────────────────────────────────────┘
```

**Per-row error handling:**

```
✗ FA-2026-0005  · Tłumaczenie nie powiodło się   [Ponów]
```

Failure of one row does NOT halt the batch. Successful rows remain downloadable. Failed rows keep their credit (we refund on translation failure — see §6.3). Retry triggers a fresh translate call on that single file.

**Concurrency:** sequential ❌ (too slow) → cap at **3 parallel translate calls** (matches OpenAI rate budget; configurable via env). Honors `prefers-reduced-motion` for the progress bar animation.

### 3.6 Re-entering the wizard from history

`/translate/history` rows get a new "↻ Tłumacz ponownie" action that pre-populates Step 2 with the previous language + bilingual choice. This is a follow-up improvement (not in v1 if scope pressure forces a cut), but the data plumbing in §6.4 makes it trivial.

---

## 4. Information architecture (full sidebar)

The Sprint 1 sidebar stays. Only the labels and the primary CTA wording change.

| Slot | Current label | New label (PL / EN) | Behavior |
|------|----------------|---------------------|----------|
| Primary CTA | "Nowa faktura" | **"+ Nowe tłumaczenie" / "+ New translation"** | resets wizard, focuses Step 1 |
| Recent section heading | "Ostatnie" | **"Ostatnie" / "Recent"** | unchanged, 5 rows |
| Archive link | "Cały archiwum" | **"Historia" / "History"** | grammar fix (Polish "Całe archiwum"); new label is shorter and more conventional |
| Billing link | (existing) "Doładuj" | **"Doładuj kredyty" / "Top up credits"** | unchanged route, fuller label |
| Account link | (existing) "Konto" | **"Konto" / "Account"** | unchanged |
| Help | (existing) "Pomoc" | **"Pomoc i kontakt" / "Help & contact"** | merge two labels into one row |

---

## 5. Visual system — re-using Sprint 1 tokens, no new tokens needed

We keep:

- **Typeface:** Inter (CSS var `--font-inter`).
- **Palette:** Stripe-minimal from `tailwind.config.ts` — `surface`, `surface-muted`, `accent`, `accent-soft`, `border`, `border-strong`, `success`, `danger`, `text-strong`, `text`, `text-muted`.
- **Type scale:** `display`, `h1`, `h2`, `h3`, `body`, `small`, `micro`, `number-xl`.
- **Radii / shadows / motion:** already defined.

We add **two** small additions (token level — see §6.5):

1. A new semantic token `--warning` (amber) for the per-file "duplicate" state. Currently we only have `success` + `danger`.
2. A `stepper` component family in `components/ui/` — not in Sprint 1, missing.

The Pro-Max-recommended **Trust & Authority** style applies as *principles* on this existing palette:
- Persistent reminder strip in §3.3: "Kwoty, NIP, IBAN i numery faktur NIE są tłumaczone przez AI."
- Explicit cost preview in §3.4 (no surprises).
- Per-file granularity in §3.5 (no all-or-nothing failures).

No emojis in the UI; all icons from `lucide-react` already in use.

---

## 6. Architectural changes required

### 6.1 Front-end state model (replaces `useTranslatorWorkflow`)

New hook **`useTranslationWizard()`** in `components/translate/use-translation-wizard.ts`:

```typescript
type Step = "upload" | "language" | "delivery";

type FileSlot = {
  localId: string;        // crypto.randomUUID() — stable across renders
  file: File;
  status: "parsing" | "ready" | "error" | "duplicate";
  invoiceId?: string;      // populated by /api/upload-batch when status === "ready"
  invoiceNumber?: string;  // from parse result
  errorMessage?: string;
  warnings?: string[];
};

type JobItem = {
  fileSlotId: string;
  invoiceId: string;
  status: "queued" | "translating" | "done" | "error";
  durationMs?: number;
  errorMessage?: string;
  previewUrl?: string;     // object URL once PDF ready
};

interface WizardState {
  step: Step;
  files: FileSlot[];
  language: WorkspaceLanguageCode | null;
  bilingual: boolean;
  jobItems: JobItem[];     // populated when entering Step 3
  insufficientCredit: boolean;
}
```

State transitions are pure (immutable updates, per `~/.claude/rules/common/coding-style.md`). The hook exposes `goNext`, `goBack`, `addFiles`, `removeFile`, `setLanguage`, `setBilingual`, `startTranslation`, `retryItem`, `reset`. No `useEffect` auto-translation anywhere.

### 6.2 Credit consumption — move to Step 3

**Today:** `/api/upload` consumes one credit per dedupe-miss insert.
**Tomorrow:** `/api/upload` continues to parse + insert, but **does NOT consume credit**. A new endpoint **`POST /api/translate/batch`** (or per-item `POST /api/translate` reused with batch coordination on the client) consumes credit *at translation start*, per item.

Rationale:
- Step 1 (upload) is non-destructive: parsing is cheap, dedupe must be free.
- Step 3 (translation) is the metered service. Cost matches user action.
- We can refund cleanly on translation failure (one delta in the ledger).

**Migration:** the `consumeCreditForInvoice` call is removed from `app/api/upload/route.ts` and added to whichever code path starts the translate job. The DB schema does not change. The credit ledger event_type stays `"invoice_translated"` instead of `"invoice_uploaded"`.

⚠ **This changes paid behavior.** Any user who has been paying per-upload would notice. Practically — the old behavior was "you pay once per unique invoice ever," which is identical to "you pay once per first translation of a unique invoice" because uploading without translating was meaningless.

### 6.3 Refund on translation failure

Add `creditLedger.refundForInvoice({ supabase, userId, invoiceId, note })` to `lib/billing/credit-enforcement.ts`. Called by the `/api/translate` (or batch) endpoint when the translation call to OpenAI returns a 5xx after retries. The user-visible "Ponów" button calls translate again; if successful, a fresh credit is consumed.

### 6.4 New endpoint `POST /api/upload-batch`

Multipart form with multiple `file` fields. Returns `{ results: UploadResultOrError[] }`. Internally just loops `uploadInvoiceForUser` (no credit consumption per §6.2). Cap at **20 files per batch** server-side (rejects with `413` above that). Stream results would be nicer; v1 is request/response with a small batch cap.

Alternative: keep `/api/upload` single-file and have the client fire N parallel requests. **Decision: single batch endpoint** — cleaner error semantics, one auth round-trip, easier to extend with batch-level limits.

### 6.5 New token + component

`app/globals.css` — add `--warning: 38 92% 50%;` (amber-500) and a matching `warning-soft: 38 92% 95%`.
`tailwind.config.ts` — extend `colors.warning` and `colors.warning-soft`.
`components/ui/stepper.tsx` — server-renderable list (uses `nav` + `ol` + `aria-current`).

### 6.6 Route + nav changes

- `app/(protected)/app/page.tsx` → moved to `app/(protected)/translate/page.tsx`.
- `app/(protected)/app/history/page.tsx` → moved to `app/(protected)/translate/history/page.tsx`.
- Old route stubs (`app/(protected)/app/page.tsx`, `.../history/page.tsx`) become **`redirect()` shims** to the new URLs for one release cycle, then deleted.
- Sidebar (`components/layout/protected-sidebar.tsx` or wherever it lives) updates href + label.
- Polish friendly alias: `app/(protected)/tlumaczenie/page.tsx` → redirects to `/translate`.

### 6.7 No DB migrations required

We use the existing `invoices`, `translations`, `credit_balances`, `credit_ledger` tables. The credit ledger event_type rename (§6.2) is a code change only.

---

## 7. Edge cases & error handling matrix

| Scenario | Behavior |
|----------|----------|
| User drops zero files | Drop zone shakes; no toast. Empty list keeps "Dalej →" disabled. |
| User drops one unsupported file | Row renders in error state with reason; "Dalej →" stays enabled iff other rows are ready. |
| Parse hangs > 30s for a row | Row enters "error" state with reason "Parsowanie trwało zbyt długo. Spróbuj ponownie." + retry. |
| Upload-batch hits 20-file cap | Server returns 413 with overflow names; client renders affected rows in error and accepts the rest. |
| User navigates away mid-Step 1 | State is **NOT** persisted (file blobs can't survive a refresh). On return, wizard resets. No nag. |
| User navigates away mid-Step 3 batch | Background fetches are aborted; on return, partial results are lost (matches current behavior). v2: persist job in DB so it survives. |
| Credit runs out mid-batch | The first failing item flips to error with reason "Brak kredytów" and CTA "Doładuj"; remaining queued items skip to error with the same reason; finished items remain available. |
| Same file dropped twice in one batch | Client dedupes by `name+size+lastModified` hash before sending; server further dedupes by content hash. UI shows "Pominięto duplikat." |
| User picks PL as target in Step 2 | Forbidden — language picker hides PL (Polish is the source). The bilingual radio is the only way to *include* Polish. |
| Translation cache hit on retry | Free (no credit consumed); UI shows the "Z cache — bez opłaty" micro-badge. |
| PDF preview iframe fails to load | Falls back to the React `<InvoicePreview>` (same fallback the current `WorkspaceInvoiceView` already does). |
| User in bilingual mode picks RTL language (none currently — Arabic etc. future) | Out of scope for v1; the bilingual layout assumes LTR. |
| Browser blocks pop-up for download | We use `<a download>` clicks, no pop-ups. Zip download streams from server endpoint. |

---

## 8. Accessibility checklist (must pass in QA)

- [ ] Step indicator: `<nav aria-label="Postęp tłumaczenia">` + `<ol>` + per-item `aria-current="step"`.
- [ ] All drop zones: `role="button"` + `tabIndex` + Enter/Space activate (already there in current empty state — port verbatim).
- [ ] File-list rows: per-row remove button has `aria-label="Usuń {filename}"`.
- [ ] Cost preview card: `aria-live="polite"` so screen readers announce updates when balance changes.
- [ ] Batch progress: `<progress>` element with `aria-valuetext` ("4 of 7 invoices translated"), updates throttled to once per second (no spam).
- [ ] Per-file status icons: SVG `aria-hidden="true"`, sibling visually-hidden status text.
- [ ] Language picker keyboard-navigable: `↑↓` to cycle, `Enter` to confirm, `Escape` to close (use Radix `Combobox` if available, else hand-rolled but tested).
- [ ] Color contrast: amber `warning` token validated for 4.5:1 against `surface-muted` background before merging.
- [ ] `prefers-reduced-motion`: progress bar fills via discrete steps (no `transition: width`).
- [ ] All `cursor-pointer` on clickables (per the Pro Max checklist).
- [ ] Focus rings: `focus-visible:ring-2 focus-visible:ring-accent`.

---

## 9. Migration & rollout

1. **Build behind a flag** — `NEXT_PUBLIC_TRANSLATE_V2=1` env var, defaults to off. The new route renders only when the flag is on; old `/app` keeps working.
2. **QA in preview** — run Vercel preview with the flag on, validate against the test plan in §10.
3. **Cutover PR** — flip the default, delete the flag check, redirect `/app` → `/translate` permanently. Old routes deleted.
4. **No DB migrations.** No user data is touched. The credit ledger reads `event_type` permissively (we already handle multiple values).

---

## 10. Acceptance criteria

A user with 10 credits should be able to:

1. Open `/translate` and see Step 1.
2. Drop 5 KSeF XML files.
3. See per-file parse status update from "parsing" → "ready" without page reload.
4. Click "Dalej →" and land on Step 2.
5. Pick German, choose "Dwujęzycznie."
6. See "Koszt: 5 kredytów. Po: 5 kredytów." in the cost card.
7. Click "Tłumacz 5 faktur →" and land on Step 3 with a progress bar.
8. Watch rows complete one by one; download individual PDFs as they finish.
9. Click "Pobierz wszystkie (.zip)" to get a single archive.
10. Return to "+ Nowe tłumaczenie" without losing any sidebar state.

A user with 0 credits should be **stopped at Step 2** with a clear path to /billing.
A user uploading 1 file should see the **single-file delivery view** at Step 3 (preview + download), not the batch list.
A user retrying a failed translation should consume exactly one credit per success (cache-hit retries are free).

---

## 11. What we are explicitly NOT changing

- The `/billing` page (Sprint 4 work stands).
- The `/account` page (Sprint 4 work stands).
- The marketing site / landing page.
- The translation engine itself (`lib/translation/*`).
- The PDF renderer (`vendor/ksef-pdf-generator`).
- The Supabase schema.
- Stripe / credits pricing.
- Language list (22 supported targets — no additions).

---

## 12. Open spec-level questions (default if user doesn't override)

| Question | Default I'll ship unless told otherwise |
|----------|-----------------------------------------|
| Max batch size per upload | **20** files |
| Concurrent translate cap | **3** parallel |
| Zip filename format | `tlumaczenia-{YYYY-MM-DD}-{HHMM}.zip` |
| Polish friendly route `/tlumaczenie` redirect | **Yes**, behind 308 permanent redirect |
| Retain `/app` redirects after cutover | **One release**, then 410 Gone |
| Persist incomplete batches across reloads | **No** in v1 — too much DB churn for marginal value; revisit if users ask |
