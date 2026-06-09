# Landing Page Rebuild, Visual Design

**Status:** Visual design spec. Companion to the content spec `2026-06-09-landing-content-rebuild.md` (which holds the final Polish copy). This spec defines the design system and the section by section visual design.
**Date:** 2026-06-09
**Direction:** Bold modern SaaS, flavor "2A" (indigo on white with disciplined dark accents). Validated against the ui-ux-pro-max design intelligence (style classified as Exaggerated Minimalism: oversized type, high contrast, generous whitespace).
**Scope:** The public landing page (`/` and `/en`). This is a ground up rebuild with a new design system, not a reuse of the current Stripe-minimal tokens.

---

## 1. Design system

### 1.1 Style

Exaggerated Minimalism for a conversion landing: oversized Space Grotesk headlines, weight 700, tight tracking around -0.03em, lots of white space, high contrast, one confident accent. Restraint everywhere except the headline and the animated hero.

### 1.2 Color palette

| Token | Hex | Use |
|---|---|---|
| `indigo` | `#4F46E5` | Primary brand, all primary CTAs, active states, key accents |
| `indigo-hover` | `#4338CA` | CTA hover |
| `indigo-soft` | `#EEF0FF` | Eyebrow pills, soft washes, selected backgrounds |
| `ink` | `#0B1020` | Headlines, primary text, dark sections |
| `ink-panel` | `#121A2E` | Inner surfaces on dark sections |
| `text` | `#475069` | Body text |
| `text-muted` | `#697386` | Secondary labels, captions |
| `surface` | `#FFFFFF` | Default canvas |
| `surface-soft` | `#F7F8FB` | Alternating section bands, inset cards |
| `border` | `#E7EBF2` | Card outlines |
| `hairline` | `#EEF1F5` | Internal dividers |
| `violet` | `#8B5CF6` | Gradient start, hero glow |
| `fuchsia` | `#D946EF` | Gradient end |
| `success` | `#10B981` | Success microstates only (translated, cached, done) |
| `danger-soft` | `#DC2626` | The "old way" x marks in the comparison, used sparingly |

Rules:
- The violet to fuchsia gradient (`#8B5CF6` to `#D946EF`) is used only on the hopeful line "Już nie musisz", the brand logo, and a couple of glows. It is never a background for text blocks.
- Emerald is reserved for success states. It is not a second brand color.
- CTAs are solid indigo on both light and dark sections (high contrast both ways), so no separate CTA color is needed.

### 1.3 Typography

Pairing: **Space Grotesk** for headings, **DM Sans** for body (the ui-ux-pro-max "Tech Startup / SaaS" pairing). Loaded with `next/font/google` (self hosted, zero layout shift), applied on `<body>` in the root layout. Both cover Polish diacritics.

| Role | Font, weight | Size |
|---|---|---|
| Hero H1 | Space Grotesk 700 | `clamp(24px, 4.4vw, 43px)`, line-height 1.09, tracking -0.03em |
| Section H2 | Space Grotesk 700 | `clamp(26px, 3.2vw, 36px)`, tracking -0.02em |
| Card H3 | Space Grotesk 600 | 18 to 20px |
| Body | DM Sans 400 to 500 | `clamp(14px, 1.4vw, 16px)`, line-height 1.6 |
| Small | DM Sans 400 | 14px |
| Micro, eyebrows | DM Sans 600 | 12px, uppercase tracking on eyebrows |
| Numbers, prices | DM Sans 600, `tabular-nums` | per context |

Body line length capped around 33em. Body line-height 1.6.

### 1.4 Spacing, radii, shadows

- Spacing on a 4px grid. Section vertical padding around 80px desktop, 44px mobile.
- Radii: 9 to 11px buttons, 14 to 16px cards, 999px pills.
- Shadows: resting card `0 16px 38px -16px rgba(10,20,40,.26)`; raised `0 30px 60px -22px rgba(10,20,40,.32)`; indigo CTA `0 12px 24px -8px rgba(79,70,229,.5)`.
- One shared content max width around 1080 to 1140px, centered.

### 1.5 Motion

- Entrance: one time fade plus a 12px rise on scroll into view, 200ms ease-out, light stagger. Respects `prefers-reduced-motion`.
- Hero invoice: the only continuous motion. Language cycles roughly every 2.4s with a scan sweep plus a short label shimmer, plus a gentle 6s bob float. On `prefers-reduced-motion` it stops and shows a static English invoice. Pause on hover is a nice to have.
- Demo: skeleton or spinner while processing an upload.
- No other infinite or decorative animation. Glows are static. Only transform and opacity are animated. Durations stay 150 to 300ms for micro interactions.

