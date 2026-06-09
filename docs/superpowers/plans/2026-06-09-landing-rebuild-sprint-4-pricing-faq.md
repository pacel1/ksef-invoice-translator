# Landing Rebuild Sprint 4: Pricing + FAQ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pricing teaser and the FAQ accordion sections and wire them into the landing at `/landing-preview`, replacing the `#cennik` and `#faq` placeholders.

**Architecture:** Two presentational server components driven by new bilingual copy groups. The FAQ uses native `<details>`/`<summary>` (accessible, no client JS). The pricing teaser shows promise bullets plus a compact 3-point price ladder (accurate to `lib/billing/pricing.ts`) and a link to the full `/pricing` page.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, TailwindCSS, lucide-react, Vitest + Testing Library (jsdom), Playwright. Builds on Sprints 1 to 3 (merged).

**Specs:** `docs/superpowers/specs/2026-06-09-landing-content-rebuild.md` (§4.7 Pricing, §4.8 FAQ), `docs/superpowers/specs/2026-06-09-landing-visual-design.md` (§3 Sections 7 and 8).

**Branch:** `claude/landing-rebuild-sprint-4-pricing-faq` (already off `main`).

**Scope note:** The interactive demo (`#demo`) stays a placeholder (needs the upload-backend design). The final swap of `/` and `/en` to the new design is deferred until the demo exists (the hero CTA targets `#demo`). Pricing values match the canonical ladder: 5 = 6,99 zł, 25 = 4,99 zł, 100 = 2,99 zł (net).

---

## File map

| File | Responsibility | Action |
|---|---|---|
| `lib/landing/copy.ts` | Pricing + FAQ copy (pl + en) | Modify |
| `components/landing/pricing-teaser.tsx` | Section 7 | Create |
| `components/landing/faq-accordion.tsx` | Section 8 | Create |
| `components/landing/landing-rebuild.tsx` | Composition | Modify (render the two sections) |
| `tests/integration/lib/landing-copy.test.ts` | Copy test | Modify |
| `tests/components/landing/pricing-teaser.test.tsx` | Test | Create |
| `tests/components/landing/faq-accordion.test.tsx` | Test | Create |
| `tests/components/landing/landing-rebuild.test.tsx` | Composition test | Modify |
| `tests/e2e/landing-rebuild-preview.spec.ts` | E2E | Modify |

Both components are server components. The pricing CTA uses the `Button` primitive (renders a plain `<a href>`); the FAQ needs no client JS.

---

## Task 1: Pricing + FAQ copy (pl + en)

**Files:**
- Modify: `lib/landing/copy.ts`
- Test: `tests/integration/lib/landing-copy.test.ts`

- [ ] **Step 1: Write the failing test**, append inside `describe("landingCopy", …)` in `tests/integration/lib/landing-copy.test.ts`:

```ts
  it("has pricing and faq groups on both locales", () => {
    for (const loc of [landingCopy.pl, landingCopy.en]) {
      expect(loc.pricing.heading).toBeTruthy();
      expect(loc.pricing.promises.length).toBeGreaterThanOrEqual(5);
      expect(loc.pricing.ladder).toHaveLength(3);
      expect(loc.pricing.ctaHref).toMatch(/pricing/);
      expect(loc.faq.heading).toBeTruthy();
      expect(loc.faq.items).toHaveLength(6);
      for (const item of loc.faq.items) {
        expect(item.q).toBeTruthy();
        expect(item.a).toBeTruthy();
      }
    }
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/lib/landing-copy.test.ts`
Expected: FAIL (`loc.pricing` is undefined).

- [ ] **Step 3: Add the copy.** In `lib/landing/copy.ts`, add `pricing` and `faq` inside `pl` (after `builtForTwo`, before `nav`):

