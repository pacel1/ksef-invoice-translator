# Tłumacz Faktur KSeF — Total UI/UX Overhaul

**Status:** Spec
**Date:** 2026-05-18
**Approach:** B — Stripe-minimal aesthetic with a Polish-business heart
**Scope:** 13 routes (7 existing rebuilt + 6 new) + workspace rebuild

---

## 1. Goals & non-goals

### Primary goal

Make Tłumacz Faktur KSeF *feel trustworthy* to two audiences simultaneously: Polish SMB owners issuing invoices to international clients, and Polish accountants translating on behalf of their clients. Trust here means the visitor concludes — within 30 seconds of landing — that:

1. The pricing has no surprises (per-invoice cost is visible everywhere)
2. Their data is handled responsibly (EU storage, RODO compliance, deletion policy stated)
3. There is a real Polish company behind the product (NIP, address, founder, contact)

### What "rebuild" covers

- A new design system (tokens + typography + components)
- A new brand mark and wordmark lockup
- Every existing route rebuilt against the new tokens
- Six new routes (pricing, security, terms, privacy, history, error states)
- The `/app` workspace rebuilt with a sidebar shell + inline credit-purchase drawer

### Non-goals

- Brand photography / illustration system (Approach B is photo-free by design)
- Languages beyond PL and EN on marketing pages
- A separate help-center or docs site
- Multi-user / team accounts (accountant-managing-many-clients flows)
- Mobile native apps (responsive web only)

---

## 2. Audience

Designed for two roles, weighted equally:

**SMB owner / solo founder.** Issues KSeF invoices to foreign clients occasionally. Cares about:
- Time-to-first-translated-PDF (under 1 minute from landing)
- Per-invoice cost visible up front
- Output that looks professional when forwarded to a buyer

**Accountant / Biuro rachunkowe.** Translates invoices on behalf of multiple SMB clients. Cares about:
- Predictable batch pricing
- Audit trail (when uploaded, when translated, who saw what)
- Real company behind the tool — legally responsible for client data
- Multi-language coverage without per-language pricing

The design must not alienate either. Visual register sits between Stripe (fintech-pro) and a quiet Polish business tool — never consumer-SaaS friendly, never enterprise-bloated.

---

## 3. Design system

### 3.1 Color palette

Pure white surface, slate hierarchy, **Stripe Purple** (`#635bff`) as the single accent.

| Token | Value | Usage |
|---|---|---|
| `surface` | `#ffffff` | Default canvas |
| `surface-muted` | `#f7fafc` | Inset panels, dashboards, code blocks |
| `text-strong` | `#0a2540` | Headings, primary text |
| `text` | `#425466` | Body strong |
| `text-muted` | `#697386` | Secondary labels |
| `border` | `#e3e8ee` | Hairlines, card outlines |
| `border-strong` | `#c1c9d2` | Focused inputs, dividers |
| `accent` | `#635bff` | Primary CTAs, active states, brand mark |
| `accent-hover` | `#5851ec` | CTA hover |
| `accent-soft` | `#f0effd` | Selected pill backgrounds, hover wash |
| `success` | `#3fa66a` | Paid, success toasts |
| `danger` | `#cd3d64` | Errors, destructive actions |

**Rationale.** Cyan reads as generic SaaS. Blue reads as Comarch/PKO/everybody. Red reads as alarm. Stripe Purple is globally recognized as "serious fintech" and reads as credible without being country-specific — leaving the Polish-business identity to the *content* layer (copy, footer, founder), not the color.

### 3.2 Typography

**Inter Variable** — single typeface, all weights via `font-variation-settings`. Tabular numerals always on for prices, balances, and dates.

| Size | Use |
|---|---|
| Display 48/56, weight 700 | Landing hero, page H1 on `/pricing`, `/security` |
| H1 32/40, weight 700 | Page titles |
| H2 24/32, weight 600 | Section headings |
| H3 18/28, weight 600 | Card headings |
| Body 16/24, weight 400 | Default text |
| Small 14/20, weight 400 | Labels, captions |
| Micro 12/16, weight 500 | Pills, badges, eyebrows |
| Number-XL 56/64, weight 600, tabular | Per-invoice price displays |

