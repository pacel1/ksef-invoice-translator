# Landing Page Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the public landing page (`/` and `/en`) into a tighter, more honest, refined-minimal conversion page — new "Jak to działa" and "Zacznij bez ryzyka" sections, a polished hero, and removal of the fake testimonials, vendor trust strip, and founder card.

**Architecture:** The landing is composed in `components/marketing/landing-page.tsx` from section components, with all copy in `lib/marketing/copy.ts` (PL + EN). We add two new presentational components, rework the existing hero component, and recompose the landing — no design-token changes. Section backgrounds alternate white ↔ `surface-muted` via the shared `cn`/`twMerge` helper.

**Tech Stack:** Next.js 15 (App Router, RSC), React 19, TypeScript, Tailwind (custom Stripe-minimal tokens), framer-motion (hero entrance only), lucide-react icons, Vitest + Testing Library (jsdom for `tests/components/**`), Playwright E2E.

**Spec:** `docs/superpowers/specs/2026-06-08-landing-page-refresh-design.md`

**Branch:** `claude/landing-refresh` (already created off `main`; spec already committed).

---

## File map

| File | Responsibility | Action |
|---|---|---|
| `lib/marketing/copy.ts` | Bilingual strings | **Modify** — add `landing.heroEyebrow`, `landing.heroProofLine`, `landing.howItWorks`, `landing.riskReversal`; add `eyebrow` to `landing.pricingTeaser` and `landing.faq` (both locales) |
| `components/marketing/how-it-works.tsx` | "Jak to działa" 3-step section | **Create** |
| `components/marketing/risk-reversal.tsx` | "Zacznij bez ryzyka" promise grid + CTA | **Create** |
| `components/ui/hero-section-9.tsx` | Hero | **Modify** — add `eyebrow` prop, slim the stat row, drop infinite floating shapes, add static wash |
| `components/marketing/landing-page.tsx` | Page composition | **Modify** — add 2 new sections, remove 3 old ones, wire eyebrow + proof line, alternate backgrounds |
| `tests/components/marketing/how-it-works.test.tsx` | Unit test | **Create** |
| `tests/components/marketing/risk-reversal.test.tsx` | Unit test | **Create** |
| `tests/components/ui/hero-section.test.tsx` | Unit test | **Create** |
| `tests/integration/lib/marketing-copy.test.ts` | Copy parity test | **Modify** — assert new landing keys |
| `tests/e2e/landing-refresh.spec.ts` | Page-level smoke (PL + EN) | **Create** |

**Not touched:** `public-header.tsx`, `legal-footer.tsx`, `features-section.tsx` (only its background is overridden from the parent), `trust-strip.tsx`, `animated-testimonials.tsx`, `founder-card.tsx` (the latter three simply stop being rendered on the landing; `founder-card` is still used by `/security`).

---

## Task 1: Copy strings (PL + EN)

**Files:**
- Modify: `lib/marketing/copy.ts` (add keys inside `pl.landing` and `en.landing`; add `eyebrow` to `pl.landing.pricingTeaser`/`faq` and the EN mirrors)
- Test: `tests/integration/lib/marketing-copy.test.ts`

- [ ] **Step 1: Write the failing test** — append these cases inside the existing `describe("marketingCopy", …)` block in `tests/integration/lib/marketing-copy.test.ts`:

```typescript
  it("landing exposes hero eyebrow + proof line on both locales", () => {
    expect(marketingCopy.pl.landing.heroEyebrow).toBeTruthy();
    expect(marketingCopy.pl.landing.heroProofLine).toBeTruthy();
    expect(marketingCopy.en.landing.heroEyebrow).toBeTruthy();
    expect(marketingCopy.en.landing.heroProofLine).toBeTruthy();
  });

  it("landing howItWorks has an eyebrow, heading, and exactly three steps (both locales)", () => {
    for (const loc of [marketingCopy.pl, marketingCopy.en]) {
      expect(loc.landing.howItWorks.eyebrow).toBeTruthy();
      expect(loc.landing.howItWorks.heading).toBeTruthy();
      expect(loc.landing.howItWorks.steps).toHaveLength(3);
      for (const step of loc.landing.howItWorks.steps) {
        expect(step.title).toBeTruthy();
        expect(step.body).toBeTruthy();
      }
    }
  });

  it("landing riskReversal has an eyebrow, heading, cta, and exactly four items (both locales)", () => {
    for (const loc of [marketingCopy.pl, marketingCopy.en]) {
      expect(loc.landing.riskReversal.eyebrow).toBeTruthy();
      expect(loc.landing.riskReversal.heading).toBeTruthy();
      expect(loc.landing.riskReversal.cta).toBeTruthy();
      expect(loc.landing.riskReversal.items).toHaveLength(4);
    }
  });

  it("landing pricingTeaser and faq carry eyebrows (both locales)", () => {
    expect(marketingCopy.pl.landing.pricingTeaser.eyebrow).toBeTruthy();
    expect(marketingCopy.pl.landing.faq.eyebrow).toBeTruthy();
    expect(marketingCopy.en.landing.pricingTeaser.eyebrow).toBeTruthy();
    expect(marketingCopy.en.landing.faq.eyebrow).toBeTruthy();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/lib/marketing-copy.test.ts`