```ts
    pricing: {
      eyebrow: "Cennik",
      heading: "Płacisz tylko za faktury, które tłumaczysz.",
      sub: "Żadnego abonamentu. Pierwsza faktura w miesiącu jest za darmo. Im większy pakiet, tym taniej za sztukę.",
      promises: [
        "1 faktura w miesiącu za darmo, bez karty.",
        "Pakiety od 5 do 100 faktur.",
        "Cena spada z każdym większym pakietem.",
        "Niewykorzystane faktury nie przepadają.",
        "Do każdego zakupu dostajesz fakturę VAT."
      ],
      ladderLabel: "Im większy pakiet, tym taniej za fakturę",
      packUnit: "faktur",
      perInvoiceLabel: "za fakturę",
      ladder: [
        { size: "5", perInvoice: "6,99 zł" },
        { size: "25", perInvoice: "4,99 zł" },
        { size: "100", perInvoice: "2,99 zł" }
      ],
      note: "Ceny netto. VAT 23% dolicza się przy zakupie.",
      cta: "Zobacz pełny cennik",
      ctaHref: "/pricing"
    },
    faq: {
      eyebrow: "FAQ",
      heading: "Najczęstsze pytania",
      items: [
        { q: "Czy tłumaczenie zastępuje fakturę z KSeF?", a: "Nie. Fakturą jest dokument w KSeF. To, co tworzymy, to jej czytelna wersja w języku klienta. Oryginał zostaje nienaruszony." },
        { q: "Czy faktura z KSeF może być po angielsku albo niemiecku?", a: "Tak. Klient dostaje wersję w swoim języku, a oryginał dalej żyje w KSeF po polsku." },
        { q: "Co z kodem QR?", a: "Zostaje. Dzięki niemu wizualizację da się powiązać z fakturą źródłową i zweryfikować." },
        { q: "Muszę coś instalować albo integrować się z KSeF?", a: "Nie. Wgrywasz plik XML lub PDF i tyle. Nie łączymy się z KSeF i nie logujemy Cię do Ministerstwa Finansów." },
        { q: "Czy dostanę fakturę VAT za zakup?", a: "Tak. Po każdym zakupie pakietu wysyłamy fakturę VAT mailem." },
        { q: "Czy moje dane są bezpieczne?", a: "Pliki trzymamy w UE (Frankfurt) i kasujemy po 30 dniach. Nie używamy ich do trenowania modeli." }
      ]
    },
```

And the EN mirror inside `en` (after `builtForTwo`, before `nav`):

```ts
    pricing: {
      eyebrow: "Pricing",
      heading: "You pay only for the invoices you translate.",
      sub: "No subscription. The first invoice each month is free. The bigger the pack, the cheaper per invoice.",
      promises: [
        "1 free invoice each month, no card.",
        "Packs from 5 to 100 invoices.",
        "The price drops with every bigger pack.",
        "Unused invoices never expire.",
        "Every purchase comes with a VAT invoice."
      ],
      ladderLabel: "The bigger the pack, the cheaper per invoice",
      packUnit: "invoices",
      perInvoiceLabel: "per invoice",
      ladder: [
        { size: "5", perInvoice: "PLN 6.99" },
        { size: "25", perInvoice: "PLN 4.99" },
        { size: "100", perInvoice: "PLN 2.99" }
      ],
      note: "Prices net of VAT. 23% VAT is added at checkout.",
      cta: "See full pricing",
      ctaHref: "/en/pricing"
    },
    faq: {
      eyebrow: "FAQ",
      heading: "Frequent questions",
      items: [
        { q: "Does the translation replace the KSeF invoice?", a: "No. The invoice is the document in KSeF. What we create is a readable version in your client's language. The original stays untouched." },
        { q: "Can a KSeF invoice be in English or German?", a: "Yes. Your client gets a version in their language, while the original still lives in KSeF in Polish." },
        { q: "What about the QR code?", a: "It stays. It lets the rendering be linked back to the source invoice and verified." },
        { q: "Do I need to install anything or integrate with KSeF?", a: "No. You upload an XML or PDF file and that is it. We never connect to KSeF and never log you into the Ministry of Finance." },
        { q: "Will I get a VAT invoice for my purchase?", a: "Yes. After every pack purchase we email you a VAT invoice." },
        { q: "Is my data safe?", a: "We store files in the EU (Frankfurt) and delete them after 30 days. We do not use them to train models." }
      ]
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/lib/landing-copy.test.ts`
Expected: PASS (all cases, including the pre-existing parity + no-dash tests).

- [ ] **Step 5: Commit**

```bash
git add lib/landing/copy.ts tests/integration/lib/landing-copy.test.ts
git commit -m "feat(landing-rebuild): pricing + faq copy (pl + en)"
```

---

## Task 2: PricingTeaser (Section 7)

**Files:**
- Create: `components/landing/pricing-teaser.tsx`
- Test: `tests/components/landing/pricing-teaser.test.tsx`

