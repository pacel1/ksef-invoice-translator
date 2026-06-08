# Landing Page Refresh — Refined-Minimal Conversion Rework

**Status:** Spec
**Date:** 2026-06-08
**Approach:** Direction A — Refined minimal (elevate execution *within* the locked Stripe-minimal system; no new aesthetic)
**Scope:** The public landing page only (`/` and its `/en` mirror), rendered by `components/marketing/landing-page.tsx`. Header and footer are out of scope.

---

## 1. Goal & non-goals

### Goal

Make the landing page convert better and look sharper **without** leaving the Stripe-minimal design system or inventing credibility the product hasn't earned yet. "Awesome" here means executional polish and a tighter conversion narrative — not visual flash. The audience is trust-sensitive Polish SMB owners and accountants; the page must read as a serious tool, not consumer SaaS.

### Why now

The current landing works but has three weaknesses:
1. It leans on **fake social proof** — three testimonials tagged `REPLACE_BEFORE_LAUNCH` with invented names.
2. It shows a **trust strip of partner logos** (Stripe, Supabase, etc.) that implies endorsements the product doesn't have — none of those companies are customers.
3. There is **no "how it works"** explanation, so a first-time visitor has to infer the product from the hero alone.

### Non-goals

- No new colors, fonts, or design tokens. The Stripe-minimal system (`tailwind.config.ts`, spec `2026-05-18-ui-overhaul-design.md` §3) is authoritative and unchanged.
- No change to the public **header** (`components/layout/public-header.tsx`) — the user is happy with it.
- No change to the **footer** (`components/layout/legal-footer.tsx`).
- No interactive/live product demo in the hero (Direction A keeps the before→after **static**).
- No new marketing locales beyond the existing PL + EN.
- No bold/editorial aesthetic, gradient hero, or animated background (Directions B and C were considered and declined).

---

## 2. Design language

Unchanged from the system spec. Reaffirmed here because the refresh leans on consistent application of it:

- **Accent.** Stripe purple `#635bff` (`accent`), hover `accent-hover`, soft wash `accent-soft`. One deliberate accent per viewport — used for the primary CTA and at most one highlight; never sprayed.
- **Surfaces.** `surface` (`#ffffff`) and `surface-muted` (`#f7fafc`) **alternate** section-to-section to separate content without heavy borders.
- **Type.** Inter variable; the existing scale (`display`, `h1`, `h2`, `h3`, `body`, `small`, `micro`). Tabular numerals on every price and stat.
- **Shape & shadow.** `rounded-lg`/`rounded-xl` cards, hairline `border`, three-tier `shadow-sm` (rest) / `shadow-md` (hover) / `shadow-lg` (hero visual).
- **Motion.** 150–200 ms ease-out. **One-time** entrance transitions only (fade + slight rise), staggered, `prefers-reduced-motion` safe. **No** infinite/looping animation.

### Craft rules applied across every section

These are what lift the page from "fine" to "refined" inside a minimal system:

1. **Shared content width + steady vertical rhythm.** Every section uses one max-width and standardized vertical padding so the page scrolls with a consistent cadence.
2. **Section eyebrows.** A small uppercase `micro`-scale label (e.g. `JAK TO DZIAŁA`) above each `h2`, for scannability and hierarchy.
3. **Alternating backgrounds.** White ↔ `surface-muted`, so section boundaries read without boxing everything.
4. **One accent per viewport.** Purple earns attention; it doesn't decorate.
5. **Real content only.** Polish-first, EN parity. No lorem, no placeholder people.

---

## 3. Page structure

Ten slots top-to-bottom. Legend: **keep** = render unchanged · **restyle** = same component, refined styling/copy · **rework** = significant change · **new** = new component · **remove** = dropped from the landing.

| # | Section | Change | Component |
|---|---------|--------|-----------|
| 1 | Header | keep | `PublicHeader` (untouched) |
| 2 | Hero | **rework** | `components/ui/hero-section-9.tsx` |
| 3 | ~~Trust strip~~ | **remove** | `TrustStrip` (no longer rendered on landing) |
| 4 | Jak to działa (3 steps) | **new** | `components/marketing/how-it-works.tsx` |
| 5 | Features ("Faktura zostaje fakturą") | restyle | `components/ui/features-section.tsx` |
| 6 | Pricing teaser (live slider) | restyle | `PublicPricingSlider` |
| 7 | Zacznij bez ryzyka (risk-reversal) | **new** (replaces testimonials) | `components/marketing/risk-reversal.tsx` |
| 8 | FAQ | restyle | `MarketingFAQ` |
| 9 | ~~Founder card~~ | **remove** | `FounderCard` (stays on `/security`) |
| 10 | Final CTA + Footer | restyle | inline + `LegalFooter` (footer untouched) |

---

## 4. Section designs

### 4.1 Hero — rework (`hero-section-9.tsx`)

