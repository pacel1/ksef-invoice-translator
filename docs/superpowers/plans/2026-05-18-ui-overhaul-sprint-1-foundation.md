# UI Overhaul Sprint 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the design-token foundation, brand mark, footer, and trust-module components so Sprints 2-4 can compose them into pages.

**Architecture:** Tailwind config gets a complete token rewrite (Stripe palette, Inter Variable font, new spacing/radii/shadows). A brand-lockup component renders the purple "T" bug + "Tłumacz Faktur KSeF" wordmark. Header is split into `<AuthenticatedHeader>` (extracted from the current protected layout) + `<PublicHeader>` (new). A `<LegalFooter>` ships site-wide. Five trust-module components (`<TrustStrip>`, `<PriceSnippet>`, `<SecurityCard>`, `<FounderCard>`, `<StatCounter>`) are built in isolation, fully tested, and consumed in Sprint 2+. Static `/404` (`app/not-found.tsx`) and runtime `/500` (`app/error.tsx`) pages adopt the new chrome.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Vitest + @testing-library/react (jsdom), Playwright E2E, next/font/google for Inter Variable. Existing `lib/billing/pricing.ts` powers `<PriceSnippet>`.

**Spec reference:** `docs/superpowers/specs/2026-05-18-ui-overhaul-design.md` — Section 3 (tokens), Section 4.2 (header/footer), Section 4.3 (trust modules), Section 5.7 (404/500), Section 7 (Sprint 1 row).

**Branch:** `claude/ui-overhaul-spec` (the spec branch). All Sprint 1 commits land on this branch and ship as PR #11.

---

## File Structure

### Modified files
- `tailwind.config.ts` — replaces existing color/shadow tokens, adds `fontFamily`, `keyframes`, `transitionTimingFunction`
- `app/globals.css` — replaces CSS variable values; removes legacy `.surface-grid` and `.glass-panel` helpers
- `app/layout.tsx` — loads Inter Variable via `next/font/google`, applies to `<html>` className
- `app/(protected)/layout.tsx` — replaces inline header markup with `<AuthenticatedHeader>` + footer

### New files

**Brand & data (no UI):**
- `lib/brand/legal.ts` — `LegalEntity` interface + placeholder constants (replace before launch)
- `lib/brand/founder.ts` — `Founder` interface + placeholder constants
- `lib/marketing/copy.ts` — bilingual strings for footer, public-header nav, 404/500 pages, trust strip labels

**Components — brand:**
- `components/brand/brand-lockup.tsx` — bug (purple square + white T) + wordmark, size variants
- `public/founder-placeholder.svg` — neutral placeholder asset for `<FounderCard>` during dev

**Components — layout:**
- `components/layout/authenticated-header.tsx` — extracted from current protected layout; mounts `<BrandLockup>` + nav + chip + email + logout
- `components/layout/public-header.tsx` — bug + wordmark + 3 nav links (Cennik, Bezpieczeństwo, Zaloguj się)
- `components/layout/legal-footer.tsx` — three-column footer used on every route

**Components — trust:**
- `components/trust/trust-strip.tsx` — 5 logos in a row (Stripe, Supabase, OpenAI, RODO, MF FA(3))
- `components/trust/price-snippet.tsx` — "od 2,99 zł za fakturę" (live-computed from `priceForPackage(100)`)
- `components/trust/security-card.tsx` — 3–4 bullet security claim block
- `components/trust/founder-card.tsx` — photo + name + statement + email
- `components/trust/stat-counter.tsx` — "X faktur" / "Y firm" — null below threshold

**Pages:**
- `app/not-found.tsx` — 404 with brand chrome + back-home CTA
- `app/error.tsx` — runtime error boundary with error ID + retry

**Tests:**
- `tests/components/brand/brand-lockup.test.tsx`
- `tests/components/layout/legal-footer.test.tsx`
- `tests/components/layout/authenticated-header.test.tsx`
- `tests/components/layout/public-header.test.tsx`
- `tests/components/trust/trust-strip.test.tsx`
- `tests/components/trust/price-snippet.test.tsx`
- `tests/components/trust/security-card.test.tsx`
- `tests/components/trust/founder-card.test.tsx`
- `tests/components/trust/stat-counter.test.tsx`
- `tests/components/pages/not-found.test.tsx`
- `tests/components/pages/error.test.tsx`
- `tests/e2e/sprint-1-foundation.spec.ts` — visits `/nonexistent`, asserts 404 page rendered with new chrome

---

## Task 1: Tailwind tokens rewrite

**Files:**
- Modify: `tailwind.config.ts`
- Modify: `app/globals.css`

- [ ] **Step 1: Replace `tailwind.config.ts`**

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Stripe-minimal palette — see specs/2026-05-18 §3.1
        surface: "hsl(var(--surface))",
        "surface-muted": "hsl(var(--surface-muted))",
        "text-strong": "hsl(var(--text-strong))",
        text: "hsl(var(--text))",
        "text-muted": "hsl(var(--text-muted))",
        border: "hsl(var(--border))",
        "border-strong": "hsl(var(--border-strong))",
        accent: {
          DEFAULT: "hsl(var(--accent))",
          hover: "hsl(var(--accent-hover))",
          soft: "hsl(var(--accent-soft))"
        },
        success: "hsl(var(--success))",
        danger: "hsl(var(--danger))",
        // Legacy shadcn aliases kept for the existing protected layout until Sprint 2/3 replace them.
        // Remove in Sprint 4 cleanup.
        input: "hsl(var(--border))",
        ring: "hsl(var(--accent))",
        foreground: "hsl(var(--text-strong))",
        background: "hsl(var(--surface))",
        primary: { DEFAULT: "hsl(var(--accent))", foreground: "0 0% 100%" },
        muted: { DEFAULT: "hsl(var(--surface-muted))", foreground: "hsl(var(--text-muted))" }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgba(10, 37, 64, 0.04), 0 1px 3px 0 rgba(10, 37, 64, 0.06)",
        md: "0 4px 6px -1px rgba(10, 37, 64, 0.07), 0 2px 4px -2px rgba(10, 37, 64, 0.05)",
        lg: "0 10px 24px -3px rgba(10, 37, 64, 0.10), 0 4px 8px -4px rgba(10, 37, 64, 0.06)",
        // Legacy alias kept for the existing components until Sprint 2/3.
        soft: "0 1px 2px 0 rgba(10, 37, 64, 0.04), 0 1px 3px 0 rgba(10, 37, 64, 0.06)"
      },
      borderRadius: {
        md: "6px",
        lg: "8px",
        xl: "12px"
      },
      transitionDuration: {
        hover: "150ms",
        layout: "200ms",
        modal: "300ms"
      },
      transitionTimingFunction: {
        "ease-out": "cubic-bezier(0.16, 1, 0.3, 1)"
      },
      fontSize: {
        // Type scale — specs/2026-05-18 §3.2
        display: ["48px", { lineHeight: "56px", fontWeight: "700" }],
        h1: ["32px", { lineHeight: "40px", fontWeight: "700" }],
        h2: ["24px", { lineHeight: "32px", fontWeight: "600" }],
        h3: ["18px", { lineHeight: "28px", fontWeight: "600" }],
        body: ["16px", { lineHeight: "24px", fontWeight: "400" }],
        small: ["14px", { lineHeight: "20px", fontWeight: "400" }],
        micro: ["12px", { lineHeight: "16px", fontWeight: "500" }],
        "number-xl": ["56px", { lineHeight: "64px", fontWeight: "600" }]
      }
    }
  },
  plugins: []
};