- [ ] **Step 1: Write the failing test**, create `tests/components/landing/pricing-teaser.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PricingTeaser } from "@/components/landing/pricing-teaser";

describe("<PricingTeaser>", () => {
  it("renders the heading, the promises, the ladder, and the full-pricing CTA (PL)", () => {
    render(<PricingTeaser locale="pl" />);
    expect(screen.getByRole("heading", { level: 2, name: /Płacisz tylko za faktury/ })).toBeInTheDocument();
    expect(screen.getByText("Niewykorzystane faktury nie przepadają.")).toBeInTheDocument();
    expect(screen.getByText("2,99 zł")).toBeInTheDocument();
    expect(screen.getByText(/Ceny netto/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zobacz pełny cennik" })).toHaveAttribute("href", "/pricing");
  });

  it("renders the EN CTA to /en/pricing", () => {
    render(<PricingTeaser locale="en" />);
    expect(screen.getByRole("link", { name: "See full pricing" })).toHaveAttribute("href", "/en/pricing");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/landing/pricing-teaser.test.tsx`
Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Write the component**, create `components/landing/pricing-teaser.tsx`:

```tsx
import { Check } from "lucide-react";
import { landingCopy, type LandingLocale } from "@/lib/landing/copy";
import { Button } from "@/components/landing/ui/button";

export interface PricingTeaserProps {
  locale: LandingLocale;
}

export function PricingTeaser({ locale }: PricingTeaserProps) {
  const t = landingCopy[locale].pricing;
  return (
    <section id="cennik" className="bg-paper">
      <div className="mx-auto max-w-5xl px-5 py-16 md:px-8 md:py-20">
        <p className="font-dm text-[12px] font-semibold uppercase tracking-wide text-brand">{t.eyebrow}</p>
        <h2 className="mt-3 max-w-2xl font-heading text-h2x text-ink">{t.heading}</h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-copy">{t.sub}</p>

        <div className="mt-10 grid gap-8 md:grid-cols-2 md:items-center">
          <ul className="space-y-3">
            {t.promises.map((p, i) => (
              <li key={i} className="flex items-start gap-3 text-[14px] text-copy">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mint/15 text-mint">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                {p}
              </li>
            ))}
          </ul>

          <div className="rounded-2xl border border-line bg-paper-soft p-6">
            <p className="font-dm text-[13px] font-medium text-copy-muted">{t.ladderLabel}</p>
            <ul className="mt-4 space-y-2.5">
              {t.ladder.map((row, i) => {
                const highlight = i === t.ladder.length - 1;
                return (
                  <li
                    key={row.size}
                    className={
                      highlight
                        ? "flex items-center justify-between rounded-xl border border-brand/30 bg-brand-soft px-4 py-3"
                        : "flex items-center justify-between rounded-xl border border-line bg-paper px-4 py-3"
                    }
                  >
                    <span className="font-dm text-[14px] text-ink">
                      <span className="font-semibold tabular-nums">{row.size}</span> {t.packUnit}
                    </span>
                    <span className="flex items-baseline gap-1">
                      <span className={highlight ? "font-heading text-[16px] font-bold tabular-nums text-brand" : "font-heading text-[15px] font-semibold tabular-nums text-ink"}>
                        {row.perInvoice}
                      </span>
                      <span className="font-dm text-[12px] font-normal text-copy-muted">{t.perInvoiceLabel}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-copy-muted">{t.note}</p>
          <Button href={t.ctaHref} variant="ghost">{t.cta}</Button>
        </div>
      </div>
    </section>
  );
}

export default PricingTeaser;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/landing/pricing-teaser.test.tsx`
Expected: PASS (2 cases). (`getByText("2,99 zł")` matches the ladder cell exactly; the promise list no longer contains a bare "2,99 zł", so there is no multiple-match.)

- [ ] **Step 5: Commit**

```bash
git add components/landing/pricing-teaser.tsx tests/components/landing/pricing-teaser.test.tsx
git commit -m "feat(landing-rebuild): PricingTeaser section"
```

---

## Task 3: FaqAccordion (Section 8)

**Files:**
- Create: `components/landing/faq-accordion.tsx`
- Test: `tests/components/landing/faq-accordion.test.tsx`