Keep the two-column split (copy left, before→after visual right); it stacks to single column below `lg` (copy first, visual second).

**Copy column.**
- **Eyebrow** pill: `MF FA(3) · schemat 2025-06-25` — an immediate compliance cue in `accent-soft`.
- **H1** (`display` scale): *"Faktura KSeF dla klienta z zagranicy. **W 4 sekundy.**"* — accent applied to "W 4 sekundy."
- **Subhead** (`body`, `text-muted`): existing `heroSubhead`.
- **CTAs:** primary **"Zacznij za darmo"** → `/login` (purple, `size=lg`, visually dominant) + secondary **"Zobacz przykład"** (ghost/outline, anchors to the `#jak-to-dziala` section or an example modal — see open items §9).
- **Proof line** (one tidy group under CTAs, `small`/`text-muted`): *"od 2,99 zł za fakturę · bez subskrypcji · 1 darmowa faktura w miesiącu, bez karty."* Consolidates today's separate `note` + free-note.
- **Stat row:** slimmed from three chunky icon-circle cards to **one quiet inline row** separated by hairline dividers — `20+ języków · MF FA(3) · ≈4 s`. Lower visual weight; the stats support, not shout.

**Visual column.**
- **Remove** the perpetual floating decorative shapes (`floatingVariants` blobs, warning-soft square, accent dots) — too playful for refined-minimal.
- Replace with a single, **static**, very subtle radial wash behind the document pair.
- Keep the two stacked document cards (PL source top-left, EN result bottom-right) using `/marketing/invoice-pl.svg` and `/marketing/invoice-en.svg`, with the translation arrow + `4 s` badge between them. Tighten to `rounded-xl`, `shadow-lg`, crisp borders.
- **Motion:** one-time entrance only (fade + slight rise/scale, staggered). `useReducedMotion` disables it. No `repeat: Infinity`.

### 4.2 Trust strip — remove

Not rendered on the landing. Rationale: the logos imply endorsement by companies that are vendors, not customers — dishonest credibility for a pre-B2B product. `TrustStrip` is the only landing-only trust component besides testimonials; after removal it is unused (see §6, dead code).

### 4.3 Jak to działa — new (`how-it-works.tsx`)

White background. Eyebrow `JAK TO DZIAŁA` + **H2** *"Od pliku KSeF do gotowego PDF — w trzech krokach."*

Three numbered steps in a row (single column below `md`), each: a large **tabular step number** in an `accent-soft` circle, an `h3`, and one supporting line:

1. **Wgraj fakturę** — *"Plik FA(3) XML z KSeF albo PDF. Bez integracji, bez logowania do KSeF."*
2. **Tłumaczymy treść** — *"20+ języków. Numerację i strukturę MF zostawiamy nietknięte."* (carries a small `≈4 s` marker)
3. **Pobierz MF-PDF** — *"Zgodny ze schematem 2025-06-25. Gotowy do wysłania klientowi."*

Thin connector line/chevrons between steps on desktop (`border` color, decorative, `aria-hidden`). New copy under `landing.howItWorks` (PL + EN).

### 4.4 Features — restyle (`features-section.tsx`)

Keep the "1 hero card + 2 small cards" layout and all three illustrations (`FieldMappingIllustration`, `PricingTiersIllustration`, `DataResidencyIllustration`) and copy (`landing.features`). Refinements only:
- Add the eyebrow label above the existing two-tone heading.
- Set the section background to `surface-muted` so it alternates against the white "Jak to działa" above it.
- Normalize card padding and shadows to `shadow-sm` rest / `shadow-md` hover; align max-width and vertical padding to the shared rhythm.

### 4.5 Pricing teaser — restyle (`PublicPricingSlider`)

White background. Eyebrow `CENNIK` + **H2** *"Im więcej tłumaczysz, tym taniej."* Wrap the existing slider in one bordered card (`rounded-xl`, `shadow-sm`); per-invoice readout uses the `number-xl` tabular scale; slider track styled in `accent`. Keep the **"Pełny cennik →"** link to `/pricing`.

### 4.6 Zacznij bez ryzyka — new (`risk-reversal.tsx`), replaces testimonials

`surface-muted` background (alternates against white pricing above). Centered. Eyebrow `BEZ RYZYKA` + **H2** *"Zacznij bez ryzyka."*

A 2×2 grid (single column below `sm`) of four check items — each a `success`-colored check + one line. All four are already true in the product:

- *1 faktura w miesiącu — gratis*
- *Bez karty, bez subskrypcji*
- *Niewykorzystane kredyty nie wygasają*
- *Zwrot pakietu w ciągu 14 dni*

Below the grid: primary CTA **"Zacznij za darmo"** → `/login`. New copy under `landing.riskReversal` (PL + EN). The `AnimatedTestimonials` render is removed from the landing.

### 4.7 FAQ — restyle (`MarketingFAQ`)

