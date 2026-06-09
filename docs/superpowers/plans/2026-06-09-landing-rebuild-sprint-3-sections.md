# Landing Rebuild Sprint 3: Explainer Sections

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the four explainer sections (why the old way fails, how it works, what stays exact, built for two) and wire them into the landing at `/landing-preview`, replacing their empty placeholders.

**Architecture:** Four self-contained presentational server components, each driven by a new bilingual copy group in `lib/landing/copy.ts`. They render into the reserved `#dlaczego`, `#jak-to-dziala`, `#co-zostaje`, `#dla-kogo` section ids, alternating white and `paper-soft` backgrounds. No interactivity, no backend.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, TailwindCSS, lucide-react, Vitest + Testing Library (jsdom), Playwright. Builds on Sprints 1 and 2 (merged).

**Specs:** `docs/superpowers/specs/2026-06-09-landing-content-rebuild.md` (§4.3 to §4.6), `docs/superpowers/specs/2026-06-09-landing-visual-design.md` (§3 Sections 3 to 6, §2 background rhythm).

**Branch:** `claude/landing-rebuild-sprint-3-sections` (already off `main`).

**Scope note:** The interactive demo (Section 2, `#demo`), pricing (`#cennik`), and FAQ (`#faq`) stay empty placeholders, built in later sprints. The hero CTAs already point at `#demo`; that anchor remains a reserved section until the demo sprint.

---

## File map

| File | Responsibility | Action |
|---|---|---|
| `lib/landing/copy.ts` | Section copy (pl + en) | Modify (add `whyOldWay`, `howItWorks`, `whatStays`, `builtForTwo`) |
| `components/landing/old-way-comparison.tsx` | Section 3 | Create |
| `components/landing/how-it-works-steps.tsx` | Section 4 | Create |
| `components/landing/preserved-vs-translated.tsx` | Section 5 | Create |
| `components/landing/audience-cards.tsx` | Section 6 | Create |
| `components/landing/landing-rebuild.tsx` | Page composition | Modify (render the 4 sections, drop their placeholders) |
| `tests/integration/lib/landing-copy.test.ts` | Copy test | Modify |
| `tests/components/landing/old-way-comparison.test.tsx` | Test | Create |
| `tests/components/landing/how-it-works-steps.test.tsx` | Test | Create |
| `tests/components/landing/preserved-vs-translated.test.tsx` | Test | Create |
| `tests/components/landing/audience-cards.test.tsx` | Test | Create |
| `tests/components/landing/landing-rebuild.test.tsx` | Composition test | Modify |
| `tests/e2e/landing-rebuild-preview.spec.ts` | E2E | Modify |

All four section components are server components (no client interactivity); icons come from `lucide-react`. Section eyebrows use a plain uppercase brand label (the hero keeps the prominent `Eyebrow` pill, giving the page a clear hierarchy).

---

## Task 1: Section copy (pl + en)

**Files:**
- Modify: `lib/landing/copy.ts`
- Test: `tests/integration/lib/landing-copy.test.ts`

- [ ] **Step 1: Write the failing test**, append inside `describe("landingCopy", …)` in `tests/integration/lib/landing-copy.test.ts`:

```ts
  it("has the four explainer-section groups on both locales", () => {
    for (const loc of [landingCopy.pl, landingCopy.en]) {
      expect(loc.whyOldWay.heading).toBeTruthy();
      expect(loc.whyOldWay.problems).toHaveLength(3);
      expect(loc.whyOldWay.resolution).toBeTruthy();
      expect(loc.howItWorks.steps).toHaveLength(3);
      expect(loc.howItWorks.footnote).toBeTruthy();
      expect(loc.whatStays.kept.length).toBeGreaterThanOrEqual(5);
      expect(loc.whatStays.translated.length).toBeGreaterThanOrEqual(5);
      expect(loc.whatStays.trust).toBeTruthy();
      expect(loc.builtForTwo.lanes).toHaveLength(2);
    }
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/lib/landing-copy.test.ts`
Expected: FAIL (`loc.whyOldWay` is undefined).