Polish has long compound words. The scale is intentionally generous so headings breathe.

### 3.3 Spacing, radii, shadows, motion

- **Spacing.** 4 px base grid. `gap-1` = 4, `gap-2` = 8, then 12 / 16 / 24 / 32 / 48 / 64.
- **Radii.** `rounded-md` (6 px) for inputs; `rounded-lg` (8 px) for cards; `rounded-xl` (12 px) for hero modules; `rounded-full` for chips and avatars. No sharp corners.
- **Shadows.** Three levels: `shadow-sm` (resting cards), `shadow-md` (hover, dropdowns), `shadow-lg` (modals). Replaces the single `shadow-soft` token.
- **Motion.** 150 ms ease-out for hover/focus; 200 ms ease-out for layout shifts; 300 ms for modal entry/exit. No bouncy springs.

### 3.4 Brand identity

- **Brand name** (used everywhere on-site): **Tłumacz Faktur KSeF** — written out, proper Polish capitalization.
- **Domain** (browser bar only): `tlumaczksef.pl`. Never used as the display name in body copy.
- **Wordmark.** "Tłumacz Faktur KSeF" set in Inter 600, slate-950, kerned tight.
- **Bug / favicon / app icon.** Purple square (`#635bff`) with a white capital **T**. Scales from 16 px favicon to 512 px PWA icon. Used in browser tabs, header lockup beside the wordmark, email signature. Never used standalone in body copy.
- **Legal entity name** (in footer) is separate — uses the actual company name registered against the NIP.

### 3.5 Voice & tone

- **Polish-first, EN-parity.** Every customer-facing string lives in `lib/workspace/copy.ts` with both. Marketing pages are PL by default; `/en/...` mirrors them.
- **Direct, no marketing-speak.** "Wgraj fakturę" not "Rozpocznij swoją podróż translacji." Numbers replace adjectives ("3,99 zł za fakturę", not "tani").
- **Polish-business formal.** No "Hej!" Use "Witaj" sparingly for first-load greetings; default to "Pan/Pani" in transactional emails. No English buzzwords inline ("workflow," "stack," "ship").
- **Trust statements are concrete.** Not "secure" → "dane przechowywane w Supabase Frankfurt, kasowane po 30 dniach". Not "fast" → "PDF gotowy w 4 sekundy".

---

## 4. Information architecture

### 4.1 Route map

14 routes total. New = does not exist today.

| Route | Auth | Purpose | New? |
|---|---|---|---|
| `/` | public | Landing — hero, value props, pricing teaser, footer | rebuild |
| `/pricing` | public | Live slider, ladder, FAQ, comparison | **new** |
| `/security` | public | Data handling, RODO, founder, KSeF/MF references | **new** |
| `/terms` | public | Regulamin (legal) | **new** |
| `/privacy` | public | Polityka prywatności (RODO) | **new** |
| `/login` | public | Magic-link form | rebuild |
| `/auth/callback` | public | Token verify (no UI surface) | keep |
| `/auth/error` | public | Sign-in failure states | **new** |
| `/404`, `/500` | public | Not found / server error | **new** |
| `/app` | private | Workspace — three-zone shell | rebuild |
| `/app/history` | private | Invoice archive | **new** |
| `/billing` | private | Credit purchase + history | rebuild |
| `/account` | private | Profile, locale, RODO export, danger zone | rebuild |

### 4.2 Navigation model

**Public header.** Left: bug + wordmark linking to `/`. Center: nothing. Right: `Cennik` · `Bezpieczeństwo` · **`Zaloguj się`** (purple button). Mobile: bug only on left, hamburger on right that slides a full-height sheet with the three links + EN toggle.

**Authenticated header.** Left: bug + wordmark → `/app`. Center: `Workspace` · `Historia`. Right: `<BalanceChip>` · email link → `/account` · `Wyloguj`. Mobile collapses to bug + chip + hamburger.