White background. Eyebrow `FAQ` + existing **H2** *"Najczęstsze pytania."* Accordion with hairline `border` dividers and an `accent` open-state indicator. Existing five items (`landing.faq`) unchanged.

### 4.8 Founder card — remove from landing

`FounderCard` is no longer rendered on the landing. It **remains** on `/security` (`components/marketing/security-page.tsx`), so the component is not deleted. The trust narrative on the landing now rests on concrete, honest signals (MF compliance, EU data, transparent pricing, risk-reversal) rather than a single founder photo.

### 4.9 Final CTA + Footer — restyle

`surface-muted` band. **H2** *"1 darmowa faktura w miesiącu. Bez karty."* + dominant primary CTA **"Zacznij teraz"** → `/login`. Tighten spacing to the shared rhythm. `LegalFooter` is rendered unchanged.

---

## 5. Copy

All new strings land in `lib/marketing/copy.ts` under `landing`, **with PL and EN parity** (the same `LandingPage` component renders `/` as `pl` and `/en` as `en`):

- `landing.heroEyebrow` — "MF FA(3) · schemat 2025-06-25" / EN equivalent.
- `landing.heroProofLine` — consolidated price + free-note line.
- `landing.howItWorks` — `{ eyebrow, heading, steps: [{ title, body }] × 3 }`.
- `landing.riskReversal` — `{ eyebrow, heading, items: string[4], cta }`.
- Section eyebrows for features / pricing / faq (e.g. `landing.sectionLabels`).

Strings no longer rendered on the landing (`landing.testimonials`, `trustStrip` usage, `founderHeading`) may stay in `copy.ts` for now; removing them is a cleanup concern, not required for this change. Voice follows the system spec §3.5: direct, Polish-business formal, numbers over adjectives.

---

## 6. Components, isolation & dead code

**New, self-contained components** (each one purpose, props-driven, independently testable):

- `how-it-works.tsx` — props: `{ eyebrow, heading, steps }`. No data fetching. Pure presentational.
- `risk-reversal.tsx` — props: `{ eyebrow, heading, items, ctaText, ctaHref }`. Pure presentational.

`landing-page.tsx` stays the thin composition layer; it gains the two new sections and loses three (`TrustStrip`, `AnimatedTestimonials`, `FounderCard`) from its render tree.

**Dead code after this change:** `TrustStrip` (`components/trust/trust-strip.tsx`) and `AnimatedTestimonials` (`components/ui/animated-testimonials.tsx`) become unused. They are **left in place** for this PR to keep blast radius small, and flagged for a separate cleanup pass. `FounderCard` is retained (used by `/security`).

---

## 7. Responsive design

Mobile-first; verified at **360 / 768 / 1024 / 1440**.

- **Hero:** two columns ≥ `lg`; below that, stacks — copy first, visual below. CTAs go full-width on the smallest breakpoint.
- **Jak to działa:** three across ≥ `md`; single column below, connectors hidden.
- **Features:** existing responsive grid retained (hero card spans both columns ≥ `sm`).
- **Risk-reversal:** 2×2 ≥ `sm`; single column below.
- **Pricing teaser / FAQ / final CTA:** single-column, centered, width-capped at all sizes.
- Tap targets ≥ 44 px; no horizontal scroll at 360 px; respects `prefers-reduced-motion`.

---

## 8. Testing (TDD, 80%+ coverage)

Written test-first per the project policy.

**Unit (Vitest + RTL):**
- `how-it-works` — renders three steps, correct titles/bodies for PL and EN, eyebrow + heading present.
- `risk-reversal` — renders four items, CTA text + `href="/login"`, PL and EN strings.
- `landing-page` — renders the two new sections; does **not** render `TrustStrip`, `AnimatedTestimonials`, or `FounderCard`.

**E2E (Playwright) smoke, per locale (`/` and `/en`):**
- Page loads with no console/JS errors.
- Primary hero CTA is visible and links to `/login`.
- "Jak to działa" and "Zacznij bez ryzyka" sections are present; old trust strip / testimonials / founder are absent.
- One screenshot baseline per locale to guard against visual regressions across future changes.

---

## 9. Open items

- **"Zobacz przykład" secondary CTA target.** Today it anchors to `#features`. Decide at implementation: keep as an anchor (e.g. to "Jak to działa") or wire the sample-PDF modal described in the system spec §5.1. Default for this PR: anchor — the modal is out of scope.
- **Whether to delete the now-unused `TrustStrip` / `AnimatedTestimonials`** in this PR or a follow-up. Default: follow-up.

---

## 10. Success criteria

- The landing renders the reworked hero + two new sections at all four breakpoints with no console errors and no visual regression elsewhere.
- No fake or unearned credibility remains on the page (no invented testimonials, no vendor-logo endorsements).
- Primary path to `/login` is unambiguous and reachable from hero, risk-reversal, and final CTA.
- PL and EN render at full parity from a single component.
- New components are unit-covered; Playwright smoke + screenshots pass per locale.