### 1.6 Dark usage discipline

Most of the page is light (white alternating with `surface-soft`). Dark (`ink`) is used only for the final CTA plus footer, as one cohesive dark close. This keeps the Exaggerated Minimalism contrast high without the page feeling heavy.

### 1.7 Accessibility and performance (enforced)

- Text contrast at least 4.5:1. Indigo `#4F46E5` on white passes for large and normal text.
- Visible focus rings on every interactive element (`focus:ring-2 ring-indigo`).
- Icon only buttons get `aria-label`. Decorative elements get `aria-hidden`.
- All clickable elements get `cursor-pointer`.
- Icons are Lucide SVG, never emoji.
- `next/image` for any raster images, lazy loaded below the fold.
- Responsive verified at 375, 768, 1024, 1440. No horizontal scroll at 375.
- Forms (the demo upload, the login gate) have labels and clear error feedback.

---

## 2. Section backgrounds (rhythm)

| Section | Background |
|---|---|
| Sticky nav | white, blurred, hairline bottom border |
| 1 Hero | white |
| 2 Live demo | `surface-soft` so the demo card pops |
| 3 Why the old way fails | white |
| 4 How it works | `surface-soft` |
| 5 What stays exact | white |
| 6 Built for two | `surface-soft` |
| 7 Pricing | white |
| 8 FAQ | `surface-soft` |
| 9 Final CTA plus footer | `ink` (dark) |

---

## 3. Section by section visual design

Copy is in the content spec. This section defines layout, components, and behavior.

### Nav (sticky)

White blurred bar, hairline bottom border, shared max width. Left: gradient "T" logo plus "TłumaczKSeF" in Space Grotesk. Center or right: links (Jak to działa, Cennik, Bezpieczeństwo, FAQ). Right: indigo "Zacznij za darmo". Below `lg` the links collapse into a hamburger that opens a full height sheet (same interaction pattern already shipped: trigger with `aria-expanded`, focus moved into the sheet, close on link, backdrop, and Escape, body scroll locked).

### 1 Hero

Two columns on `lg` and up (copy left, animated invoice right), single column below with the invoice under the copy. Copy column: eyebrow pill, oversized Space Grotesk H1 with the violet to fuchsia gradient only on "Już nie musisz", DM Sans subline, indigo primary CTA ("Przetłumacz swoją fakturę") that scrolls to the demo, ghost secondary ("Zobacz na przykładzie"), and a reassurance line with an emerald dot. A static violet glow sits behind the visual.

**The animated invoice (hero showpiece).** A realistic invoice card (seller, invoice number, issue date, buyer, seller VAT id, one line item, totals, the KSeF QR), around 420px wide, with a soft stacked card shadow behind it for depth and a gentle bob float. A language strip on top (PL, EN, DE, FR, ES, IT) plus a success status chip. It auto cycles languages roughly every 2.4s. On each switch a scan sweep plus a short shimmer runs, and only the translatable parts change: the document title, the field labels, the item description, the totals label, the success status, and the currency token (`zł` for PL, `PLN` for every other language). Everything that must stay exact stays visibly identical: the invoice number, the date, the VAT id, the digits of every amount, and the QR. A small chip states it: "Numery, kwoty i kod QR bez zmian". On `prefers-reduced-motion` the animation stops on a static English invoice. The component is a client component using React state plus an interval for the cycle and `useReducedMotion` to gate it. The H1 scales with `clamp()` so the long headline shrinks gracefully on small screens.

### 2 Live demo

`surface-soft` band, a prominent centered card. Left zone: a dropzone ("Przeciągnij plik XML lub PDF") plus a secondary "Otwórz przykładową fakturę" that loads the clearly fictional sample, plus the language pills. Right zone: the rendered result preview, styled like the hero invoice for consistency. While processing, the preview shows a skeleton plus spinner. A "Pobierz PDF" button opens the free account gate ("Załóż darmowe konto, żeby pobrać. Pierwsza faktura w tym miesiącu jest za darmo."). The privacy line sits beneath the card. This section is the interactive centerpiece. Its backend (anonymous upload, server side render, gated download, abuse and privacy handling) is a separate implementation concern, see Open items.

### 3 Why the old way fails

A comparison (the ui-ux-pro-max landing intelligence notes comparison sections convert well). Two columns: "Tak to wygląda dzisiaj" (muted, three rows with a soft red x: polski PDF, ręczne przepisywanie, Google Translate, each with its consequence) and "Z TłumaczKSeF" (an indigo highlighted column with green checks resolving each pain). The resolution line sits below: "My tłumaczymy tylko język. Liczby, numery i kod QR zostają dokładnie tam, gdzie były."