- [ ] **Step 3: Add the copy.** In `lib/landing/copy.ts`, add these four groups inside `pl` (after `hero`, before `nav`):

```ts
    whyOldWay: {
      eyebrow: "Dlaczego nie wystarczy polski plik",
      heading: "„Wyślę polską fakturę albo przetłumaczę w Google." Znamy to. I wiemy, czym się to kończy.",
      problems: [
        { action: "Wysyłasz polski PDF.", consequence: "Klient nie wie, co podpisuje ani za co płaci. Zamiast zapłacić, odpisuje z pytaniami." },
        { action: "Przepisujesz fakturę ręcznie w Wordzie.", consequence: "Pół godziny przy jednym dokumencie i łatwo pomylić kwotę albo numer konta." },
        { action: "Wrzucasz fakturę w Google Translate.", consequence: "Przetłumaczy też to, czego ruszać nie wolno: kwoty, numery, NIP. Układ się sypie, a kod QR przepada." }
      ],
      resolution: "My tłumaczymy tylko język. Liczby, numery i kod QR zostają dokładnie tam, gdzie były."
    },
    howItWorks: {
      eyebrow: "Jak to działa",
      heading: "Trzy kroki i faktura jest gotowa do wysłania.",
      steps: [
        { title: "Wgraj fakturę z KSeF.", body: "Plik XML albo PDF. Nie łączymy się z KSeF i nie logujemy Cię do Ministerstwa Finansów." },
        { title: "Wybierz język klienta.", body: "Angielski, niemiecki, francuski i kilkanaście innych. Możesz też zrobić wersję dwujęzyczną." },
        { title: "Pobierz gotowy plik.", body: "Profesjonalna wizualizacja faktury, gotowa, żeby wysłać ją mailem." }
      ],
      footnote: "Bez instalacji, bez integracji, bez umów."
    },
    whatStays: {
      eyebrow: "Faktura zostaje fakturą",
      heading: "Zmienia się tylko język. Reszta zostaje dokładnie taka sama.",
      keptLabel: "Zostaje bez zmian",
      kept: ["Numery faktur", "NIP i numery VAT", "Kwoty i sumy", "Daty", "Stawki VAT", "IBAN i numery kont", "Kod QR z KSeF"],
      translatedLabel: "Tłumaczymy",
      translated: ["Nazwy pól i nagłówki", "Opisy towarów i usług", "Notatki i uwagi", "Warunki i instrukcje płatności", "Stopkę"],
      trust: "Dlatego wynik nadal zgadza się z fakturą źródłową w KSeF i można go zweryfikować po kodzie QR."
    },
    builtForTwo: {
      eyebrow: "Dla kogo",
      heading: "Działa tak samo dobrze, czy masz jedną fakturę, czy sto.",
      lanes: [
        { title: "Prowadzisz firmę i sprzedajesz za granicę", body: "Wystawiasz fakturę w KSeF, a klient dostaje czytelną wersję w swoim języku. Wyglądasz profesjonalnie i szybciej dostajesz zapłatę." },
        { title: "Prowadzisz biuro rachunkowe", body: "Robisz obcojęzyczne wersje dla wielu klientów w kilka sekund. Bez abonamentu, płacisz tylko za to, co realnie tłumaczysz, a niewykorzystane pakiety się sumują." }
      ]
    },
```

And the EN mirror inside `en` (after `hero`, before `nav`):