Expected: FAIL — `marketingCopy.pl.landing.heroEyebrow` is `undefined` / `howItWorks` does not exist.

- [ ] **Step 3: Add the PL strings.** In `lib/marketing/copy.ts`, inside `pl.landing`, add `heroEyebrow` and `heroProofLine` right after `heroFreeNote`, and add `howItWorks` + `riskReversal` right after the `features` object. Also add an `eyebrow` field to the existing `pricingTeaser` and `faq` objects.

```typescript
      heroEyebrow: "MF FA(3) · schemat 2025-06-25",
      heroProofLine:
        "od 2,99 zł za fakturę · bez subskrypcji · 1 darmowa faktura w miesiącu, bez karty.",
      howItWorks: {
        eyebrow: "Jak to działa",
        heading: "Od pliku KSeF do gotowego PDF — w trzech krokach.",
        steps: [
          {
            title: "Wgraj fakturę",
            body: "Plik FA(3) XML z KSeF albo PDF. Bez integracji, bez logowania do KSeF."
          },
          {
            title: "Tłumaczymy treść",
            body: "20+ języków, w około 4 sekundy. Numerację i strukturę MF zostawiamy nietknięte."
          },
          {
            title: "Pobierz MF-PDF",
            body: "Zgodny ze schematem 2025-06-25. Gotowy do wysłania klientowi."
          }
        ]
      },
      riskReversal: {
        eyebrow: "Bez ryzyka",
        heading: "Zacznij bez ryzyka.",
        items: [
          "1 faktura w miesiącu — gratis",
          "Bez karty, bez subskrypcji",
          "Niewykorzystane kredyty nie wygasają",
          "Zwrot pakietu w ciągu 14 dni"
        ],
        cta: "Zacznij za darmo"
      },
```

For `pricingTeaser` (PL), add the `eyebrow` line:

```typescript
      pricingTeaser: {
        eyebrow: "Cennik",
        heading: "Im więcej tłumaczysz, tym taniej",
        sliderLabel: "Wybierz pakiet:",
        cta: "Pełny cennik"
      },
```

For `faq` (PL), add the `eyebrow` line:

```typescript
      faq: {
        eyebrow: "FAQ",
        heading: "Najczęstsze pytania",
        items: [
```

- [ ] **Step 4: Add the EN mirror strings.** In `en.landing`, mirror the same keys:

```typescript
      heroEyebrow: "MF FA(3) · schema 2025-06-25",
      heroProofLine:
        "from PLN 2.99 per invoice · no subscription · 1 free invoice every month, no card.",
      howItWorks: {
        eyebrow: "How it works",
        heading: "From a KSeF file to a ready PDF — in three steps.",
        steps: [
          {
            title: "Upload your invoice",
            body: "FA(3) XML from KSeF or a PDF. No integration, no KSeF login."
          },
          {
            title: "We translate the content",
            body: "20+ languages in about 4 seconds. MF numbering and structure stay untouched."
          },
          {
            title: "Download the MF-PDF",
            body: "Matches the 2025-06-25 schema. Ready to send to your client."
          }
        ]
      },
      riskReversal: {
        eyebrow: "No risk",
        heading: "Start with zero risk.",
        items: [
          "1 free invoice every month",
          "No card, no subscription",
          "Unused credits never expire",
          "Refund within 14 days"
        ],
        cta: "Start free"
      },
```

For `pricingTeaser` (EN):

```typescript
      pricingTeaser: {
        eyebrow: "Pricing",
        heading: "The more you translate, the cheaper it gets",
        sliderLabel: "Choose a package:",
        cta: "Full pricing"
      },
```

For `faq` (EN):

```typescript
      faq: {
        eyebrow: "FAQ",
        heading: "Frequent questions",
        items: [
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/integration/lib/marketing-copy.test.ts`
Expected: PASS (all cases, including the pre-existing parity test, green).

