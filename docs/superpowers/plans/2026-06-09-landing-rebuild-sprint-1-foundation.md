# Landing Rebuild Sprint 1: Foundation and Chrome

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the new bold-modern-SaaS design system (tokens, fonts), the bilingual copy module, the shared UI primitives, and the page chrome (sticky nav with mobile sheet, dark final CTA, dark footer), rendered at a noindex preview route so later sprints can fill in the sections without touching the live landing.

**Architecture:** The rebuild is additive and isolated. New Tailwind tokens use collision-safe names and live beside the existing Stripe-minimal tokens. The new landing lives under `components/landing/**` and renders at `app/landing-preview/page.tsx` (noindex) until Sprint 4 swaps `/` and `/en`. Copy is bilingual in a new `lib/landing/copy.ts`, separate from the live `lib/marketing/copy.ts`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, TailwindCSS, `next/font/google` (Space Grotesk + DM Sans), lucide-react, Vitest + Testing Library (jsdom for `tests/components/**`), Playwright.

**Specs:** `docs/superpowers/specs/2026-06-09-landing-content-rebuild.md` (copy), `docs/superpowers/specs/2026-06-09-landing-visual-design.md` (design system).

**Branch:** `claude/landing-content-rebuild` (already off `main`; both specs committed).

---

## File map

| File | Responsibility | Action |
|---|---|---|
| `tailwind.config.ts` | Design tokens | Modify (add brand/ink/paper/line/copy/mint/iris/plum/negative colors, heading+dm fonts, hero/h2x sizes, brand shadow) |
| `app/layout.tsx` | Fonts | Modify (load Space Grotesk + DM Sans as CSS variables, keep Inter) |
| `lib/landing/copy.ts` | Bilingual chrome copy | Create |
| `components/landing/ui/button.tsx` | Button primitive | Create |
| `components/landing/ui/eyebrow.tsx` | Eyebrow pill | Create |
| `components/landing/mobile-nav-sheet.tsx` | Hamburger sheet (client) | Create |
| `components/landing/site-nav.tsx` | Sticky nav | Create |
| `components/landing/final-cta.tsx` | Dark final CTA band | Create |
| `components/landing/site-footer.tsx` | Dark footer | Create |
| `components/landing/landing-rebuild.tsx` | Page composition (chrome + section placeholders) | Create |
| `app/landing-preview/page.tsx` | Noindex preview route | Create |
| `tests/components/landing/*.test.tsx` | Unit tests | Create |
| `tests/integration/lib/landing-copy.test.ts` | Copy parity test | Create |
| `tests/e2e/landing-rebuild-preview.spec.ts` | E2E smoke | Create |

`cn` already exists at `@/lib/utils` (clsx + tailwind-merge). Reuse it.

---

## Task 1: Design tokens and fonts

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/layout.tsx`
- Test: `tests/styles/landing-tokens.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/styles/landing-tokens.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import config from "@/tailwind.config";

