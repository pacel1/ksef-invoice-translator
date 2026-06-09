# Landing Rebuild Sprint 2: Animated Hero

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the hero section and its animated `InvoiceShowcase` centerpiece (an invoice whose labels and currency cycle through PL, EN, DE, FR, ES, IT while the numbers and QR stay locked), and wire it into the landing at `/landing-preview`.

**Architecture:** A locale-independent showcase data module feeds a client `InvoiceShowcase` component that cycles languages on an interval (reduced-motion safe). A server `Hero` component composes the page copy, the `Button` primitive, and the showcase. The `Button` primitive is hardened first so the hero CTAs can use it. The hero replaces the empty `#hero` placeholder in `LandingRebuild`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, TailwindCSS, Vitest + Testing Library (jsdom), Playwright. Builds on the Sprint 1 design system (tokens, fonts, primitives, copy module), now merged to `main`.

**Specs:** `docs/superpowers/specs/2026-06-09-landing-visual-design.md` (§3 Section 1 Hero, §1.5 Motion), `docs/superpowers/specs/2026-06-09-landing-content-rebuild.md` (§4.1 Hero copy).

**Branch:** `claude/landing-rebuild-sprint-2-hero` (already off `main`).

---

## File map

| File | Responsibility | Action |
|---|---|---|
| `components/landing/ui/button.tsx` | Button primitive | Modify (forward props to anchor, default `type="button"`) |
| `tests/components/landing/button.test.tsx` | Button tests | Modify (2 new cases) |
| `tailwind.config.ts` | Animation keyframes | Modify (add `bob` + `showcase-scan`) |
| `lib/landing/invoice-showcase.ts` | Showcase data (6 languages + fixed values) | Create |
| `lib/landing/copy.ts` | Hero copy (pl + en) | Modify (add `hero` group) |
| `components/landing/invoice-showcase.tsx` | Animated invoice (client) | Create |
| `components/landing/hero.tsx` | Hero section | Create |
| `components/landing/landing-rebuild.tsx` | Page composition | Modify (render `<Hero>`, drop `hero` placeholder) |
| `tests/components/landing/invoice-showcase.test.tsx` | Showcase tests | Create |
| `tests/components/landing/hero.test.tsx` | Hero tests | Create |
| `tests/components/landing/landing-rebuild.test.tsx` | Composition test | Modify |
| `tests/integration/lib/landing-copy.test.ts` | Copy test | Modify (hero group) |
| `tests/integration/lib/invoice-showcase.test.ts` | Showcase data test | Create |
| `tests/e2e/landing-rebuild-preview.spec.ts` | E2E | Modify (hero assertions) |

---

## Task 1: Harden the Button primitive

The hero CTAs will be the first `Button` consumers. Sprint 1 review flagged two gaps: the `href` branch drops `...props`, and `type` is not defaulted. Fix both.

**Files:**
- Modify: `components/landing/ui/button.tsx`
- Test: `tests/components/landing/button.test.tsx`

- [ ] **Step 1: Write the failing tests**, append inside the `describe("<Button>", …)` block in `tests/components/landing/button.test.tsx`:

```tsx
  it("defaults the native button type to 'button'", () => {
    render(<Button>Klik</Button>);
    expect(screen.getByRole("button", { name: "Klik" })).toHaveAttribute("type", "button");
  });

  it("forwards onClick and aria-label to the anchor when href is set", () => {
    const onClick = vi.fn();
    render(<Button href="/x" onClick={onClick} aria-label="Idź">Idź</Button>);
    const link = screen.getByRole("link", { name: "Idź" });
    fireEvent.click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/components/landing/button.test.tsx`
Expected: FAIL (no `type` attribute defaulted; the anchor receives no `onClick`, so the click handler is never called).

- [ ] **Step 3: Update the component.** In `components/landing/ui/button.tsx`, replace the `Button` function body:

```tsx
export function Button({ variant = "primary", size = "md", href, type, className, children, ...props }: ButtonProps) {
  const classes = cn(base, variants[variant], sizes[size], className);
  if (href) {
    return (
      <a href={href} className={classes} {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </a>
    );
  }
  return (
    <button type={type ?? "button"} className={classes} {...props}>
      {children}
    </button>
  );
}
```