export default config;
```

- [ ] **Step 2: Replace `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* Stripe-minimal palette — specs/2026-05-18 §3.1
     HSL values: enter as "H S% L%" so Tailwind's hsl(var(--token)) wrapper works. */
  --surface: 0 0% 100%;
  --surface-muted: 210 25% 98%;
  --text-strong: 213 67% 15%;
  --text: 213 25% 33%;
  --text-muted: 213 14% 47%;
  --border: 210 22% 91%;
  --border-strong: 213 14% 79%;
  --accent: 245 100% 67%;
  --accent-hover: 245 81% 62%;
  --accent-soft: 245 100% 96%;
  --success: 148 45% 45%;
  --danger: 346 60% 52%;
}

* {
  box-sizing: border-box;
}

html {
  font-family: var(--font-inter), ui-sans-serif, system-ui, sans-serif;
  font-feature-settings: "cv02", "cv03", "cv04", "cv11", "tnum";
}

body {
  min-height: 100vh;
  background: hsl(var(--surface));
  color: hsl(var(--text-strong));
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

- [ ] **Step 3: Verify build still compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: PASS. Visual regressions in existing pages are expected (colors shifted) and will be resolved in Sprint 2.

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.ts app/globals.css
git commit -m "feat(design-system): Stripe-minimal token palette + Inter type scale"
```

---

## Task 2: Inter Variable font load

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update `app/layout.tsx` to load Inter via `next/font/google`**

Replace the existing import block + `RootLayout` function:

```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-inter"
});

export const metadata: Metadata = {
  // ... existing metadata block stays unchanged ...
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={inter.variable}>
      <body className="bg-surface text-text-strong">{children}</body>
    </html>
  );
}
```

Keep the entire `metadata` object as-is. Only the `Inter` import, the `inter` constant, and the `RootLayout` JSX change.

- [ ] **Step 2: Build + manual check**

```bash
npm run build && tmux kill-session -t dev 2>/dev/null; tmux new-session -d -s dev "npx next dev"
sleep 6 && curl -s http://localhost:3000/ -o /dev/null -w "%{http_code}\n"
```

Expected: build clean, HTTP 200, page renders in Inter (visible difference from default sans).

- [ ] **Step 3: Stop dev server**

```bash
tmux kill-session -t dev 2>/dev/null
```

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(design-system): load Inter Variable via next/font/google"
```

---

## Task 3: Brand + marketing data modules

**Files:**
- Create: `lib/brand/legal.ts`
- Create: `lib/brand/founder.ts`
- Create: `lib/marketing/copy.ts`
- Test: `tests/integration/lib/marketing-copy.test.ts`

These are data-only modules. Loud placeholder values flag the open items from spec §8.

- [ ] **Step 1: Write failing test for marketing copy shape**

Create `tests/integration/lib/marketing-copy.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { marketingCopy } from "@/lib/marketing/copy";

describe("marketingCopy", () => {
  it("has parity between PL and EN top-level keys", () => {
    expect(Object.keys(marketingCopy.pl).sort()).toEqual(Object.keys(marketingCopy.en).sort());
  });

  it("PL footer carries product, trust, and sitemap groups", () => {
    expect(marketingCopy.pl.footer.sitemap.cennik).toBe("Cennik");
    expect(marketingCopy.pl.footer.sitemap.security).toBe("Bezpieczeństwo");
    expect(marketingCopy.pl.footer.trust.hosting).toMatch(/Frankfurt/);
    expect(marketingCopy.pl.footer.trust.stripe).toMatch(/Stripe/);
    expect(marketingCopy.pl.footer.trust.rodo).toMatch(/RODO/);
  });

  it("EN mirror translates the trust strings", () => {
    expect(marketingCopy.en.footer.trust.hosting).toMatch(/Frankfurt/);
    expect(marketingCopy.en.footer.trust.rodo).toMatch(/GDPR|RODO/i);
  });

  it("404 + error500 keys exist on both locales", () => {
    expect(marketingCopy.pl.notFound.title).toBeTruthy();
    expect(marketingCopy.pl.serverError.title).toBeTruthy();
    expect(marketingCopy.en.notFound.title).toBeTruthy();
    expect(marketingCopy.en.serverError.title).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --run tests/integration/lib/marketing-copy.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/brand/legal.ts`**

```typescript
/**
 * Legal entity displayed in the site footer + transactional emails.
 *
 * REPLACE BEFORE LAUNCH — these placeholder values must be swapped for the
 * actual registered Polish entity. Tracked in
 * docs/superpowers/specs/2026-05-18-ui-overhaul-design.md §8.
 */
export interface LegalEntity {
  name: string;
  nip: string;
  regon: string;
  address: string;
  copyrightYear: number;
}

export const LEGAL_ENTITY: LegalEntity = {
  name: "Tłumacz Faktur KSeF (REPLACE_BEFORE_LAUNCH)",
  nip: "0000000000",
  regon: "000000000",
  address: "ul. REPLACE_BEFORE_LAUNCH 1, 00-000 Warszawa",
  copyrightYear: new Date().getFullYear()
};
```

- [ ] **Step 4: Create `lib/brand/founder.ts`**

```typescript
/**
 * Founder card content. REPLACE BEFORE LAUNCH — placeholder values must be
 * swapped for real founder photo, name, statement, and contact email. Tracked
 * in docs/superpowers/specs/2026-05-18-ui-overhaul-design.md §8.
 */
export interface Founder {
  name: string;
  photoUrl: string;
  statement: string;
  contactEmail: string;
}

export const FOUNDER: Founder = {
  name: "Founder Name (REPLACE_BEFORE_LAUNCH)",
  photoUrl: "/founder-placeholder.svg",
  statement:
    "REPLACE_BEFORE_LAUNCH: dwa zdania o tym, dlaczego prowadzisz tłumaczksef.pl i że osobiście czytasz każdą wiadomość.",
  contactEmail: "kontakt@example.test"
};
```

- [ ] **Step 5: Create `lib/marketing/copy.ts`**