describe("landing design tokens", () => {
  it("exposes the bold-modern brand + ink + paper colors", () => {
    const colors = (config.theme?.extend?.colors ?? {}) as Record<string, unknown>;
    expect(colors.brand).toMatchObject({ DEFAULT: "#4F46E5", hover: "#4338CA", soft: "#EEF0FF" });
    expect(colors.ink).toMatchObject({ DEFAULT: "#0B1020", panel: "#121A2E" });
    expect(colors["paper-soft"]).toBe("#F7F8FB");
    expect(colors.copy).toMatchObject({ DEFAULT: "#475069", muted: "#697386" });
    expect(colors.mint).toBe("#10B981");
  });

  it("registers the heading + dm font families", () => {
    const fonts = (config.theme?.extend?.fontFamily ?? {}) as Record<string, string[]>;
    expect(fonts.heading?.[0]).toBe("var(--font-space-grotesk)");
    expect(fonts.dm?.[0]).toBe("var(--font-dm-sans)");
  });

  it("registers the fluid hero + section font sizes", () => {
    const sizes = (config.theme?.extend?.fontSize ?? {}) as Record<string, unknown>;
    expect(sizes.hero).toBeDefined();
    expect(sizes["h2x"]).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/styles/landing-tokens.test.ts`
Expected: FAIL (`colors.brand` is undefined).

- [ ] **Step 3: Add the tokens.** In `tailwind.config.ts`, inside `theme.extend.colors` (after the `muted` entry, before the closing brace of `colors`), add:

```ts
        // ---- Landing rebuild (bold modern SaaS), specs/2026-06-09. Collision-safe names. ----
        brand: { DEFAULT: "#4F46E5", hover: "#4338CA", soft: "#EEF0FF" },
        ink: { DEFAULT: "#0B1020", panel: "#121A2E" },
        paper: "#FFFFFF",
        "paper-soft": "#F7F8FB",
        line: { DEFAULT: "#E7EBF2", soft: "#EEF1F5" },
        copy: { DEFAULT: "#475069", muted: "#697386" },
        mint: "#10B981",
        iris: "#8B5CF6",
        plum: "#D946EF",
        negative: "#DC2626",
```

In `theme.extend.fontFamily`, add the two new keys (keep the existing `sans`):

```ts
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        heading: ["var(--font-space-grotesk)", "ui-sans-serif", "system-ui", "sans-serif"],
        dm: ["var(--font-dm-sans)", "ui-sans-serif", "system-ui", "sans-serif"]
      },
```

In `theme.extend.fontSize`, add two fluid sizes (after `"number-xl"`):

```ts
        hero: ["clamp(1.5rem, 4.4vw, 2.7rem)", { lineHeight: "1.09", letterSpacing: "-0.03em", fontWeight: "700" }],
        "h2x": ["clamp(1.6rem, 3.2vw, 2.25rem)", { lineHeight: "1.15", letterSpacing: "-0.02em", fontWeight: "700" }],
```

In `theme.extend.boxShadow`, add the brand CTA shadow and a raised card shadow (after `soft`):

```ts
        brand: "0 12px 24px -8px rgba(79, 70, 229, 0.5)",
        raised: "0 30px 60px -22px rgba(10, 20, 40, 0.32)",
        card: "0 16px 38px -16px rgba(10, 20, 40, 0.26)",
```

- [ ] **Step 4: Load the fonts.** In `app/layout.tsx`, add the imports and instances next to Inter:

```tsx
import { Inter, Space_Grotesk, DM_Sans } from "next/font/google";

const inter = Inter({ subsets: ["latin", "latin-ext"], display: "swap", variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin", "latin-ext"], weight: ["500", "600", "700"], display: "swap", variable: "--font-space-grotesk" });
const dmSans = DM_Sans({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-dm-sans" });
```

Then change the `<html>` element to expose all three variables:

```tsx
    <html lang="pl" className={`${inter.variable} ${spaceGrotesk.variable} ${dmSans.variable}`}>
```

(Leave the `<body>` className as is. The landing root will opt into `font-dm`.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/styles/landing-tokens.test.ts`
Expected: PASS (3 cases).

- [ ] **Step 6: Typecheck** (note: the branch has pre-existing unrelated Sanity/blog typecheck errors; confirm zero NEW errors referencing `tailwind.config` or `layout`)

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add tailwind.config.ts app/layout.tsx tests/styles/landing-tokens.test.ts
git commit -m "feat(landing-rebuild): add bold-modern tokens + Space Grotesk/DM Sans fonts"
```

---

## Task 2: Bilingual chrome copy module

**Files:**
- Create: `lib/landing/copy.ts`
- Test: `tests/integration/lib/landing-copy.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/integration/lib/landing-copy.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { landingCopy } from "@/lib/landing/copy";

describe("landingCopy", () => {
  it("has matching top-level locale keys", () => {
    expect(Object.keys(landingCopy.pl).sort()).toEqual(Object.keys(landingCopy.en).sort());
  });

  it("has nav, finalCta, and footer groups on both locales", () => {
    for (const loc of [landingCopy.pl, landingCopy.en]) {
      expect(loc.nav.cta).toBeTruthy();
      expect(loc.nav.menuOpen).toBeTruthy();
      expect(loc.nav.menuClose).toBeTruthy();
      expect(loc.nav.links).toHaveLength(4);
      expect(loc.finalCta.heading).toBeTruthy();
      expect(loc.finalCta.cta).toBeTruthy();
      expect(loc.footer.legalNote).toBeTruthy();
    }
  });

  it("contains no em or en dashes", () => {
    const flat = JSON.stringify(landingCopy);
    expect(flat).not.toMatch(/—|–/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/lib/landing-copy.test.ts`
Expected: FAIL (cannot resolve `@/lib/landing/copy`).

- [ ] **Step 3: Write the copy module**

Create `lib/landing/copy.ts`:

```ts
/**
 * Bilingual copy for the rebuilt landing page (bold modern SaaS).
 * Separate from lib/marketing/copy.ts so the live pages stay untouched
 * until Sprint 4 swaps the route. No em or en dashes anywhere (house rule).
 */
export type LandingLocale = "pl" | "en";

export interface NavLink {
  href: string;
  label: string;
}

export const landingCopy = {
  pl: {
    nav: {
      links: [
        { href: "#jak-to-dziala", label: "Jak to działa" },
        { href: "/pricing", label: "Cennik" },
        { href: "/security", label: "Bezpieczeństwo" },
        { href: "#faq", label: "FAQ" }
      ] as NavLink[],
      cta: "Zacznij za darmo",
      menuOpen: "Otwórz menu",
      menuClose: "Zamknij menu"
    },
    finalCta: {
      heading: "Wgraj pierwszą fakturę i zobacz wynik.",
      sub: "Pierwsza w tym miesiącu jest za darmo. Bez karty, bez zobowiązań.",
      cta: "Zacznij za darmo"
    },
    footer: {
      tagline: "Faktura KSeF w języku Twojego klienta.",
      productHeading: "Produkt",
      companyHeading: "Firma",
      productLinks: [
        { href: "/pricing", label: "Cennik" },
        { href: "/security", label: "Bezpieczeństwo" },
        { href: "#faq", label: "FAQ" },
        { href: "/blog", label: "Blog" }
      ] as NavLink[],
      companyLinks: [
        { href: "/terms", label: "Regulamin" },
        { href: "/privacy", label: "Polityka prywatności" }
      ] as NavLink[],
      legalNote: "Dane w UE (Frankfurt). Płatności Stripe. Zgodność z RODO.",
      rights: "Wszelkie prawa zastrzeżone."
    }
  },
  en: {
    nav: {
      links: [
        { href: "#jak-to-dziala", label: "How it works" },
        { href: "/en/pricing", label: "Pricing" },
        { href: "/en/security", label: "Security" },
        { href: "#faq", label: "FAQ" }
      ] as NavLink[],
      cta: "Start free",
      menuOpen: "Open menu",
      menuClose: "Close menu"
    },
    finalCta: {
      heading: "Upload your first invoice and see the result.",
      sub: "Your first this month is free. No card, no commitment.",
      cta: "Start free"
    },
    footer: {
      tagline: "Your KSeF invoice, in your client's language.",
      productHeading: "Product",
      companyHeading: "Company",
      productLinks: [
        { href: "/en/pricing", label: "Pricing" },
        { href: "/en/security", label: "Security" },
        { href: "#faq", label: "FAQ" },
        { href: "/en/blog", label: "Blog" }
      ] as NavLink[],
      companyLinks: [
        { href: "/en/terms", label: "Terms" },
        { href: "/en/privacy", label: "Privacy policy" }
      ] as NavLink[],
      legalNote: "Data in the EU (Frankfurt). Payments by Stripe. GDPR compliant.",
      rights: "All rights reserved."
    }
  }
} as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/lib/landing-copy.test.ts`
Expected: PASS (3 cases).

- [ ] **Step 5: Commit**

```bash
git add lib/landing/copy.ts tests/integration/lib/landing-copy.test.ts
git commit -m "feat(landing-rebuild): bilingual chrome copy module"
```

---

## Task 3: Button + Eyebrow primitives

**Files:**
- Create: `components/landing/ui/button.tsx`
- Create: `components/landing/ui/eyebrow.tsx`
- Test: `tests/components/landing/button.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/landing/button.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "@/components/landing/ui/button";
import { Eyebrow } from "@/components/landing/ui/eyebrow";

describe("<Button>", () => {
  it("renders a button with its label and primary styling by default", () => {
    render(<Button>Zacznij</Button>);
    const btn = screen.getByRole("button", { name: "Zacznij" });
    expect(btn.className).toMatch(/bg-brand/);
  });

  it("renders an anchor when href is provided", () => {
    render(<Button href="/login">Zaloguj</Button>);
    const link = screen.getByRole("link", { name: "Zaloguj" });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("applies the ghost variant", () => {
    render(<Button variant="ghost">Przykład</Button>);
    expect(screen.getByRole("button", { name: "Przykład" }).className).toMatch(/border/);
  });

  it("fires onClick", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Klik</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Klik" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("<Eyebrow>", () => {
  it("renders its text", () => {
    render(<Eyebrow>Faktura KSeF</Eyebrow>);
    expect(screen.getByText("Faktura KSeF")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/landing/button.test.tsx`
Expected: FAIL (cannot resolve `@/components/landing/ui/button`).

- [ ] **Step 3: Write the Button primitive**

Create `components/landing/ui/button.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "onDark";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-[11px] font-dm font-semibold transition-colors duration-150 ease-out cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white shadow-brand hover:bg-brand-hover",
  ghost: "bg-paper text-ink border border-line hover:bg-paper-soft",
  onDark: "bg-white text-ink hover:bg-paper-soft focus-visible:ring-offset-ink"
};

const sizes: Record<Size, string> = {
  md: "h-11 px-5 text-[14px]",
  lg: "h-[52px] px-6 text-[15px]"
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  href?: string;
}

export function Button({ variant = "primary", size = "md", href, className, children, ...props }: ButtonProps) {
  const classes = cn(base, variants[variant], sizes[size], className);
  if (href) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }
  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}

export default Button;
```

- [ ] **Step 4: Write the Eyebrow primitive**

Create `components/landing/ui/eyebrow.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface EyebrowProps {
  children: React.ReactNode;
  className?: string;
}

export function Eyebrow({ children, className }: EyebrowProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1.5 font-dm text-[12px] font-semibold text-brand",
        className
      )}
    >
      {children}
    </span>
  );
}

export default Eyebrow;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/components/landing/button.test.tsx`
Expected: PASS (5 cases).

- [ ] **Step 6: Commit**

```bash
git add components/landing/ui/button.tsx components/landing/ui/eyebrow.tsx tests/components/landing/button.test.tsx
git commit -m "feat(landing-rebuild): Button + Eyebrow primitives"
```

---

## Task 4: Mobile nav sheet

**Files:**
- Create: `components/landing/mobile-nav-sheet.tsx`
- Test: `tests/components/landing/mobile-nav-sheet.test.tsx`

This ports the shipped mobile-nav interaction (trigger with `aria-expanded`, focus moved into the sheet on open and restored on close, close on link/backdrop/Escape, body scroll lock) onto the new tokens.

- [ ] **Step 1: Write the failing test**

Create `tests/components/landing/mobile-nav-sheet.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  )
}));

import { MobileNavSheet } from "@/components/landing/mobile-nav-sheet";

const links = [
  { href: "/pricing", label: "Cennik" },
  { href: "/security", label: "Bezpieczeństwo" }
];
const baseProps = { links, ctaHref: "/login", ctaLabel: "Zacznij za darmo", openLabel: "Otwórz menu", closeLabel: "Zamknij menu" };

describe("<MobileNavSheet>", () => {
  it("is collapsed by default with no links shown", () => {
    render(<MobileNavSheet {...baseProps} />);
    expect(screen.getByRole("button", { name: "Otwórz menu" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: "Cennik" })).not.toBeInTheDocument();
  });

  it("opens the sheet with links + CTA and moves focus to close", () => {
    render(<MobileNavSheet {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Otwórz menu" }));
    expect(screen.getByRole("link", { name: "Cennik" })).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("link", { name: "Zacznij za darmo" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("button", { name: "Zamknij menu" })).toHaveFocus();
  });

  it("closes on link click", () => {
    render(<MobileNavSheet {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Otwórz menu" }));
    fireEvent.click(screen.getByRole("link", { name: "Cennik" }));
    expect(screen.queryByRole("link", { name: "Cennik" })).not.toBeInTheDocument();
  });

  it("closes on Escape", () => {
    render(<MobileNavSheet {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Otwórz menu" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("link", { name: "Cennik" })).not.toBeInTheDocument();
  });

  it("closes on backdrop click", () => {
    render(<MobileNavSheet {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Otwórz menu" }));
    fireEvent.click(screen.getByTestId("mobile-nav-backdrop"));
    expect(screen.queryByRole("link", { name: "Cennik" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/landing/mobile-nav-sheet.test.tsx`
Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Write the component**

Create `components/landing/mobile-nav-sheet.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import type { NavLink } from "@/lib/landing/copy";
import { cn } from "@/lib/utils";

const SHEET_ID = "landing-mobile-nav";

export interface MobileNavSheetProps {
  links: ReadonlyArray<NavLink>;
  ctaHref: string;
  ctaLabel: string;
  openLabel: string;
  closeLabel: string;
  className?: string;
}

export function MobileNavSheet({ links, ctaHref, ctaLabel, openLabel, closeLabel, className }: MobileNavSheetProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const previous = document.body.style.overflow;
    if (open) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (open) closeRef.current?.focus();
    else if (wasOpen.current) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <div className={cn("md:hidden", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={openLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={SHEET_ID}
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-line text-ink cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <div
            data-testid="mobile-nav-backdrop"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/30"
          />
          <div
            id={SHEET_ID}
            role="dialog"
            aria-modal="true"
            aria-label={openLabel}
            className="absolute right-0 top-0 flex h-full w-[min(20rem,85vw)] flex-col gap-2 border-l border-line bg-paper p-5 shadow-raised"
          >
            <div className="mb-2 flex justify-end">
              <button
                ref={closeRef}
                type="button"
                aria-label={closeLabel}
                onClick={() => setOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-[10px] text-ink cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-[10px] px-3 py-3 font-dm text-[17px] text-ink hover:bg-paper-soft"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href={ctaHref}
              onClick={() => setOpen(false)}
              className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-[11px] bg-brand font-dm font-semibold text-white shadow-brand hover:bg-brand-hover"
            >
              {ctaLabel}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default MobileNavSheet;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/landing/mobile-nav-sheet.test.tsx`
Expected: PASS (5 cases).

- [ ] **Step 5: Commit**

```bash
git add components/landing/mobile-nav-sheet.tsx tests/components/landing/mobile-nav-sheet.test.tsx
git commit -m "feat(landing-rebuild): mobile nav sheet"
```

---

## Task 5: Site nav

**Files:**
- Create: `components/landing/site-nav.tsx`
- Test: `tests/components/landing/site-nav.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/landing/site-nav.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  )
}));

import { SiteNav } from "@/components/landing/site-nav";

describe("<SiteNav>", () => {
  it("renders the brand wordmark and the desktop CTA to /login (PL)", () => {
    render(<SiteNav locale="pl" />);
    expect(screen.getByText("TłumaczKSeF")).toBeInTheDocument();
    const ctas = screen.getAllByRole("link", { name: "Zacznij za darmo" });
    expect(ctas.length).toBeGreaterThanOrEqual(1);
    expect(ctas[0]).toHaveAttribute("href", "/login");
  });

  it("renders the desktop nav links", () => {
    render(<SiteNav locale="pl" />);
    expect(screen.getByRole("link", { name: "Cennik" })).toHaveAttribute("href", "/pricing");
  });

  it("renders the EN CTA label", () => {
    render(<SiteNav locale="en" />);
    expect(screen.getAllByRole("link", { name: "Start free" })[0]).toHaveAttribute("href", "/login");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/landing/site-nav.test.tsx`
Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Write the component**

Create `components/landing/site-nav.tsx`:

```tsx
import Link from "next/link";
import { landingCopy, type LandingLocale } from "@/lib/landing/copy";
import { MobileNavSheet } from "@/components/landing/mobile-nav-sheet";

export interface SiteNavProps {
  locale: LandingLocale;
}

export function SiteNav({ locale }: SiteNavProps) {
  const t = landingCopy[locale].nav;
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3.5 md:px-8">
        <Link href={locale === "en" ? "/en" : "/"} className="flex items-center gap-2.5 font-heading text-[17px] font-bold text-ink">
          <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-gradient-to-br from-brand to-iris text-[15px] font-bold text-white">T</span>
          TłumaczKSeF
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {t.links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-[9px] px-3 py-2 font-dm text-[14px] font-medium text-copy hover:text-ink">
              {l.label}
            </Link>
          ))}
          <Link href="/login" className="ml-2 inline-flex h-10 items-center rounded-[9px] bg-brand px-4 font-dm text-[14px] font-semibold text-white hover:bg-brand-hover">
            {t.cta}
          </Link>
        </nav>

        <MobileNavSheet
          links={t.links}
          ctaHref="/login"
          ctaLabel={t.cta}
          openLabel={t.menuOpen}
          closeLabel={t.menuClose}
        />
      </div>
    </header>
  );
}

export default SiteNav;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/landing/site-nav.test.tsx`
Expected: PASS (3 cases). (Both the desktop CTA and the mobile-sheet CTA render with the same name, hence `getAllByRole`.)

- [ ] **Step 5: Commit**

```bash
git add components/landing/site-nav.tsx tests/components/landing/site-nav.test.tsx
git commit -m "feat(landing-rebuild): sticky site nav"
```

---

## Task 6: Final CTA (dark band)

**Files:**
- Create: `components/landing/final-cta.tsx`
- Test: `tests/components/landing/final-cta.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/landing/final-cta.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  )
}));

import { FinalCta } from "@/components/landing/final-cta";

describe("<FinalCta>", () => {
  it("renders the heading and a CTA to /login (PL)", () => {
    render(<FinalCta locale="pl" />);
    expect(screen.getByRole("heading", { level: 2, name: /Wgraj pierwszą fakturę/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zacznij za darmo" })).toHaveAttribute("href", "/login");
  });

  it("renders the EN heading", () => {
    render(<FinalCta locale="en" />);
    expect(screen.getByRole("heading", { level: 2, name: /Upload your first invoice/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/landing/final-cta.test.tsx`
Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Write the component**

Create `components/landing/final-cta.tsx`:

```tsx
import Link from "next/link";
import { landingCopy, type LandingLocale } from "@/lib/landing/copy";

export interface FinalCtaProps {
  locale: LandingLocale;
}

export function FinalCta({ locale }: FinalCtaProps) {
  const t = landingCopy[locale].finalCta;
  return (
    <section className="relative overflow-hidden bg-ink">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-40%] h-[420px] w-[520px] -translate-x-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(139,92,246,0.28), rgba(217,70,239,0.08) 45%, transparent 70%)" }}
      />
      <div className="relative mx-auto max-w-3xl px-5 py-20 text-center md:px-8 md:py-24">
        <h2 className="font-heading text-h2x text-white">{t.heading}</h2>
        <p className="mx-auto mt-4 max-w-xl font-dm text-[16px] leading-relaxed text-white/70">{t.sub}</p>
        <div className="mt-9">
          <Link
            href="/login"
            className="inline-flex h-[52px] items-center justify-center rounded-[11px] bg-white px-7 font-dm text-[15px] font-semibold text-ink hover:bg-paper-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          >
            {t.cta}
          </Link>
        </div>
      </div>
    </section>
  );
}

export default FinalCta;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/landing/final-cta.test.tsx`
Expected: PASS (2 cases).

- [ ] **Step 5: Commit**

```bash
git add components/landing/final-cta.tsx tests/components/landing/final-cta.test.tsx
git commit -m "feat(landing-rebuild): dark final CTA band"
```

---

## Task 7: Site footer (dark)

**Files:**
- Create: `components/landing/site-footer.tsx`
- Test: `tests/components/landing/site-footer.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/landing/site-footer.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  )
}));

import { SiteFooter } from "@/components/landing/site-footer";

describe("<SiteFooter>", () => {
  it("renders the legal note and product links (PL)", () => {
    render(<SiteFooter locale="pl" />);
    expect(screen.getByText(/Dane w UE \(Frankfurt\)/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cennik" })).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("link", { name: "Polityka prywatności" })).toHaveAttribute("href", "/privacy");
  });

  it("renders the EN legal note", () => {
    render(<SiteFooter locale="en" />);
    expect(screen.getByText(/GDPR compliant/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/landing/site-footer.test.tsx`
Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Write the component**

Create `components/landing/site-footer.tsx`:

```tsx
import Link from "next/link";
import { landingCopy, type LandingLocale } from "@/lib/landing/copy";

export interface SiteFooterProps {
  locale: LandingLocale;
}

export function SiteFooter({ locale }: SiteFooterProps) {
  const t = landingCopy[locale].footer;
  const year = 2026;
  return (
    <footer className="bg-ink text-white/70">
      <div className="mx-auto max-w-6xl px-5 py-14 md:px-8">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 font-heading text-[16px] font-bold text-white">
              <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-gradient-to-br from-brand to-iris text-[15px] text-white">T</span>
              TłumaczKSeF
            </div>
            <p className="mt-3 max-w-xs font-dm text-[14px]">{t.tagline}</p>
          </div>
          <div>
            <p className="font-dm text-[12px] font-semibold uppercase tracking-wide text-white/50">{t.productHeading}</p>
            <ul className="mt-3 space-y-2">
              {t.productLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="font-dm text-[14px] text-white/70 hover:text-white">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-dm text-[12px] font-semibold uppercase tracking-wide text-white/50">{t.companyHeading}</p>
            <ul className="mt-3 space-y-2">
              {t.companyLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="font-dm text-[14px] text-white/70 hover:text-white">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 font-dm text-[13px] text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <span>{t.legalNote}</span>
          <span>© {year} TłumaczKSeF. {t.rights}</span>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/landing/site-footer.test.tsx`
Expected: PASS (2 cases).

- [ ] **Step 5: Commit**

```bash
git add components/landing/site-footer.tsx tests/components/landing/site-footer.test.tsx
git commit -m "feat(landing-rebuild): dark site footer"
```

---

## Task 8: Page composition + preview route

**Files:**
- Create: `components/landing/landing-rebuild.tsx`
- Create: `app/landing-preview/page.tsx`
- Test: `tests/components/landing/landing-rebuild.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/landing/landing-rebuild.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  )
}));

import { LandingRebuild } from "@/components/landing/landing-rebuild";

describe("<LandingRebuild>", () => {
  it("renders the nav, final CTA, footer, and the section anchors", () => {
    const { container } = render(<LandingRebuild locale="pl" />);
    expect(screen.getByText("TłumaczKSeF")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /Wgraj pierwszą fakturę/i })).toBeInTheDocument();
    expect(screen.getByText(/Dane w UE \(Frankfurt\)/i)).toBeInTheDocument();
    // section placeholder anchors exist for later sprints
    expect(container.querySelector("#jak-to-dziala")).not.toBeNull();
    expect(container.querySelector("#faq")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/landing/landing-rebuild.test.tsx`
Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Write the composition**

Create `components/landing/landing-rebuild.tsx`. The `font-dm` on the root opts the whole landing into DM Sans. The empty anchored `<section>`s are placeholders that later sprints replace with real sections.

```tsx
import type { LandingLocale } from "@/lib/landing/copy";
import { SiteNav } from "@/components/landing/site-nav";
import { FinalCta } from "@/components/landing/final-cta";
import { SiteFooter } from "@/components/landing/site-footer";

export interface LandingRebuildProps {
  locale: LandingLocale;
}

/** Section ids reserved for later sprints (hero, demo, comparison, etc.). */
const SECTION_IDS = [
  "hero",
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

- [ ] **Step 4: Write the preview route**

Create `app/landing-preview/page.tsx` (noindex so it never competes with the live landing in search):

```tsx
import type { Metadata } from "next";
import { LandingRebuild } from "@/components/landing/landing-rebuild";

export const metadata: Metadata = {
  title: "Landing preview (rebuild)",
  robots: { index: false, follow: false }
};

export default function LandingPreviewPage() {
  return <LandingRebuild locale="pl" />;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/components/landing/landing-rebuild.test.tsx`
Expected: PASS (1 case).

- [ ] **Step 6: Typecheck + lint**

Run: `npm run typecheck && npm run lint`
Expected: no new errors; lint clean.

- [ ] **Step 7: Commit**

```bash
git add components/landing/landing-rebuild.tsx app/landing-preview/page.tsx tests/components/landing/landing-rebuild.test.tsx
git commit -m "feat(landing-rebuild): page composition + noindex preview route"
```

---

## Task 9: E2E smoke + full verification

**Files:**
- Create: `tests/e2e/landing-rebuild-preview.spec.ts`

- [ ] **Step 1: Write the test**

Create `tests/e2e/landing-rebuild-preview.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("landing rebuild preview renders chrome with no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("/landing-preview");

  await expect(page.getByText("TłumaczKSeF").first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /Wgraj pierwszą fakturę/i })).toBeVisible();
  await expect(page.getByText(/Dane w UE \(Frankfurt\)/i)).toBeVisible();
  // primary nav CTA points to /login
  await expect(page.getByRole("link", { name: "Zacznij za darmo" }).first()).toHaveAttribute("href", "/login");

  expect(errors).toEqual([]);
});

test("landing rebuild preview has no horizontal overflow at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/landing-preview");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  );
  expect(overflow).toBe(false);
});
```

- [ ] **Step 2: Run the E2E**

Run: `npm run test:e2e -- landing-rebuild-preview`
Expected: PASS. If a browser is missing, run `npm run test:e2e:install` first.

- [ ] **Step 3: Run the full unit/component suite for the new code**

Run: `npx vitest run tests/components/landing tests/integration/lib/landing-copy.test.ts tests/styles/landing-tokens.test.ts`
Expected: all green.

- [ ] **Step 4: Typecheck + lint + MF-label guard**

Run: `npm run typecheck && npm run lint && npm run check:mf-labels`
Expected: no new typecheck errors, lint clean, MF labels pass.

- [ ] **Step 5: Manual responsive check (preview tools)**

Start the dev server and load `/landing-preview`. Verify at 375 / 768 / 1024 / 1440: the nav shows the hamburger below `md` and the links at `md` and up; opening the sheet works (links + CTA, close on link/backdrop/Escape); the dark final CTA and footer render with readable contrast; no horizontal scroll at 375. Repeat once at a manually constructed EN render if convenient (the route is PL; EN preview arrives when Sprint 4 wires `/en`).

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/landing-rebuild-preview.spec.ts
git commit -m "test(landing-rebuild): e2e smoke for preview chrome"
```

---

## Self-review notes (author)

- **Spec coverage (Sprint 1 slice):** tokens + fonts (visual spec 1.2, 1.3 → Task 1), copy rules incl. no-dashes (content spec 2, visual spec → Task 2 test asserts no dashes), Button/Eyebrow primitives (visual spec 4 → Task 3), nav + mobile sheet (visual spec 3 Nav → Tasks 4, 5), dark final CTA (visual spec 3 section 9 → Task 6), dark footer (→ Task 7), page shell + dark-close rhythm (→ Task 8), a11y/RWD (visual spec 1.7 → Task 9). The hero, demo, comparison, how-it-works, preserved-vs-translated, audience, pricing, and FAQ sections are deliberately deferred to Sprints 2 to 4 and represented here only as empty anchors.
- **Collision-safe tokens:** new color names (`brand`, `ink`, `paper`, `paper-soft`, `line`, `copy`, `mint`, `iris`, `plum`, `negative`) avoid Tailwind defaults (`indigo`, `violet`, `fuchsia`, `emerald`, `red`) and the existing project tokens (`surface`, `text`, `accent`, `border`, `success`, `danger`). New font families `heading` and `dm` avoid overriding the global `sans` (Inter). New fontSize keys `hero` and `h2x` do not collide with the existing scale.
- **Type consistency:** `NavLink` is defined once in `lib/landing/copy.ts` and imported by `MobileNavSheet` and consumed via `landingCopy` in `SiteNav`/`SiteFooter`. `LandingLocale` is the shared locale type used by `SiteNav`, `FinalCta`, `SiteFooter`, `LandingRebuild`. The `Button` `href` switch returns an anchor (role `link`) vs a button consistently with its tests.
- **No placeholders:** every component and test has complete code. The empty section anchors in Task 8 are intentional scaffolding for later sprints, not placeholders for missing logic.
- **Isolation:** nothing here touches the live landing (`app/page.tsx`, `components/marketing/**`, `lib/marketing/copy.ts`). The preview route is noindex. Sprint 4 performs the swap and retires the old landing.
```