**Footer (every page — public and authenticated).** Three-column grid:
1. **Legal column.** Wordmark, legal entity name, NIP, REGON, address, © year.
2. **Product column.** Cennik, Bezpieczeństwo, Historia, Pomoc.
3. **Trust column.** "Dane w Supabase Frankfurt 🇪🇺", "Płatności Stripe", "RODO-compliant", "Regulamin", "Polityka prywatności".

The footer is the trust load-bearer — accountants check the footer before they trust anything.

### 4.3 Trust modules (reusable components)

Six components carry the trust signals:

| Component | Carries | Used on |
|---|---|---|
| `<LegalFooter>` | NIP, REGON, address, hosting location | every page |
| `<PriceSnippet>` | "od 2,99 zł za fakturę", live-computed | landing hero, header CTA, pricing, billing |
| `<TrustStrip>` | Stripe · Supabase Frankfurt · OpenAI · RODO · MF FA(3) — five logos in one quiet row | landing, pricing, security |
| `<SecurityCard>` | 3–4 line statement (encryption, EU, deletion, RODO) | landing section, security page |
| `<FounderCard>` | Photo + name + 2-line statement of accountability + email | security, privacy, landing |
| `<StatCounter>` | "X faktur" / "Y firm" — *only if backed by a real DB count ≥ 50* | landing strip (optional) |

`<StatCounter>` reads from `invoices` and `profiles` row counts at request time. Renders only when both counts are ≥ 50 (constant exported from the component file). Below that threshold it returns `null` — fake numbers destroy trust.

### 4.4 URL strategy

- PL-first canonical. EN mirror at `/en/...`. Toggle in footer + header.
- All authenticated routes are PL only — UI text uses `copy[uiLanguage]` driven by `profiles.locale`.
- Canonical tags on every public page point to the PL version for SEO.

---

## 5. Public pages

### 5.1 `/` Landing — the conversion page

Nine vertically-stacked sections, each carrying one job. Total scroll ≈ 5 viewport heights on desktop.

1. **Header** (Section 4.2).
2. **Hero.** Headline: *"Faktura KSeF dla klienta z zagranicy. W 4 sekundy."* Subhead: 2 lines. Two CTAs side-by-side — primary purple **"Zacznij za darmo"** → `/login`; secondary **"Zobacz przykład"** opens a modal with a pre-translated sample PDF (no signup required). Below CTAs: `<PriceSnippet>` reading *"od 2,99 zł za fakturę. Bez subskrypcji."*
3. **Live demo strip.** Side-by-side: real Polish FA(3) source on left, MF-compatible English PDF on right with language pills above (EN / DE / FR / ES / IT). Click a pill → right pane swaps. Uses production `/api/pdf` rendering. The killer surface — proves accuracy in 3 seconds.
4. **Three value props.** Three cards, each 1 H3 + 2 lines + tiny purple icon:
   - *MF-compliant PDF* — "Wynik zgodny ze schematem FA(3) 2025-06-25."
   - *Bez subskrypcji* — "Płacisz tylko za faktury, które tłumaczysz."
   - *Dane w UE 🇪🇺* — "Supabase Frankfurt. RODO. Kasowanie po 30 dniach."
5. **`<TrustStrip>`.** Five logos in slate-400: Stripe · Supabase · OpenAI · RODO · MF FA(3). Single quiet row.
6. **Pricing teaser.** Mini live slider showing package → unit price. CTA "Pełny cennik" → `/pricing`.
7. **FAQ (5).** "Czy potrzebuję integracji z KSeF?" / "Co jeśli tłumaczenie się nie zgadza?" / "Czy moje dane są bezpieczne?" / "Czy działa z FA(1)/FA(2)?" / "Czy dostanę fakturę VAT?". Accordion, slate-200 borders.
8. **`<FounderCard>`.** Photo + name + 2-sentence statement of accountability + email.
9. **Final CTA + `<LegalFooter>`.**

**States:** logged-in variant (header CTA → *"Otwórz aplikację →"*); sample-demo modal (idle / loading / showing / error); slider interactions; EN mirror at `/en`.

### 5.2 `/pricing` — the transparency page

