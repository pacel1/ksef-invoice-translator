# Landing Demo Sprint A (Lane 1 reveal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the empty `#demo` placeholder on the rebuilt landing with an instant, in browser sample reveal: a faithful KSeF FA(3) export invoice that re renders in six languages as the visitor taps language chips, on the `/landing-preview` route only.

**Architecture:** A new client `DemoSection` holds the selected language in state and feeds a scaled, watermarked `InvoiceStage` that reuses the existing `components/invoice-preview.tsx`. The invoice data comes from a static `lib/landing/demo-sample.ts` (a hand authored `Invoice` literal plus per language free text overlays), so the reveal needs no network and no LLM. A real KSeF FA(3) XML asset is shipped and validated by the parser for use by later sprints (the gated PDF). The download gate (Sprint B) and the upload lane (Sprint C) are out of scope here; Sprint A ends with a single CTA to `/login`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, TailwindCSS, Vitest + Testing Library (jsdom), Playwright. Reuses `parseKsefXml` (`lib/xml/parser.ts`), `InvoicePreview` (`components/invoice-preview.tsx`), the `Invoice`/`LanguageCode` types (`types/invoice.ts`), the `cn` helper (`lib/utils`), and design tokens already in `tailwind.config.ts` (`ink`, `brand`, `paper`, `line`, fonts `font-heading`/`font-dm`, keyframes `bob`/`showcase-scan`).

**Branch:** `claude/landing-demo` (already created off `main`). One PR for this sprint.

**Note on the spec:** This plan supersedes the spec's "UK" baked language with **CS (Czech)**, because Ukrainian is not a member of the `LanguageCode` union in `types/invoice.ts`. The spec file is updated to match.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `public/sample-data/demo-fa3-export.xml` (create) | The faithful KSeF FA(3) export invoice asset (validated by the parser; used by later sprints for the PDF). |
| `lib/landing/demo-sample.ts` (create) | The `Invoice` literal that drives the preview, the six language free text overlays, `DEMO_LANGS`, `DemoLang`, and `buildDemoInvoice(lang)`. |
| `lib/landing/copy.ts` (modify) | Add a `demo` copy group (pl + en, no em or en dashes). |
| `components/landing/demo/language-chips.tsx` (create) | The chip row: real buttons, `aria-pressed`, calls back with the chosen `DemoLang`. |
| `components/landing/demo/invoice-stage.tsx` (create) | Scaled, watermarked preview frame; swap shimmer on language change; reduced motion safe. |
| `components/landing/demo/demo-section.tsx` (create) | The dark stage shell: eyebrow/heading/sub, chips, stage, privacy caption, CTA. Owns the language state. |
| `components/landing/landing-rebuild.tsx` (modify) | Replace the `#demo` placeholder with `<DemoSection>`. |
| `tests/integration/lib/demo-sample.test.ts` (create) | Parser validates the XML asset; baked data integrity. |
| `tests/integration/lib/landing-copy.test.ts` (modify) | Assert the `demo` copy group exists on both locales. |
| `tests/components/landing/language-chips.test.tsx` (create) | Chips render, set `aria-pressed`, fire `onChange`. |
| `tests/components/landing/demo-section.test.tsx` (create) | Default EN, switching a chip changes a visible translated item name, reduced motion path. |
| `tests/e2e/landing-rebuild-preview.spec.ts` (modify) | The demo section renders and a chip switch changes a visible label. |

---

## Task 1: The KSeF FA(3) sample asset and its parser test

**Files:**
- Create: `public/sample-data/demo-fa3-export.xml`
- Test: `tests/integration/lib/demo-sample.test.ts`

- [ ] **Step 1: Write the failing parser test**

Create `tests/integration/lib/demo-sample.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseKsefXml } from "@/lib/xml/parser";

const xml = readFileSync(
  join(process.cwd(), "public/sample-data/demo-fa3-export.xml"),
  "utf8"
);

describe("demo-fa3-export.xml", () => {
  it("parses cleanly as a KSeF FA(3) invoice", () => {
    const result = parseKsefXml(xml);
    expect(result.ok).toBe(true);
  });

  it("carries the expected export-invoice values", () => {
    const result = parseKsefXml(xml);
    if (!result.ok) throw new Error(result.error);
    const inv = result.invoice;
    expect(inv.invoiceNumber).toBe("FV 2026/05/0142");
    expect(inv.currency).toBe("EUR");
    expect(inv.seller.vatId).toBe("7811924557");
    expect(inv.buyer.vatId).toBe("DE811569244");
    expect(inv.items).toHaveLength(3);
    expect(inv.totals.net).toBe(10200);
    expect(inv.totals.vat).toBe(0);
    expect(inv.totals.gross).toBe(10200);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/integration/lib/demo-sample.test.ts`