```ts
    whyOldWay: {
      eyebrow: "Why the Polish file is not enough",
      heading: "\"I'll send the Polish invoice, or run it through Google.\" We know that one. And we know how it ends.",
      problems: [
        { action: "You send the Polish PDF.", consequence: "Your client has no idea what they are signing or paying for. Instead of paying, they reply with questions." },
        { action: "You retype the invoice in Word by hand.", consequence: "Half an hour per document, and it is easy to slip up on an amount or an account number." },
        { action: "You drop the invoice into Google Translate.", consequence: "It also translates what must never change: amounts, numbers, the VAT ID. The layout falls apart and the QR code disappears." }
      ],
      resolution: "We translate only the language. The figures, numbers and the QR code stay exactly where they were."
    },
    howItWorks: {
      eyebrow: "How it works",
      heading: "Three steps and the invoice is ready to send.",
      steps: [
        { title: "Upload your KSeF invoice.", body: "An XML or PDF file. We never connect to KSeF and never log you into the Ministry of Finance." },
        { title: "Choose your client's language.", body: "English, German, French and a dozen more. You can also make a bilingual version." },
        { title: "Download the finished file.", body: "A professional rendering of the invoice, ready to send by email." }
      ],
      footnote: "No install, no integration, no contracts."
    },
    whatStays: {
      eyebrow: "An invoice stays an invoice",
      heading: "Only the language changes. Everything else stays exactly the same.",
      keptLabel: "Stays unchanged",
      kept: ["Invoice numbers", "NIP and VAT IDs", "Amounts and totals", "Dates", "VAT rates", "IBAN and account numbers", "The KSeF QR code"],
      translatedLabel: "We translate",
      translated: ["Field names and headers", "Descriptions of goods and services", "Notes and remarks", "Payment terms and instructions", "The footer"],
      trust: "That is why the result still matches the source invoice in KSeF and can be verified by the QR code."
    },
    builtForTwo: {
      eyebrow: "Who it is for",
      heading: "Works just as well whether you have one invoice or a hundred.",
      lanes: [
        { title: "You run a business and sell abroad", body: "You issue the invoice in KSeF, and your client gets a readable version in their language. You look professional and get paid faster." },
        { title: "You run an accounting office", body: "You produce foreign-language versions for many clients in seconds. No subscription, you pay only for what you actually translate, and unused packs add up." }
      ]
    },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/integration/lib/landing-copy.test.ts`