1. Header
2. **Hero.** H1 *"Cennik prosty jak faktura."* + subhead *"Płacisz tylko za faktury, które tłumaczysz."*
3. **Big slider widget.** Full-width card. Slider 5 → 100, step 5. Live readouts: `[Pakiet: 25 faktur]` `[Cena: 124,75 zł]` `[Za fakturę: 4,99 zł]` (tabular numerals, **Number-XL** type scale on per-invoice). *"Ceny netto. Dolicz 23% VAT przy zakupie."*
4. **Price ladder table.** 5 / 10 / 25 / 50 / 100 with per-invoice price column. Highlights the slider's current selection.
5. **Free tier callout.** *"1 faktura w miesiącu gratis. Bez karty. Bez zobowiązań."*
6. **What's included per invoice** — checkmark list: tłumaczenie, MF-compliant PDF, QR KSeF, bilingual option, source XML retained 30 days.
7. **Pricing FAQ (6).** Czy faktury wygasają? / Czy mogę zwrócić niewykorzystany pakiet? / Co jeśli tłumaczenie nie zadziałało? / Czy dostanę fakturę VAT? / Czy płatność jest bezpieczna? / Czy mogę zmienić ilość po zakupie?
8. **CTA + footer.**

**States:** anonymous (CTA → `/login`); logged-in (CTA → `/billing` with the slider value passed via querystring); slider drag/release; decimal locale (PL `124,75 zł` vs EN `PLN 124.75`).

### 5.3 `/security` — the credibility page

The page Polish accountants read before they commit. Long, structured, deliberately boring-looking.

1. Header
2. **TL;DR card.** Four green-checkmark bullets: *Dane w UE · Szyfrowanie · Kasowanie po 30 dniach · RODO-compliant.*
3. **Data flow diagram.** Static SVG: *Twój komputer → Supabase Frankfurt → OpenAI (treści) → Dostarczenie PDF → Kasowanie.* Each step has a one-line caption.
4. **Gdzie żyją Twoje dane.** Paragraph + region badge `eu-central-1 (Frankfurt)`.
5. **Co przechowujemy, jak długo.** Table — source XML/PDF (30 dni), translations (30 dni), credit balance (na zawsze, dopóki masz konto), magic-link tokens (60 minut), Stripe purchase logs (5 lat — prawo PL).
6. **Czego NIE robimy.** *Nie używamy Twoich treści do trenowania modeli. Nie sprzedajemy danych. Nie udostępniamy stronom trzecim poza wymienionymi sub-procesorami.*
7. **Sub-processors table.** OpenAI (translation) / Stripe (payments) / Resend (email) / Supabase (storage + auth). Each row: nazwa, rola, lokalizacja, certyfikacje.
8. **RODO — Twoje prawa.** Six rights (dostęp, sprostowanie, kasowanie, ograniczenie, przenoszenie, sprzeciw). Email IOD/admin.
9. **MF & KSeF compliance.** Schema version, last validation date, link to gov.pl schema reference.
10. **`<FounderCard>`** + incidents policy: *Logi 90 dni · powiadomienie o naruszeniu w 72h zgodnie z RODO.*
11. Footer.

**States:** static — no interactive states. SVG has hover labels for accessibility, no animation.

### 5.4 `/terms` and `/privacy` — the legal pages

Plain Polish. Boring on purpose.

- Header + H1 + *"Ostatnia aktualizacja: DD.MM.YYYY"*
- Sticky table of contents (desktop left column, inline on mobile)
- Numbered sections in clean Inter Body
- Footer

Content drafted by a Polish lawyer — out of scope here, but the **layout** is locked.

### 5.5 `/login` — the entry page

Centered card on `surface-muted` (`#f7fafc`). Single column. Mobile-first.

Card contents (top to bottom): bug + wordmark; H2 *"Zaloguj się"*; subhead *"Wpisz e-mail. Bez hasła."*; email input full-width; primary CTA *"Wyślij link logowania"* (purple); below card *"Konto powstaje automatycznie przy pierwszym logowaniu."*; footer link *"Wracam na stronę główną"* + EN toggle.