(`type` is destructured out so it does not double-apply via `...props`; the anchor branch forwards the remaining props, cast to anchor attributes, so `onClick`/`aria-*`/`data-*` reach the `<a>`.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/components/landing/button.test.tsx`
Expected: PASS (7 cases: the 5 original + 2 new).

- [ ] **Step 5: Commit**

```bash
git add components/landing/ui/button.tsx tests/components/landing/button.test.tsx
git commit -m "fix(landing-rebuild): forward props to Button anchor + default type=button"
```

---

## Task 2: Showcase data module

The invoice showcase cycles the same 6 languages regardless of the page locale, so its data is locale-independent and lives in its own module.

**Files:**
- Create: `lib/landing/invoice-showcase.ts`
- Test: `tests/integration/lib/invoice-showcase.test.ts`

- [ ] **Step 1: Write the failing test**, create `tests/integration/lib/invoice-showcase.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { SHOWCASE_ORDER, SHOWCASE_LANGS, SHOWCASE_FIXED, SHOWCASE_CYCLE_MS } from "@/lib/landing/invoice-showcase";

describe("invoice showcase data", () => {
  it("cycles exactly the six languages in order, starting with PL", () => {
    expect(SHOWCASE_ORDER).toEqual(["PL", "EN", "DE", "FR", "ES", "IT"]);
  });

  it("has a full label set for every language", () => {
    for (const code of SHOWCASE_ORDER) {
      const L = SHOWCASE_LANGS[code];
      for (const key of ["title", "number", "issue", "buyer", "nip", "item", "total", "cur", "lock", "status"] as const) {
        expect(L[key]).toBeTruthy();
      }
    }
  });

  it("shows zł for PL and PLN for every other language (currency localizes, value does not)", () => {
    expect(SHOWCASE_LANGS.PL.cur).toBe("zł");
    for (const code of ["EN", "DE", "FR", "ES", "IT"] as const) {
      expect(SHOWCASE_LANGS[code].cur).toBe("PLN");
    }
  });

  it("exposes the fixed (locked) invoice values and a cycle interval", () => {
    expect(SHOWCASE_FIXED.number).toBeTruthy();
    expect(SHOWCASE_FIXED.total).toBeTruthy();
    expect(SHOWCASE_CYCLE_MS).toBeGreaterThan(1000);
  });

  it("contains no em or en dashes", () => {
    expect(JSON.stringify({ SHOWCASE_LANGS, SHOWCASE_FIXED })).not.toMatch(/—|–/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/lib/invoice-showcase.test.ts`
Expected: FAIL (cannot resolve `@/lib/landing/invoice-showcase`).

- [ ] **Step 3: Write the data module**, create `lib/landing/invoice-showcase.ts`:

```ts
/**
 * Data for the animated hero invoice (InvoiceShowcase). The card cycles these
 * six languages to demonstrate translation. Translatable strings live per
 * language; the numbers/IDs/amounts (SHOWCASE_FIXED) never change, which is
 * the whole point. Currency localizes zł -> PLN (the value does not change).
 * Locale-independent: shown identically on the pl and en pages.
 */
export type ShowcaseCode = "PL" | "EN" | "DE" | "FR" | "ES" | "IT";

export interface ShowcaseLang {
  title: string;
  number: string;
  issue: string;
  buyer: string;
  nip: string;
  item: string;
  total: string;
  cur: string;
  lock: string;
  status: string;
}

export const SHOWCASE_ORDER: ShowcaseCode[] = ["PL", "EN", "DE", "FR", "ES", "IT"];

export const SHOWCASE_LANGS: Record<ShowcaseCode, ShowcaseLang> = {
  PL: { title: "FAKTURA", number: "Numer", issue: "Data wystawienia", buyer: "Nabywca", nip: "NIP sprzedawcy", item: "Usługa konsultingowa", total: "Razem do zapłaty", cur: "zł", lock: "Numery, kwoty i kod QR bez zmian", status: "Gotowe" },
  EN: { title: "INVOICE", number: "Number", issue: "Issue date", buyer: "Buyer", nip: "Seller VAT ID", item: "Consulting service", total: "Total due", cur: "PLN", lock: "Numbers, amounts and QR unchanged", status: "Translated" },
  DE: { title: "RECHNUNG", number: "Nummer", issue: "Ausstellungsdatum", buyer: "Käufer", nip: "USt-IdNr. des Verkäufers", item: "Beratungsleistung", total: "Fälliger Betrag", cur: "PLN", lock: "Nummern, Beträge und QR unverändert", status: "Übersetzt" },
  FR: { title: "FACTURE", number: "Numéro", issue: "Date d'émission", buyer: "Acheteur", nip: "N° TVA du vendeur", item: "Service de conseil", total: "Total à payer", cur: "PLN", lock: "Numéros, montants et QR inchangés", status: "Traduit" },
  ES: { title: "FACTURA", number: "Número", issue: "Fecha de emisión", buyer: "Comprador", nip: "NIF del vendedor", item: "Servicio de consultoría", total: "Total a pagar", cur: "PLN", lock: "Números, importes y QR sin cambios", status: "Traducido" },
  IT: { title: "FATTURA", number: "Numero", issue: "Data di emissione", buyer: "Acquirente", nip: "P. IVA del venditore", item: "Servizio di consulenza", total: "Totale da pagare", cur: "PLN", lock: "Numeri, importi e QR invariati", status: "Tradotto" }
};

/** Locked values that never change as the language cycles. */
export const SHOWCASE_FIXED = {
  seller: "ACME Sp. z o.o.",
  number: "FV 2026/04/118",
  issue: "12.04.2026",
  buyer: "Globex GmbH",
  nip: "701-000-12-34",
  itemAmount: "10 000,00",
  total: "12 300,00"
} as const;

export const SHOWCASE_CYCLE_MS = 2400;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/lib/invoice-showcase.test.ts`
Expected: PASS (5 cases).

- [ ] **Step 5: Commit**

```bash
git add lib/landing/invoice-showcase.ts tests/integration/lib/invoice-showcase.test.ts
git commit -m "feat(landing-rebuild): invoice showcase data (6 languages, locked values)"
```

---

## Task 3: Animation keyframes

**Files:**
- Modify: `tailwind.config.ts`
- Test: `tests/styles/landing-tokens.test.ts`

- [ ] **Step 1: Write the failing test**, append inside the `describe("landing design tokens", …)` block in `tests/styles/landing-tokens.test.ts`:

```ts
  it("registers the hero bob + showcase-scan animations", () => {
    const animation = (config.theme?.extend?.animation ?? {}) as Record<string, string>;
    expect(animation.bob).toBeDefined();
    expect(animation["showcase-scan"]).toBeDefined();
    const keyframes = (config.theme?.extend?.keyframes ?? {}) as Record<string, unknown>;
    expect(keyframes.bob).toBeDefined();
    expect(keyframes["showcase-scan"]).toBeDefined();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/styles/landing-tokens.test.ts`
Expected: FAIL (`animation.bob` undefined).

- [ ] **Step 3: Add the keyframes + animations.** In `tailwind.config.ts`, in `theme.extend.keyframes`, add after the existing `"translate-progress"` entry:

```ts
        bob: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" }
        },
        "showcase-scan": {
          "0%": { opacity: "0", transform: "translateY(-70%)" },
          "30%": { opacity: "1" },
          "100%": { opacity: "0", transform: "translateY(180%)" }
        },
```

In `theme.extend.animation`, add after the existing `"translate-progress"` entry:

```ts
        bob: "bob 6s ease-in-out infinite",
        "showcase-scan": "showcase-scan 1s ease-in-out"
```

(Note: the existing `animation` object has a single `"translate-progress"` entry with no trailing comma. Add a comma after it, then the two new lines.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/styles/landing-tokens.test.ts`
Expected: PASS (4 cases: the 3 original + 1 new).

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.ts tests/styles/landing-tokens.test.ts
git commit -m "feat(landing-rebuild): bob + showcase-scan keyframes for the hero"
```

---

## Task 4: InvoiceShowcase component

**Files:**
- Create: `components/landing/invoice-showcase.tsx`
- Test: `tests/components/landing/invoice-showcase.test.tsx`

- [ ] **Step 1: Write the failing test**, create `tests/components/landing/invoice-showcase.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { InvoiceShowcase } from "@/components/landing/invoice-showcase";

function mockMatchMedia(reduced: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduced,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));
}

afterEach(() => {
  vi.useRealTimers();
});

describe("<InvoiceShowcase>", () => {
  it("renders the Polish invoice first, with the locked values and all six language pills", () => {
    mockMatchMedia(false);
    vi.useFakeTimers();
    render(<InvoiceShowcase />);
    expect(screen.getByText("FAKTURA")).toBeInTheDocument();
    expect(screen.getByText("Razem do zapłaty")).toBeInTheDocument();
    // locked values
    expect(screen.getByText("FV 2026/04/118")).toBeInTheDocument();
    expect(screen.getByText(/12 300,00/)).toBeInTheDocument();
    // language pills
    for (const code of ["PL", "EN", "DE", "FR", "ES", "IT"]) {
      expect(screen.getByText(code, { exact: true })).toBeInTheDocument();
    }
  });

  it("cycles to English after one interval: labels and currency localize, locked values stay", () => {
    mockMatchMedia(false);
    vi.useFakeTimers();
    render(<InvoiceShowcase />);
    // "zł" renders twice (item + total), so use getAllByText
    expect(screen.getAllByText("zł").length).toBeGreaterThanOrEqual(1);
    act(() => {
      vi.advanceTimersByTime(2400 + 250);
    });
    expect(screen.getByText("INVOICE")).toBeInTheDocument();
    expect(screen.getByText("Total due")).toBeInTheDocument();
    expect(screen.getAllByText("PLN").length).toBeGreaterThanOrEqual(1);
    // locked values unchanged
    expect(screen.getByText("FV 2026/04/118")).toBeInTheDocument();
    expect(screen.getByText(/12 300,00/)).toBeInTheDocument();
  });

  it("respects reduced motion: shows a static English invoice and does not cycle", () => {
    mockMatchMedia(true);
    vi.useFakeTimers();
    render(<InvoiceShowcase />);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText("INVOICE")).toBeInTheDocument();
    expect(screen.queryByText("RECHNUNG")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/landing/invoice-showcase.test.tsx`
Expected: FAIL (cannot resolve `@/components/landing/invoice-showcase`).

- [ ] **Step 3: Write the component**, create `components/landing/invoice-showcase.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  SHOWCASE_ORDER,
  SHOWCASE_LANGS,
  SHOWCASE_FIXED,
  SHOWCASE_CYCLE_MS
} from "@/lib/landing/invoice-showcase";
import { cn } from "@/lib/utils";

export function InvoiceShowcase() {
  const [index, setIndex] = useState(0);
  const [swapping, setSwapping] = useState(false);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setIndex(1); // static English, no cycle
      return;
    }
    const id = setInterval(() => {
      setSwapping(true);
      setTimeout(() => {
        setIndex((i) => (i + 1) % SHOWCASE_ORDER.length);
        setSwapping(false);
      }, 180);
    }, SHOWCASE_CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  const code = SHOWCASE_ORDER[index];
  const L = SHOWCASE_LANGS[code];
  const t = cn("transition-all duration-150", swapping ? "-translate-y-[3px] opacity-0" : "translate-y-0 opacity-100");

  return (
    <div className="relative mx-auto w-full max-w-[420px] motion-safe:animate-bob" aria-hidden="true">
      {/* Decorative auto-cycling illustration: hidden from AT (the hero copy carries the message). */}
      {/* stacked-card depth */}
      <div aria-hidden="true" className="absolute -left-3 -top-3 h-full w-full rounded-2xl border border-line bg-paper opacity-60" />
      <div className="relative overflow-hidden rounded-2xl border border-line bg-paper shadow-raised">
        {/* language strip */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-paper-soft px-3.5 py-3">
          {SHOWCASE_ORDER.map((c) => (
            <span
              key={c}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors",
                c === code ? "bg-brand text-white" : "text-copy-muted"
              )}
            >
              {c}
            </span>
          ))}
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-mint">
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-mint text-[9px] text-white" aria-hidden="true">✓</span>
            <span className={t}>{L.status}</span>
          </span>
        </div>

        {/* body */}
        <div className="relative px-5 py-5">
          <div aria-hidden="true" key={index} className="pointer-events-none absolute inset-x-0 top-0 h-3/5 motion-safe:animate-showcase-scan" style={{ background: "linear-gradient(180deg, transparent, rgba(79,70,229,0.10) 60%, rgba(139,92,246,0.18))" }} />

          <div className="mb-3.5 flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-brand to-iris" aria-hidden="true" />
              <div>
                <div className="font-heading text-[14px] font-bold text-ink">{SHOWCASE_FIXED.seller}</div>
                <div className={cn("text-[10px] uppercase tracking-wide text-copy-muted", t)}>{L.title}</div>
              </div>
            </div>
            <span className="h-[42px] w-[42px] rounded-md" style={{ background: "repeating-linear-gradient(0deg,#0B1020 0 3px,transparent 3px 6px), repeating-linear-gradient(90deg,#0B1020 0 3px,transparent 3px 6px)", backgroundColor: "#fff" }} aria-hidden="true" />
          </div>

          <div className="border-t border-line-soft pt-3">
            {([
              [L.number, SHOWCASE_FIXED.number],
              [L.issue, SHOWCASE_FIXED.issue],
              [L.buyer, SHOWCASE_FIXED.buyer],
              [L.nip, SHOWCASE_FIXED.nip]
            ] as const).map(([label, value], i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-1.5 text-[12.5px]">
                <span className={cn("text-copy", t)}>{label}</span>
                <span className="font-semibold tabular-nums text-ink">{value}</span>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 rounded-[10px] bg-paper-soft px-3 py-2.5 text-[12.5px]">
            <span className={cn("font-medium text-ink", t)}>{L.item}</span>
            <span className="whitespace-nowrap font-semibold tabular-nums text-ink">
              {SHOWCASE_FIXED.itemAmount} <span className={t}>{L.cur}</span>
            </span>
          </div>

          <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-line-soft pt-3">
            <span className={cn("text-[13px] font-semibold text-ink", t)}>{L.total}</span>
            <span className="whitespace-nowrap font-heading text-[20px] font-bold tabular-nums text-brand">
              {SHOWCASE_FIXED.total} <span className={t}>{L.cur}</span>
            </span>
          </div>

          <span className={cn("mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-line-soft px-2.5 py-1.5 text-[11px] text-copy-muted", t)}>
            {L.lock}
          </span>
        </div>
      </div>
    </div>
  );
}

export default InvoiceShowcase;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/landing/invoice-showcase.test.tsx`
Expected: PASS (3 cases).

- [ ] **Step 5: Commit**

```bash
git add components/landing/invoice-showcase.tsx tests/components/landing/invoice-showcase.test.tsx
git commit -m "feat(landing-rebuild): animated InvoiceShowcase (language + currency cycle, locked values)"
```

---

## Task 5: Hero copy

**Files:**
- Modify: `lib/landing/copy.ts`
- Test: `tests/integration/lib/landing-copy.test.ts`

- [ ] **Step 1: Write the failing test**, append inside `describe("landingCopy", …)` in `tests/integration/lib/landing-copy.test.ts`:

```ts
  it("has a hero group with headline parts, two CTAs, and reassurance on both locales", () => {
    for (const loc of [landingCopy.pl, landingCopy.en]) {
      expect(loc.hero.eyebrow).toBeTruthy();
      expect(loc.hero.headlineLead).toBeTruthy();
      expect(loc.hero.headlineTurn).toBeTruthy();
      expect(loc.hero.subline).toBeTruthy();
      expect(loc.hero.ctaPrimary).toBeTruthy();
      expect(loc.hero.ctaSecondary).toBeTruthy();
      expect(loc.hero.reassurance).toBeTruthy();
    }
  });
```

(The existing `has matching top-level locale keys` and no-dash tests already cover parity + the dash rule for the new group.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/lib/landing-copy.test.ts`
Expected: FAIL (`loc.hero` is undefined).

- [ ] **Step 3: Add the hero copy.** In `lib/landing/copy.ts`, add a `hero` group as the FIRST key inside `pl` (before `nav`):

```ts
    hero: {
      eyebrow: "Faktura KSeF dla kontrahenta z zagranicy",
      headlineLead: "Znowu przepisujesz fakturę z KSeF do Worda, żeby klient z zagranicy ją zrozumiał?",
      headlineTurn: "Już nie musisz.",
      subline: "Wgrywasz fakturę z KSeF, a po kilku sekundach masz jej profesjonalną wersję w języku klienta. Bez przepisywania. Numery, kwoty i kod QR zostają nietknięte.",
      ctaPrimary: "Przetłumacz swoją fakturę",
      ctaSecondary: "Zobacz na przykładzie",
      reassurance: "Pierwsza faktura w miesiącu za darmo, bez karty. Dane w UE, kasujemy po 30 dniach."
    },
```

And the mirror as the FIRST key inside `en` (before `nav`):

```ts
    hero: {
      eyebrow: "KSeF invoice for a foreign client",
      headlineLead: "Still retyping your KSeF invoice into Word so a foreign client can read it?",
      headlineTurn: "You don't have to anymore.",
      subline: "Upload your KSeF invoice and in a few seconds you have a professional version in your client's language. No retyping. Numbers, amounts and the QR code stay untouched.",
      ctaPrimary: "Translate your invoice",
      ctaSecondary: "See it on a sample",
      reassurance: "First invoice each month is free, no card. Data in the EU, deleted after 30 days."
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/lib/landing-copy.test.ts`
Expected: PASS (all cases, including the pre-existing parity + no-dash tests).

- [ ] **Step 5: Commit**

```bash
git add lib/landing/copy.ts tests/integration/lib/landing-copy.test.ts
git commit -m "feat(landing-rebuild): hero copy (pl + en)"
```

---

## Task 6: Hero section component

**Files:**
- Create: `components/landing/hero.tsx`
- Test: `tests/components/landing/hero.test.tsx`

- [ ] **Step 1: Write the failing test**, create `tests/components/landing/hero.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  )
}));

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn()
  }));
});

import { Hero } from "@/components/landing/hero";

describe("<Hero>", () => {
  it("renders the eyebrow, the level-1 headline (lead + turn), and the subline (PL)", () => {
    render(<Hero locale="pl" />);
    expect(screen.getByText("Faktura KSeF dla kontrahenta z zagranicy")).toBeInTheDocument();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveTextContent(/Znowu przepisujesz fakturę/);
    expect(h1).toHaveTextContent(/Już nie musisz\./);
  });

  it("renders both CTAs pointing to the demo anchor", () => {
    render(<Hero locale="pl" />);
    expect(screen.getByRole("link", { name: "Przetłumacz swoją fakturę" })).toHaveAttribute("href", "#demo");
    expect(screen.getByRole("link", { name: "Zobacz na przykładzie" })).toHaveAttribute("href", "#demo");
  });

  it("renders the EN headline", () => {
    render(<Hero locale="en" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Still retyping your KSeF invoice/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/landing/hero.test.tsx`
Expected: FAIL (cannot resolve `@/components/landing/hero`).

- [ ] **Step 3: Write the component**, create `components/landing/hero.tsx`:

```tsx
import { landingCopy, type LandingLocale } from "@/lib/landing/copy";
import { Eyebrow } from "@/components/landing/ui/eyebrow";
import { Button } from "@/components/landing/ui/button";
import { InvoiceShowcase } from "@/components/landing/invoice-showcase";

export interface HeroProps {
  locale: LandingLocale;
}

export function Hero({ locale }: HeroProps) {
  const t = landingCopy[locale].hero;
  return (
    <section id="hero" className="relative overflow-hidden bg-paper">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[-10%] top-[-20%] h-[460px] w-[520px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(139,92,246,0.16), rgba(217,70,239,0.06) 45%, transparent 70%)" }}
      />
      <div className="relative mx-auto grid max-w-6xl gap-12 px-5 py-16 md:px-8 md:py-20 lg:grid-cols-2 lg:items-center lg:gap-14">
        <div>
          <Eyebrow>{t.eyebrow}</Eyebrow>
          <h1 className="mt-5 font-heading text-hero text-ink">
            {t.headlineLead}{" "}
            <span className="bg-gradient-to-r from-iris to-plum bg-clip-text text-transparent">{t.headlineTurn}</span>
          </h1>
          <p className="mt-5 max-w-[34em] text-[clamp(0.95rem,1.4vw,1.05rem)] leading-relaxed text-copy">{t.subline}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button href="#demo" size="lg">{t.ctaPrimary}</Button>
            <Button href="#demo" size="lg" variant="ghost">{t.ctaSecondary}</Button>
          </div>
          <p className="mt-4 flex items-center gap-2 text-[13px] text-copy-muted">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-mint" aria-hidden="true" />
            {t.reassurance}
          </p>
        </div>
        <div className="lg:justify-self-end">
          <InvoiceShowcase />
        </div>
      </div>
    </section>
  );
}

export default Hero;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/landing/hero.test.tsx`
Expected: PASS (3 cases). (The matchMedia mock is needed because `Hero` renders the client `InvoiceShowcase`, whose effect calls `window.matchMedia`.)

- [ ] **Step 5: Commit**

```bash
git add components/landing/hero.tsx tests/components/landing/hero.test.tsx
git commit -m "feat(landing-rebuild): hero section with animated showcase"
```

---

## Task 7: Wire the hero into the page + E2E + verification

**Files:**
- Modify: `components/landing/landing-rebuild.tsx`
- Modify: `tests/components/landing/landing-rebuild.test.tsx`
- Modify: `tests/e2e/landing-rebuild-preview.spec.ts`

- [ ] **Step 1: Update the composition test**, in `tests/components/landing/landing-rebuild.test.tsx`, add the matchMedia mock at the top (the hero now renders the client showcase) and a hero assertion. Replace the file's import/mock preamble and add one assertion inside the existing test:

Add, right after the existing `vi.mock("next/link", …)` block:

```tsx
beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: false, media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn()
  }));
});
```

Update the `import { describe, it, expect, vi } from "vitest";` line to also import `beforeEach`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
```

And add this assertion inside the existing `it("renders the nav, final CTA, footer, and the section anchors", …)` test body (after the existing assertions):

```tsx
    // hero is now real content (level-1 headline), not an empty placeholder
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/Znowu przepisujesz fakturę/);
```

- [ ] **Step 2: Run the composition test to verify it fails**

Run: `npx vitest run tests/components/landing/landing-rebuild.test.tsx`
Expected: FAIL (no level-1 heading yet; `#hero` is still an empty placeholder).

- [ ] **Step 3: Wire the hero in.** In `components/landing/landing-rebuild.tsx`: import `Hero`, drop `"hero"` from `SECTION_IDS`, and render `<Hero>` first in `<main>`:

```tsx
import type { LandingLocale } from "@/lib/landing/copy";
import { SiteNav } from "@/components/landing/site-nav";
import { Hero } from "@/components/landing/hero";
import { FinalCta } from "@/components/landing/final-cta";
import { SiteFooter } from "@/components/landing/site-footer";

export interface LandingRebuildProps {
  locale: LandingLocale;
}

/** Section ids reserved for later sprints (demo, comparison, etc.). The hero is built. */
const SECTION_IDS = [
  "demo",
  "dlaczego",
  "jak-to-dziala",
  "co-zostaje",
  "dla-kogo",
  "cennik",
  "faq"
] as const;

export function LandingRebuild({ locale }: LandingRebuildProps) {
  return (
    <div className="flex min-h-screen flex-col bg-paper font-dm text-copy">
      <SiteNav locale={locale} />
      <main className="flex-1">
        <Hero locale={locale} />
        {SECTION_IDS.map((id) => (
          <section key={id} id={id} aria-hidden="true" />
        ))}
      </main>
      <FinalCta locale={locale} />
      <SiteFooter locale={locale} />
    </div>
  );
}

export default LandingRebuild;
```

- [ ] **Step 4: Run the composition test to verify it passes**

Run: `npx vitest run tests/components/landing/landing-rebuild.test.tsx`
Expected: PASS (1 case).

- [ ] **Step 5: Add E2E hero assertions.** Append to `tests/e2e/landing-rebuild-preview.spec.ts`:

```ts
test("hero renders with the level-1 headline and a CTA to the demo anchor", async ({ page }) => {
  await page.goto("/landing-preview");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Znowu przepisujesz fakturę");
  await expect(page.getByRole("link", { name: "Przetłumacz swoją fakturę" })).toHaveAttribute("href", "#demo");
  // the animated showcase renders its invoice card (Polish title visible first)
  await expect(page.getByText("FAKTURA").first()).toBeVisible();
});
```

- [ ] **Step 6: Run the E2E**

Run: `npm run test:e2e -- landing-rebuild-preview`
Expected: PASS (the existing 3 + the new hero test).

- [ ] **Step 7: Full verification**

Run: `npx vitest run tests/components/landing tests/integration/lib tests/styles/landing-tokens.test.ts`
Expected: all green.

Run: `npm run typecheck && npm run lint && npm run check:mf-labels`
Expected: no new typecheck errors (the pre-existing Sanity/blog errors are unrelated), lint clean, MF labels pass.

- [ ] **Step 8: Commit**

```bash
git add components/landing/landing-rebuild.tsx tests/components/landing/landing-rebuild.test.tsx tests/e2e/landing-rebuild-preview.spec.ts
git commit -m "feat(landing-rebuild): wire hero into the page + e2e"
```

- [ ] **Step 9: Controller-owned manual check.** The controller verifies live at `/landing-preview`: the headline gradient renders on "Już nie musisz", the invoice cycles PL to EN to DE to FR to ES to IT with labels + currency localizing while the number/amount/QR stay fixed, the bob float and scan run, reduced-motion shows a static English invoice, and the layout stacks cleanly with no overflow at 360 / 768 / 1024 / 1440.

---

## Self-review notes (author)

- **Spec coverage:** hero copy (content spec §4.1 -> Task 5), hero layout + gradient turn + CTAs + reassurance + static glow (visual spec §3 Section 1 -> Task 6), the animated showcase with language + currency cycling, locked numbers/QR, scan + bob, reduced-motion fallback (visual spec §1.5 + §3 Section 1 -> Tasks 2, 3, 4), wiring + dark-close rhythm unaffected (Task 7). Button hardening (Sprint 1 review follow-up -> Task 1).
- **Reduced-motion + SSR:** `InvoiceShowcase` renders index 0 (PL) on the server and on first client render (no hydration mismatch); the effect then either starts the interval or, under reduced motion, switches once to English (index 1) with no looping. `motion-safe:` variants gate the bob + scan CSS animations as a second layer of defence.
- **Currency vs amount:** the digits (`SHOWCASE_FIXED.itemAmount`, `.total`) are static; only the `cur` token (`zł` -> `PLN`) is part of the per-language set, so the test asserts the value persists while the currency localizes.
- **Type consistency:** `ShowcaseCode`/`ShowcaseLang`/`SHOWCASE_ORDER`/`SHOWCASE_LANGS`/`SHOWCASE_FIXED`/`SHOWCASE_CYCLE_MS` are defined once in `lib/landing/invoice-showcase.ts` and consumed by `InvoiceShowcase`. `landingCopy[locale].hero` keys used in `Hero` match those added in Task 5. The `Button` `href` anchor change keeps the existing `role="link"` behaviour the hero test relies on.
- **No placeholders:** every component, data module, and test has complete code. The remaining empty `<section>` anchors (demo, dlaczego, etc.) are intentional scaffolding for Sprints 3 to 4.
- **No dashes:** hero copy and showcase strings use only hyphens (USt-IdNr., date/number formats), never em/en dashes; the copy + showcase no-dash tests enforce it.
```