- [ ] **Step 1: Write the failing test**, create `tests/components/landing/faq-accordion.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FaqAccordion } from "@/components/landing/faq-accordion";

describe("<FaqAccordion>", () => {
  it("renders the heading and all six question/answer pairs as details (PL)", () => {
    const { container } = render(<FaqAccordion locale="pl" />);
    expect(screen.getByRole("heading", { level: 2, name: /Najczęstsze pytania/ })).toBeInTheDocument();
    expect(container.querySelectorAll("details")).toHaveLength(6);
    expect(screen.getByText("Co z kodem QR?")).toBeInTheDocument();
    expect(screen.getByText(/Pliki trzymamy w UE/)).toBeInTheDocument();
  });

  it("renders the EN heading", () => {
    render(<FaqAccordion locale="en" />);
    expect(screen.getByRole("heading", { level: 2, name: /Frequent questions/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/landing/faq-accordion.test.tsx`
Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Write the component**, create `components/landing/faq-accordion.tsx`:

```tsx
import { ChevronDown } from "lucide-react";
import { landingCopy, type LandingLocale } from "@/lib/landing/copy";

export interface FaqAccordionProps {
  locale: LandingLocale;
}

export function FaqAccordion({ locale }: FaqAccordionProps) {
  const t = landingCopy[locale].faq;
  return (
    <section id="faq" className="bg-paper-soft">
      <div className="mx-auto max-w-3xl px-5 py-16 md:px-8 md:py-20">
        <p className="font-dm text-[12px] font-semibold uppercase tracking-wide text-brand">{t.eyebrow}</p>
        <h2 className="mt-3 font-heading text-h2x text-ink">{t.heading}</h2>

        <div className="mt-8 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper">
          {t.items.map((item) => (
            <details key={item.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer items-center justify-between gap-4 font-dm text-[15px] font-semibold text-ink">
                <span>{item.q}</span>
                <ChevronDown className="h-5 w-5 shrink-0 text-copy-muted transition-transform duration-150 ease-out group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="mt-3 text-[14px] leading-relaxed text-copy">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export default FaqAccordion;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/landing/faq-accordion.test.tsx`
Expected: PASS (2 cases).

- [ ] **Step 5: Commit**

```bash
git add components/landing/faq-accordion.tsx tests/components/landing/faq-accordion.test.tsx
git commit -m "feat(landing-rebuild): FaqAccordion section"
```

---

## Task 4: Wire pricing + FAQ + E2E + verification

**Files:**
- Modify: `components/landing/landing-rebuild.tsx`
- Modify: `tests/components/landing/landing-rebuild.test.tsx`
- Modify: `tests/e2e/landing-rebuild-preview.spec.ts`

- [ ] **Step 1: Update the composition test**, add this assertion inside the existing `it("renders the nav, final CTA, footer, and the section anchors", …)` test body in `tests/components/landing/landing-rebuild.test.tsx` (after the existing assertions):

```tsx
    // pricing + faq now render real content
    expect(screen.getByRole("heading", { level: 2, name: /Płacisz tylko za faktury/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /Najczęstsze pytania/ })).toBeInTheDocument();
```

- [ ] **Step 2: Run the composition test to verify it fails**

Run: `npx vitest run tests/components/landing/landing-rebuild.test.tsx`
Expected: FAIL (those headings do not render yet).

- [ ] **Step 3: Wire the sections in.** Replace the ENTIRE contents of `components/landing/landing-rebuild.tsx` with:

```tsx
import type { LandingLocale } from "@/lib/landing/copy";
import { SiteNav } from "@/components/landing/site-nav";
import { Hero } from "@/components/landing/hero";
import { OldWayComparison } from "@/components/landing/old-way-comparison";
import { HowItWorksSteps } from "@/components/landing/how-it-works-steps";
import { PreservedVsTranslated } from "@/components/landing/preserved-vs-translated";
import { AudienceCards } from "@/components/landing/audience-cards";
import { PricingTeaser } from "@/components/landing/pricing-teaser";
import { FaqAccordion } from "@/components/landing/faq-accordion";
import { FinalCta } from "@/components/landing/final-cta";
import { SiteFooter } from "@/components/landing/site-footer";

export interface LandingRebuildProps {
  locale: LandingLocale;
}

export function LandingRebuild({ locale }: LandingRebuildProps) {
  return (
    <div className="flex min-h-screen flex-col bg-paper font-dm text-copy">
      <SiteNav locale={locale} />
      <main className="flex-1">
        <Hero locale={locale} />
        {/* Reserved placeholder for the demo sprint */}
        <section id="demo" aria-hidden="true" />
        <OldWayComparison locale={locale} />
        <HowItWorksSteps locale={locale} />
        <PreservedVsTranslated locale={locale} />
        <AudienceCards locale={locale} />
        <PricingTeaser locale={locale} />
        <FaqAccordion locale={locale} />
      </main>
      <FinalCta locale={locale} />
      <SiteFooter locale={locale} />
    </div>
  );
}

export default LandingRebuild;
```