**States:** idle / filling / submitting (button spinner); sent (card content swaps to *"Sprawdź skrzynkę. Link wysłany na [email]."* + *"Wyślij ponownie"* with 60-second cooldown); validation error (inline below input); rate-limited (toast + disabled button with countdown); network error (toast).

### 5.6 `/auth/error` — when the magic link fails

Same visual template as login. Slate alert icon — not red, we don't want to scare. Headline picks one of:

- *"Link wygasł"* (token expired) — CTA *"Wyślij nowy link"* → `/login`
- *"Link został już użyty"* — same CTA
- *"Coś poszło nie tak"* — CTA + small *"[error ID: ksef-xxx]"* monospace for support

### 5.7 `/404` and `/500`

Centered with brand at top. Large slate-300 "404" / "500" (quiet, not loud). Headline + helpful copy + CTAs back to `/`, `/pricing`, `/security`. `/500` additionally shows the error ID in monospace.

---

## 6. Authenticated app

### 6.1 `/app` — workspace rebuild

**Three-zone shell** instead of the current vertical stack: header + sidebar + main pane.

```
┌──────────────────────────────────────────────────────────────────┐
│ [T] Tłumacz Faktur KSeF    Workspace · Historia    [Chip][Email][↩]│
├────────────┬─────────────────────────────────────────────────────┤
│ + Nowa     │                                                     │
│   faktura  │                                                     │
│ OSTATNIE   │                                                     │
│ F/24/0148  │             [ PDF iframe — primary surface ]        │
│  PL EN DE  │                                                     │
│ F/24/0147  │                                                     │
│ Cały       │                                                     │
│ archiwum→  │                                                     │
│ Pomoc      │                                                     │
│ Kontakt    │                                                     │
├────────────┴─────────────────────────────────────────────────────┤
│ [PL][EN][DE][FR][ES][IT][⋯ Więcej] ☐ Dwujęzyczny    [Pobierz PDF] │
└──────────────────────────────────────────────────────────────────┘
```

1. **Header.** Brand bug + wordmark on left, two text links (Workspace · Historia) in center, `<BalanceChip>` + email + logout on right. Sticky.
2. **Sidebar** (240 px, collapsible <md). Top: prominent purple **"+ Nowa faktura"** primary CTA. Below: "OSTATNIE" + last 5 invoices, each with number + date + small pills of translated languages. **"Cały archiwum →"** links to `/app/history`. Bottom: "Pomoc" / "Kontakt".
3. **Main pane.** MF-compatible PDF iframe (full height) OR empty state. Toolbar stays sticky at the bottom of the main pane (not viewport), so sidebar stays accessible.

**Mobile.** Sidebar collapses into a slide-in sheet triggered from a hamburger; workspace becomes single column; toolbar at bottom of viewport.

**Empty state — no invoice loaded, no history:**

Two-column grid inside the main pane:
- **Left (3/5 cols).** Redesigned drop zone — larger purple dashed border, headline *"Wgraj fakturę KSeF"*, subhead *"Przeciągnij plik XML lub PDF, albo wybierz z dysku."* Big secondary CTA: **"Wypróbuj z przykładem →"** (loads `sample-data/sample-fa3-invoice.xml`).
- **Right (2/5 cols).** "CO DOSTAJESZ" onboarding panel — kept from Phase 4.6 with new tokens.

**Empty state — with history:** Same dropzone left; right column swaps to **"Otwórz ostatnią fakturę"** with thumbnails of the last 3 — one-click resume. Sidebar still shows the full list.

**Invoice view states:**
- Preview loading (server PDF generation) → loader card in iframe area
- Preview ready → MF PDF iframe
- Preview error → soft error card + retry + `<InvoicePreview>` React fallback
- Translation in progress on pill click → spinner inside the active pill, iframe shows current language while new one fetches (no blank state)
- Cached pill click → instant pill swap, preview useEffect refetches PDF (fast — server-side translation cache hits)
- Bilingual toggle → toolbar recomputes preview body
- Download → button spinner, browser download triggers
- Insufficient credit → existing `<InsufficientCreditModal>` retained but restyled, CTA opens the **inline credit-purchase drawer** rather than navigating away