```typescript
import type { LegalEntity } from "@/lib/brand/legal";

/**
 * Bilingual strings for marketing surfaces and shared chrome (footer, public
 * header, error pages). Workspace-specific copy stays in lib/workspace/copy.ts.
 */
export const marketingCopy = {
  pl: {
    publicHeader: {
      pricing: "Cennik",
      security: "Bezpieczeństwo",
      login: "Zaloguj się"
    },
    footer: {
      legalLabel: "© {year} {name} · NIP {nip} · REGON {regon} · {address}",
      sitemap: {
        heading: "Produkt",
        cennik: "Cennik",
        security: "Bezpieczeństwo",
        history: "Historia",
        help: "Pomoc"
      },
      trust: {
        heading: "Zaufanie i prawo",
        hosting: "Dane w Supabase Frankfurt 🇪🇺",
        stripe: "Płatności Stripe",
        rodo: "RODO-compliant",
        terms: "Regulamin",
        privacy: "Polityka prywatności"
      }
    },
    trustStrip: {
      label: "Zaufane technologie",
      stripe: "Stripe",
      supabase: "Supabase Frankfurt",
      openai: "OpenAI",
      rodo: "RODO",
      mf: "MF FA(3)"
    },
    notFound: {
      title: "Nie znaleziono",
      body: "Strona nie istnieje albo została przeniesiona.",
      cta: "Wracam na stronę główną"
    },
    serverError: {
      title: "Coś poszło nie tak",
      body: "Wystąpił błąd po naszej stronie. Spróbuj ponownie za chwilę.",
      cta: "Spróbuj ponownie",
      home: "Wracam na stronę główną",
      errorIdLabel: "ID błędu"
    }
  },
  en: {
    publicHeader: {
      pricing: "Pricing",
      security: "Security",
      login: "Sign in"
    },
    footer: {
      legalLabel: "© {year} {name} · NIP {nip} · REGON {regon} · {address}",
      sitemap: {
        heading: "Product",
        cennik: "Pricing",
        security: "Security",
        history: "History",
        help: "Help"
      },
      trust: {
        heading: "Trust & legal",
        hosting: "Data in Supabase Frankfurt 🇪🇺",
        stripe: "Payments by Stripe",
        rodo: "GDPR-compliant",
        terms: "Terms",
        privacy: "Privacy policy"
      }
    },
    trustStrip: {
      label: "Trusted tech",
      stripe: "Stripe",
      supabase: "Supabase Frankfurt",
      openai: "OpenAI",
      rodo: "GDPR",
      mf: "MF FA(3)"
    },
    notFound: {
      title: "Not found",
      body: "This page does not exist or has been moved.",
      cta: "Back to homepage"
    },
    serverError: {
      title: "Something went wrong",
      body: "An error occurred on our side. Please try again in a moment.",
      cta: "Try again",
      home: "Back to homepage",
      errorIdLabel: "Error ID"
    }
  }
} as const;

export type MarketingLocale = keyof typeof marketingCopy;

/** Format the footer legal line with values from a `LegalEntity`. */
export function formatLegalLine(locale: MarketingLocale, entity: LegalEntity): string {
  return marketingCopy[locale].footer.legalLabel
    .replace("{year}", String(entity.copyrightYear))
    .replace("{name}", entity.name)
    .replace("{nip}", entity.nip)
    .replace("{regon}", entity.regon)
    .replace("{address}", entity.address);
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
npm test -- --run tests/integration/lib/marketing-copy.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 7: Commit**

```bash
git add lib/brand/legal.ts lib/brand/founder.ts lib/marketing/copy.ts tests/integration/lib/marketing-copy.test.ts
git commit -m "feat(brand): legal + founder + marketing copy modules"
```

---

## Task 4: BrandLockup component

**Files:**
- Create: `components/brand/brand-lockup.tsx`
- Test: `tests/components/brand/brand-lockup.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/brand/brand-lockup.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrandLockup } from "@/components/brand/brand-lockup";