Expected: PASS (all cases, including the pre-existing parity + no-dash tests). Note: the copy uses Polish typographic quotes („ ") and straight quotes/apostrophes, never em or en dashes.

- [ ] **Step 5: Commit**

```bash
git add lib/landing/copy.ts tests/integration/lib/landing-copy.test.ts
git commit -m "feat(landing-rebuild): copy for the four explainer sections (pl + en)"
```

---

## Task 2: OldWayComparison (Section 3)

**Files:**
- Create: `components/landing/old-way-comparison.tsx`
- Test: `tests/components/landing/old-way-comparison.test.tsx`

- [ ] **Step 1: Write the failing test**, create `tests/components/landing/old-way-comparison.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OldWayComparison } from "@/components/landing/old-way-comparison";

describe("<OldWayComparison>", () => {
  it("renders the heading, the three problem actions, and the resolution (PL)", () => {
    render(<OldWayComparison locale="pl" />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(/Znamy to/);
    expect(screen.getByText("Wysyłasz polski PDF.")).toBeInTheDocument();
    expect(screen.getByText("Wrzucasz fakturę w Google Translate.")).toBeInTheDocument();
    expect(screen.getByText(/My tłumaczymy tylko język/)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("renders the EN heading", () => {
    render(<OldWayComparison locale="en" />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(/We know that one/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/landing/old-way-comparison.test.tsx`
Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Write the component**, create `components/landing/old-way-comparison.tsx`:

```tsx
import { X, Check } from "lucide-react";
import { landingCopy, type LandingLocale } from "@/lib/landing/copy";

export interface OldWayComparisonProps {
  locale: LandingLocale;
}

export function OldWayComparison({ locale }: OldWayComparisonProps) {
  const t = landingCopy[locale].whyOldWay;
  return (
    <section id="dlaczego" className="bg-paper">
      <div className="mx-auto max-w-5xl px-5 py-16 md:px-8 md:py-20">
        <p className="font-dm text-[12px] font-semibold uppercase tracking-wide text-brand">{t.eyebrow}</p>
        <h2 className="mt-3 max-w-3xl font-heading text-h2x text-ink">{t.heading}</h2>

        <ul className="mt-10 space-y-3">
          {t.problems.map((p, i) => (
            <li key={i} className="flex items-start gap-4 rounded-2xl border border-line bg-paper-soft p-5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-negative/10 text-negative">
                <X className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="font-dm font-semibold text-ink">{p.action}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-copy">{p.consequence}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-start gap-4 rounded-2xl border border-brand/30 bg-brand-soft p-5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mint/15 text-mint">
            <Check className="h-4 w-4" aria-hidden="true" />
          </span>
          <p className="font-dm text-[15px] font-medium text-ink">{t.resolution}</p>
        </div>
      </div>
    </section>
  );
}

export default OldWayComparison;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/landing/old-way-comparison.test.tsx`
Expected: PASS (2 cases).

- [ ] **Step 5: Commit**

```bash
git add components/landing/old-way-comparison.tsx tests/components/landing/old-way-comparison.test.tsx
git commit -m "feat(landing-rebuild): OldWayComparison section"
```

---

## Task 3: HowItWorksSteps (Section 4)

**Files:**
- Create: `components/landing/how-it-works-steps.tsx`
- Test: `tests/components/landing/how-it-works-steps.test.tsx`

- [ ] **Step 1: Write the failing test**, create `tests/components/landing/how-it-works-steps.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HowItWorksSteps } from "@/components/landing/how-it-works-steps";

describe("<HowItWorksSteps>", () => {
  it("renders the heading, three numbered steps, and the footnote (PL)", () => {
    render(<HowItWorksSteps locale="pl" />);
    expect(screen.getByRole("heading", { level: 2, name: /Trzy kroki/ })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Wybierz język klienta." })).toBeInTheDocument();
    expect(screen.getByText("Bez instalacji, bez integracji, bez umów.")).toBeInTheDocument();
  });

  it("renders the EN heading", () => {
    render(<HowItWorksSteps locale="en" />);
    expect(screen.getByRole("heading", { level: 2, name: /Three steps/ })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/landing/how-it-works-steps.test.tsx`
Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Write the component**, create `components/landing/how-it-works-steps.tsx`:

```tsx
import { landingCopy, type LandingLocale } from "@/lib/landing/copy";

export interface HowItWorksStepsProps {
  locale: LandingLocale;
}

export function HowItWorksSteps({ locale }: HowItWorksStepsProps) {
  const t = landingCopy[locale].howItWorks;
  return (
    <section id="jak-to-dziala" className="bg-paper-soft">
      <div className="mx-auto max-w-5xl px-5 py-16 md:px-8 md:py-20">
        <p className="font-dm text-[12px] font-semibold uppercase tracking-wide text-brand">{t.eyebrow}</p>
        <h2 className="mt-3 max-w-2xl font-heading text-h2x text-ink">{t.heading}</h2>

        <ol className="mt-10 grid gap-8 md:grid-cols-3">
          {t.steps.map((s, i) => (
            <li key={i} className="flex flex-col">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft font-heading text-[18px] font-bold tabular-nums text-brand">
                {i + 1}
              </span>
              <h3 className="mt-4 font-heading text-[18px] font-semibold text-ink">{s.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-copy">{s.body}</p>
            </li>
          ))}
        </ol>

        <p className="mt-8 text-[13px] text-copy-muted">{t.footnote}</p>
      </div>
    </section>
  );
}

export default HowItWorksSteps;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/landing/how-it-works-steps.test.tsx`
Expected: PASS (2 cases).

- [ ] **Step 5: Commit**

```bash
git add components/landing/how-it-works-steps.tsx tests/components/landing/how-it-works-steps.test.tsx
git commit -m "feat(landing-rebuild): HowItWorksSteps section"
```

---

## Task 4: PreservedVsTranslated (Section 5)

**Files:**
- Create: `components/landing/preserved-vs-translated.tsx`
- Test: `tests/components/landing/preserved-vs-translated.test.tsx`

- [ ] **Step 1: Write the failing test**, create `tests/components/landing/preserved-vs-translated.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PreservedVsTranslated } from "@/components/landing/preserved-vs-translated";

describe("<PreservedVsTranslated>", () => {
  it("renders both column labels, a kept item, a translated item, and the trust line (PL)", () => {
    render(<PreservedVsTranslated locale="pl" />);
    expect(screen.getByRole("heading", { level: 2, name: /Zmienia się tylko język/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Zostaje bez zmian" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Tłumaczymy" })).toBeInTheDocument();
    expect(screen.getByText("Kod QR z KSeF")).toBeInTheDocument();
    expect(screen.getByText("Opisy towarów i usług")).toBeInTheDocument();
    expect(screen.getByText(/zgadza się z fakturą źródłową/)).toBeInTheDocument();
  });

  it("renders the EN labels", () => {
    render(<PreservedVsTranslated locale="en" />);
    expect(screen.getByRole("heading", { level: 3, name: "Stays unchanged" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "We translate" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/landing/preserved-vs-translated.test.tsx`
Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Write the component**, create `components/landing/preserved-vs-translated.tsx`:

```tsx
import { Lock, Languages } from "lucide-react";
import { landingCopy, type LandingLocale } from "@/lib/landing/copy";

export interface PreservedVsTranslatedProps {
  locale: LandingLocale;
}

export function PreservedVsTranslated({ locale }: PreservedVsTranslatedProps) {
  const t = landingCopy[locale].whatStays;
  return (
    <section id="co-zostaje" className="bg-paper">
      <div className="mx-auto max-w-5xl px-5 py-16 md:px-8 md:py-20">
        <p className="font-dm text-[12px] font-semibold uppercase tracking-wide text-brand">{t.eyebrow}</p>
        <h2 className="mt-3 max-w-2xl font-heading text-h2x text-ink">{t.heading}</h2>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-line bg-paper-soft p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink/5 text-ink">
                <Lock className="h-4 w-4" aria-hidden="true" />
              </span>
              <h3 className="font-heading text-[17px] font-semibold text-ink">{t.keptLabel}</h3>
            </div>
            <ul className="mt-4 space-y-2.5">
              {t.kept.map((k, i) => (
                <li key={i} className="flex items-center gap-2.5 text-[14px] text-copy">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink/40" aria-hidden="true" />
                  {k}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-brand/20 bg-brand-soft p-6">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <Languages className="h-4 w-4" aria-hidden="true" />
              </span>
              <h3 className="font-heading text-[17px] font-semibold text-ink">{t.translatedLabel}</h3>
            </div>
            <ul className="mt-4 space-y-2.5">
              {t.translated.map((k, i) => (
                <li key={i} className="flex items-center gap-2.5 text-[14px] text-copy">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                  {k}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-6 max-w-3xl text-[14px] leading-relaxed text-copy-muted">{t.trust}</p>
      </div>
    </section>
  );
}

export default PreservedVsTranslated;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/landing/preserved-vs-translated.test.tsx`
Expected: PASS (2 cases).

- [ ] **Step 5: Commit**

```bash
git add components/landing/preserved-vs-translated.tsx tests/components/landing/preserved-vs-translated.test.tsx
git commit -m "feat(landing-rebuild): PreservedVsTranslated section"
```

---

## Task 5: AudienceCards (Section 6)

**Files:**
- Create: `components/landing/audience-cards.tsx`
- Test: `tests/components/landing/audience-cards.test.tsx`

- [ ] **Step 1: Write the failing test**, create `tests/components/landing/audience-cards.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AudienceCards } from "@/components/landing/audience-cards";

describe("<AudienceCards>", () => {
  it("renders the heading and both lane titles (PL)", () => {
    render(<AudienceCards locale="pl" />);
    expect(screen.getByRole("heading", { level: 2, name: /czy masz jedną fakturę, czy sto/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Prowadzisz firmę i sprzedajesz za granicę" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Prowadzisz biuro rachunkowe" })).toBeInTheDocument();
  });

  it("renders the EN lane titles", () => {
    render(<AudienceCards locale="en" />);
    expect(screen.getByRole("heading", { level: 3, name: "You run a business and sell abroad" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "You run an accounting office" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/landing/audience-cards.test.tsx`
Expected: FAIL (cannot resolve module).

- [ ] **Step 3: Write the component**, create `components/landing/audience-cards.tsx`:

```tsx
import { Store, Calculator } from "lucide-react";
import { landingCopy, type LandingLocale } from "@/lib/landing/copy";

export interface AudienceCardsProps {
  locale: LandingLocale;
}

const ICONS = [Store, Calculator];

export function AudienceCards({ locale }: AudienceCardsProps) {
  const t = landingCopy[locale].builtForTwo;
  return (
    <section id="dla-kogo" className="bg-paper-soft">
      <div className="mx-auto max-w-5xl px-5 py-16 md:px-8 md:py-20">
        <p className="font-dm text-[12px] font-semibold uppercase tracking-wide text-brand">{t.eyebrow}</p>
        <h2 className="mt-3 max-w-2xl font-heading text-h2x text-ink">{t.heading}</h2>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {t.lanes.map((lane, i) => {
            const Icon = ICONS[i] ?? Store;
            return (
              <div key={i} className="rounded-2xl border border-line bg-paper p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-heading text-[18px] font-semibold text-ink">{lane.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-copy">{lane.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default AudienceCards;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/landing/audience-cards.test.tsx`
Expected: PASS (2 cases).

- [ ] **Step 5: Commit**

```bash
git add components/landing/audience-cards.tsx tests/components/landing/audience-cards.test.tsx
git commit -m "feat(landing-rebuild): AudienceCards section"
```

---

## Task 6: Wire the four sections + E2E + verification

**Files:**
- Modify: `components/landing/landing-rebuild.tsx`
- Modify: `tests/components/landing/landing-rebuild.test.tsx`
- Modify: `tests/e2e/landing-rebuild-preview.spec.ts`

- [ ] **Step 1: Update the composition test**, add this assertion inside the existing `it("renders the nav, final CTA, footer, and the section anchors", …)` test body in `tests/components/landing/landing-rebuild.test.tsx` (after the existing assertions):

```tsx
    // the four explainer sections now render real content (their level-2 headings)
    expect(screen.getByRole("heading", { level: 2, name: /Trzy kroki/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /Zmienia się tylko język/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /czy masz jedną fakturę/ })).toBeInTheDocument();
```

- [ ] **Step 2: Run the composition test to verify it fails**

Run: `npx vitest run tests/components/landing/landing-rebuild.test.tsx`
Expected: FAIL (those headings do not render yet; the sections are empty placeholders).

- [ ] **Step 3: Wire the sections in.** In `components/landing/landing-rebuild.tsx`: import the four sections, remove `"dlaczego"`, `"jak-to-dziala"`, `"co-zostaje"`, `"dla-kogo"` from `SECTION_IDS`, and render the four components in order after the hero:

```tsx
import type { LandingLocale } from "@/lib/landing/copy";
import { SiteNav } from "@/components/landing/site-nav";
import { Hero } from "@/components/landing/hero";
import { OldWayComparison } from "@/components/landing/old-way-comparison";
import { HowItWorksSteps } from "@/components/landing/how-it-works-steps";
import { PreservedVsTranslated } from "@/components/landing/preserved-vs-translated";
import { AudienceCards } from "@/components/landing/audience-cards";
import { FinalCta } from "@/components/landing/final-cta";
import { SiteFooter } from "@/components/landing/site-footer";

export interface LandingRebuildProps {
  locale: LandingLocale;
}

/** Section ids still reserved for later sprints (demo, pricing, faq). */
const SECTION_IDS = ["demo", "cennik", "faq"] as const;

export function LandingRebuild({ locale }: LandingRebuildProps) {
  return (
    <div className="flex min-h-screen flex-col bg-paper font-dm text-copy">
      <SiteNav locale={locale} />
      <main className="flex-1">
        <Hero locale={locale} />
        <section id="demo" aria-hidden="true" />
        <OldWayComparison locale={locale} />
        <HowItWorksSteps locale={locale} />
        <PreservedVsTranslated locale={locale} />
        <AudienceCards locale={locale} />
        <section id="cennik" aria-hidden="true" />
        <section id="faq" aria-hidden="true" />
      </main>
      <FinalCta locale={locale} />
      <SiteFooter locale={locale} />
    </div>
  );
}

export default LandingRebuild;
```

(The `SECTION_IDS` constant is now only used for documentation of the remaining placeholders; the empty `<section>`s are rendered explicitly in the right order so the page flows hero, demo placeholder, the four sections, pricing placeholder, faq placeholder. Keeping `SECTION_IDS` exported-as-const is optional; if it causes an unused-variable lint error, render the three placeholder `<section>`s inline as shown and delete the `SECTION_IDS` constant.)

- [ ] **Step 3b: Resolve the unused-constant risk.** Since the placeholders are now rendered inline, `SECTION_IDS` is unused. Delete the `const SECTION_IDS = [...]` line and its doc comment to avoid an ESLint `no-unused-vars` error. The three placeholder `<section id="demo|cennik|faq">` elements are already rendered inline in Step 3.

- [ ] **Step 4: Run the composition test to verify it passes**

Run: `npx vitest run tests/components/landing/landing-rebuild.test.tsx`
Expected: PASS (1 case).

- [ ] **Step 5: Add E2E section assertions.** Append to `tests/e2e/landing-rebuild-preview.spec.ts`:

```ts
test("renders the four explainer sections in order", async ({ page }) => {
  await page.goto("/landing-preview");
  await expect(page.getByText("Wysyłasz polski PDF.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /Trzy kroki/ })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Zostaje bez zmian" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: "Prowadzisz biuro rachunkowe" })).toBeVisible();
});
```

- [ ] **Step 6: Run the E2E**

Run: `npm run test:e2e -- landing-rebuild-preview`
Expected: PASS (existing + the new section test).

- [ ] **Step 7: Full verification**

Run: `npx vitest run tests/components/landing tests/integration/lib tests/styles/landing-tokens.test.ts`
Expected: all green.

Run: `npm run typecheck && npm run lint && npm run check:mf-labels`
Expected: no new typecheck errors, lint clean, MF labels pass.

- [ ] **Step 8: Commit**

```bash
git add components/landing/landing-rebuild.tsx tests/components/landing/landing-rebuild.test.tsx tests/e2e/landing-rebuild-preview.spec.ts
git commit -m "feat(landing-rebuild): wire the four explainer sections into the page"
```

- [ ] **Step 9: Controller-owned manual check.** The controller verifies live at `/landing-preview`: the four sections render in order with the correct alternating backgrounds (hero white, comparison white, how-it-works paper-soft, what-stays white, built-for-two paper-soft), the comparison red x marks and the indigo resolution, the numbered steps, the two-column kept/translated split, the two audience cards, all readable with no overflow at 360 / 768 / 1024 / 1440.

---

## Self-review notes (author)

- **Spec coverage:** why-old-way comparison (content §4.3, visual §3 Section 3 -> Tasks 1, 2), how-it-works (content §4.4, visual §3 Section 4 -> Tasks 1, 3), what-stays-exact (content §4.5, visual §3 Section 5 -> Tasks 1, 4), built-for-two (content §4.6, visual §3 Section 6 -> Tasks 1, 5), wiring + background rhythm (visual §2 -> Task 6). The demo, pricing, and FAQ remain placeholders for later sprints, as scoped.
- **Background rhythm:** hero (white) -> demo placeholder (no bg, transparent) -> comparison (white) -> how-it-works (paper-soft) -> what-stays (white) -> built-for-two (paper-soft) -> pricing placeholder -> faq placeholder -> final CTA (dark). Two white sections sit adjacent (hero + comparison) only because the demo placeholder between them is an empty zero-height section; once the demo (paper-soft) is built, the alternation completes.
- **A11y:** every section has one `<h2>`; sub-cards use `<h3>`; the page keeps a single `<h1>` (hero); all icons are `aria-hidden`; the comparison uses both a red x AND text (color is not the only signal). Section eyebrows are plain uppercase brand labels (hierarchy below the hero pill).
- **Type consistency:** the four copy groups (`whyOldWay`, `howItWorks`, `whatStays`, `builtForTwo`) are added to both locales with identical shapes; each component reads `landingCopy[locale].<group>` with the keys defined in Task 1. All four components share the `{ locale: LandingLocale }` prop shape.
- **No placeholders / no dashes:** every component and test has complete code; the copy uses Polish typographic quotes and straight apostrophes, never em or en dashes (the existing no-dash copy test enforces it).
- **No interactivity:** all four are server components with no client state, no links, no `next/link` (so their tests need no mocks).