**Inline credit-purchase drawer (new).** Triggered from (a) `<LowBalanceBanner>` CTA, (b) `<InsufficientCreditModal>` CTA, (c) `<BalanceChip>` click. Slides from right (400 px wide), contains mini-slider + Stripe Checkout redirect. User never leaves the workspace mid-flow. On success: drawer closes, `credit-balance-changed` event fires, chip/banner update.

### 6.2 `/app/history` — invoice archive (new)

- **Top filter bar.** Search by invoice number / seller name. Date-range picker. Status filter (Tłumaczone / Tylko źródło). Sort dropdown.
- **Table.** Columns: Numer faktury · Data wystawienia · Sprzedawca · Kwota · Języki (pills) · Status · ⋯ row actions.
- **Row click** → opens that invoice in `/app` workspace (reuses server-side translation cache; reopen-a-translated-invoice is instant).
- **Bulk actions.** Checkboxes per row → "Pobierz wszystkie PDF (ZIP)" / "Eksportuj listę (CSV)".
- **Empty state.** *"Nie masz jeszcze żadnej faktury. Wgraj pierwszą →"* CTA → `/app`.

**Backend dependency:** new `GET /api/me/invoices?page&search&from&to` endpoint returning paginated invoice rows with translated-language list.

**States:** loading skeleton (table rows shimmer), error (retry), empty, populated, filtering, bulk selection.

### 6.3 `/billing` — credit purchase + history (redesign)

1. **Top stat band.** Big number tabular: **`25 kredytów`** (current paid) + **`1 darmowy/miesiąc`** sub-row. Tiny *"Następne darmowe odnowienie: 1 lipca."*
2. **Slider card.** Existing `<CreditSlider>` restyled with Stripe-purple range + tabular numerals. Big per-invoice price readout (Number-XL).
3. **What's included** — 4 checkmark bullets reused from `/pricing`.
4. **Purchase history.** Existing `<PurchaseHistory>`. Columns: Data · Pakiet · Kwota · Status · Pobierz fakturę VAT (Stripe-hosted invoice).
5. **VAT note.** *"Wszystkie ceny netto. VAT 23% naliczany przy zakupie."*
6. **Refund policy.** *"Niewykorzystane kredyty nie wygasają. Zwroty na życzenie w 14 dni."*

**States:** balance loading skeleton, slider drag, Stripe redirect (current pattern), purchase pending/paid/failed (existing toast logic).

### 6.4 `/account` — profile + settings + danger zone (redesign)

1. **Profile section.** Email (immutable, monospace) + *"Email logowania nie można zmienić."* Locale toggle (PL/EN) — affects UI language. Display name (optional, used in emails).
2. **Notification preferences.** Receipts on/off, monthly summary on/off, account changes on/off.
3. **Data export (RODO).** Big button *"Pobierz wszystkie moje dane (JSON)"* — generates and downloads everything (profile, balance, invoices, translations, purchases). RODO Article 20 compliance.
4. **Active sessions** (designed not built — future).
5. **Danger zone** (red-bordered card).
   - *"Usuń wszystkie moje faktury"* — soft destructive, confirmation modal
   - *"Usuń konto"* — destructive, modal requires typing email to confirm, cascades delete, logs out

**Backend dependencies:** new `POST /api/me/export` (queues JSON dump generation, returns signed-URL download); new `DELETE /api/me/account` (cascading delete with confirmation token).

**States:** profile-save in-flight / success / error; data-export queued / generating / ready; confirmation modals; logged-out (redirects to `/`).

---

## 7. Implementation phases

Four sprints, each shippable as its own PR. Order is sequential — later sprints depend on earlier ones.