(This replaces the `#cennik` and `#faq` placeholder `<section>`s with the real `PricingTeaser` and `FaqAccordion`, which render their own `<section id="cennik">` / `<section id="faq">`. The `#demo` placeholder remains.)

- [ ] **Step 4: Run the composition test to verify it passes**

Run: `npx vitest run tests/components/landing/landing-rebuild.test.tsx`
Expected: PASS (1 case).

- [ ] **Step 5: Add E2E assertions.** Append to `tests/e2e/landing-rebuild-preview.spec.ts`:

```ts
test("renders pricing + faq sections", async ({ page }) => {
  await page.goto("/landing-preview");
  await expect(page.getByRole("heading", { level: 2, name: /Płacisz tylko za faktury/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Zobacz pełny cennik" })).toHaveAttribute("href", "/pricing");
  await expect(page.getByRole("heading", { level: 2, name: /Najczęstsze pytania/ })).toBeVisible();
  await expect(page.getByText("Co z kodem QR?")).toBeVisible();
});
```

- [ ] **Step 6: Run the E2E**

Run: `npm run test:e2e -- landing-rebuild-preview`
Expected: PASS (existing + the new pricing/faq test). Port 3000 should be free.

- [ ] **Step 7: Full verification**

Run: `npx vitest run tests/components/landing tests/integration/lib tests/styles/landing-tokens.test.ts`
Expected: all green.

Run: `npm run typecheck && npm run lint && npm run check:mf-labels`
Expected: no new typecheck errors (the ~12 pre-existing Sanity/blog errors are unrelated), lint clean, MF labels pass.

- [ ] **Step 8: Commit**

```bash
git add components/landing/landing-rebuild.tsx tests/components/landing/landing-rebuild.test.tsx tests/e2e/landing-rebuild-preview.spec.ts
git commit -m "feat(landing-rebuild): wire pricing + faq into the page"
```

- [ ] **Step 9: Controller-owned manual check.** The controller verifies live at `/landing-preview`: the pricing section (promise list + the 3-row ladder with the 100-pack highlighted + the net-VAT note + the ghost CTA to /pricing) and the FAQ accordion (6 items, each `<details>` expands on click, the chevron rotates), correct backgrounds (pricing white, faq paper-soft), no overflow at 360 / 768 / 1024 / 1440, and one `<details>` expands correctly.

---

## Self-review notes (author)

- **Spec coverage:** pricing teaser with promises, ladder, net-VAT note, full-pricing link (content §4.7, visual §3 Section 7 -> Tasks 1, 2); FAQ accordion with six items (content §4.8, visual §3 Section 8 -> Tasks 1, 3); wiring (Task 4). The demo (`#demo`) and the `/` swap remain out of scope, as noted.
- **Pricing accuracy:** the ladder values (5 = 6,99 zł, 25 = 4,99 zł, 100 = 2,99 zł) match `lib/billing/pricing.ts` TIERS (699 / 499 / 299 cents). EN shows `PLN 6.99` etc. (period decimal, ISO code), consistent with the existing `/pricing` formatting and the showcase currency localization.
- **A11y:** each section has one `<h2>`; the FAQ uses native `<details>`/`<summary>` (keyboard-operable, expandable without JS); the chevron and the promise/ladder icons are `aria-hidden`; the pricing CTA is a real anchor with the Button focus ring. Contrast: `text-copy-muted` (#697386) on `paper-soft` is the tightest combination at 4.50 (AA pass), already verified in Sprint 3.
- **No multiple-match trap:** the pricing test asserts `getByText("2,99 zł")` (exact) which matches only the ladder cell; the promises copy intentionally says "Cena spada z każdym większym pakietem." without a bare "2,99 zł", so there is exactly one match.
- **Type consistency:** `pricing` (eyebrow, heading, sub, promises[], ladderLabel, packUnit, perInvoiceLabel, ladder[{size, perInvoice}]×3, note, cta, ctaHref) and `faq` (eyebrow, heading, items[{q, a}]×6) are added to both locales with identical shapes; each component reads `landingCopy[locale].<group>`. Both components share `{ locale: LandingLocale }`.
- **No placeholders / no dashes:** every component and test has complete code; copy uses straight apostrophes and commas, never em or en dashes (the no-dash copy test enforces it).