Expected: FAIL (ENOENT: the XML file does not exist yet).

- [ ] **Step 3: Create the XML asset**

Create `public/sample-data/demo-fa3-export.xml`. It mirrors the structure of the shipped `public/sample-data/sample-fa3-invoice.xml` (known to parse), with export values, a 0 percent (WDT) rate, a `DodatkowyOpis` legal note, and a `Stopka` footer. Use real Polish diacritics exactly as shown:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Faktura xmlns="http://crd.gov.pl/wzor/2025/06/25/13775/">
  <Naglowek>
    <KodFormularza kodSystemowy="FA (3)" wersjaSchemy="1-0E">FA</KodFormularza>
    <WariantFormularza>3</WariantFormularza>
    <DataWytworzeniaFa>2026-05-12T09:12:00Z</DataWytworzeniaFa>
    <SystemInfo>TlumaczKSeF Demo</SystemInfo>
  </Naglowek>
  <Podmiot1>
    <DaneIdentyfikacyjne>
      <NIP>7811924557</NIP>
      <Nazwa>Meble Dębowe Nowak Sp. z o.o.</Nazwa>
    </DaneIdentyfikacyjne>
    <Adres>
      <KodKraju>PL</KodKraju>
      <AdresL1>ul. Przemysłowa 14</AdresL1>
      <AdresL2>61-001 Poznań</AdresL2>
    </Adres>
  </Podmiot1>
  <Podmiot2>
    <DaneIdentyfikacyjne>
      <NIP>DE811569244</NIP>
      <Nazwa>Holzkontor Brandt GmbH</Nazwa>
    </DaneIdentyfikacyjne>
    <Adres>
      <KodKraju>DE</KodKraju>
      <AdresL1>Chausseestraße 22</AdresL1>
      <AdresL2>10115 Berlin</AdresL2>
    </Adres>
  </Podmiot2>
  <Fa>
    <KodWaluty>EUR</KodWaluty>
    <P_1>2026-05-12</P_1>
    <P_1M>Poznań</P_1M>
    <P_2>FV 2026/05/0142</P_2>
    <P_6>2026-05-12</P_6>
    <P_13_1>10200.00</P_13_1>
    <P_14_1>0.00</P_14_1>
    <P_15>10200.00</P_15>
    <RodzajFaktury>VAT</RodzajFaktury>
    <DodatkowyOpis>
      <Klucz>Podstawa zastosowania stawki 0%</Klucz>
      <Wartosc>Wewnątrzwspólnotowa dostawa towarów, stawka 0% (art. 42 ust. 1 ustawy o VAT)</Wartosc>
    </DodatkowyOpis>
    <FaWiersz>
      <NrWierszaFa>1</NrWierszaFa>
      <P_7>Stół dębowy „Helena” 180 cm</P_7>
      <P_8A>szt</P_8A>
      <P_8B>12</P_8B>
      <P_9A>420.00</P_9A>
      <P_11>5040.00</P_11>
      <P_12>0</P_12>
    </FaWiersz>
    <FaWiersz>
      <NrWierszaFa>2</NrWierszaFa>
      <P_7>Krzesło dębowe „Helena”</P_7>
      <P_8A>szt</P_8A>
      <P_8B>48</P_8B>
      <P_9A>95.00</P_9A>
      <P_11>4560.00</P_11>
      <P_12>0</P_12>
    </FaWiersz>
    <FaWiersz>
      <NrWierszaFa>3</NrWierszaFa>
      <P_7>Transport i pakowanie</P_7>
      <P_8A>usł</P_8A>
      <P_8B>1</P_8B>
      <P_9A>600.00</P_9A>
      <P_11>600.00</P_11>
      <P_12>0</P_12>
    </FaWiersz>
  </Fa>
  <Platnosc>
    <TerminPlatnosci>2026-05-26</TerminPlatnosci>
    <FormaPlatnosci>przelew bankowy</FormaPlatnosci>
    <NrRB>PL61109010140000071219812874</NrRB>
  </Platnosc>
  <Stopka>
    <Informacje>
      <StopkaFaktury>Kapitał zakładowy 200 000 zł</StopkaFaktury>
    </Informacje>
    <Rejestry>
      <KRS>0000412857</KRS>
      <REGON>302419773</REGON>
      <BDO>000158472</BDO>
    </Rejestry>
  </Stopka>