| Sprint | Scope | Why this order | Approx scale |
|---|---|---|---|
| **1. Foundation** | Tailwind tokens rewrite, Inter font load, new `<Header>` lockup, `<LegalFooter>`, `<TrustStrip>`, `<PriceSnippet>`, `<SecurityCard>`, `<FounderCard>` components, `/404` + `/500` pages. | Every other sprint depends on tokens. Build in isolation; users see headers/footers change, error pages improve, but no major surface yet. | 1 PR, ~3 days. Low blast radius. |
| **2. Public pages** | `/` rebuild, `/pricing` new, `/security` new, `/terms` + `/privacy` new (content stub), `/login` rebuild, `/auth/error` new. All EN mirrors at `/en/...`. | Marketing surfaces ship before product changes — improves conversion immediately without touching the authenticated app. Risk-isolated from existing users. | 1 PR, ~5 days. Largest visual delta for first-time visitors. |
| **3. Workspace rebuild + history** | `/app` three-zone shell, sidebar with recent invoices, inline credit-purchase drawer, full-bleed PDF iframe, restyled empty state, restyled `<InsufficientCreditModal>`. `/app/history` page. Backend: `GET /api/me/invoices`. | Biggest sprint, biggest user-facing change. Ships after Sprint 1 has locked the tokens. Recommended: deploy at a low-traffic hour and watch error logs the first hour; if a feature-flag system exists by then, prefer that. | 1 PR, ~7 days. High blast radius. |
| **4. Billing + account + polish** | `/billing` redesign with stat band + restyled slider + receipts list. `/account` redesign with profile + notifications + RODO export + danger zone. Backend: `POST /api/me/export`, `DELETE /api/me/account`. | Tidy-up + new RODO compliance features. Ships last — foundation needs to exist and workspace needs to be stable before touching billing flow. | 1 PR, ~3 days. Medium blast radius. |

**Total ≈ 18 working days, 4 PRs, sequential.**

Each sprint is its own implementation plan (one plan per sprint, not one plan for all four). The spec is shared because the design tokens and trust modules are reused across sprints; the *plans* decompose the work into shippable units.

### 7.1 Cross-cutting work

- `lib/workspace/copy.ts` grows substantially — every new component needs PL + EN strings
- E2E coverage: every new page gets at least one smoke test (loads, no JS errors, key CTA visible). Workspace rebuild gets full coverage including sidebar + inline-purchase flow
- Playwright screenshot testing wired up for public pages (one screenshot per page per locale) — guards against accidental visual regressions across the 4 sprints

### 7.2 Explicit deferrals

- Brand photography or illustration system (Approach B is photo-free)
- Marketing translations beyond PL + EN
- Help-center / docs site (linked from "Pomoc" but lives elsewhere)
- Multi-user / team accounts (accountant managing many clients — future product)
- Active-sessions UI (designed, not built in this round)

---

## 8. Open items

- **Legal entity name + NIP/REGON/address.** Required for `<LegalFooter>`. The user must supply these or confirm placeholders for development.
- **Founder photo + bio** for `<FounderCard>`. Real photo, real name, contactable email.
- **Stripe-hosted invoice link** per purchase row — confirm the Stripe webhook stores `hosted_invoice_url` on `stripe_purchases`, or surface via API.
- **`/terms` and `/privacy` content** drafted by a Polish lawyer — out of scope for this design spec.
- **MF schema version** to reference on `/security` — confirm current `FA(3) 2025-06-25` is correct at sprint time.

---

## 9. Success criteria

The redesign succeeds when, *measured 30 days after Sprint 4 ships*:

- Landing → login conversion rate is materially higher than the pre-redesign baseline.
- `/security` page receives organic traffic from accountant-firm domains (indicates the trust page is doing its job).
- `<BalanceChip>` and inline credit-purchase drawer reduce the abandonment rate during low-balance flows.
- No new visual regressions land in `main` undetected (Playwright screenshot tests catch them in CI).
- Polish accountant feedback (qualitative) confirms the site reads as a "real company" rather than a side project.

The redesign **fails** if any of:

- Trust signals are added but not believed (e.g., founder photo is generic stock; NIP placeholder isn't replaced; sub-processor table is vague).
- The workspace rebuild slows down the upload-to-PDF flow for existing users by more than 10%.
- The inline credit-purchase drawer creates conversion friction worse than redirecting to `/billing` did.