describe("<BrandLockup>", () => {
  it("renders the bug + wordmark by default", () => {
    render(<BrandLockup />);
    expect(screen.getByText("Tłumacz Faktur KSeF")).toBeInTheDocument();
    expect(screen.getByText("T", { selector: "[data-brand-bug] *" })).toBeInTheDocument();
  });

  it("wraps the lockup in a link when href is provided", () => {
    render(<BrandLockup href="/app" />);
    const link = screen.getByRole("link", { name: /Tłumacz Faktur KSeF/i });
    expect(link).toHaveAttribute("href", "/app");
  });

  it("renders bug only when variant='bug-only'", () => {
    render(<BrandLockup variant="bug-only" />);
    expect(screen.queryByText("Tłumacz Faktur KSeF")).not.toBeInTheDocument();
    expect(screen.getByText("T", { selector: "[data-brand-bug] *" })).toBeInTheDocument();
  });

  it("applies size classes for sm | md | lg", () => {
    const { rerender } = render(<BrandLockup size="sm" />);
    expect(document.querySelector("[data-brand-bug]")?.className).toMatch(/h-6/);
    rerender(<BrandLockup size="lg" />);
    expect(document.querySelector("[data-brand-bug]")?.className).toMatch(/h-10/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --run tests/components/brand/brand-lockup.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the component**

Create `components/brand/brand-lockup.tsx`:

```tsx
import Link from "next/link";

export type BrandLockupSize = "sm" | "md" | "lg";
export type BrandLockupVariant = "full" | "bug-only";

export interface BrandLockupProps {
  /** Wraps the lockup in a Next.js Link when set. Omit for non-clickable headers. */
  href?: string;
  size?: BrandLockupSize;
  variant?: BrandLockupVariant;
  className?: string;
}

const BUG_SIZE: Record<BrandLockupSize, string> = {
  sm: "h-6 w-6 text-[14px]",
  md: "h-8 w-8 text-[18px]",
  lg: "h-10 w-10 text-[22px]"
};

const WORDMARK_SIZE: Record<BrandLockupSize, string> = {
  sm: "text-small",
  md: "text-body",
  lg: "text-h3"
};

const GAP: Record<BrandLockupSize, string> = {
  sm: "gap-1.5",
  md: "gap-2",
  lg: "gap-3"
};

export function BrandLockup({
  href,
  size = "md",
  variant = "full",
  className = ""
}: BrandLockupProps) {
  const inner = (
    <span className={`inline-flex items-center ${GAP[size]} ${className}`}>
      <span
        data-brand-bug
        className={`inline-flex items-center justify-center rounded-md bg-accent font-semibold text-white ${BUG_SIZE[size]}`}
        aria-hidden={variant === "full"}
      >
        <span>T</span>
      </span>
      {variant === "full" ? (
        <span className={`font-semibold tracking-tight text-text-strong ${WORDMARK_SIZE[size]}`}>
          Tłumacz Faktur KSeF
        </span>
      ) : null}
    </span>
  );
  if (href) {
    return (
      <Link href={href} aria-label="Tłumacz Faktur KSeF">
        {inner}
      </Link>
    );
  }
  return inner;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --run tests/components/brand/brand-lockup.test.tsx
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add components/brand/brand-lockup.tsx tests/components/brand/brand-lockup.test.tsx
git commit -m "feat(brand): BrandLockup component (bug + wordmark with size variants)"
```

---

## Task 4b: Favicon + apple-touch icon (Next.js icon convention)

**Files:**
- Create: `app/icon.tsx`
- Create: `app/apple-icon.tsx`

The bug from `<BrandLockup>` rendered at build time via `ImageResponse`. Next.js auto-wires the output as `/icon` (32×32 favicon) and `/apple-icon` (180×180 apple-touch). No manual `<link>` tags needed.

- [ ] **Step 1: Create `app/icon.tsx`**

```tsx
import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#635bff",
          color: "white",
          fontSize: 22,
          fontWeight: 600,
          fontFamily: "system-ui",
          borderRadius: 6
        }}
      >
        T
      </div>
    ),
    { ...size }
  );
}
```

- [ ] **Step 2: Create `app/apple-icon.tsx`**

```tsx
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#635bff",
          color: "white",
          fontSize: 120,
          fontWeight: 600,
          fontFamily: "system-ui",
          borderRadius: 32
        }}
      >
        T
      </div>
    ),
    { ...size }
  );
}
```

- [ ] **Step 3: Build to verify the icons compile**

```bash
npm run build 2>&1 | grep -E "icon|apple-icon"
```

Expected: output references the new routes (`/icon` and `/apple-icon`).

- [ ] **Step 4: Manual visual check**

Start the dev server and confirm the browser tab favicon is purple with a white "T":

```bash
tmux kill-session -t dev 2>/dev/null
tmux new-session -d -s dev "npx next dev"
sleep 6 && curl -s -o /tmp/icon.png -w "%{http_code}\n" http://localhost:3000/icon
tmux kill-session -t dev 2>/dev/null
```

Expected: HTTP 200. The downloaded `/tmp/icon.png` is a 32×32 PNG.

- [ ] **Step 5: Commit**

```bash
git add app/icon.tsx app/apple-icon.tsx
git commit -m "feat(brand): favicon + apple-touch icon via Next.js icon convention"
```

---

## Task 5: LegalFooter component

**Files:**
- Create: `components/layout/legal-footer.tsx`
- Test: `tests/components/layout/legal-footer.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/layout/legal-footer.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LegalFooter } from "@/components/layout/legal-footer";

describe("<LegalFooter>", () => {
  it("renders all three column headings (PL default)", () => {
    render(<LegalFooter />);
    expect(screen.getByText(/Tłumacz Faktur KSeF/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Produkt/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Zaufanie/i })).toBeInTheDocument();
  });

  it("shows the legal line with NIP, REGON, and address", () => {
    render(<LegalFooter />);
    expect(screen.getByText(/NIP\s+\d/i)).toBeInTheDocument();
    expect(screen.getByText(/REGON/i)).toBeInTheDocument();
  });

  it("links to /pricing, /security, /terms, /privacy", () => {
    render(<LegalFooter />);
    expect(screen.getByRole("link", { name: "Cennik" })).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("link", { name: "Bezpieczeństwo" })).toHaveAttribute("href", "/security");
    expect(screen.getByRole("link", { name: "Regulamin" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "Polityka prywatności" })).toHaveAttribute("href", "/privacy");
  });

  it("renders the EN mirror when locale='en'", () => {
    render(<LegalFooter locale="en" />);
    expect(screen.getByRole("heading", { name: /Product/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pricing" })).toBeInTheDocument();
    expect(screen.getByText(/GDPR-compliant/i)).toBeInTheDocument();
  });

  it("includes the Frankfurt hosting badge", () => {
    render(<LegalFooter />);
    expect(screen.getByText(/Frankfurt/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --run tests/components/layout/legal-footer.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Create the component**

Create `components/layout/legal-footer.tsx`:

```tsx
import Link from "next/link";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { LEGAL_ENTITY } from "@/lib/brand/legal";
import { formatLegalLine, marketingCopy, type MarketingLocale } from "@/lib/marketing/copy";

export interface LegalFooterProps {
  locale?: MarketingLocale;
}

export function LegalFooter({ locale = "pl" }: LegalFooterProps) {
  const t = marketingCopy[locale];
  const legalLine = formatLegalLine(locale, LEGAL_ENTITY);

  return (
    <footer className="mt-16 border-t border-border bg-surface-muted">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-3 md:px-8">
        <div className="space-y-3">
          <BrandLockup size="md" />
          <p className="max-w-xs text-small text-text-muted">{legalLine}</p>
        </div>
        <div className="space-y-3">
          <h3 className="text-micro uppercase tracking-wide text-text-muted">{t.footer.sitemap.heading}</h3>
          <ul className="space-y-2 text-small">
            <li><Link href="/pricing" className="text-text hover:text-text-strong">{t.footer.sitemap.cennik}</Link></li>
            <li><Link href="/security" className="text-text hover:text-text-strong">{t.footer.sitemap.security}</Link></li>
            <li><Link href="/app/history" className="text-text hover:text-text-strong">{t.footer.sitemap.history}</Link></li>
            <li><Link href="/security#kontakt" className="text-text hover:text-text-strong">{t.footer.sitemap.help}</Link></li>
          </ul>
        </div>
        <div className="space-y-3">
          <h3 className="text-micro uppercase tracking-wide text-text-muted">{t.footer.trust.heading}</h3>
          <ul className="space-y-2 text-small">
            <li className="text-text">{t.footer.trust.hosting}</li>
            <li className="text-text">{t.footer.trust.stripe}</li>
            <li className="text-text">{t.footer.trust.rodo}</li>
            <li><Link href="/terms" className="text-text hover:text-text-strong">{t.footer.trust.terms}</Link></li>
            <li><Link href="/privacy" className="text-text hover:text-text-strong">{t.footer.trust.privacy}</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --run tests/components/layout/legal-footer.test.tsx
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add components/layout/legal-footer.tsx tests/components/layout/legal-footer.test.tsx
git commit -m "feat(layout): LegalFooter — three-column footer with PL/EN parity"
```

---

## Task 6: AuthenticatedHeader (extract from protected layout)

**Files:**
- Create: `components/layout/authenticated-header.tsx`
- Modify: `app/(protected)/layout.tsx`
- Test: `tests/components/layout/authenticated-header.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/layout/authenticated-header.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthenticatedHeader } from "@/components/layout/authenticated-header";

// next/link is fine under jsdom. The chip is a child component we render directly.
const balanceChip = <span data-testid="balance-chip-mock">25 kredytów</span>;
const signOutAction = vi.fn();

describe("<AuthenticatedHeader>", () => {
  it("renders the brand lockup linking to /app", () => {
    render(
      <AuthenticatedHeader email="jane@firma.pl" balanceSlot={balanceChip} signOutAction={signOutAction} />
    );
    expect(screen.getByRole("link", { name: /Tłumacz Faktur KSeF/i })).toHaveAttribute("href", "/app");
  });

  it("renders Workspace + Historia nav links", () => {
    render(
      <AuthenticatedHeader email="jane@firma.pl" balanceSlot={balanceChip} signOutAction={signOutAction} />
    );
    expect(screen.getByRole("link", { name: "Workspace" })).toHaveAttribute("href", "/app");
    expect(screen.getByRole("link", { name: "Historia" })).toHaveAttribute("href", "/app/history");
  });

  it("renders the balance slot, email, and logout button", () => {
    render(
      <AuthenticatedHeader email="jane@firma.pl" balanceSlot={balanceChip} signOutAction={signOutAction} />
    );
    expect(screen.getByTestId("balance-chip-mock")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "jane@firma.pl" })).toHaveAttribute("href", "/account");
    expect(screen.getByRole("button", { name: /Wyloguj/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --run tests/components/layout/authenticated-header.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Create the component**

Create `components/layout/authenticated-header.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLockup } from "@/components/brand/brand-lockup";

export interface AuthenticatedHeaderProps {
  email: string;
  /** Slot for the live <BalanceChip>. Passed in as JSX so this component stays purely presentational. */
  balanceSlot: ReactNode;
  /** Server action bound to the logout form. */
  signOutAction: () => Promise<void> | void;
}

export function AuthenticatedHeader({ email, balanceSlot, signOutAction }: AuthenticatedHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-3 md:px-8">
        <BrandLockup href="/app" size="md" />
        <nav className="flex items-center gap-3 text-small text-text">
          <Link href="/app" className="rounded-md px-3 py-2 hover:bg-surface-muted">Workspace</Link>
          <Link href="/app/history" className="rounded-md px-3 py-2 hover:bg-surface-muted">Historia</Link>
          {balanceSlot}
          <Link href="/account" className="rounded-md px-3 py-2 hover:bg-surface-muted">
            {email}
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-md px-3 py-2 text-small text-text hover:bg-surface-muted"
            >
              Wyloguj
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --run tests/components/layout/authenticated-header.test.tsx
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Update `app/(protected)/layout.tsx` to mount the extracted header + footer**

Replace the entire file contents:

```tsx
import { requireUser } from "@/lib/auth/require-user";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { getCurrentBalance } from "@/lib/billing/get-current-balance";
import { signOut } from "@/app/actions/auth";
import { BalanceChip } from "@/components/billing/balance-chip";
import { AuthenticatedHeader } from "@/components/layout/authenticated-header";
import { LegalFooter } from "@/components/layout/legal-footer";
import { copy } from "@/lib/workspace/copy";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { uiLanguage } = await getCurrentProfile(user.id);
  const balance = await getCurrentBalance(user.id);
  const t = copy[uiLanguage];

  const balanceSlot = (
    <BalanceChip
      initialFree={balance.freeCreditsRemaining}
      initialPaid={balance.paidCredits}
      freeLabel={String(t.balanceFree)}
      paidLabel={String(t.balanceFreePaid)}
      topUpLabel={String(t.topUp)}
      outOfCreditsLabel={String(t.creditsExhaustedShort)}
    />
  );

  return (
    <div className="flex min-h-screen flex-col bg-surface text-text-strong">
      <AuthenticatedHeader email={user.email ?? ""} balanceSlot={balanceSlot} signOutAction={signOut} />
      <div className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 md:px-8">{children}</div>
      <LegalFooter locale={uiLanguage} />
    </div>
  );
}
```

- [ ] **Step 6: Run existing E2E to verify the protected pages still work**

```bash
tmux kill-session -t dev 2>/dev/null
npm run test:e2e -- workspace auth 2>&1 | tail -15
```

Expected: smoke + workspace + auth all pass.

- [ ] **Step 7: Commit**

```bash
git add components/layout/authenticated-header.tsx 'app/(protected)/layout.tsx' tests/components/layout/authenticated-header.test.tsx
git commit -m "refactor(layout): extract AuthenticatedHeader + mount LegalFooter on protected routes"
```

---

## Task 7: PublicHeader component

**Files:**
- Create: `components/layout/public-header.tsx`
- Test: `tests/components/layout/public-header.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/layout/public-header.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PublicHeader } from "@/components/layout/public-header";

describe("<PublicHeader>", () => {
  it("renders the brand lockup linking to /", () => {
    render(<PublicHeader />);
    expect(screen.getByRole("link", { name: /Tłumacz Faktur KSeF/i })).toHaveAttribute("href", "/");
  });

  it("renders Cennik + Bezpieczeństwo nav links (PL default)", () => {
    render(<PublicHeader />);
    expect(screen.getByRole("link", { name: "Cennik" })).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("link", { name: "Bezpieczeństwo" })).toHaveAttribute("href", "/security");
  });

  it("renders the Zaloguj się CTA as a button-styled link to /login", () => {
    render(<PublicHeader />);
    const cta = screen.getByRole("link", { name: "Zaloguj się" });
    expect(cta).toHaveAttribute("href", "/login");
    expect(cta.className).toMatch(/bg-accent/);
  });

  it("renders the EN mirror when locale='en'", () => {
    render(<PublicHeader locale="en" />);
    expect(screen.getByRole("link", { name: "Pricing" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Security" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --run tests/components/layout/public-header.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Create the component**

Create `components/layout/public-header.tsx`:

```tsx
import Link from "next/link";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { marketingCopy, type MarketingLocale } from "@/lib/marketing/copy";

export interface PublicHeaderProps {
  locale?: MarketingLocale;
}

export function PublicHeader({ locale = "pl" }: PublicHeaderProps) {
  const t = marketingCopy[locale];
  const baseLink = "rounded-md px-3 py-2 text-small text-text hover:text-text-strong";
  const ctaLink =
    "inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-small font-semibold text-white shadow-sm hover:bg-accent-hover transition-colors duration-hover ease-out";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-3 md:px-8">
        <BrandLockup href="/" size="md" />
        <nav className="flex items-center gap-2">
          <Link href="/pricing" className={baseLink}>{t.publicHeader.pricing}</Link>
          <Link href="/security" className={baseLink}>{t.publicHeader.security}</Link>
          <Link href="/login" className={ctaLink}>{t.publicHeader.login}</Link>
        </nav>
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --run tests/components/layout/public-header.test.tsx
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add components/layout/public-header.tsx tests/components/layout/public-header.test.tsx
git commit -m "feat(layout): PublicHeader — bug + wordmark + nav + login CTA"
```

---

## Task 8: TrustStrip component

**Files:**
- Create: `components/trust/trust-strip.tsx`
- Test: `tests/components/trust/trust-strip.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/trust/trust-strip.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrustStrip } from "@/components/trust/trust-strip";

describe("<TrustStrip>", () => {
  it("renders all five trust badges (PL default)", () => {
    render(<TrustStrip />);
    expect(screen.getByText("Stripe")).toBeInTheDocument();
    expect(screen.getByText(/Supabase/i)).toBeInTheDocument();
    expect(screen.getByText("OpenAI")).toBeInTheDocument();
    expect(screen.getByText("RODO")).toBeInTheDocument();
    expect(screen.getByText(/MF FA\(3\)/)).toBeInTheDocument();
  });

  it("renders an aria-label for the strip", () => {
    render(<TrustStrip />);
    expect(screen.getByRole("list", { name: /Zaufane technologie/i })).toBeInTheDocument();
  });

  it("switches to EN locale labels", () => {
    render(<TrustStrip locale="en" />);
    expect(screen.getByText("GDPR")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /Trusted tech/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --run tests/components/trust/trust-strip.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Create the component**

Create `components/trust/trust-strip.tsx`:

```tsx
import { marketingCopy, type MarketingLocale } from "@/lib/marketing/copy";

export interface TrustStripProps {
  locale?: MarketingLocale;
}

export function TrustStrip({ locale = "pl" }: TrustStripProps) {
  const t = marketingCopy[locale].trustStrip;
  const items = [t.stripe, t.supabase, t.openai, t.rodo, t.mf];

  return (
    <ul
      aria-label={t.label}
      className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-small text-text-muted"
    >
      {items.map((label) => (
        <li key={label} className="font-medium tracking-tight">
          {label}
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --run tests/components/trust/trust-strip.test.tsx
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add components/trust/trust-strip.tsx tests/components/trust/trust-strip.test.tsx
git commit -m "feat(trust): TrustStrip — five-badge row (Stripe, Supabase, OpenAI, RODO, MF)"
```

---

## Task 9: PriceSnippet component

**Files:**
- Create: `components/trust/price-snippet.tsx`
- Test: `tests/components/trust/price-snippet.test.tsx`

The snippet shows the *lowest* per-invoice price (the 100-pack tier = 2,99 zł). Live-computed from `priceForPackage(100)` so it stays in sync with `lib/billing/pricing.ts` if tiers ever change.

- [ ] **Step 1: Write failing test**

Create `tests/components/trust/price-snippet.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PriceSnippet } from "@/components/trust/price-snippet";

describe("<PriceSnippet>", () => {
  it("renders 'od 2,99 zł za fakturę' in PL", () => {
    render(<PriceSnippet />);
    expect(screen.getByText(/od\s+2,99\s+zł\s+za\s+fakturę/i)).toBeInTheDocument();
  });

  it("renders 'from PLN 2.99 per invoice' in EN", () => {
    render(<PriceSnippet locale="en" />);
    expect(screen.getByText(/from\s+PLN\s+2\.99\s+per\s+invoice/i)).toBeInTheDocument();
  });

  it("adds the 'Bez subskrypcji' tagline when variant='full'", () => {
    render(<PriceSnippet variant="full" />);
    expect(screen.getByText(/Bez subskrypcji/i)).toBeInTheDocument();
  });

  it("omits the tagline when variant='inline'", () => {
    render(<PriceSnippet variant="inline" />);
    expect(screen.queryByText(/Bez subskrypcji/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --run tests/components/trust/price-snippet.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Create the component**

Create `components/trust/price-snippet.tsx`:

```tsx
import { priceForPackage } from "@/lib/billing/pricing";

export type PriceSnippetLocale = "pl" | "en";
export type PriceSnippetVariant = "inline" | "full";

export interface PriceSnippetProps {
  locale?: PriceSnippetLocale;
  variant?: PriceSnippetVariant;
}

const LOWEST_TIER_PACKAGE_SIZE = 100; // 100-pack hits the lowest unit price

function formatUnitPrice(cents: number, locale: PriceSnippetLocale): string {
  const amount = cents / 100;
  if (locale === "pl") {
    // Polish formatting: "2,99 zł"
    return `${amount.toFixed(2).replace(".", ",")} zł`;
  }
  // English: "PLN 2.99"
  return `PLN ${amount.toFixed(2)}`;
}

export function PriceSnippet({ locale = "pl", variant = "full" }: PriceSnippetProps) {
  const quote = priceForPackage(LOWEST_TIER_PACKAGE_SIZE);
  const formatted = formatUnitPrice(quote.unitPriceCents, locale);

  const headline =
    locale === "pl"
      ? `od ${formatted} za fakturę`
      : `from ${formatted} per invoice`;

  const tagline = locale === "pl" ? "Bez subskrypcji." : "No subscription.";

  return (
    <p className="text-small text-text-muted">
      <span className="font-semibold text-text-strong tabular-nums">{headline}</span>
      {variant === "full" ? <span className="ml-2">{tagline}</span> : null}
    </p>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --run tests/components/trust/price-snippet.test.tsx
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add components/trust/price-snippet.tsx tests/components/trust/price-snippet.test.tsx
git commit -m "feat(trust): PriceSnippet — live-computed 'od 2,99 zł za fakturę'"
```

---

## Task 10: SecurityCard component

**Files:**
- Create: `components/trust/security-card.tsx`
- Test: `tests/components/trust/security-card.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/trust/security-card.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SecurityCard } from "@/components/trust/security-card";

const baseProps = {
  title: "Bezpieczeństwo Twoich faktur",
  items: [
    "Dane przechowywane w Supabase Frankfurt",
    "Szyfrowanie w trakcie i w spoczynku",
    "Kasowanie faktur po 30 dniach",
    "RODO-compliant"
  ]
};

describe("<SecurityCard>", () => {
  it("renders the title and all bullet items", () => {
    render(<SecurityCard {...baseProps} />);
    expect(screen.getByRole("heading", { name: /Bezpieczeństwo Twoich faktur/i })).toBeInTheDocument();
    for (const item of baseProps.items) {
      expect(screen.getByText(item)).toBeInTheDocument();
    }
  });

  it("renders a green check icon next to each bullet", () => {
    render(<SecurityCard {...baseProps} />);
    const icons = document.querySelectorAll("[data-security-check]");
    expect(icons.length).toBe(baseProps.items.length);
  });

  it("renders an empty state with no items", () => {
    render(<SecurityCard title="Tytuł" items={[]} />);
    expect(screen.getByRole("heading", { name: "Tytuł" })).toBeInTheDocument();
    expect(document.querySelectorAll("[data-security-check]").length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --run tests/components/trust/security-card.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Create the component**

Create `components/trust/security-card.tsx`:

```tsx
import { CheckCircle2 } from "lucide-react";

export interface SecurityCardProps {
  title: string;
  items: string[];
}

export function SecurityCard({ title, items }: SecurityCardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h3 className="text-h3 text-text-strong">{title}</h3>
      <ul className="mt-4 space-y-3 text-body text-text">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3">
            <CheckCircle2
              data-security-check
              className="mt-0.5 h-5 w-5 shrink-0 text-success"
              aria-hidden="true"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --run tests/components/trust/security-card.test.tsx
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add components/trust/security-card.tsx tests/components/trust/security-card.test.tsx
git commit -m "feat(trust): SecurityCard — title + green-checkmark bullet list"
```

---

## Task 11: FounderCard component

**Files:**
- Create: `components/trust/founder-card.tsx`
- Create: `public/founder-placeholder.svg`
- Test: `tests/components/trust/founder-card.test.tsx`

- [ ] **Step 1: Write failing test**

Create `tests/components/trust/founder-card.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FounderCard } from "@/components/trust/founder-card";

const baseProps = {
  name: "Jan Kowalski",
  photoUrl: "/founder-placeholder.svg",
  statement: "Prowadzę tłumaczksef.pl od 2025 r. Osobiście czytam każdą wiadomość.",
  contactEmail: "jan@example.test"
};

describe("<FounderCard>", () => {
  it("renders the founder name and statement", () => {
    render(<FounderCard {...baseProps} />);
    expect(screen.getByText("Jan Kowalski")).toBeInTheDocument();
    expect(screen.getByText(/Osobiście czytam/i)).toBeInTheDocument();
  });

  it("renders the photo with alt text matching the name", () => {
    render(<FounderCard {...baseProps} />);
    const img = screen.getByRole("img", { name: /Jan Kowalski/i });
    expect(img).toHaveAttribute("src", expect.stringContaining("founder-placeholder.svg"));
  });

  it("renders the contact email as a mailto link", () => {
    render(<FounderCard {...baseProps} />);
    const link = screen.getByRole("link", { name: /jan@example\.test/i });
    expect(link).toHaveAttribute("href", "mailto:jan@example.test");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --run tests/components/trust/founder-card.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Create the SVG placeholder asset**

Create `public/founder-placeholder.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="Founder photo placeholder">
  <rect width="96" height="96" rx="48" fill="#f0effd"/>
  <circle cx="48" cy="38" r="16" fill="#635bff" opacity="0.7"/>
  <path d="M16 88c0-17.7 14.3-32 32-32s32 14.3 32 32" fill="#635bff" opacity="0.7"/>
</svg>
```

- [ ] **Step 4: Create the component**

Create `components/trust/founder-card.tsx`:

```tsx
import Image from "next/image";

export interface FounderCardProps {
  name: string;
  photoUrl: string;
  statement: string;
  contactEmail: string;
}

export function FounderCard({ name, photoUrl, statement, contactEmail }: FounderCardProps) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-xl border border-border bg-surface p-6 shadow-sm sm:flex-row sm:items-center sm:gap-6">
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full">
        <Image
          src={photoUrl}
          alt={name}
          fill
          sizes="80px"
          className="object-cover"
        />
      </div>
      <div className="space-y-2">
        <p className="text-h3 text-text-strong">{name}</p>
        <p className="text-small text-text">{statement}</p>
        <a
          href={`mailto:${contactEmail}`}
          className="inline-flex text-small font-medium text-accent hover:text-accent-hover"
        >
          {contactEmail}
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test -- --run tests/components/trust/founder-card.test.tsx
```

Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add components/trust/founder-card.tsx public/founder-placeholder.svg tests/components/trust/founder-card.test.tsx
git commit -m "feat(trust): FounderCard — photo + name + statement + mailto"
```

---

## Task 12: StatCounter component

**Files:**
- Create: `components/trust/stat-counter.tsx`
- Test: `tests/components/trust/stat-counter.test.tsx`

The counter renders only when value ≥ 50 (threshold exported as `STAT_COUNTER_THRESHOLD`). Below that, it returns `null` so no fake numbers appear.

- [ ] **Step 1: Write failing test**

Create `tests/components/trust/stat-counter.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatCounter, STAT_COUNTER_THRESHOLD } from "@/components/trust/stat-counter";

describe("<StatCounter>", () => {
  it("exports a threshold of 50", () => {
    expect(STAT_COUNTER_THRESHOLD).toBe(50);
  });

  it("renders the value + label when value is at the threshold", () => {
    render(<StatCounter value={50} label="faktur" />);
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("faktur")).toBeInTheDocument();
  });

  it("renders the value + label when value is above the threshold", () => {
    render(<StatCounter value={1234} label="faktur" />);
    expect(screen.getByText("1234")).toBeInTheDocument();
  });

  it("returns null below the threshold", () => {
    const { container } = render(<StatCounter value={49} label="faktur" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("returns null for non-positive values", () => {
    const { container } = render(<StatCounter value={0} label="faktur" />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --run tests/components/trust/stat-counter.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Create the component**

Create `components/trust/stat-counter.tsx`:

```tsx
/**
 * StatCounter — renders a big number + label, but only when the value is
 * meaningful (≥ STAT_COUNTER_THRESHOLD). Below that, it returns null so we
 * never show fake or unimpressive stats. See specs/2026-05-18 §4.3.
 */
export const STAT_COUNTER_THRESHOLD = 50;

export interface StatCounterProps {
  value: number;
  label: string;
}

export function StatCounter({ value, label }: StatCounterProps) {
  if (value < STAT_COUNTER_THRESHOLD) return null;
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span className="text-number-xl tabular-nums text-text-strong">{value}</span>
      <span className="text-small uppercase tracking-wide text-text-muted">{label}</span>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --run tests/components/trust/stat-counter.test.tsx
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add components/trust/stat-counter.tsx tests/components/trust/stat-counter.test.tsx
git commit -m "feat(trust): StatCounter — threshold-gated (>=50) number display"
```

---

## Task 13: Error pages (`/404` via not-found.tsx + `/500` via error.tsx)

**Files:**
- Create: `app/not-found.tsx`
- Create: `app/error.tsx`
- Test: `tests/components/pages/not-found.test.tsx`
- Test: `tests/components/pages/error.test.tsx`
- Test: `tests/e2e/sprint-1-foundation.spec.ts`

- [ ] **Step 1: Write failing component test for `not-found.tsx`**

Create `tests/components/pages/not-found.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import NotFound from "@/app/not-found";

describe("app/not-found.tsx", () => {
  it("renders 404 + title + body + back-home CTA (PL)", () => {
    render(<NotFound />);
    expect(screen.getByText("404")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Nie znaleziono/i })).toBeInTheDocument();
    expect(screen.getByText(/nie istnieje albo została przeniesiona/i)).toBeInTheDocument();
    const cta = screen.getByRole("link", { name: /Wracam na stronę główną/i });
    expect(cta).toHaveAttribute("href", "/");
  });

  it("renders the brand lockup linking to /", () => {
    render(<NotFound />);
    const lockup = screen.getByRole("link", { name: /Tłumacz Faktur KSeF/i });
    expect(lockup).toHaveAttribute("href", "/");
  });

  it("renders the LegalFooter", () => {
    render(<NotFound />);
    expect(screen.getByText(/NIP/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --run tests/components/pages/not-found.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Create `app/not-found.tsx`**

```tsx
import Link from "next/link";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { LegalFooter } from "@/components/layout/legal-footer";
import { marketingCopy } from "@/lib/marketing/copy";

export default function NotFound() {
  const t = marketingCopy.pl.notFound;
  return (
    <div className="flex min-h-screen flex-col bg-surface text-text-strong">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-5 py-3 md:px-8">
          <BrandLockup href="/" size="md" />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-5 py-16 text-center md:px-8">
        <span className="text-display tabular-nums text-border-strong">404</span>
        <h1 className="text-h1 text-text-strong">{t.title}</h1>
        <p className="text-body text-text-muted">{t.body}</p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-accent px-5 py-3 text-small font-semibold text-white shadow-sm hover:bg-accent-hover transition-colors duration-hover ease-out"
        >
          {t.cta}
        </Link>
      </main>
      <LegalFooter />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify not-found passes**

```bash
npm test -- --run tests/components/pages/not-found.test.tsx
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Write failing component test for `error.tsx`**

Create `tests/components/pages/error.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Error from "@/app/error";

const sampleError = Object.assign(new Error("boom"), { digest: "ksef-abc123" });

describe("app/error.tsx", () => {
  it("renders 500 + title + retry button + error ID", () => {
    const reset = vi.fn();
    render(<Error error={sampleError} reset={reset} />);
    expect(screen.getByText("500")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Coś poszło nie tak/i })).toBeInTheDocument();
    expect(screen.getByText(/ksef-abc123/i)).toBeInTheDocument();
    const retry = screen.getByRole("button", { name: /Spróbuj ponownie/i });
    expect(retry).toBeInTheDocument();
    fireEvent.click(retry);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("renders the back-home link", () => {
    render(<Error error={sampleError} reset={vi.fn()} />);
    const home = screen.getByRole("link", { name: /Wracam na stronę główną/i });
    expect(home).toHaveAttribute("href", "/");
  });

  it("omits the error ID block when no digest is present", () => {
    const errorWithoutDigest = new Error("no digest");
    render(<Error error={errorWithoutDigest} reset={vi.fn()} />);
    expect(screen.queryByText(/ID błędu/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
npm test -- --run tests/components/pages/error.test.tsx
```

Expected: FAIL.

- [ ] **Step 7: Create `app/error.tsx`**

```tsx
"use client";

import Link from "next/link";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { LegalFooter } from "@/components/layout/legal-footer";
import { marketingCopy } from "@/lib/marketing/copy";

export interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const t = marketingCopy.pl.serverError;
  const errorId = error.digest;

  return (
    <div className="flex min-h-screen flex-col bg-surface text-text-strong">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-5 py-3 md:px-8">
          <BrandLockup href="/" size="md" />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-5 py-16 text-center md:px-8">
        <span className="text-display tabular-nums text-border-strong">500</span>
        <h1 className="text-h1 text-text-strong">{t.title}</h1>
        <p className="text-body text-text-muted">{t.body}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center rounded-md bg-accent px-5 py-3 text-small font-semibold text-white shadow-sm hover:bg-accent-hover transition-colors duration-hover ease-out"
          >
            {t.cta}
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-border px-5 py-3 text-small font-medium text-text hover:bg-surface-muted"
          >
            {t.home}
          </Link>
        </div>
        {errorId ? (
          <p className="font-mono text-micro text-text-muted">
            {t.errorIdLabel}: <span data-testid="error-id">{errorId}</span>
          </p>
        ) : null}
      </main>
      <LegalFooter />
    </div>
  );
}
```

- [ ] **Step 8: Run test to verify error.tsx passes**

```bash
npm test -- --run tests/components/pages/error.test.tsx
```

Expected: PASS, 3 tests.

- [ ] **Step 9: Write E2E that hits a nonexistent route and verifies the 404 chrome**

Create `tests/e2e/sprint-1-foundation.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test("404 page renders with new brand chrome", async ({ page }) => {
  const response = await page.goto("/this-route-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /Nie znaleziono/i })).toBeVisible();
  await expect(page.getByText("404")).toBeVisible();
  await expect(page.getByRole("link", { name: /Tłumacz Faktur KSeF/i })).toBeVisible();
  await expect(page.getByText(/NIP/i)).toBeVisible(); // LegalFooter present
  const cta = page.getByRole("link", { name: /Wracam na stronę główną/i });
  await expect(cta).toHaveAttribute("href", "/");
});
```

- [ ] **Step 10: Run the E2E to verify**

```bash
tmux kill-session -t dev 2>/dev/null
npm run test:e2e -- sprint-1-foundation 2>&1 | tail -10
```

Expected: 1 passed.

- [ ] **Step 11: Commit**

```bash
git add app/not-found.tsx app/error.tsx tests/components/pages/ tests/e2e/sprint-1-foundation.spec.ts
git commit -m "feat(pages): /404 and /500 with new brand chrome + LegalFooter"
```

---

## Task 14: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit + integration suite**

```bash
npm run typecheck
```

Expected: clean (no output).

```bash
tmux kill-session -t dev 2>/dev/null
tmux new-session -d -s dev "npx next dev"
sleep 8 && curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/
npm test -- --run
tmux kill-session -t dev 2>/dev/null
```

Expected: HTTP 200, all tests pass (existing 97 + new Sprint 1 ones).

- [ ] **Step 2: Run the full E2E suite**

```bash
tmux kill-session -t dev 2>/dev/null
npm run test:e2e 2>&1 | tail -20
```

Expected: 15 passed (14 existing + 1 new `sprint-1-foundation`).

- [ ] **Step 3: Run the production build**

```bash
npm run build 2>&1 | tail -15
```

Expected: build succeeds. The new `/404` and `/500` (compiled as `not-found.tsx` + `error.tsx`) show in the route summary.

- [ ] **Step 4: Manual visual smoke check**

```bash
tmux kill-session -t dev 2>/dev/null
tmux new-session -d -s dev "npx next dev"
sleep 6
```

Open in browser and visually check (do not run automated tests against these — just look):

1. `http://localhost:3000/` — existing landing still renders (visual regressions expected but should not be broken — Sprint 2 fixes them)
2. `http://localhost:3000/app` — after login, the new header lockup is visible (purple "T" + wordmark), LegalFooter appears at bottom with NIP placeholder
3. `http://localhost:3000/this-does-not-exist` — new 404 page with brand chrome, large slate "404", CTA back to /
4. Browser DevTools: confirm Inter Variable loaded (Network tab → fonts → Inter*.woff2 present and applied)

Stop dev server:

```bash
tmux kill-session -t dev 2>/dev/null
```

- [ ] **Step 5: No commit — verification task only**

If any of steps 1–4 fail, the failure is its own fix commit (don't bundle fixes into the verification task). If everything passes, Sprint 1 is done.

---

## Explicit deferrals (NOT in Sprint 1)

- **Mobile hamburger sheet for both headers.** Sprint 1 headers are responsive at the basic Tailwind level (they shrink and wrap on small screens) but the slide-in mobile drawer described in spec §4.2 is built in Sprint 2 when public pages start using `<PublicHeader>` and a mobile experience matters more.
- **EN mirrors of /404 and /500 pages.** Sprint 1 ships PL only for the error pages. EN mirrors land in Sprint 2 along with the rest of `/en/...`.
- **Mounting `<LegalFooter>` on the existing landing page (`/`) and `/login`.** Those pages are rebuilt in Sprint 2; adding the footer now would just create double-footer visual issues. Sprint 1 only mounts the footer on routes it controls (protected layout, /404, /500).
- **Wiring trust-module components into pages.** `<TrustStrip>`, `<PriceSnippet>`, `<SecurityCard>`, `<FounderCard>`, `<StatCounter>` are built and unit-tested in Sprint 1, but they remain unmounted in any user-facing page until Sprint 2 (landing, pricing, security) and Sprint 3 (workspace).

## After this plan

Open the Sprint 1 PR against `main` (the spec branch already has the design doc — this PR will contain spec + plan + 14 commits of foundation code).

Sprint 2 picks up after Sprint 1 merges. Its plan will be written then, when the tokens, brand, footer, and trust modules are actually present in the codebase and Sprint 2 can import them.