</Faktura>
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run tests/integration/lib/demo-sample.test.ts`
Expected: PASS for both cases. If the parser maps a field differently (for example `totals.net`), adjust the XML numeric fields so the asserted values hold; do not change the assertions, since they define the contract Sprint B/C depend on.

- [ ] **Step 5: Commit**

```bash
git add public/sample-data/demo-fa3-export.xml tests/integration/lib/demo-sample.test.ts
git commit -m "feat(landing-demo): faithful KSeF FA(3) sample asset + parser test"
```

---

## Task 2: The demo sample module (preview data + language overlays)

**Files:**
- Create: `lib/landing/demo-sample.ts`
- Test: `tests/integration/lib/demo-sample.test.ts` (extend)

- [ ] **Step 1: Add the failing integrity test**

Append to `tests/integration/lib/demo-sample.test.ts`:

```typescript
import {
  DEMO_LANGS,
  DEMO_DEFAULT_LANG,
  DEMO_SAMPLE_INVOICE,
  buildDemoInvoice
} from "@/lib/landing/demo-sample";

describe("demo-sample baked data", () => {
  it("exposes six languages with EN as the default", () => {
    expect(DEMO_LANGS.map((l) => l.code)).toEqual(["en", "de", "fr", "es", "it", "cs"]);
    expect(DEMO_DEFAULT_LANG).toBe("en");
    for (const lang of DEMO_LANGS) {
      expect(lang.label).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("keeps every preserved field byte-identical across all languages", () => {
    const base = DEMO_SAMPLE_INVOICE;
    for (const { code } of DEMO_LANGS) {
      const inv = buildDemoInvoice(code);
      expect(inv.invoiceNumber).toBe(base.invoiceNumber);
      expect(inv.seller.vatId).toBe(base.seller.vatId);
      expect(inv.buyer.vatId).toBe(base.buyer.vatId);
      expect(inv.issueDate).toBe(base.issueDate);
      expect(inv.saleDate).toBe(base.saleDate);
      expect(inv.totals).toEqual(base.totals);
      expect(inv.verification?.ksefNumber).toBe(base.verification?.ksefNumber);
      expect(inv.payment?.bankAccounts?.[0]?.accountNumber).toBe(
        base.payment?.bankAccounts?.[0]?.accountNumber
      );
      expect(inv.items.map((i) => i.netValue)).toEqual(base.items.map((i) => i.netValue));
    }
  });

  it("translates the free text per language without mutating the base", () => {
    const en = buildDemoInvoice("en");
    const de = buildDemoInvoice("de");
    expect(en.items[1].translatedName).toBe("Oak chair „Helena”");
    expect(de.items[1].translatedName).toBe("Eichenstuhl „Helena”");
    expect(en.footer?.translatedText).toBe("Share capital PLN 200,000");
    // base stays untranslated (immutability)
    expect(DEMO_SAMPLE_INVOICE.items[1].translatedName).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/integration/lib/demo-sample.test.ts`
Expected: FAIL (cannot resolve `@/lib/landing/demo-sample`).

- [ ] **Step 3: Create the module**

Create `lib/landing/demo-sample.ts`:

```typescript
import type { Invoice } from "@/types/invoice";

/**
 * Static data for the landing live demo (Lane 1). The base invoice drives the
 * on screen preview; per language overlays carry only the translated free text
 * (item names, units, the 0% WDT legal note, footer text). Structural labels are
 * localized by InvoicePreview itself via getLabels(language), so they are not baked
 * here. Numbers, IDs, IBAN, dates and the KSeF id never change between languages.
 */
export type DemoLang = "en" | "de" | "fr" | "es" | "it" | "cs";

export const DEMO_LANGS: { code: DemoLang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "de", label: "DE" },
  { code: "fr", label: "FR" },
  { code: "es", label: "ES" },
  { code: "it", label: "IT" },
  { code: "cs", label: "CS" }
];

export const DEMO_DEFAULT_LANG: DemoLang = "en";

/** Polish source invoice, hand authored to the Invoice type, untranslated. */
export const DEMO_SAMPLE_INVOICE: Invoice = {
  invoiceNumber: "FV 2026/05/0142",
  invoiceType: "VAT",
  invoiceTypeLabel: "Faktura podstawowa",
  issueDate: "2026-05-12",
  saleDate: "2026-05-12",
  currency: "EUR",
  seller: {
    name: "Meble Dębowe Nowak Sp. z o.o.",
    vatId: "7811924557",
    address: "ul. Przemysłowa 14, 61-001 Poznań, PL"
  },
  buyer: {
    name: "Holzkontor Brandt GmbH",
    vatId: "DE811569244",
    address: "Chausseestraße 22, 10115 Berlin, DE"
  },
  items: [
    { name: "Stół dębowy „Helena” 180 cm", quantity: 12, unit: "szt", unitPrice: 420, netValue: 5040, vatRate: "0", grossValue: 5040 },
    { name: "Krzesło dębowe „Helena”", quantity: 48, unit: "szt", unitPrice: 95, netValue: 4560, vatRate: "0", grossValue: 4560 },
    { name: "Transport i pakowanie", quantity: 1, unit: "usł", unitPrice: 600, netValue: 600, vatRate: "0", grossValue: 600 }
  ],
  totals: { net: 10200, vat: 0, gross: 10200 },
  payment: {
    dueDate: "2026-05-26",
    status: "unpaid",
    bankAccounts: [
      { accountNumber: "PL61 1090 1014 0000 0712 1981 2874", bankName: "Santander Bank Polska", swift: "WBKPPLPP" }
    ]
  },
  additionalDescriptions: [
    { key: "Podstawa zastosowania stawki 0%", value: "Wewnątrzwspólnotowa dostawa towarów, stawka 0% (art. 42 ust. 1 ustawy o VAT)" }
  ],
  footer: {
    text: "Kapitał zakładowy 200 000 zł",
    registry: { fullName: "Meble Dębowe Nowak Sp. z o.o.", krs: "0000412857", regon: "302419773", bdo: "000158472" }
  },
  verification: {
    ksefNumber: "7811924557-20260512-FA1A2B3C4D5E-7F",
    qrLink: "https://ksef.mf.gov.pl/web/verify/7811924557-20260512-FA1A2B3C4D5E-7F"
  }
};

interface DemoOverlay {
  itemNames: [string, string, string];
  itemUnits: [string, string, string];
  noteKey: string;
  noteValue: string;
  footerText: string;
}

const DEMO_OVERLAYS: Record<DemoLang, DemoOverlay> = {
  en: {
    itemNames: ["Oak dining table „Helena” 180 cm", "Oak chair „Helena”", "Delivery and packaging"],
    itemUnits: ["pcs", "pcs", "svc"],
    noteKey: "Basis for applying the 0% rate",
    noteValue: "Intra-Community supply of goods, 0% rate (Art. 42(1) of the VAT Act)",
    footerText: "Share capital PLN 200,000"
  },
  de: {
    itemNames: ["Eichen-Esstisch „Helena” 180 cm", "Eichenstuhl „Helena”", "Lieferung und Verpackung"],
    itemUnits: ["Stk", "Stk", "Lstg."],
    noteKey: "Grundlage für die Anwendung des Nullsatzes",
    noteValue: "Innergemeinschaftliche Lieferung von Gegenständen, 0%-Satz (Art. 42 Abs. 1 des poln. UStG)",
    footerText: "Stammkapital 200.000 PLN"
  },
  fr: {
    itemNames: ["Table à manger en chêne « Helena » 180 cm", "Chaise en chêne « Helena »", "Livraison et emballage"],
    itemUnits: ["pce", "pce", "prest."],
    noteKey: "Base d'application du taux de 0 %",
    noteValue: "Livraison intracommunautaire de biens, taux de 0 % (art. 42 al. 1 de la loi sur la TVA)",
    footerText: "Capital social 200 000 PLN"
  },
  es: {
    itemNames: ["Mesa de comedor de roble «Helena» 180 cm", "Silla de roble «Helena»", "Entrega y embalaje"],
    itemUnits: ["uds", "uds", "serv."],
    noteKey: "Base para aplicar el tipo del 0%",
    noteValue: "Entrega intracomunitaria de bienes, tipo del 0% (art. 42.1 de la Ley del IVA)",
    footerText: "Capital social 200 000 PLN"
  },
  it: {
    itemNames: ["Tavolo da pranzo in rovere “Helena” 180 cm", "Sedia in rovere “Helena”", "Consegna e imballaggio"],
    itemUnits: ["pz", "pz", "serv."],
    noteKey: "Base per l'applicazione dell'aliquota 0%",
    noteValue: "Cessione intracomunitaria di beni, aliquota 0% (art. 42 c. 1 della legge IVA)",
    footerText: "Capitale sociale 200.000 PLN"
  },
  cs: {
    itemNames: ["Dubový jídelní stůl „Helena” 180 cm", "Dubová židle „Helena”", "Doprava a balení"],
    itemUnits: ["ks", "ks", "sl."],
    noteKey: "Důvod použití nulové sazby",
    noteValue: "Dodání zboží do jiného členského státu, sazba 0 % (čl. 42 odst. 1 zákona o DPH)",
    footerText: "Základní kapitál 200 000 PLN"
  }
};

/** Returns a new Invoice with free text translated for the language. Never mutates the base. */
export function buildDemoInvoice(lang: DemoLang): Invoice {
  const o = DEMO_OVERLAYS[lang];
  return {
    ...DEMO_SAMPLE_INVOICE,
    items: DEMO_SAMPLE_INVOICE.items.map((item, i) => ({
      ...item,
      translatedName: o.itemNames[i],
      translatedUnit: o.itemUnits[i]
    })),
    additionalDescriptions: DEMO_SAMPLE_INVOICE.additionalDescriptions?.map((d) => ({
      ...d,
      translatedKey: o.noteKey,
      translatedValue: o.noteValue
    })),
    footer: DEMO_SAMPLE_INVOICE.footer
      ? { ...DEMO_SAMPLE_INVOICE.footer, translatedText: o.footerText }
      : undefined
  };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run tests/integration/lib/demo-sample.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/landing/demo-sample.ts tests/integration/lib/demo-sample.test.ts
git commit -m "feat(landing-demo): demo-sample preview data + language overlays"
```

---

## Task 3: The demo copy group

**Files:**
- Modify: `lib/landing/copy.ts`
- Test: `tests/integration/lib/landing-copy.test.ts`

- [ ] **Step 1: Add the failing copy test**

Add this `it` block inside the `describe("landingCopy", ...)` in `tests/integration/lib/landing-copy.test.ts`:

```typescript
  it("has a demo group on both locales", () => {
    for (const loc of [landingCopy.pl, landingCopy.en]) {
      expect(loc.demo.eyebrow).toBeTruthy();
      expect(loc.demo.heading).toBeTruthy();
      expect(loc.demo.sub).toBeTruthy();
      expect(loc.demo.watermark).toBeTruthy();
      expect(loc.demo.languagesLabel).toBeTruthy();
      expect(loc.demo.privacy).toBeTruthy();
      expect(loc.demo.cta).toBeTruthy();
      expect(loc.demo.ctaHref).toMatch(/login/);
      expect(loc.demo.moreLabel).toBeTruthy();
    }
  });
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/integration/lib/landing-copy.test.ts`
Expected: FAIL (`loc.demo` is undefined). The existing "no em or en dashes" test will keep passing and will automatically cover the new strings (it stringifies the whole object).

- [ ] **Step 3: Add the `demo` group to both locales**

In `lib/landing/copy.ts`, add a `demo` key inside the `pl` object (next to `hero`, before `whyOldWay`):

```typescript
    demo: {
      eyebrow: "Demo na żywo",
      heading: "Zobacz swoją fakturę w innym języku",
      sub: "Wybierz język i zobacz tłumaczenie od razu. Liczby, NIP, IBAN i kwoty zostają takie same.",
      watermark: "PODGLĄD",
      languagesLabel: "Język",
      moreLabel: "+ więcej",
      moreHref: "/login",
      privacy: "Nie przechowujemy Twojej faktury.",
      cta: "Przetłumacz swoją fakturę",
      ctaHref: "/login"
    },
```

And the matching `demo` key inside the `en` object:

```typescript
    demo: {
      eyebrow: "Live demo",
      heading: "See your invoice in another language",
      sub: "Pick a language and see the translation right away. Numbers, tax IDs, IBAN and amounts stay exactly the same.",
      watermark: "PREVIEW",
      languagesLabel: "Language",
      moreLabel: "+ more",
      moreHref: "/login",
      privacy: "We do not store your invoice.",
      cta: "Translate your invoice",
      ctaHref: "/login"
    },
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run tests/integration/lib/landing-copy.test.ts`
Expected: PASS (including the unchanged dash and locale-key-parity tests).

- [ ] **Step 5: Commit**

```bash
git add lib/landing/copy.ts tests/integration/lib/landing-copy.test.ts
git commit -m "feat(landing-demo): demo section copy (pl + en)"
```

---

## Task 4: The language chips

**Files:**
- Create: `components/landing/demo/language-chips.tsx`
- Test: `tests/components/landing/language-chips.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/landing/language-chips.test.tsx`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LanguageChips } from "@/components/landing/demo/language-chips";

describe("<LanguageChips>", () => {
  it("renders a button per demo language and marks the active one", () => {
    render(<LanguageChips value="en" onChange={() => {}} label="Language" />);
    for (const code of ["EN", "DE", "FR", "ES", "IT", "CS"]) {
      expect(screen.getByRole("button", { name: code })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "EN" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "DE" })).toHaveAttribute("aria-pressed", "false");
  });

  it("fires onChange with the chosen language code", () => {
    const onChange = vi.fn();
    render(<LanguageChips value="en" onChange={onChange} label="Language" />);
    fireEvent.click(screen.getByRole("button", { name: "DE" }));
    expect(onChange).toHaveBeenCalledWith("de");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/components/landing/language-chips.test.tsx`
Expected: FAIL (cannot resolve the component).

- [ ] **Step 3: Implement the component**

Create `components/landing/demo/language-chips.tsx`:

```tsx
"use client";

import { DEMO_LANGS, type DemoLang } from "@/lib/landing/demo-sample";
import { cn } from "@/lib/utils";

export interface LanguageChipsProps {
  value: DemoLang;
  onChange: (lang: DemoLang) => void;
  label: string;
}

export function LanguageChips({ value, onChange, label }: LanguageChipsProps) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center justify-center gap-2">
      {DEMO_LANGS.map(({ code, label: chip }) => {
        const active = code === value;
        return (
          <button
            key={code}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(code)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ink",
              active
                ? "bg-brand text-white"
                : "border border-[#26314a] bg-ink-panel text-[#aab3c5] hover:text-white"
            )}
          >
            {chip}
          </button>
        );
      })}
    </div>
  );
}

export default LanguageChips;
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run tests/components/landing/language-chips.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/landing/demo/language-chips.tsx tests/components/landing/language-chips.test.tsx
git commit -m "feat(landing-demo): language chips"
```

---

## Task 5: The invoice stage (scaled, watermarked, animated)

**Files:**
- Create: `components/landing/demo/invoice-stage.tsx`
- Test: covered by the demo-section test in Task 6 (the stage has no standalone branching beyond reduced motion, which is exercised there).

- [ ] **Step 1: Implement the component**

Create `components/landing/demo/invoice-stage.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { InvoicePreview } from "@/components/invoice-preview";
import { buildDemoInvoice, type DemoLang } from "@/lib/landing/demo-sample";
import { cn } from "@/lib/utils";

export interface InvoiceStageProps {
  lang: DemoLang;
  watermark: string;
}

/**
 * Renders the demo invoice scaled to fit the dark stage. The full A4 preview is
 * 794px wide; we scale it down and clip the height, fading out the bottom. On a
 * language change we play a brief shimmer, unless the user prefers reduced motion.
 */
export function InvoiceStage({ lang, watermark }: InvoiceStageProps) {
  const [swapping, setSwapping] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    setSwapping(true);
    const t = setTimeout(() => setSwapping(false), 180);
    return () => clearTimeout(t);
  }, [lang]);

  return (
    <div className="relative mx-auto w-full max-w-[460px]">
      <div className="relative overflow-hidden rounded-2xl border border-[#26314a] bg-white shadow-raised" style={{ height: 560 }}>
        {/* scaled A4 preview; decorative, the chips + copy carry the meaning */}
        <div
          aria-hidden="true"
          className={cn("origin-top transition-opacity duration-150", swapping ? "opacity-0" : "opacity-100")}
          style={{ width: 794, transform: "scale(0.58)", transformOrigin: "top left" }}
        >
          <InvoicePreview invoice={buildDemoInvoice(lang)} language={lang} bilingual={false} translated />
        </div>

        {/* swap shimmer, replays on language change */}
        <div
          aria-hidden="true"
          key={lang}
          className="pointer-events-none absolute inset-x-0 top-0 h-2/3 motion-safe:animate-showcase-scan"
          style={{ background: "linear-gradient(180deg, transparent, rgba(79,70,229,0.10) 60%, rgba(139,92,246,0.18))" }}
        />

        {/* bottom fade so the clipped page edge reads as intentional */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent" />

        {/* watermark */}
        <span className="pointer-events-none absolute right-4 top-3 text-[10px] font-bold tracking-[0.2em] text-slate-300">
          {watermark}
        </span>
      </div>
    </div>
  );
}

export default InvoiceStage;
```

- [ ] **Step 2: Typecheck the new file**

Run: `npx tsc --noEmit`
Expected: no new errors from `components/landing/demo/invoice-stage.tsx`. (Pre-existing Sanity/blog typecheck errors are unrelated and may remain.)

- [ ] **Step 3: Commit**

```bash
git add components/landing/demo/invoice-stage.tsx
git commit -m "feat(landing-demo): scaled, watermarked invoice stage"
```

---

## Task 6: The demo section (composition + state)

**Files:**
- Create: `components/landing/demo/demo-section.tsx`
- Test: `tests/components/landing/demo-section.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/landing/demo-section.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DemoSection } from "@/components/landing/demo/demo-section";

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

beforeEach(() => mockMatchMedia(false));

describe("<DemoSection>", () => {
  it("renders the dark demo stage with the heading and the default English invoice", () => {
    render(<DemoSection locale="pl" />);
    expect(
      screen.getByRole("heading", { level: 2, name: "Zobacz swoją fakturę w innym języku" })
    ).toBeInTheDocument();
    expect(screen.getByText('Oak chair „Helena”')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "EN" })).toHaveAttribute("aria-pressed", "true");
  });

  it("re renders the invoice in the chosen language when a chip is clicked", () => {
    render(<DemoSection locale="pl" />);
    fireEvent.click(screen.getByRole("button", { name: "DE" }));
    expect(screen.getByText('Eichenstuhl „Helena”')).toBeInTheDocument();
    expect(screen.queryByText('Oak chair „Helena”')).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "DE" })).toHaveAttribute("aria-pressed", "true");
  });

  it("links the primary CTA to /login", () => {
    render(<DemoSection locale="pl" />);
    expect(screen.getByRole("link", { name: "Przetłumacz swoją fakturę" })).toHaveAttribute("href", "/login");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npx vitest run tests/components/landing/demo-section.test.tsx`
Expected: FAIL (cannot resolve the component).

- [ ] **Step 3: Implement the component**

Create `components/landing/demo/demo-section.tsx`:

```tsx
"use client";

import { useState } from "react";
import { landingCopy, type LandingLocale } from "@/lib/landing/copy";
import { DEMO_DEFAULT_LANG, type DemoLang } from "@/lib/landing/demo-sample";
import { LanguageChips } from "@/components/landing/demo/language-chips";
import { InvoiceStage } from "@/components/landing/demo/invoice-stage";

export interface DemoSectionProps {
  locale: LandingLocale;
}

export function DemoSection({ locale }: DemoSectionProps) {
  const t = landingCopy[locale].demo;
  const [lang, setLang] = useState<DemoLang>(DEMO_DEFAULT_LANG);

  return (
    <section id="demo" className="bg-ink">
      <div className="mx-auto max-w-5xl px-5 py-20 md:px-8 md:py-24">
        <div className="text-center">
          <p className="font-dm text-[12px] font-semibold uppercase tracking-wide text-[#a5b4fc]">{t.eyebrow}</p>
          <h2 className="mx-auto mt-3 max-w-2xl font-heading text-h2x text-white">{t.heading}</h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-[#aab3c5]">{t.sub}</p>
        </div>

        <div className="mt-9 flex items-center justify-center gap-2">
          <LanguageChips value={lang} onChange={setLang} label={t.languagesLabel} />
          <a
            href={t.moreHref}
            className="rounded-full border border-[#26314a] bg-ink-panel px-3.5 py-1.5 text-[12px] font-semibold text-[#aab3c5] transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          >
            {t.moreLabel}
          </a>
        </div>

        <div className="mt-9">
          <InvoiceStage lang={lang} watermark={t.watermark} />
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <a
            href={t.ctaHref}
            className="inline-flex items-center justify-center rounded-xl bg-brand px-6 py-3 text-[15px] font-semibold text-white shadow-brand transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          >
            {t.cta}
          </a>
          <p className="flex items-center gap-2 text-[13px] text-[#8a93a6]">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-mint" aria-hidden="true" />
            {t.privacy}
          </p>
        </div>
      </div>
    </section>
  );
}

export default DemoSection;
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run tests/components/landing/demo-section.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/landing/demo/demo-section.tsx tests/components/landing/demo-section.test.tsx
git commit -m "feat(landing-demo): demo section composition + language state"
```

---

## Task 7: Wire into the page, extend e2e, and verify

**Files:**
- Modify: `components/landing/landing-rebuild.tsx`
- Test: `tests/e2e/landing-rebuild-preview.spec.ts`

- [ ] **Step 1: Replace the placeholder**

In `components/landing/landing-rebuild.tsx`, add the import near the other landing imports:

```typescript
import { DemoSection } from "@/components/landing/demo/demo-section";
```

Then replace these two lines:

```tsx
        {/* Reserved placeholder for the demo sprint */}
        <section id="demo" aria-hidden="true" />
```

with:

```tsx
        <DemoSection locale={locale} />
```

- [ ] **Step 2: Add the failing e2e checks**

Append to `tests/e2e/landing-rebuild-preview.spec.ts`:

```typescript
test("demo section reveals the sample and switches language on chip click", async ({ page }) => {
  await page.goto("/landing-preview");
  await expect(
    page.getByRole("heading", { level: 2, name: "Zobacz swoją fakturę w innym języku" })
  ).toBeVisible();
  // default English rendering
  await expect(page.getByText('Oak chair „Helena”')).toBeVisible();
  // switch to German
  await page.getByRole("button", { name: "DE" }).click();
  await expect(page.getByText('Eichenstuhl „Helena”')).toBeVisible();
  // the demo CTA points to /login
  await expect(page.getByRole("link", { name: "Przetłumacz swoją fakturę" })).toHaveAttribute("href", "/login");
});
```

- [ ] **Step 3: Run the e2e test**

Run: `npx playwright test tests/e2e/landing-rebuild-preview.spec.ts`
Expected: PASS. (If the dev server is not running, start it per the project's e2e setup, e.g. `npm run dev` in another shell, or use the configured Playwright webServer.)

- [ ] **Step 4: Full verification**

Run the whole feature test suite and typecheck:

```bash
npx vitest run tests/integration/lib/demo-sample.test.ts tests/integration/lib/landing-copy.test.ts tests/components/landing
npx tsc --noEmit
```
Expected: all demo + landing tests green; no new TypeScript errors (pre-existing Sanity/blog errors unrelated).

- [ ] **Step 5: Live RWD check**

Start the dev server and open `/landing-preview`. Verify at 360, 768, 1024 and 1440 widths:
- the demo section renders on the dark panel with no horizontal overflow,
- chips wrap and switch the visible language,
- the invoice preview is legible and clipped with a clean bottom fade,
- the CTA and privacy line are centered and readable.

- [ ] **Step 6: Commit**

```bash
git add components/landing/landing-rebuild.tsx tests/e2e/landing-rebuild-preview.spec.ts
git commit -m "feat(landing-demo): wire demo section into the preview + e2e"
```

---

## Out of scope (later sprints)

- Sprint B: the download-for-email gate (Turnstile, `/api/demo/unlock`, `/api/demo/pdf`, `signInWithOtp`, the `download-gate` UI). The Sprint A CTA points to `/login` as a placeholder for where the gate lands.
- Sprint C: Lane 2 upload (`upload-panel`, `/api/demo/translate`, rate limit, circuit breaker, privacy).
- Final swap: point `/` and `/en` at `LandingRebuild`; repoint hero CTAs from `#demo` to the live demo; retire the old marketing landing.

## Self-review notes

- Spec coverage (Sprint A slice): sample asset (§8), baked translations (§8), demo copy no-dashes (§10), dark centered stage + chips + watermark + reduced-motion swap (§9), wired on `/landing-preview` with the live landing untouched (§1). Gate and upload are deferred by design (§12).
- The preview is driven by the hand authored `DEMO_SAMPLE_INVOICE` literal (not by parsing the XML), so no untranslated Polish leaks into non-Polish renders; the XML asset is validated independently and reserved for the Sprint B/C PDF.