- [ ] **Step 6: Typecheck** (the `as const` object is consumed with exact types — confirm both locales stayed in sync)

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/marketing/copy.ts tests/integration/lib/marketing-copy.test.ts
git commit -m "feat(landing): add copy for how-it-works, risk-reversal, hero eyebrow"
```

---

## Task 2: `<HowItWorks>` component

**Files:**
- Create: `components/marketing/how-it-works.tsx`
- Test: `tests/components/marketing/how-it-works.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HowItWorks } from "@/components/marketing/how-it-works";

const steps = [
  { title: "Wgraj fakturę", body: "Plik FA(3) XML z KSeF albo PDF." },
  { title: "Tłumaczymy treść", body: "20+ języków." },
  { title: "Pobierz MF-PDF", body: "Zgodny ze schematem 2025-06-25." }
];

describe("<HowItWorks>", () => {
  it("renders the eyebrow and the level-2 heading", () => {
    render(<HowItWorks eyebrow="Jak to działa" heading="Trzy kroki" steps={steps} />);
    expect(screen.getByText("Jak to działa")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Trzy kroki" })
    ).toBeInTheDocument();
  });

  it("renders one list item per step, numbered 1..n", () => {
    render(<HowItWorks eyebrow="x" heading="y" steps={steps} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders each step title (as h3) and body", () => {
    render(<HowItWorks eyebrow="x" heading="y" steps={steps} />);
    expect(
      screen.getByRole("heading", { level: 3, name: "Wgraj fakturę" })
    ).toBeInTheDocument();
    expect(screen.getByText("20+ języków.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/marketing/how-it-works.test.tsx`
Expected: FAIL — cannot resolve `@/components/marketing/how-it-works`.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { cn } from "@/lib/utils";

export interface HowItWorksStep {
  title: string;
  body: string;
}

export interface HowItWorksProps {
  eyebrow: string;
  heading: string;
  steps: ReadonlyArray<HowItWorksStep>;
  className?: string;
}

/**
 * "Jak to działa" — three-step explainer that sits directly under the hero.
 * Pure presentational (no client state), so it renders as a server component.
 */
export function HowItWorks({ eyebrow, heading, steps, className }: HowItWorksProps) {
  return (
    <section className={cn("bg-surface", className)}>
      <div className="mx-auto w-full max-w-5xl px-5 py-20 md:px-8 md:py-24">
        <p className="text-micro uppercase tracking-wide text-accent">{eyebrow}</p>
        <h2 className="mt-3 max-w-2xl text-balance text-h2 text-text-strong">{heading}</h2>

        <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          {steps.map((step, i) => (
            <li key={step.title} className="flex flex-col">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-h3 font-semibold tabular-nums text-accent">
                {i + 1}
              </span>
              <h3 className="mt-5 text-h3 text-text-strong">{step.title}</h3>
              <p className="mt-2 text-small text-text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export default HowItWorks;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/marketing/how-it-works.test.tsx`
Expected: PASS (3 cases).

- [ ] **Step 5: Commit**

```bash
git add components/marketing/how-it-works.tsx tests/components/marketing/how-it-works.test.tsx
git commit -m "feat(landing): add HowItWorks three-step section"
```

---

## Task 3: `<RiskReversal>` component

**Files:**
- Create: `components/marketing/risk-reversal.tsx`
- Test: `tests/components/marketing/risk-reversal.test.tsx`

- [ ] **Step 1: Write the failing test** (mock `next/link` so the anchor is deterministic in jsdom)

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

import { RiskReversal } from "@/components/marketing/risk-reversal";

const items = [
  "1 faktura w miesiącu — gratis",
  "Bez karty, bez subskrypcji",
  "Niewykorzystane kredyty nie wygasają",
  "Zwrot pakietu w ciągu 14 dni"
];

describe("<RiskReversal>", () => {
  it("renders the eyebrow and the level-2 heading", () => {
    render(
      <RiskReversal
        eyebrow="Bez ryzyka"
        heading="Zacznij bez ryzyka."
        items={items}
        ctaText="Zacznij za darmo"
        ctaHref="/login"
      />
    );
    expect(screen.getByText("Bez ryzyka")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Zacznij bez ryzyka." })
    ).toBeInTheDocument();
  });

  it("renders one list item per promise", () => {
    render(
      <RiskReversal
        eyebrow="x"
        heading="y"
        items={items}
        ctaText="z"
        ctaHref="/login"
      />
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("renders the CTA as a link to ctaHref", () => {
    render(
      <RiskReversal
        eyebrow="x"
        heading="y"
        items={items}
        ctaText="Zacznij za darmo"
        ctaHref="/login"
      />
    );
    expect(screen.getByRole("link", { name: "Zacznij za darmo" })).toHaveAttribute(
      "href",
      "/login"
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/marketing/risk-reversal.test.tsx`
Expected: FAIL — cannot resolve `@/components/marketing/risk-reversal`.

- [ ] **Step 3: Write minimal implementation**

```tsx
import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RiskReversalProps {
  eyebrow: string;
  heading: string;
  items: ReadonlyArray<string>;
  ctaText: string;
  ctaHref: string;
  className?: string;
}

/**
 * "Zacznij bez ryzyka" — replaces the old (fake) testimonials block with
 * honest, already-true promises plus the primary CTA. Pure presentational.
 */
export function RiskReversal({
  eyebrow,
  heading,
  items,
  ctaText,
  ctaHref,
  className
}: RiskReversalProps) {
  return (
    <section className={cn("bg-surface-muted", className)}>
      <div className="mx-auto w-full max-w-3xl px-5 py-20 text-center md:px-8">
        <p className="text-micro uppercase tracking-wide text-accent">{eyebrow}</p>
        <h2 className="mt-3 text-h2 text-text-strong">{heading}</h2>

        <ul className="mx-auto mt-8 grid max-w-xl gap-x-8 gap-y-4 text-left sm:grid-cols-2">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="text-body text-text">{item}</span>
            </li>
          ))}
        </ul>

        <div className="mt-10">
          <Link
            href={ctaHref}
            className="inline-flex h-12 items-center justify-center rounded-md bg-accent px-8 text-body font-semibold text-white shadow-sm transition-colors duration-hover ease-out hover:bg-accent-hover"
          >
            {ctaText}
          </Link>
        </div>
      </div>
    </section>
  );
}

export default RiskReversal;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/marketing/risk-reversal.test.tsx`
Expected: PASS (3 cases).

- [ ] **Step 5: Commit**

```bash
git add components/marketing/risk-reversal.tsx tests/components/marketing/risk-reversal.test.tsx
git commit -m "feat(landing): add RiskReversal promise section"
```

---

## Task 4: Hero rework — eyebrow, slim stats, drop infinite motion

**Files:**
- Modify: `components/ui/hero-section-9.tsx`
- Test: `tests/components/ui/hero-section.test.tsx`

- [ ] **Step 1: Write the failing test** (mock `next/image` so it renders a plain `<img>` in jsdom)

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />
}));

import { HeroSection } from "@/components/ui/hero-section-9";

const baseProps = {
  title: "Faktura KSeF dla klienta z zagranicy. W 4 sekundy.",
  subtitle: "Przetłumacz fakturę FA(3).",
  eyebrow: "MF FA(3) · schemat 2025-06-25",
  note: "od 2,99 zł za fakturę",
  actions: [{ text: "Zacznij za darmo", href: "/login", variant: "default" as const }],
  stats: [
    { value: "20+", label: "języków", icon: <svg data-testid="i1" /> },
    { value: "≈4 s", label: "na fakturę", icon: <svg data-testid="i2" /> }
  ],
  images: [
    { src: "/marketing/invoice-pl.svg", alt: "Faktura PL" },
    { src: "/marketing/invoice-en.svg", alt: "Invoice EN" }
  ] as [{ src: string; alt: string }, { src: string; alt: string }],
  translationLabel: "4 s"
};

describe("<HeroSection>", () => {
  it("renders the eyebrow text", () => {
    render(<HeroSection {...baseProps} />);
    expect(screen.getByText("MF FA(3) · schemat 2025-06-25")).toBeInTheDocument();
  });

  it("renders the H1 and the primary CTA linking to /login", () => {
    render(<HeroSection {...baseProps} />);
    expect(
      screen.getByRole("heading", { level: 1, name: /Faktura KSeF dla klienta z zagranicy/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zacznij za darmo" })).toHaveAttribute(
      "href",
      "/login"
    );
  });

  it("renders each stat value and label", () => {
    render(<HeroSection {...baseProps} />);
    expect(screen.getByText("20+")).toBeInTheDocument();
    expect(screen.getByText("języków")).toBeInTheDocument();
    expect(screen.getByText("≈4 s")).toBeInTheDocument();
    expect(screen.getByText("na fakturę")).toBeInTheDocument();
  });

  it("renders the source and result images", () => {
    render(<HeroSection {...baseProps} />);
    expect(screen.getByAltText("Faktura PL")).toBeInTheDocument();
    expect(screen.getByAltText("Invoice EN")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/ui/hero-section.test.tsx`
Expected: FAIL — `eyebrow` is not rendered (the prop does not exist yet), so the first case fails on "Unable to find element with text: MF FA(3)…".

- [ ] **Step 3a: Add the `eyebrow` prop to the interface.** In `components/ui/hero-section-9.tsx`, in `interface HeroSectionProps`, add the prop just above `actions`:

```tsx
  title: React.ReactNode;
  subtitle: React.ReactNode;
  /** Small uppercase pill shown above the H1 (e.g. a compliance cue). */
  eyebrow?: React.ReactNode;
  note?: React.ReactNode;
```

- [ ] **Step 3b: Destructure `eyebrow`** in the `HeroSection({ … })` parameter list (add after `subtitle`):

```tsx
export function HeroSection({
  title,
  subtitle,
  eyebrow,
  note,
  actions,
  stats,
  images,
  translationLabel,
  className
}: HeroSectionProps) {
```

- [ ] **Step 3c: Remove the infinite-float machinery.** Delete the `floatingVariants` constant entirely:

```tsx
const floatingVariants: Variants = {
  animate: {
    y: [0, -8, 0],
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" }
  }
};
```

And replace the body line that derives `floatAnim`:

```tsx
  const prefersReducedMotion = useReducedMotion();
  const floatAnim = prefersReducedMotion ? undefined : "animate";
```

with a single initial-state gate (one-time entrance only):

```tsx
  const prefersReducedMotion = useReducedMotion();
  const initial = prefersReducedMotion ? false : "hidden";
```

- [ ] **Step 3d: Apply `initial`** to the two top-level `motion.div` columns. Change both occurrences of `initial="hidden"` to `initial={initial}`:

```tsx
        <motion.div
          className="flex flex-col items-center text-center lg:items-start lg:text-left"
          variants={containerVariants}
          initial={initial}
          animate="visible"
        >
```

```tsx
        <motion.div
          className="relative mx-auto h-[440px] w-full max-w-[520px] sm:h-[480px]"
          variants={containerVariants}
          initial={initial}
          animate="visible"
        >
```

- [ ] **Step 3e: Render the eyebrow** as the first child inside the left (copy) column, immediately before the `<motion.h1>`:

```tsx
          {eyebrow ? (
            <motion.span
              className="mb-4 inline-flex items-center rounded-full bg-accent-soft px-3 py-1 text-micro font-semibold uppercase tracking-wide text-accent"
              variants={itemVariants}
            >
              {eyebrow}
            </motion.span>
          ) : null}

          <motion.h1
```

- [ ] **Step 3f: Slim the stat row.** Replace the entire stats `motion.div` block:

```tsx
          <motion.div
            className="mt-10 flex flex-wrap items-start justify-center gap-x-8 gap-y-6 lg:justify-start"
            variants={itemVariants}
          >
            {stats.map((stat, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
                  {stat.icon}
                </div>
                <div className="text-left">
                  <p className="text-lg font-semibold leading-tight text-text-strong">{stat.value}</p>
                  <p className="text-xs text-text-muted">{stat.label}</p>
                </div>
              </div>
            ))}
          </motion.div>
```

with a quiet single-row version (small accent icon, tabular value, hairline divider between items on `sm+`):

```tsx
          <motion.div
            className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 lg:justify-start"
            variants={itemVariants}
          >
            {stats.map((stat, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2",
                  i > 0 && "sm:border-l sm:border-border sm:pl-5"
                )}
              >
                <span className="text-accent [&_svg]:h-4 [&_svg]:w-4" aria-hidden="true">
                  {stat.icon}
                </span>
                <span className="text-small font-semibold tabular-nums text-text-strong">
                  {stat.value}
                </span>
                <span className="text-small text-text-muted">{stat.label}</span>
              </div>
            ))}
          </motion.div>
```

- [ ] **Step 3g: Replace the three floating decorative shapes** with one static wash. Delete this block (the three `motion.div`s with `floatingVariants`):

```tsx
          {/* Soft decorative shapes (project palette) */}
          <motion.div
            className="absolute -top-3 left-[8%] h-14 w-14 rounded-full bg-accent-soft"
            variants={floatingVariants}
            animate={floatAnim}
          />
          <motion.div
            className="absolute -bottom-2 right-[10%] h-10 w-10 rounded-lg bg-warning-soft"
            variants={floatingVariants}
            animate={floatAnim}
            transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
          />
          <motion.div
            className="absolute right-2 top-[34%] h-5 w-5 rounded-full bg-accent/20"
            variants={floatingVariants}
            animate={floatAnim}
            transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut", delay: 1.1 }}
          />
```

with:

```tsx
          {/* Static, subtle wash behind the document pair (no animation). */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 rounded-[32px] bg-[radial-gradient(60%_60%_at_50%_42%,hsl(var(--accent-soft)),transparent_70%)]"
          />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/ui/hero-section.test.tsx`
Expected: PASS (4 cases).

- [ ] **Step 5: Typecheck** (ensures `cn` is imported — it already is in this file — and no leftover references to `floatAnim`/`floatingVariants`)

Run: `npm run typecheck`
Expected: no errors. If it complains about an unused `useReducedMotion` import, it is still used by `prefersReducedMotion`, so no change needed.

- [ ] **Step 6: Commit**

```bash
git add components/ui/hero-section-9.tsx tests/components/ui/hero-section.test.tsx
git commit -m "feat(landing): rework hero — eyebrow, slim stats, drop infinite float"
```

---

## Task 5: Recompose the landing page

**Files:**
- Modify: `components/marketing/landing-page.tsx`

This task has no new unit test (the page composition is covered by the Task 6 E2E). It is a pure wiring change; verify by typecheck + the existing/own E2E.

- [ ] **Step 1: Update imports.** Replace the current import block at the top of `components/marketing/landing-page.tsx`. Remove `TrustStrip`, `FounderCard`, `AnimatedTestimonials`, and `FOUNDER`; add `HowItWorks` and `RiskReversal`:

```tsx
import Link from "next/link";
import { Globe2, ShieldCheck, Zap } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { LegalFooter } from "@/components/layout/legal-footer";
import { MarketingFAQ } from "@/components/marketing/marketing-faq";
import { PublicPricingSlider } from "@/components/marketing/public-pricing-slider";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { RiskReversal } from "@/components/marketing/risk-reversal";
import { HeroSection } from "@/components/ui/hero-section-9";
import {
  FeaturesSection,
  FieldMappingIllustration,
  PricingTiersIllustration,
  DataResidencyIllustration
} from "@/components/ui/features-section";
import { marketingCopy, type MarketingLocale } from "@/lib/marketing/copy";
```

- [ ] **Step 2: Pass the eyebrow + proof line to the hero.** In the `<HeroSection … />` call, change the `note` prop and add `eyebrow`:

```tsx
        <HeroSection
          title={t.heroHeadline}
          subtitle={t.heroSubhead}
          eyebrow={t.heroEyebrow}
          note={t.heroProofLine}
          actions={[
```

(Leave the rest of the HeroSection props — `actions`, `stats`, `images`, `translationLabel` — unchanged.)

- [ ] **Step 3: Insert `<HowItWorks>` directly after the hero**, before the `{/* Features */}` block:

```tsx
        {/* How it works — 3 steps (muted band to separate from the hero) */}
        <HowItWorks
          eyebrow={t.howItWorks.eyebrow}
          heading={t.howItWorks.heading}
          steps={t.howItWorks.steps}
          className="bg-surface-muted"
        />
```

- [ ] **Step 4: Remove the testimonials block.** Delete:

```tsx
        {/* Testimonials */}
        <AnimatedTestimonials
          badgeText={t.testimonials.badge}
          title={t.testimonials.heading}
          subtitle={t.testimonials.subhead}
          testimonials={t.testimonials.items}
        />
```

- [ ] **Step 5: Remove the trust-strip block.** Delete:

```tsx
        {/* TrustStrip */}
        <section className="bg-surface-muted py-12">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <TrustStrip locale={locale} />
          </div>
        </section>
```

- [ ] **Step 6: Add an eyebrow above the pricing teaser, and put it on a muted band.** Replace the pricing-teaser `<section>` opening + heading block:

```tsx
        {/* Pricing teaser */}
        <section className="mx-auto w-full max-w-4xl px-5 py-20 md:px-8">
          <div className="text-center">
            <h2 className="text-h2 text-text-strong">{t.pricingTeaser.heading}</h2>
            <p className="mt-2 text-small text-text-muted">{t.pricingTeaser.sliderLabel}</p>
          </div>
```

with (note the outer full-width muted band wrapping an inner centered container):

```tsx
        {/* Pricing teaser */}
        <section className="bg-surface-muted">
          <div className="mx-auto w-full max-w-4xl px-5 py-20 md:px-8">
            <div className="text-center">
              <p className="text-micro uppercase tracking-wide text-accent">
                {t.pricingTeaser.eyebrow}
              </p>
              <h2 className="mt-3 text-h2 text-text-strong">{t.pricingTeaser.heading}</h2>
              <p className="mt-2 text-small text-text-muted">{t.pricingTeaser.sliderLabel}</p>
            </div>
```

Then update that section's closing tags to match the new extra nesting. The original closes as:

```tsx
          <div className="mt-6 text-center">
            <Link
              href="/pricing"
              className="inline-flex text-small font-medium text-accent hover:text-accent-hover"
            >
              {t.pricingTeaser.cta} →
            </Link>
          </div>
        </section>
```

Replace it with (one extra `</div>` for the inner container):

```tsx
            <div className="mt-6 text-center">
              <Link
                href="/pricing"
                className="inline-flex text-small font-medium text-accent hover:text-accent-hover"
              >
                {t.pricingTeaser.cta} →
              </Link>
            </div>
          </div>
        </section>
```

(Also indent the existing `<div className="mt-8"><PublicPricingSlider … /></div>` to sit inside the new inner container — purely cosmetic; the JSX nesting is what matters.)

- [ ] **Step 7: Add `<RiskReversal>` after the pricing teaser, before the FAQ** (white band — overrides the component's default muted, so it alternates against muted pricing above and muted FAQ below):

```tsx
        {/* Risk reversal — replaces the old testimonials slot */}
        <RiskReversal
          eyebrow={t.riskReversal.eyebrow}
          heading={t.riskReversal.heading}
          items={t.riskReversal.items}
          ctaText={t.riskReversal.cta}
          ctaHref="/login"
          className="bg-surface"
        />
```

- [ ] **Step 8: Put the FAQ on a muted band with an eyebrow.** Replace the FAQ `<section>`:

```tsx
        {/* FAQ */}
        <section className="mx-auto w-full max-w-3xl px-5 py-20 md:px-8">
          <MarketingFAQ heading={t.faq.heading} items={t.faq.items} />
        </section>
```

with:

```tsx
        {/* FAQ */}
        <section className="bg-surface-muted">
          <div className="mx-auto w-full max-w-3xl px-5 py-20 md:px-8">
            <p className="mb-3 text-micro uppercase tracking-wide text-accent">
              {t.faq.eyebrow}
            </p>
            <MarketingFAQ heading={t.faq.heading} items={t.faq.items} />
          </div>
        </section>
```

- [ ] **Step 9: Remove the founder section.** Delete:

```tsx
        {/* Founder */}
        <section className="bg-surface-muted py-16">
          <div className="mx-auto max-w-3xl px-5 md:px-8">
            <h2 className="text-center text-h2 text-text-strong">{t.founderHeading}</h2>
            <div className="mt-8">
              <FounderCard
                name={FOUNDER.name}
                photoUrl={FOUNDER.photoUrl}
                statement={FOUNDER.statement}
                contactEmail={FOUNDER.contactEmail}
              />
            </div>
          </div>
        </section>
```

(The final-CTA `<section>` and `<LegalFooter>` below it stay as-is — white band, then footer.)

- [ ] **Step 10: Typecheck**

Run: `npm run typecheck`
Expected: no errors. Common catches: a leftover reference to `t.testimonials`, `t.founderHeading`, `TrustStrip`, `FounderCard`, `AnimatedTestimonials`, or `FOUNDER` → remove it.

- [ ] **Step 11: Lint** (catches unused imports the typecheck might allow)

Run: `npm run lint`
Expected: no errors about unused vars in `landing-page.tsx`.

- [ ] **Step 12: Commit**

```bash
git add components/marketing/landing-page.tsx
git commit -m "feat(landing): recompose page — add how-it-works + risk-reversal, drop trust strip, testimonials, founder"
```

---

## Task 6: E2E smoke (PL + EN)

**Files:**
- Create: `tests/e2e/landing-refresh.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { test, expect } from "@playwright/test";

test.describe("landing refresh — PL", () => {
  test("renders hero, how-it-works, risk-reversal and links to /login", async ({ page }) => {
    await page.goto("/");

    // Hero
    await expect(
      page.getByRole("heading", { level: 1, name: /Faktura KSeF dla klienta z zagranicy/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Zacznij za darmo/i }).first()
    ).toHaveAttribute("href", "/login");

    // New sections
    await expect(
      page.getByRole("heading", { name: /Od pliku KSeF do gotowego PDF/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Zacznij bez ryzyka/i })
    ).toBeVisible();

    // Footer still present
    await expect(page.getByText(/NIP/).first()).toBeVisible();
  });

  test("no longer renders the removed sections", async ({ page }) => {
    await page.goto("/");
    // Founder heading removed
    await expect(page.getByText(/Stoi za tym konkretny człowiek/i)).toHaveCount(0);
    // Beta testimonials badge removed
    await expect(page.getByText(/Beta — pierwsze opinie/i)).toHaveCount(0);
  });
});

test.describe("landing refresh — EN", () => {
  test("renders translated hero + new sections", async ({ page }) => {
    await page.goto("/en");
    await expect(
      page.getByRole("heading", { level: 1, name: /Polish KSeF invoice, translated/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /From a KSeF file to a ready PDF/i })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Start with zero risk/i })
    ).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the E2E suite** (Playwright starts the dev/preview server per `playwright.config.ts`)

Run: `npm run test:e2e -- landing-refresh`
Expected: PASS. If the runner needs a browser, first run `npm run test:e2e:install`.

- [ ] **Step 3: Run the pre-existing public-pages E2E** to confirm no regression (it already asserts the landing H1 + "Zacznij za darmo" → /login, which we preserved):

Run: `npm run test:e2e -- sprint-2-public-pages`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/landing-refresh.spec.ts
git commit -m "test(landing): e2e smoke for refreshed landing (pl + en)"
```

---

## Task 7: Full verification + responsive check

**Files:** none (verification only).

- [ ] **Step 1: Run the entire unit/integration suite**

Run: `npm test`
Expected: all green (new component tests, copy test, plus the existing suite).

- [ ] **Step 2: Typecheck + lint the whole project**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 2b: Run the MF-label guard** (project-specific check that official Ministry-of-Finance labels weren't altered — cheap and required before any landing/marketing change ships)

Run: `npm run check:mf-labels`
Expected: PASS.

- [ ] **Step 3: Responsive smoke via the preview tools.** Start the dev server (`preview_start`), load `/`, and verify at four widths — **360, 768, 1024, 1440** — using `preview_resize` + `preview_screenshot`. Confirm:
  - Hero stacks to a single column below `lg`; no horizontal scroll at 360.
  - "Jak to działa" is three-across on desktop, single column at 360/768.
  - "Zacznij bez ryzyka" is 2×2 on `sm+`, single column at 360.
  - Section backgrounds alternate (hero white → how-it-works muted → features white → pricing muted → risk white → faq muted → final CTA white).
  - Primary CTA reachable from hero, risk-reversal, and final CTA.

  Repeat the load once at `/en` to confirm the EN strings render.

- [ ] **Step 4: Capture proof.** Take a full-page `preview_screenshot` of `/` at 1440 and at 360 and share them with the user.

- [ ] **Step 5 (optional, only if asked): Delete the now-dead components.** `components/trust/trust-strip.tsx` and `components/ui/animated-testimonials.tsx` are unused after Task 5. If the user wants them gone in this PR rather than a follow-up: confirm no other importers (`grep -rln "TrustStrip\|AnimatedTestimonials" app components | grep -v node_modules` returns only their own files), delete them, re-run `npm run typecheck && npm test`, and commit `chore(landing): remove now-unused trust-strip and testimonials components`.

---

## Self-review notes (author)

- **Spec coverage:** hero rework (§4.1 → Task 4), trust strip removal (§4.2 → Task 5 Step 5), how-it-works (§4.3 → Tasks 1–2, 5), features muted band (§4.4 → Task 5 Step 3 className), pricing teaser eyebrow/band (§4.5 → Task 5 Step 6), risk-reversal (§4.6 → Tasks 1, 3, 5), FAQ band/eyebrow (§4.7 → Task 5 Step 8), founder removal (§4.8 → Task 5 Step 9), final CTA (§4.9 → unchanged, stays white), copy parity (§5 → Task 1), RWD (§7 → Task 7 Step 3), testing (§8 → Tasks 2/3/4/6). **Section eyebrows for the Features card** (§2 craft rule) are intentionally not added to `FeaturesSection` to avoid changing its API — it keeps its strong two-tone heading; noted as a conscious deviation.
- **Screenshot baseline** (spec §8) is implemented as live preview-tool screenshots in Task 7 rather than committed Playwright `toHaveScreenshot()` baselines — the repo has no screenshot harness yet and adding one is out of scope for this PR (consistent with spec §9 deferrals).
- **Open item — "Zobacz przykład" target:** left as today's `#features` anchor behavior (the secondary action prop is unchanged in Task 5). Wiring a sample-PDF modal is out of scope per spec §9.
- **Type consistency:** `HowItWorksStep { title, body }` and `riskReversal.items: string[]` in copy (Task 1) match the component props (Tasks 2, 3) and the landing wiring (Task 5). Hero `eyebrow?: React.ReactNode` (Task 4) matches `t.heroEyebrow: string` (Task 1).