### 4 How it works

`surface-soft` band, three steps in a row on desktop, stacked on mobile, with a thin connector. Each step: a large Space Grotesk numeral in an indigo soft circle, an H3, and one supporting line. Footnote: "Bez instalacji, bez integracji, bez umów."

### 5 What stays exact, what gets translated

A split card on white. Left "Zostaje bez zmian" with small lock icons and a neutral tone (numery faktur, NIP i numery VAT, kwoty i sumy, daty, stawki VAT, IBAN i numery kont, kod QR z KSeF). Right "Tłumaczymy" with indigo translate icons (nazwy pól i nagłówki, opisy towarów i usług, notatki i uwagi, warunki i instrukcje płatności, stopkę). The QR and verify trust line sits beneath.

### 6 Built for two

`surface-soft` band, two equal cards. Each has a Lucide icon, an H3, and a short paragraph: "Prowadzisz firmę i sprzedajesz za granicę" and "Prowadzisz biuro rachunkowe". Equal visual weight, indigo accents.

### 7 Pricing

White band. The heading and subline, then a row of four promise chips (Pierwsza faktura za darmo, Bez abonamentu, Kredyty nie wygasają, Faktura VAT). Below, a compact price strip showing pack size from 5 to 100 and the per invoice price dropping from 6,99 zł to 2,99 zł, with the free tier called out. A net price note and a "Zobacz pełny cennik" link to `/pricing`. The full slider lives on `/pricing`.

### 8 FAQ

`surface-soft` band, a clean accordion with six items, indigo open state indicator, hairline dividers. Content from the content spec.

### 9 Final CTA and footer

The one dark band (`ink`) with a static violet glow. A large Space Grotesk headline "Wgraj pierwszą fakturę i zobacz wynik.", the subline, and a high contrast CTA. The footer continues dark: legal entity, NIP, REGON, address, link columns, and the trust line (Dane w UE Frankfurt, Płatności Stripe, Zgodność z RODO). This dark close gives the long page a confident finish.

---

## 4. Component inventory

New components, each with one clear responsibility:

- `Button` (variants: primary indigo, ghost, sizes; focus ring; loading state).
- `EyebrowPill`.
- `SiteNav` plus `MobileNavSheet` (hamburger sheet, the shipped interaction pattern).
- `InvoiceShowcase` (the animated hero invoice, client component).
- `LiveDemo` (dropzone, sample loader, language pills, result preview, download gate, privacy line, loading state).
- `OldWayComparison`.
- `HowItWorksSteps`.
- `PreservedVsTranslated`.
- `AudienceCards`.
- `PricingStrip`.
- `FaqAccordion`.
- `FinalCta` and `SiteFooter` (dark).

Icons from `lucide-react`. All copy injected via props from the bilingual copy source.

---

## 5. Technical notes

- Next.js 15 App Router, TailwindCSS. A new token set is added to the Tailwind config for this design system (the colors and type above). The old Stripe-minimal tokens stay until the rebuild replaces the landing, then unused ones get cleaned up.
- Fonts via `next/font/google` (Space Grotesk, DM Sans), applied in `app/layout.tsx`.
- The hero animation and the demo are client components. Everything else can be server components.
- Motion via a small amount of Framer Motion (entrance) plus CSS for the hero scan and shimmer, gated by `useReducedMotion`.
- This rebuild supersedes the components shipped in the prior refined-minimal refresh (the hero, how-it-works, risk-reversal, trust strip, testimonials). The implementation plan handles replacing them and retiring the dead ones.

---

## 6. Open items

- The interactive demo backend: anonymous upload, server side render of the preview, gated download, plus privacy and abuse handling for anonymous uploads. This needs its own design before implementation.
- The clearly fictional sample invoice asset for the one click demo path.
- Legal entity name, NIP, REGON, address for the footer.
- English copy for the `/en` mirror.
- Whether the new design system replaces the global app chrome (authenticated header, other pages) or stays scoped to the landing for now. Default: scope to the public landing first.

---

## 7. Success criteria

- The page renders the animated hero plus all nine sections, dash free copy, at 375, 768, 1024, 1440 with no horizontal scroll and no console errors.
- The hero animation demonstrates the core idea (labels and currency localize, numbers and QR stay) and falls back cleanly under reduced motion.
- Contrast, focus states, keyboard nav, and Lucide SVG icons all pass the checklist in 1.7.
- The page reads as a confident, modern, trustworthy tool for both Polish exporters and accountants.
