# UI Overhaul Sprint 2 — Public Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Each task uses checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild every public route against the Sprint 1 design system + brand mark, add the missing trust pages (`/pricing`, `/security`, `/terms`, `/privacy`, `/auth/error`), and ship EN mirrors at `/en/*`.

**Architecture:** Each public page splits into (1) a shared `components/marketing/<page>-page.tsx` component that accepts `locale: MarketingLocale` and contains all layout/content, and (2) thin route shells at `app/<path>/page.tsx` (PL) + `app/en/<path>/page.tsx` (EN) that simply mount the shared component with the right locale. This pattern is the smallest-possible diff for adding language mirrors without a `[locale]` dynamic segment refactor. All marketing copy lives in `lib/marketing/copy.ts` (PL+EN parity). Sprint 1 components (`BrandLockup`, `PublicHeader`, `LegalFooter`, `TrustStrip`, `PriceSnippet`, `SecurityCard`, `FounderCard`, `StatCounter`) are imported and composed on every page. New shared components introduced here: `MarketingFAQ`, `PublicPricingSlider`, `PricingLadderTable`, `DataFlowDiagram`, `SubProcessorsTable`, `LegalDocLayout`, `LoginForm` (rebuild), `AuthErrorView`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind (Sprint 1 tokens), Vitest + @testing-library/react (jsdom), Playwright E2E, Supabase JS browser client (for login OTP flow, already wired).

**Spec reference:** `docs/superpowers/specs/2026-05-18-ui-overhaul-design.md` §5 (5.1 landing, 5.2 pricing, 5.3 security, 5.4 terms/privacy, 5.5 login, 5.6 auth/error), §4 (information architecture, footer mounting), §7 (Sprint 2 row).

**Branch:** Continues on `claude/ui-overhaul-sprint-1` per user direction — all four sprints stack into one PR (#12). Sprint 2 commits land on top of Sprint 1's 15 commits.

---

## File Structure

### Modified files

- `lib/marketing/copy.ts` — extend with all page-specific PL+EN strings (~250 new lines)
- `app/page.tsx` — replace 292-line landing with a 5-line shell that mounts `<LandingPage locale="pl" />`
- `app/login/page.tsx` — replace with shell mounting `<LoginPage locale="pl" />`
- `app/login/login-form.tsx` — rebuild around new design tokens (keep Supabase OTP logic intact)

### New files — shared marketing components

- `components/marketing/landing-page.tsx` — 9-section composition
- `components/marketing/pricing-page.tsx`
- `components/marketing/security-page.tsx`
- `components/marketing/terms-page.tsx`
- `components/marketing/privacy-page.tsx`
- `components/marketing/login-page.tsx` (wrapper around new login chrome + `<LoginForm>`)
- `components/marketing/auth-error-page.tsx`

### New files — supporting components

- `components/marketing/marketing-faq.tsx` — accordion using `<details>`/`<summary>`
- `components/marketing/public-pricing-slider.tsx` — read-only price display slider
- `components/marketing/pricing-ladder-table.tsx` — 5/10/25/50/100 table
- `components/marketing/data-flow-diagram.tsx` — static SVG for `/security`
- `components/marketing/sub-processors-table.tsx` — `/security` table
- `components/marketing/legal-doc-layout.tsx` — TOC + content for `/terms`+`/privacy`
- `components/marketing/auth-error-view.tsx` — reason-based variant renderer

### New files — page routes (PL)

- `app/pricing/page.tsx`
- `app/security/page.tsx`
- `app/terms/page.tsx`
- `app/privacy/page.tsx`
- `app/auth/error/page.tsx`

### New files — page routes (EN mirrors)

- `app/en/page.tsx`
- `app/en/pricing/page.tsx`
- `app/en/security/page.tsx`
- `app/en/terms/page.tsx`
- `app/en/privacy/page.tsx`
- `app/en/login/page.tsx`

### New files — tests

- `tests/components/marketing/marketing-faq.test.tsx`
- `tests/components/marketing/public-pricing-slider.test.tsx`
- `tests/components/marketing/pricing-ladder-table.test.tsx`
- `tests/components/marketing/data-flow-diagram.test.tsx`
- `tests/components/marketing/sub-processors-table.test.tsx`
- `tests/components/marketing/legal-doc-layout.test.tsx`
- `tests/components/marketing/auth-error-view.test.tsx`
- `tests/components/marketing/landing-page.test.tsx`
- `tests/components/marketing/pricing-page.test.tsx`
- `tests/components/marketing/security-page.test.tsx`
- `tests/components/marketing/login-page.test.tsx`
- `tests/e2e/sprint-2-public-pages.spec.ts`

---

## Task 1: Extend marketing copy with all page-specific strings

**Files:**
- Modify: `lib/marketing/copy.ts`

The existing `marketingCopy` from Sprint 1 has `publicHeader`, `footer`, `trustStrip`, `notFound`, `serverError`. This task extends it with `landing`, `pricing`, `security`, `terms`, `privacy`, `login`, `authError` groups. PL+EN parity throughout.

- [ ] **Step 1: Add type-level test that all new groups exist on both locales**

Edit `tests/integration/lib/marketing-copy.test.ts` to add cases:

```typescript
  it("has all public-page groups on both locales (Sprint 2)", () => {
    const expectedGroups = [
      "landing",
      "pricing",
      "security",
      "terms",
      "privacy",
      "login",
      "authError"
    ];
    for (const group of expectedGroups) {
      expect(marketingCopy.pl).toHaveProperty(group);
      expect(marketingCopy.en).toHaveProperty(group);
    }
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --run tests/integration/lib/marketing-copy.test.ts
```

Expected: 4 existing pass + 1 new FAILS ("expected pl to have property 'landing'").

- [ ] **Step 3: Replace `lib/marketing/copy.ts` with the extended version**

The file becomes ~450 lines. Replace the entire `marketingCopy` object:

```typescript
import type { LegalEntity } from "@/lib/brand/legal";

/**
 * Bilingual strings for marketing surfaces and shared chrome.
 * Workspace-specific copy stays in lib/workspace/copy.ts.
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
    },
    landing: {
      heroHeadline: "Faktura KSeF dla klienta z zagranicy. W 4 sekundy.",
      heroSubhead:
        "Przetłumacz fakturę FA(3) na 20+ języków. Pobierz PDF zgodny ze schematem MF, gotowy do wysyłki.",
      heroCtaPrimary: "Zacznij za darmo",
      heroCtaSecondary: "Zobacz przykład",
      heroFreeNote: "1 darmowa faktura w miesiącu. Bez karty.",
      demoStripHeading: "Tłumaczenie zachowuje strukturę i numerację MF",
      demoStripCaption: "Polski oryginał po lewej · profesjonalne tłumaczenie po prawej",
      valueProps: {
        heading: "Co cię to kosztuje? Zero subskrypcji.",
        items: [
          {
            title: "MF-compliant PDF",
            body: "Wynik zgodny ze schematem FA(3) 2025-06-25. Gotowy do wysyłki."
          },
          {
            title: "Bez subskrypcji",
            body: "Płacisz tylko za faktury, które tłumaczysz."
          },
          {
            title: "Dane w UE 🇪🇺",
            body: "Supabase Frankfurt. RODO. Kasowanie po 30 dniach."
          }
        ]
      },
      pricingTeaser: {
        heading: "Im więcej tłumaczysz, tym taniej",
        sliderLabel: "Wybierz pakiet:",
        cta: "Pełny cennik"
      },
      faq: {
        heading: "Najczęstsze pytania",
        items: [
          {
            q: "Czy potrzebuję integracji z KSeF?",
            a: "Nie. Wystarczy plik FA(3) XML pobrany z KSeF albo PDF z fakturą. Nie podłączamy się do KSeF i nie wymagamy żadnej integracji."
          },
          {
            q: "Co jeśli tłumaczenie nie jest dokładne?",
            a: "Tłumaczenie wykonuje OpenAI GPT-4 na podstawie kontekstu faktury. Możesz zwrócić pakiet w ciągu 14 dni jeśli nie jest satysfakcjonujący."
          },
          {
            q: "Czy moje dane są bezpieczne?",
            a: "Tak. Wszystkie faktury i metadane przechowujemy w Supabase Frankfurt. Faktury kasujemy po 30 dniach. RODO-compliant."
          },
          {
            q: "Czy działa z FA(1) lub FA(2)?",
            a: "Aktualnie obsługujemy FA(3) — najnowszy schemat MF z 2025-06-25. Wsparcie FA(1)/FA(2) planowane na późniejszy etap."
          },
          {
            q: "Czy dostanę fakturę VAT?",
            a: "Tak. Każdy zakup pakietu generuje fakturę VAT z 23% podatkiem. Otrzymasz link do pobrania faktury e-mailem po zakupie."
          }
        ]
      },
      founderHeading: "Stoi za tym konkretny człowiek",
      finalCta: {
        heading: "1 darmowa faktura w miesiącu. Bez karty.",
        cta: "Zacznij teraz"
      }
    },
    pricing: {
      heroHeadline: "Cennik prosty jak faktura.",
      heroSubhead: "Płacisz tylko za faktury, które tłumaczysz.",
      sliderHeading: "Wybierz wielkość pakietu",
      packageLabel: "Pakiet",
      totalLabel: "Cena pakietu",
      perInvoiceLabel: "Za fakturę",
      vatNote: "Ceny netto. Dolicz 23% VAT przy zakupie.",
      ladderHeading: "Im większy pakiet, tym niższa cena za fakturę",
      ladder: {
        packageHeader: "Pakiet",
        totalHeader: "Cena netto",
        perInvoiceHeader: "Za fakturę"
      },
      freeTierHeading: "1 darmowa faktura w miesiącu",
      freeTierBody: "Bez karty. Bez zobowiązań. Odnawia się co miesiąc.",
      includedHeading: "Co dostajesz w cenie?",
      included: [
        "Tłumaczenie treści faktury (towary, usługi, opisy)",
        "MF-compliant PDF (schemat FA(3) 2025-06-25)",
        "QR code KSeF zachowany",
        "Opcja dwujęzyczna (PL + język docelowy)",
        "Źródłowy XML przechowywany 30 dni"
      ],
      faqHeading: "Pytania o cenę",
      faq: [
        {
          q: "Czy faktury w pakiecie wygasają?",
          a: "Nie. Niewykorzystane faktury z pakietu nie tracą ważności. Możesz je wykorzystać kiedy zechcesz."
        },
        {
          q: "Czy mogę zwrócić niewykorzystany pakiet?",
          a: "Tak. Zwroty na życzenie w ciągu 14 dni od zakupu, proporcjonalnie do niewykorzystanych faktur."
        },
        {
          q: "Co jeśli tłumaczenie się nie udało?",
          a: "Jeśli faktura nie zostanie pomyślnie przetłumaczona (np. błąd po naszej stronie), kredyt nie zostaje zużyty. Możesz spróbować ponownie."
        },
        {
          q: "Czy dostanę fakturę VAT?",
          a: "Tak. Każdy zakup generuje fakturę VAT 23%. Otrzymasz link do pobrania e-mailem."
        },
        {
          q: "Czy płatność jest bezpieczna?",
          a: "Płatności obsługuje Stripe — światowy standard bezpieczeństwa płatności. Nie przechowujemy danych kart."
        },
        {
          q: "Czy mogę zmienić ilość po zakupie?",
          a: "Nie po zakupie, ale możesz w każdym momencie dokupić kolejny pakiet. Niewykorzystane faktury się sumują."
        }
      ],
      finalCta: "Zacznij od 1 darmowej faktury"
    },
    security: {
      heroHeadline: "Bezpieczeństwo i prywatność danych",
      heroSubhead:
        "Faktury to dane wrażliwe. Tłumaczksef.pl podchodzi do nich z należytą starannością.",
      tldrTitle: "W skrócie",
      tldrItems: [
        "Wszystkie dane w UE — Supabase Frankfurt (AWS eu-central-1)",
        "Szyfrowanie w trakcie transferu i w spoczynku",
        "Faktury kasowane po 30 dniach od uploadu",
        "RODO-compliant — pełna kontrola nad twoimi danymi"
      ],
      dataFlowHeading: "Jak płyną twoje dane",
      whereLivesHeading: "Gdzie żyją twoje dane",
      whereLivesBody:
        "Wszystkie faktury, tłumaczenia i metadane przechowujemy w Supabase (Frankfurt, region AWS eu-central-1). Dane nigdy nie opuszczają Unii Europejskiej w ramach naszej platformy.",
      regionBadge: "eu-central-1 (Frankfurt)",
      storageHeading: "Co przechowujemy, jak długo",
      storage: {
        dataHeader: "Typ danych",
        retentionHeader: "Czas przechowywania",
        rows: [
          { data: "Źródłowy XML/PDF faktury", retention: "30 dni od uploadu" },
          { data: "Tłumaczenia faktury", retention: "30 dni od wykonania" },
          { data: "Bilans kredytów", retention: "Na zawsze, dopóki istnieje konto" },
          { data: "Token magic-link", retention: "60 minut od wygenerowania" },
          { data: "Logi zakupów Stripe", retention: "5 lat (wymóg prawa PL)" }
        ]
      },
      notHeading: "Czego NIE robimy",
      notItems: [
        "Nie używamy twoich treści do trenowania modeli AI",
        "Nie sprzedajemy twoich danych",
        "Nie udostępniamy danych stronom trzecim poza wymienionymi sub-procesorami"
      ],
      subProcessorsHeading: "Sub-procesorzy",
      subProcessorsIntro:
        "Korzystamy z czterech sub-procesorów. Każdy jest GDPR/RODO compliant i wybrany pod kątem bezpieczeństwa danych.",
      subProcessors: {
        nameHeader: "Nazwa",
        roleHeader: "Rola",
        locationHeader: "Lokalizacja",
        rows: [
          {
            name: "Supabase",
            role: "Storage + Auth",
            location: "Frankfurt 🇩🇪 (AWS eu-central-1)"
          },
          {
            name: "OpenAI",
            role: "Tłumaczenie treści faktur",
            location: "USA (data processing agreement zawarte)"
          },
          {
            name: "Stripe",
            role: "Płatności",
            location: "Irlandia 🇮🇪 (Stripe Payments Europe)"
          },
          {
            name: "Resend",
            role: "Magic-link i transakcyjne e-maile",
            location: "USA (data processing agreement zawarte)"
          }
        ]
      },
      rodoHeading: "Twoje prawa (RODO)",
      rodoIntro: "Zgodnie z RODO masz prawo do:",
      rodoRights: [
        "Dostępu do swoich danych",
        "Sprostowania nieprawidłowych danych",
        "Kasowania (prawo do bycia zapomnianym)",
        "Ograniczenia przetwarzania",
        "Przenoszenia danych (eksport JSON dostępny w /account)",
        "Sprzeciwu wobec przetwarzania"
      ],
      rodoContact: "Aby skorzystać z któregokolwiek z tych praw, napisz do nas:",
      mfHeading: "Zgodność z MF i KSeF",
      mfBody:
        "Wynikowy PDF jest zgodny ze schematem FA(3) Ministerstwa Finansów wersja 2025-06-25. QR code KSeF jest zachowany — twój oryginalny dokument pozostaje walidowalny.",
      mfSchemaLink: "Schemat MF FA(3) — gov.pl",
      founderHeading: "Stoi za tym konkretny człowiek",
      incidentsHeading: "Polityka incydentów",
      incidentsBody:
        "Logi zachowujemy przez 90 dni. W razie naruszenia bezpieczeństwa danych powiadamiamy poszkodowanych w ciągu 72 godzin, zgodnie z art. 34 RODO."
    },
    terms: {
      heroHeadline: "Regulamin świadczenia usług",
      lastUpdated: "Ostatnia aktualizacja",
      tocHeading: "Spis treści",
      placeholderHeading: "Treść regulaminu",
      placeholderBody:
        "Pełna treść regulaminu zostanie dodana przed uruchomieniem produkcyjnym. W razie pytań prosimy o kontakt z administratorem."
    },
    privacy: {
      heroHeadline: "Polityka prywatności",
      lastUpdated: "Ostatnia aktualizacja",
      tocHeading: "Spis treści",
      placeholderHeading: "Treść polityki prywatności",
      placeholderBody:
        "Pełna treść polityki prywatności zostanie dodana przed uruchomieniem produkcyjnym. Już teraz przestrzegamy zasad RODO — szczegóły w sekcji Bezpieczeństwo."
    },
    login: {
      title: "Zaloguj się",
      subtitle: "Wpisz e-mail. Bez hasła.",
      emailLabel: "Adres e-mail",
      emailPlaceholder: "twoj@adres.pl",
      submitButton: "Wyślij link logowania",
      sendingButton: "Wysyłam link…",
      sentTitle: "Sprawdź skrzynkę",
      sentBodyPrefix: "Link logowania wysłany na",
      sentResend: "Wyślij ponownie",
      sentResendCooldown: "Wyślij ponownie za {seconds}s",
      noAccountHint: "Konto powstaje automatycznie przy pierwszym logowaniu.",
      backToHome: "Wracam na stronę główną",
      errorGeneric: "Nie udało się wysłać linku. Spróbuj ponownie.",
      errorRateLimited:
        "Za dużo prób. Odczekaj chwilę i spróbuj jeszcze raz."
    },
    authError: {
      title: "Problem z linkiem logowania",
      reasonExpired: {
        heading: "Link wygasł",
        body: "Magic-linki są ważne 60 minut. Wyślij nowy.",
        cta: "Wyślij nowy link"
      },
      reasonUsed: {
        heading: "Link został już użyty",
        body: "Każdy magic-link można użyć tylko raz. Wyślij nowy.",
        cta: "Wyślij nowy link"
      },
      reasonGeneric: {
        heading: "Coś poszło nie tak",
        body: "Nie udało się zweryfikować linku. Spróbuj wysłać go ponownie.",
        cta: "Wracam do logowania"
      },
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
    },
    landing: {
      heroHeadline: "Polish KSeF invoice, translated. In 4 seconds.",
      heroSubhead:
        "Translate FA(3) invoices into 20+ languages. Download an MF-compliant PDF, ready to send to your international clients.",
      heroCtaPrimary: "Start free",
      heroCtaSecondary: "See example",
      heroFreeNote: "1 free invoice per month. No card.",
      demoStripHeading: "Translation preserves MF structure and numbering",
      demoStripCaption: "Polish original on the left · professional translation on the right",
      valueProps: {
        heading: "What does it cost you? No subscription.",
        items: [
          {
            title: "MF-compliant PDF",
            body: "Output matches the FA(3) 2025-06-25 schema. Ready to send."
          },
          {
            title: "No subscription",
            body: "Pay only for invoices you actually translate."
          },
          {
            title: "EU-based data 🇪🇺",
            body: "Supabase Frankfurt. GDPR. Deleted after 30 days."
          }
        ]
      },
      pricingTeaser: {
        heading: "The more you translate, the cheaper it gets",
        sliderLabel: "Choose a package:",
        cta: "Full pricing"
      },
      faq: {
        heading: "Frequent questions",
        items: [
          {
            q: "Do I need to integrate with KSeF?",
            a: "No. Just upload your FA(3) XML or PDF. We never connect to KSeF and require no integration."
          },
          {
            q: "What if the translation isn't accurate?",
            a: "Translations are done by OpenAI GPT-4 with invoice context. You can return an unused package within 14 days if you're not satisfied."
          },
          {
            q: "Is my data safe?",
            a: "Yes. All invoices and metadata are stored in Supabase Frankfurt. Invoices are deleted after 30 days. GDPR-compliant."
          },
          {
            q: "Does it work with FA(1) or FA(2)?",
            a: "We currently support FA(3) — the latest MF schema from 2025-06-25. FA(1)/FA(2) support is on the roadmap."
          },
          {
            q: "Can I get a VAT receipt?",
            a: "Yes. Every purchase generates a 23% VAT invoice. You'll receive a download link via email after purchase."
          }
        ]
      },
      founderHeading: "Run by a real person",
      finalCta: {
        heading: "1 free invoice per month. No card.",
        cta: "Start now"
      }
    },
    pricing: {
      heroHeadline: "Pricing as simple as an invoice.",
      heroSubhead: "Pay only for invoices you translate.",
      sliderHeading: "Choose a package size",
      packageLabel: "Package",
      totalLabel: "Package price",
      perInvoiceLabel: "Per invoice",
      vatNote: "Prices net of VAT. 23% VAT added at checkout.",
      ladderHeading: "Bigger packages, lower per-invoice price",
      ladder: {
        packageHeader: "Package",
        totalHeader: "Net price",
        perInvoiceHeader: "Per invoice"
      },
      freeTierHeading: "1 free invoice every month",
      freeTierBody: "No card. No commitment. Renews every month.",
      includedHeading: "What's included?",
      included: [
        "Translation of invoice content (items, services, descriptions)",
        "MF-compliant PDF (FA(3) 2025-06-25 schema)",
        "KSeF QR code preserved",
        "Bilingual option (PL + target language)",
        "Source XML retained for 30 days"
      ],
      faqHeading: "Pricing questions",
      faq: [
        {
          q: "Do package invoices expire?",
          a: "No. Unused invoices in a package never expire. Use them whenever you want."
        },
        {
          q: "Can I return an unused package?",
          a: "Yes. Refund on request within 14 days of purchase, prorated by unused invoices."
        },
        {
          q: "What if a translation fails?",
          a: "If an invoice doesn't translate successfully (e.g. error on our side), no credit is consumed. Try again."
        },
        {
          q: "Will I get a VAT invoice?",
          a: "Yes. Every purchase generates a 23% VAT invoice. Download link delivered via email."
        },
        {
          q: "Is payment secure?",
          a: "Payments are handled by Stripe — the global standard for payment security. We never store card data."
        },
        {
          q: "Can I change the package size after purchase?",
          a: "Not after purchase, but you can buy another package any time. Unused invoices stack."
        }
      ],
      finalCta: "Start with 1 free invoice"
    },
    security: {
      heroHeadline: "Data security and privacy",
      heroSubhead:
        "Invoices are sensitive data. Tłumacz Faktur KSeF treats them with appropriate care.",
      tldrTitle: "TL;DR",
      tldrItems: [
        "All data in the EU — Supabase Frankfurt (AWS eu-central-1)",
        "Encryption in transit and at rest",
        "Invoices deleted 30 days after upload",
        "GDPR-compliant — full control over your data"
      ],
      dataFlowHeading: "How your data flows",
      whereLivesHeading: "Where your data lives",
      whereLivesBody:
        "All invoices, translations, and metadata are stored in Supabase (Frankfurt, AWS eu-central-1). Data never leaves the European Union within our platform.",
      regionBadge: "eu-central-1 (Frankfurt)",
      storageHeading: "What we store, for how long",
      storage: {
        dataHeader: "Data type",
        retentionHeader: "Retention period",
        rows: [
          { data: "Source XML/PDF invoice", retention: "30 days from upload" },
          { data: "Invoice translations", retention: "30 days from creation" },
          { data: "Credit balance", retention: "Forever, while the account exists" },
          { data: "Magic-link tokens", retention: "60 minutes from generation" },
          { data: "Stripe purchase logs", retention: "5 years (PL legal requirement)" }
        ]
      },
      notHeading: "What we DO NOT do",
      notItems: [
        "We do not use your content to train AI models",
        "We do not sell your data",
        "We do not share data with third parties beyond the listed sub-processors"
      ],
      subProcessorsHeading: "Sub-processors",
      subProcessorsIntro:
        "We use four sub-processors. Each is GDPR-compliant and selected for data security.",
      subProcessors: {
        nameHeader: "Name",
        roleHeader: "Role",
        locationHeader: "Location",
        rows: [
          {
            name: "Supabase",
            role: "Storage + Auth",
            location: "Frankfurt 🇩🇪 (AWS eu-central-1)"
          },
          {
            name: "OpenAI",
            role: "Invoice content translation",
            location: "USA (data processing agreement in place)"
          },
          {
            name: "Stripe",
            role: "Payments",
            location: "Ireland 🇮🇪 (Stripe Payments Europe)"
          },
          {
            name: "Resend",
            role: "Magic-link and transactional emails",
            location: "USA (data processing agreement in place)"
          }
        ]
      },
      rodoHeading: "Your rights (GDPR)",
      rodoIntro: "Under GDPR you have the right to:",
      rodoRights: [
        "Access your data",
        "Rectify incorrect data",
        "Erasure (right to be forgotten)",
        "Restrict processing",
        "Data portability (JSON export available in /account)",
        "Object to processing"
      ],
      rodoContact: "To exercise any of these rights, contact us:",
      mfHeading: "MF and KSeF compliance",
      mfBody:
        "Output PDFs conform to the Polish Ministry of Finance FA(3) schema version 2025-06-25. The KSeF QR code is preserved — your original document stays validatable.",
      mfSchemaLink: "MF FA(3) schema — gov.pl",
      founderHeading: "Run by a real person",
      incidentsHeading: "Incident policy",
      incidentsBody:
        "Logs are retained for 90 days. In case of a data breach, we notify affected users within 72 hours per GDPR Article 34."
    },
    terms: {
      heroHeadline: "Terms of service",
      lastUpdated: "Last updated",
      tocHeading: "Table of contents",
      placeholderHeading: "Terms content",
      placeholderBody:
        "Full terms will be added before production launch. For questions please contact the administrator."
    },
    privacy: {
      heroHeadline: "Privacy policy",
      lastUpdated: "Last updated",
      tocHeading: "Table of contents",
      placeholderHeading: "Privacy policy content",
      placeholderBody:
        "Full privacy policy will be added before production launch. We already follow GDPR — see the Security page for details."
    },
    login: {
      title: "Sign in",
      subtitle: "Enter your email. No password.",
      emailLabel: "Email address",
      emailPlaceholder: "you@company.com",
      submitButton: "Send sign-in link",
      sendingButton: "Sending link…",
      sentTitle: "Check your inbox",
      sentBodyPrefix: "Sign-in link sent to",
      sentResend: "Resend",
      sentResendCooldown: "Resend in {seconds}s",
      noAccountHint: "Your account is created automatically on first sign-in.",
      backToHome: "Back to homepage",
      errorGeneric: "Failed to send the link. Please try again.",
      errorRateLimited: "Too many attempts. Please wait a moment and try again."
    },
    authError: {
      title: "Sign-in link problem",
      reasonExpired: {
        heading: "Link expired",
        body: "Magic links are valid for 60 minutes. Send a new one.",
        cta: "Send new link"
      },
      reasonUsed: {
        heading: "Link already used",
        body: "Each magic link can only be used once. Send a new one.",
        cta: "Send new link"
      },
      reasonGeneric: {
        heading: "Something went wrong",
        body: "We couldn't verify the link. Try sending it again.",
        cta: "Back to sign-in"
      },
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

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- --run tests/integration/lib/marketing-copy.test.ts
```

Expected: 5/5 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/marketing/copy.ts tests/integration/lib/marketing-copy.test.ts
git commit -m "feat(marketing): extend copy with landing/pricing/security/terms/privacy/login/authError (PL+EN)"
```

---

## Task 2: `<MarketingFAQ>` reusable accordion

**Files:**
- Create: `components/marketing/marketing-faq.tsx`
- Test: `tests/components/marketing/marketing-faq.test.tsx`

Native `<details>`/`<summary>` accordion. No JS needed for show/hide.

- [ ] **Step 1: Write failing test**

`tests/components/marketing/marketing-faq.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarketingFAQ } from "@/components/marketing/marketing-faq";

const items = [
  { q: "Pytanie pierwsze?", a: "Odpowiedź pierwsza." },
  { q: "Pytanie drugie?", a: "Odpowiedź druga." }
];

describe("<MarketingFAQ>", () => {
  it("renders the heading and all questions", () => {
    render(<MarketingFAQ heading="FAQ test" items={items} />);
    expect(screen.getByRole("heading", { name: /FAQ test/i })).toBeInTheDocument();
    expect(screen.getByText("Pytanie pierwsze?")).toBeInTheDocument();
    expect(screen.getByText("Pytanie drugie?")).toBeInTheDocument();
  });

  it("renders the answers inside <details> elements", () => {
    render(<MarketingFAQ heading="X" items={items} />);
    const details = document.querySelectorAll("details");
    expect(details.length).toBe(2);
    expect(details[0].textContent).toContain("Odpowiedź pierwsza.");
  });

  it("uses semantic <summary> for the question", () => {
    render(<MarketingFAQ heading="X" items={items} />);
    const summaries = document.querySelectorAll("summary");
    expect(summaries.length).toBe(2);
    expect(summaries[0].textContent).toContain("Pytanie pierwsze?");
  });
});
```

- [ ] **Step 2: Run-fail**

```bash
npm test -- --run tests/components/marketing/marketing-faq.test.tsx
```

- [ ] **Step 3: Create component**

`components/marketing/marketing-faq.tsx`:

```tsx
import { ChevronDown } from "lucide-react";

export interface FAQItem {
  q: string;
  a: string;
}

export interface MarketingFAQProps {
  heading: string;
  items: ReadonlyArray<FAQItem>;
}

export function MarketingFAQ({ heading, items }: MarketingFAQProps) {
  return (
    <section className="space-y-6">
      <h2 className="text-h2 text-text-strong">{heading}</h2>
      <div className="divide-y divide-border rounded-xl border border-border bg-surface">
        {items.map((item) => (
          <details
            key={item.q}
            className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-4 text-body font-semibold text-text-strong">
              <span>{item.q}</span>
              <ChevronDown className="h-5 w-5 shrink-0 text-text-muted transition-transform duration-hover ease-out group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-small text-text">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run-pass.** Expect 3/3.

- [ ] **Step 5: Commit**

```bash
git add components/marketing/marketing-faq.tsx tests/components/marketing/marketing-faq.test.tsx
git commit -m "feat(marketing): MarketingFAQ — native details/summary accordion"
```

---

## Task 3: `<PublicPricingSlider>` price-display slider

**Files:**
- Create: `components/marketing/public-pricing-slider.tsx`
- Test: `tests/components/marketing/public-pricing-slider.test.tsx`

Read-only slider for the public `/pricing` page. Displays package size, total price, per-invoice price. No checkout (that's `<CreditSlider>` on `/billing`).

- [ ] **Step 1: Write failing test**

`tests/components/marketing/public-pricing-slider.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PublicPricingSlider } from "@/components/marketing/public-pricing-slider";

const labels = {
  packageLabel: "Pakiet",
  totalLabel: "Cena pakietu",
  perInvoiceLabel: "Za fakturę"
};

describe("<PublicPricingSlider>", () => {
  it("starts at the default package size of 25", () => {
    render(<PublicPricingSlider locale="pl" labels={labels} />);
    expect((screen.getByRole("slider") as HTMLInputElement).value).toBe("25");
  });

  it("renders package + total + per-invoice readouts", () => {
    render(<PublicPricingSlider locale="pl" labels={labels} />);
    expect(screen.getByText("Pakiet")).toBeInTheDocument();
    expect(screen.getByText("Cena pakietu")).toBeInTheDocument();
    expect(screen.getByText("Za fakturę")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
  });

  it("recomputes the total and per-invoice when the slider changes", () => {
    render(<PublicPricingSlider locale="pl" labels={labels} />);
    const slider = screen.getByRole("slider") as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "100" } });
    // 100-pack: 100 × 299 cents = 29900 cents = 299,00 zł; per-invoice = 2,99 zł
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText(/299,00\s+zł/)).toBeInTheDocument();
    expect(screen.getByText(/2,99\s+zł/)).toBeInTheDocument();
  });

  it("formats currency as PLN when locale='en'", () => {
    render(<PublicPricingSlider locale="en" labels={labels} />);
    const slider = screen.getByRole("slider") as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "100" } });
    expect(screen.getByText(/PLN\s+299\.00/)).toBeInTheDocument();
    expect(screen.getByText(/PLN\s+2\.99/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run-fail.**

- [ ] **Step 3: Create component**

`components/marketing/public-pricing-slider.tsx`:

```tsx
"use client";

import { useState } from "react";
import { priceForPackage, PACKAGE_SIZES } from "@/lib/billing/pricing";

export interface PublicPricingSliderLabels {
  packageLabel: string;
  totalLabel: string;
  perInvoiceLabel: string;
}

export interface PublicPricingSliderProps {
  locale: "pl" | "en";
  labels: PublicPricingSliderLabels;
  /** Default package size (must be a valid PACKAGE_SIZES entry). */
  defaultPackageSize?: number;
}

function formatPLN(cents: number, locale: "pl" | "en"): string {
  const amount = cents / 100;
  return locale === "pl"
    ? `${amount.toFixed(2).replace(".", ",")} zł`
    : `PLN ${amount.toFixed(2)}`;
}

const MIN = PACKAGE_SIZES[0];
const MAX = PACKAGE_SIZES[PACKAGE_SIZES.length - 1];

export function PublicPricingSlider({
  locale,
  labels,
  defaultPackageSize = 25
}: PublicPricingSliderProps) {
  const [size, setSize] = useState<number>(defaultPackageSize);
  const quote = priceForPackage(size);

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <div className="grid gap-6 sm:grid-cols-3">
        <div>
          <p className="text-micro uppercase tracking-wide text-text-muted">
            {labels.packageLabel}
          </p>
          <p className="mt-1 text-number-xl tabular-nums text-text-strong">{size}</p>
        </div>
        <div>
          <p className="text-micro uppercase tracking-wide text-text-muted">
            {labels.totalLabel}
          </p>
          <p className="mt-1 text-h1 tabular-nums text-text-strong">
            {formatPLN(quote.totalAmountCents, locale)}
          </p>
        </div>
        <div>
          <p className="text-micro uppercase tracking-wide text-text-muted">
            {labels.perInvoiceLabel}
          </p>
          <p className="mt-1 text-h1 tabular-nums text-accent">
            {formatPLN(quote.unitPriceCents, locale)}
          </p>
        </div>
      </div>
      <input
        type="range"
        min={MIN}
        max={MAX}
        step={5}
        value={size}
        onChange={(e) => setSize(Number(e.target.value))}
        className="mt-6 w-full accent-[hsl(var(--accent))]"
        aria-label={labels.packageLabel}
      />
      <div className="mt-2 flex justify-between text-micro tabular-nums text-text-muted">
        <span>{MIN}</span>
        <span>{MAX}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run-pass.** Expect 4/4.

- [ ] **Step 5: Commit**

```bash
git add components/marketing/public-pricing-slider.tsx tests/components/marketing/public-pricing-slider.test.tsx
git commit -m "feat(marketing): PublicPricingSlider — read-only pricing display"
```

---

## Task 4: `<PricingLadderTable>` price table

**Files:**
- Create: `components/marketing/pricing-ladder-table.tsx`
- Test: `tests/components/marketing/pricing-ladder-table.test.tsx`

5/10/25/50/100 table with per-invoice price column. Highlights the row matching `currentPackageSize` (optional prop).

- [ ] **Step 1: Test**

`tests/components/marketing/pricing-ladder-table.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PricingLadderTable } from "@/components/marketing/pricing-ladder-table";

const labels = {
  packageHeader: "Pakiet",
  totalHeader: "Cena netto",
  perInvoiceHeader: "Za fakturę"
};

describe("<PricingLadderTable>", () => {
  it("renders the 5 ladder rows (5/10/25/50/100)", () => {
    render(<PricingLadderTable locale="pl" labels={labels} />);
    expect(screen.getByRole("cell", { name: "5" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "10" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "25" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "50" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "100" })).toBeInTheDocument();
  });

  it("renders all three column headers", () => {
    render(<PricingLadderTable locale="pl" labels={labels} />);
    expect(screen.getByRole("columnheader", { name: "Pakiet" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Cena netto" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Za fakturę" })).toBeInTheDocument();
  });

  it("formats prices for PL locale", () => {
    render(<PricingLadderTable locale="pl" labels={labels} />);
    expect(screen.getByText(/6,99\s+zł/)).toBeInTheDocument(); // 5-pack unit
    expect(screen.getByText(/2,99\s+zł/)).toBeInTheDocument(); // 100-pack unit
  });

  it("highlights the current package row when supplied", () => {
    render(<PricingLadderTable locale="pl" labels={labels} currentPackageSize={50} />);
    const row50 = screen.getByRole("cell", { name: "50" }).closest("tr");
    expect(row50?.getAttribute("data-current")).toBe("true");
  });
});
```

- [ ] **Step 2: Run-fail.**

- [ ] **Step 3: Create**

`components/marketing/pricing-ladder-table.tsx`:

```tsx
import { priceForPackage } from "@/lib/billing/pricing";

export interface PricingLadderLabels {
  packageHeader: string;
  totalHeader: string;
  perInvoiceHeader: string;
}

export interface PricingLadderTableProps {
  locale: "pl" | "en";
  labels: PricingLadderLabels;
  currentPackageSize?: number;
}

const LADDER_SIZES = [5, 10, 25, 50, 100] as const;

function formatPLN(cents: number, locale: "pl" | "en"): string {
  const amount = cents / 100;
  return locale === "pl"
    ? `${amount.toFixed(2).replace(".", ",")} zł`
    : `PLN ${amount.toFixed(2)}`;
}

export function PricingLadderTable({
  locale,
  labels,
  currentPackageSize
}: PricingLadderTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <table className="w-full">
        <thead className="bg-surface-muted">
          <tr>
            <th className="px-5 py-3 text-left text-micro uppercase tracking-wide text-text-muted">
              {labels.packageHeader}
            </th>
            <th className="px-5 py-3 text-right text-micro uppercase tracking-wide text-text-muted">
              {labels.totalHeader}
            </th>
            <th className="px-5 py-3 text-right text-micro uppercase tracking-wide text-text-muted">
              {labels.perInvoiceHeader}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {LADDER_SIZES.map((size) => {
            const quote = priceForPackage(size);
            const isCurrent = size === currentPackageSize;
            return (
              <tr
                key={size}
                data-current={isCurrent ? "true" : "false"}
                className={isCurrent ? "bg-accent-soft" : ""}
              >
                <td className="px-5 py-3 text-body tabular-nums text-text-strong">{size}</td>
                <td className="px-5 py-3 text-right text-body tabular-nums text-text">
                  {formatPLN(quote.totalAmountCents, locale)}
                </td>
                <td className="px-5 py-3 text-right text-body font-semibold tabular-nums text-accent">
                  {formatPLN(quote.unitPriceCents, locale)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Run-pass.** Expect 4/4.

- [ ] **Step 5: Commit**

```bash
git add components/marketing/pricing-ladder-table.tsx tests/components/marketing/pricing-ladder-table.test.tsx
git commit -m "feat(marketing): PricingLadderTable — 5/10/25/50/100 ladder with row highlight"
```

---

## Task 5: `<DataFlowDiagram>` SVG for /security

**Files:**
- Create: `components/marketing/data-flow-diagram.tsx`
- Test: `tests/components/marketing/data-flow-diagram.test.tsx`

Static horizontal flow: Komputer → Frankfurt → OpenAI → PDF → Kasowanie.

- [ ] **Step 1: Test**

`tests/components/marketing/data-flow-diagram.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataFlowDiagram } from "@/components/marketing/data-flow-diagram";

const stepsPl = [
  { icon: "computer", label: "Twój komputer" },
  { icon: "shield", label: "Supabase Frankfurt" },
  { icon: "translate", label: "Tłumaczenie OpenAI" },
  { icon: "pdf", label: "Dostarczenie PDF" },
  { icon: "trash", label: "Kasowanie po 30 dniach" }
] as const;

describe("<DataFlowDiagram>", () => {
  it("renders all step labels in order", () => {
    render(<DataFlowDiagram steps={stepsPl} />);
    expect(screen.getByText("Twój komputer")).toBeInTheDocument();
    expect(screen.getByText("Supabase Frankfurt")).toBeInTheDocument();
    expect(screen.getByText("Tłumaczenie OpenAI")).toBeInTheDocument();
    expect(screen.getByText("Dostarczenie PDF")).toBeInTheDocument();
    expect(screen.getByText("Kasowanie po 30 dniach")).toBeInTheDocument();
  });

  it("renders an icon for each step", () => {
    render(<DataFlowDiagram steps={stepsPl} />);
    const icons = document.querySelectorAll("[data-flow-icon]");
    expect(icons.length).toBe(5);
  });

  it("renders 4 arrow separators between 5 steps", () => {
    render(<DataFlowDiagram steps={stepsPl} />);
    const arrows = document.querySelectorAll("[data-flow-arrow]");
    expect(arrows.length).toBe(4);
  });
});
```

- [ ] **Step 2: Run-fail.**

- [ ] **Step 3: Create**

`components/marketing/data-flow-diagram.tsx`:

```tsx
import { Monitor, Shield, Languages, FileText, Trash2, ArrowRight } from "lucide-react";

export type FlowIcon = "computer" | "shield" | "translate" | "pdf" | "trash";

export interface FlowStep {
  icon: FlowIcon;
  label: string;
}

export interface DataFlowDiagramProps {
  steps: ReadonlyArray<FlowStep>;
}

const ICONS: Record<FlowIcon, typeof Monitor> = {
  computer: Monitor,
  shield: Shield,
  translate: Languages,
  pdf: FileText,
  trash: Trash2
};

export function DataFlowDiagram({ steps }: DataFlowDiagramProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface p-6 shadow-sm md:flex-row md:items-stretch md:justify-between md:gap-2">
      {steps.map((step, index) => {
        const Icon = ICONS[step.icon];
        return (
          <div key={step.label} className="flex items-center gap-2 md:flex-1 md:flex-col md:items-center md:text-center">
            <div className="flex flex-col items-center gap-2 md:flex-col">
              <span
                data-flow-icon
                className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-accent-soft text-accent"
              >
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="text-small font-medium text-text-strong">{step.label}</span>
            </div>
            {index < steps.length - 1 ? (
              <ArrowRight
                data-flow-arrow
                className="h-5 w-5 shrink-0 text-text-muted rotate-90 md:rotate-0"
                aria-hidden="true"
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run-pass.** Expect 3/3.

- [ ] **Step 5: Commit**

```bash
git add components/marketing/data-flow-diagram.tsx tests/components/marketing/data-flow-diagram.test.tsx
git commit -m "feat(marketing): DataFlowDiagram — static 5-step horizontal flow"
```

---

## Task 6: `<SubProcessorsTable>` for /security

**Files:**
- Create: `components/marketing/sub-processors-table.tsx`
- Test: `tests/components/marketing/sub-processors-table.test.tsx`

4-row table: name, role, location.

- [ ] **Step 1: Test**

`tests/components/marketing/sub-processors-table.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SubProcessorsTable } from "@/components/marketing/sub-processors-table";

const labels = { nameHeader: "Nazwa", roleHeader: "Rola", locationHeader: "Lokalizacja" };
const rows = [
  { name: "Supabase", role: "Storage", location: "Frankfurt" },
  { name: "OpenAI", role: "Translation", location: "USA" }
];

describe("<SubProcessorsTable>", () => {
  it("renders all three column headers", () => {
    render(<SubProcessorsTable labels={labels} rows={rows} />);
    expect(screen.getByRole("columnheader", { name: "Nazwa" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Rola" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Lokalizacja" })).toBeInTheDocument();
  });

  it("renders each row's cells", () => {
    render(<SubProcessorsTable labels={labels} rows={rows} />);
    expect(screen.getByText("Supabase")).toBeInTheDocument();
    expect(screen.getByText("Frankfurt")).toBeInTheDocument();
    expect(screen.getByText("OpenAI")).toBeInTheDocument();
    expect(screen.getByText("Translation")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run-fail.**

- [ ] **Step 3: Create**

`components/marketing/sub-processors-table.tsx`:

```tsx
export interface SubProcessorRow {
  name: string;
  role: string;
  location: string;
}

export interface SubProcessorsTableLabels {
  nameHeader: string;
  roleHeader: string;
  locationHeader: string;
}

export interface SubProcessorsTableProps {
  labels: SubProcessorsTableLabels;
  rows: ReadonlyArray<SubProcessorRow>;
}

export function SubProcessorsTable({ labels, rows }: SubProcessorsTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <table className="w-full">
        <thead className="bg-surface-muted">
          <tr>
            <th className="px-5 py-3 text-left text-micro uppercase tracking-wide text-text-muted">
              {labels.nameHeader}
            </th>
            <th className="px-5 py-3 text-left text-micro uppercase tracking-wide text-text-muted">
              {labels.roleHeader}
            </th>
            <th className="px-5 py-3 text-left text-micro uppercase tracking-wide text-text-muted">
              {labels.locationHeader}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.name}>
              <td className="px-5 py-3 text-body font-semibold text-text-strong">{row.name}</td>
              <td className="px-5 py-3 text-body text-text">{row.role}</td>
              <td className="px-5 py-3 text-body text-text">{row.location}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Run-pass.** Expect 2/2.

- [ ] **Step 5: Commit**

```bash
git add components/marketing/sub-processors-table.tsx tests/components/marketing/sub-processors-table.test.tsx
git commit -m "feat(marketing): SubProcessorsTable — name/role/location for /security"
```

---

## Task 7: `<LegalDocLayout>` for /terms + /privacy

**Files:**
- Create: `components/marketing/legal-doc-layout.tsx`
- Test: `tests/components/marketing/legal-doc-layout.test.tsx`

Sticky TOC sidebar (desktop) + content area. Used by `/terms` and `/privacy`.

- [ ] **Step 1: Test**

`tests/components/marketing/legal-doc-layout.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LegalDocLayout } from "@/components/marketing/legal-doc-layout";

const props = {
  title: "Regulamin",
  lastUpdatedLabel: "Ostatnia aktualizacja",
  lastUpdatedDate: "2026-05-18",
  tocHeading: "Spis treści",
  sections: [
    { id: "wstep", title: "Wstęp", content: "Treść wstępu." },
    { id: "definicje", title: "Definicje", content: "Treść definicji." }
  ]
};

describe("<LegalDocLayout>", () => {
  it("renders title and last-updated metadata", () => {
    render(<LegalDocLayout {...props} />);
    expect(screen.getByRole("heading", { level: 1, name: /Regulamin/i })).toBeInTheDocument();
    expect(screen.getByText(/Ostatnia aktualizacja/)).toBeInTheDocument();
    expect(screen.getByText(/2026-05-18/)).toBeInTheDocument();
  });

  it("renders the TOC with section links", () => {
    render(<LegalDocLayout {...props} />);
    expect(screen.getByRole("heading", { name: /Spis treści/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Wstęp" })).toHaveAttribute("href", "#wstep");
    expect(screen.getByRole("link", { name: "Definicje" })).toHaveAttribute("href", "#definicje");
  });

  it("renders each section with an id anchor", () => {
    render(<LegalDocLayout {...props} />);
    expect(document.getElementById("wstep")).not.toBeNull();
    expect(document.getElementById("definicje")).not.toBeNull();
    expect(screen.getByText("Treść wstępu.")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run-fail.**

- [ ] **Step 3: Create**

`components/marketing/legal-doc-layout.tsx`:

```tsx
export interface LegalSection {
  id: string;
  title: string;
  content: string;
}

export interface LegalDocLayoutProps {
  title: string;
  lastUpdatedLabel: string;
  lastUpdatedDate: string;
  tocHeading: string;
  sections: ReadonlyArray<LegalSection>;
}

export function LegalDocLayout({
  title,
  lastUpdatedLabel,
  lastUpdatedDate,
  tocHeading,
  sections
}: LegalDocLayoutProps) {
  return (
    <article className="mx-auto max-w-6xl px-5 py-12 md:px-8">
      <header className="mb-8">
        <h1 className="text-h1 text-text-strong">{title}</h1>
        <p className="mt-2 text-small text-text-muted">
          {lastUpdatedLabel}: <time dateTime={lastUpdatedDate}>{lastUpdatedDate}</time>
        </p>
      </header>
      <div className="grid gap-8 md:grid-cols-[240px_1fr]">
        <aside className="md:sticky md:top-24 md:self-start">
          <h2 className="text-micro uppercase tracking-wide text-text-muted">{tocHeading}</h2>
          <ul className="mt-3 space-y-2 text-small">
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="text-text hover:text-text-strong">
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </aside>
        <div className="space-y-10">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="text-h2 text-text-strong">{section.title}</h2>
              <p className="mt-3 whitespace-pre-line text-body text-text">{section.content}</p>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 4: Run-pass.** Expect 3/3.

- [ ] **Step 5: Commit**

```bash
git add components/marketing/legal-doc-layout.tsx tests/components/marketing/legal-doc-layout.test.tsx
git commit -m "feat(marketing): LegalDocLayout — TOC + content for /terms + /privacy"
```

---

## Task 8: `<AuthErrorView>` reason-based renderer

**Files:**
- Create: `components/marketing/auth-error-view.tsx`
- Test: `tests/components/marketing/auth-error-view.test.tsx`

Reads a `reason` prop ("expired" | "used" | "generic") and renders the matching heading/body/cta. Used by `app/auth/error/page.tsx`.

- [ ] **Step 1: Test**

`tests/components/marketing/auth-error-view.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthErrorView } from "@/components/marketing/auth-error-view";

const copy = {
  title: "Sign-in link problem",
  reasonExpired: { heading: "Link expired", body: "Send a new one.", cta: "Send new link" },
  reasonUsed: { heading: "Link used", body: "Already used.", cta: "Send new link" },
  reasonGeneric: { heading: "Something went wrong", body: "Try again.", cta: "Back" },
  errorIdLabel: "Error ID"
};

describe("<AuthErrorView>", () => {
  it("renders the expired variant", () => {
    render(<AuthErrorView copy={copy} reason="expired" />);
    expect(screen.getByRole("heading", { name: /Link expired/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Send new link/i })).toHaveAttribute("href", "/login");
  });

  it("renders the used variant", () => {
    render(<AuthErrorView copy={copy} reason="used" />);
    expect(screen.getByRole("heading", { name: /Link used/i })).toBeInTheDocument();
  });

  it("falls back to generic for unknown reasons", () => {
    render(<AuthErrorView copy={copy} reason="something-weird" />);
    expect(screen.getByRole("heading", { name: /Something went wrong/i })).toBeInTheDocument();
  });

  it("shows error ID when provided", () => {
    render(<AuthErrorView copy={copy} reason="generic" errorId="ksef-abc-123" />);
    expect(screen.getByText(/ksef-abc-123/)).toBeInTheDocument();
  });

  it("omits error ID block when absent", () => {
    render(<AuthErrorView copy={copy} reason="generic" />);
    expect(screen.queryByText(/Error ID/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run-fail.**

- [ ] **Step 3: Create**

`components/marketing/auth-error-view.tsx`:

```tsx
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export interface AuthErrorCopy {
  title: string;
  reasonExpired: { heading: string; body: string; cta: string };
  reasonUsed: { heading: string; body: string; cta: string };
  reasonGeneric: { heading: string; body: string; cta: string };
  errorIdLabel: string;
}

export interface AuthErrorViewProps {
  copy: AuthErrorCopy;
  reason: string;
  errorId?: string;
}

function resolveReason(copy: AuthErrorCopy, reason: string) {
  if (reason === "expired") return copy.reasonExpired;
  if (reason === "used") return copy.reasonUsed;
  return copy.reasonGeneric;
}

export function AuthErrorView({ copy, reason, errorId }: AuthErrorViewProps) {
  const variant = resolveReason(copy, reason);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col items-center gap-5 px-5 py-16 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted text-text-muted">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className="text-h1 text-text-strong">{variant.heading}</h1>
      <p className="text-body text-text-muted">{variant.body}</p>
      <Link
        href="/login"
        className="inline-flex items-center justify-center rounded-md bg-accent px-5 py-3 text-small font-semibold text-white shadow-sm hover:bg-accent-hover transition-colors duration-hover ease-out"
      >
        {variant.cta}
      </Link>
      {errorId ? (
        <p className="font-mono text-micro text-text-muted">
          {copy.errorIdLabel}: <span data-testid="auth-error-id">{errorId}</span>
        </p>
      ) : null}
    </main>
  );
}
```

- [ ] **Step 4: Run-pass.** Expect 5/5.

- [ ] **Step 5: Commit**

```bash
git add components/marketing/auth-error-view.tsx tests/components/marketing/auth-error-view.test.tsx
git commit -m "feat(marketing): AuthErrorView — reason-based magic-link failure variants"
```

---

## Task 9: Rebuild `<LoginForm>` around new tokens

**Files:**
- Modify: `app/login/login-form.tsx`
- Test: `tests/components/marketing/login-form.test.tsx`

Preserve the existing Supabase OTP logic. Rewrite the visual chrome to match `/login` spec. Make labels configurable via props (so the EN mirror can pass English strings).

- [ ] **Step 1: Test**

`tests/components/marketing/login-form.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoginForm } from "@/app/login/login-form";

const baseCopy = {
  emailLabel: "Adres e-mail",
  emailPlaceholder: "twoj@adres.pl",
  submitButton: "Wyślij link logowania",
  sendingButton: "Wysyłam link…",
  sentTitle: "Sprawdź skrzynkę",
  sentBodyPrefix: "Link logowania wysłany na",
  sentResend: "Wyślij ponownie",
  errorGeneric: "Nie udało się wysłać linku. Spróbuj ponownie.",
  errorRateLimited: "Za dużo prób."
};

const signInWithOtpMock = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signInWithOtp: signInWithOtpMock }
  })
}));

beforeEach(() => {
  signInWithOtpMock.mockReset();
});

afterEach(() => {
  signInWithOtpMock.mockReset();
});

describe("<LoginForm>", () => {
  it("renders email input + submit button (idle state)", () => {
    render(<LoginForm copy={baseCopy} />);
    expect(screen.getByLabelText(/Adres e-mail/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Wyślij link logowania/i })).toBeInTheDocument();
  });

  it("calls Supabase signInWithOtp on submit and shows sent state", async () => {
    signInWithOtpMock.mockResolvedValue({ error: null });
    render(<LoginForm copy={baseCopy} />);
    fireEvent.change(screen.getByLabelText(/Adres e-mail/i), {
      target: { value: "test@firma.pl" }
    });
    fireEvent.click(screen.getByRole("button", { name: /Wyślij link logowania/i }));
    await waitFor(() => {
      expect(signInWithOtpMock).toHaveBeenCalledTimes(1);
    });
    expect(signInWithOtpMock.mock.calls[0][0].email).toBe("test@firma.pl");
    await waitFor(() => {
      expect(screen.getByText(/Sprawdź skrzynkę/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/test@firma\.pl/)).toBeInTheDocument();
  });

  it("shows the generic error when Supabase returns an error", async () => {
    signInWithOtpMock.mockResolvedValue({ error: { message: "boom", status: 500 } });
    render(<LoginForm copy={baseCopy} />);
    fireEvent.change(screen.getByLabelText(/Adres e-mail/i), {
      target: { value: "test@firma.pl" }
    });
    fireEvent.click(screen.getByRole("button", { name: /Wyślij link logowania/i }));
    await waitFor(() => {
      expect(screen.getByText(/Nie udało się wysłać linku/i)).toBeInTheDocument();
    });
  });

  it("shows the rate-limit message when Supabase returns 429", async () => {
    signInWithOtpMock.mockResolvedValue({ error: { message: "rate", status: 429 } });
    render(<LoginForm copy={baseCopy} />);
    fireEvent.change(screen.getByLabelText(/Adres e-mail/i), {
      target: { value: "test@firma.pl" }
    });
    fireEvent.click(screen.getByRole("button", { name: /Wyślij link logowania/i }));
    await waitFor(() => {
      expect(screen.getByText(/Za dużo prób/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run-fail.**

- [ ] **Step 3: Replace `app/login/login-form.tsx`**

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export interface LoginFormCopy {
  emailLabel: string;
  emailPlaceholder: string;
  submitButton: string;
  sendingButton: string;
  sentTitle: string;
  sentBodyPrefix: string;
  sentResend: string;
  errorGeneric: string;
  errorRateLimited: string;
}

export interface LoginFormProps {
  copy: LoginFormCopy;
}

type Status = "idle" | "submitting" | "sent" | "error" | "rate-limited";

export function LoginForm({ copy }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function submit(currentEmail: string) {
    setStatus("submitting");
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOtp({
      email: currentEmail,
      options: { emailRedirectTo: redirectTo }
    });
    if (error) {
      setStatus(error.status === 429 ? "rate-limited" : "error");
      return;
    }
    setStatus("sent");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submit(email);
  }

  if (status === "sent") {
    return (
      <div className="rounded-xl border border-border bg-surface-muted p-6 text-center text-small text-text-strong shadow-sm">
        <MailCheck className="mx-auto mb-3 h-6 w-6 text-success" />
        <p className="text-h3 text-text-strong">{copy.sentTitle}</p>
        <p className="mt-2 text-text">
          {copy.sentBodyPrefix} <strong className="text-text-strong">{email}</strong>
        </p>
        <button
          type="button"
          onClick={() => submit(email)}
          className="mt-4 text-small font-medium text-accent hover:text-accent-hover"
        >
          {copy.sentResend}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-small">
        <span className="font-medium text-text">{copy.emailLabel}</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={copy.emailPlaceholder}
          autoComplete="email"
          className="h-11 rounded-md border border-border bg-surface px-4 text-body text-text-strong outline-none transition-colors duration-hover ease-out focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
      </label>
      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 text-small font-semibold text-white shadow-sm transition-colors duration-hover ease-out hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "submitting" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> {copy.sendingButton}
          </>
        ) : (
          copy.submitButton
        )}
      </button>
      {status === "error" ? (
        <p className="text-small text-danger">{copy.errorGeneric}</p>
      ) : null}
      {status === "rate-limited" ? (
        <p className="text-small text-danger">{copy.errorRateLimited}</p>
      ) : null}
    </form>
  );
}
```

- [ ] **Step 4: Run-pass.** Expect 4/4.

- [ ] **Step 5: Commit**

```bash
git add app/login/login-form.tsx tests/components/marketing/login-form.test.tsx
git commit -m "refactor(login): LoginForm accepts copy prop + matches new design tokens"
```

---

## Task 10: `<LandingPage>` shared component

**Files:**
- Create: `components/marketing/landing-page.tsx`
- Test: `tests/components/marketing/landing-page.test.tsx`

9-section landing composition. Uses Sprint 1 components (`PublicHeader`, `TrustStrip`, `PriceSnippet`, `FounderCard`, `LegalFooter`) + Task 2 (`MarketingFAQ`) + Task 3 (`PublicPricingSlider`). The "live demo strip" is static for Sprint 2 (a single placeholder card with the caption — Sprint 4 can wire it interactively).

- [ ] **Step 1: Test**

`tests/components/marketing/landing-page.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LandingPage } from "@/components/marketing/landing-page";

describe("<LandingPage>", () => {
  it("renders the hero headline and CTAs (PL)", () => {
    render(<LandingPage locale="pl" />);
    expect(screen.getByRole("heading", { level: 1, name: /Faktura KSeF dla klienta z zagranicy/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Zacznij za darmo/i })).toHaveAttribute("href", "/login");
  });

  it("renders the three value props", () => {
    render(<LandingPage locale="pl" />);
    expect(screen.getByText(/MF-compliant PDF/i)).toBeInTheDocument();
    expect(screen.getByText(/Bez subskrypcji/)).toBeInTheDocument();
    expect(screen.getByText(/Dane w UE/i)).toBeInTheDocument();
  });

  it("renders the FAQ section", () => {
    render(<LandingPage locale="pl" />);
    expect(screen.getByRole("heading", { name: /Najczęstsze pytania/i })).toBeInTheDocument();
    expect(screen.getByText(/Czy potrzebuję integracji z KSeF/i)).toBeInTheDocument();
  });

  it("renders the founder card", () => {
    render(<LandingPage locale="pl" />);
    expect(screen.getByRole("heading", { name: /Stoi za tym konkretny człowiek/i })).toBeInTheDocument();
  });

  it("renders the LegalFooter", () => {
    render(<LandingPage locale="pl" />);
    expect(screen.getByText(/NIP/)).toBeInTheDocument();
  });

  it("switches headlines for EN locale", () => {
    render(<LandingPage locale="en" />);
    expect(screen.getByRole("heading", { level: 1, name: /Polish KSeF invoice, translated/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Start free/i })).toHaveAttribute("href", "/login");
  });
});
```

- [ ] **Step 2: Run-fail.**

- [ ] **Step 3: Create**

`components/marketing/landing-page.tsx`:

```tsx
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { LegalFooter } from "@/components/layout/legal-footer";
import { TrustStrip } from "@/components/trust/trust-strip";
import { PriceSnippet } from "@/components/trust/price-snippet";
import { FounderCard } from "@/components/trust/founder-card";
import { MarketingFAQ } from "@/components/marketing/marketing-faq";
import { PublicPricingSlider } from "@/components/marketing/public-pricing-slider";
import { marketingCopy, type MarketingLocale } from "@/lib/marketing/copy";
import { FOUNDER } from "@/lib/brand/founder";

export interface LandingPageProps {
  locale: MarketingLocale;
}

export function LandingPage({ locale }: LandingPageProps) {
  const t = marketingCopy[locale].landing;
  const pricingLabels = {
    packageLabel: marketingCopy[locale].pricing.packageLabel,
    totalLabel: marketingCopy[locale].pricing.totalLabel,
    perInvoiceLabel: marketingCopy[locale].pricing.perInvoiceLabel
  };

  return (
    <div className="flex min-h-screen flex-col bg-surface text-text-strong">
      <PublicHeader locale={locale} />
      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <section className="mx-auto w-full max-w-5xl px-5 py-20 text-center md:px-8 md:py-28">
          <h1 className="text-display text-text-strong">{t.heroHeadline}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-body text-text-muted">{t.heroSubhead}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-md bg-accent px-6 text-body font-semibold text-white shadow-sm transition-colors duration-hover ease-out hover:bg-accent-hover"
            >
              {t.heroCtaPrimary}
            </Link>
            <Link
              href="#demo"
              className="inline-flex h-12 items-center justify-center rounded-md border border-border bg-surface px-6 text-body font-medium text-text transition-colors duration-hover ease-out hover:bg-surface-muted"
            >
              {t.heroCtaSecondary}
            </Link>
          </div>
          <div className="mt-6 flex justify-center">
            <PriceSnippet locale={locale} variant="full" />
          </div>
        </section>

        {/* Live demo strip (static for Sprint 2) */}
        <section id="demo" className="bg-surface-muted">
          <div className="mx-auto max-w-6xl px-5 py-16 md:px-8">
            <h2 className="text-center text-h2 text-text-strong">{t.demoStripHeading}</h2>
            <p className="mt-2 text-center text-small text-text-muted">{t.demoStripCaption}</p>
            <div className="mt-8 rounded-xl border border-border bg-surface p-12 text-center text-small text-text-muted shadow-sm">
              <p className="font-medium text-text-strong">Demo — wkrótce interaktywne</p>
              <p className="mt-2">Tłumaczenia są generowane przez API w czasie rzeczywistym.</p>
            </div>
          </div>
        </section>

        {/* Three value props */}
        <section className="mx-auto w-full max-w-6xl px-5 py-20 md:px-8">
          <h2 className="text-center text-h2 text-text-strong">{t.valueProps.heading}</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {t.valueProps.items.map((item) => (
              <div key={item.title} className="rounded-xl border border-border bg-surface p-6 shadow-sm">
                <CheckCircle2 className="h-6 w-6 text-accent" aria-hidden="true" />
                <h3 className="mt-3 text-h3 text-text-strong">{item.title}</h3>
                <p className="mt-2 text-small text-text">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* TrustStrip */}
        <section className="bg-surface-muted py-12">
          <div className="mx-auto max-w-6xl px-5 md:px-8">
            <TrustStrip locale={locale} />
          </div>
        </section>

        {/* Pricing teaser */}
        <section className="mx-auto w-full max-w-4xl px-5 py-20 md:px-8">
          <div className="text-center">
            <h2 className="text-h2 text-text-strong">{t.pricingTeaser.heading}</h2>
            <p className="mt-2 text-small text-text-muted">{t.pricingTeaser.sliderLabel}</p>
          </div>
          <div className="mt-8">
            <PublicPricingSlider locale={locale} labels={pricingLabels} />
          </div>
          <div className="mt-6 text-center">
            <Link
              href="/pricing"
              className="inline-flex text-small font-medium text-accent hover:text-accent-hover"
            >
              {t.pricingTeaser.cta} →
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto w-full max-w-3xl px-5 py-20 md:px-8">
          <MarketingFAQ heading={t.faq.heading} items={t.faq.items} />
        </section>

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

        {/* Final CTA */}
        <section className="mx-auto w-full max-w-3xl px-5 py-20 text-center md:px-8">
          <h2 className="text-h1 text-text-strong">{t.finalCta.heading}</h2>
          <div className="mt-6">
            <Link
              href="/login"
              className="inline-flex h-12 items-center justify-center rounded-md bg-accent px-8 text-body font-semibold text-white shadow-sm transition-colors duration-hover ease-out hover:bg-accent-hover"
            >
              {t.finalCta.cta}
            </Link>
          </div>
        </section>
      </main>
      <LegalFooter locale={locale} />
    </div>
  );
}
```

- [ ] **Step 4: Run-pass.** Expect 6/6.

- [ ] **Step 5: Commit**

```bash
git add components/marketing/landing-page.tsx tests/components/marketing/landing-page.test.tsx
git commit -m "feat(marketing): LandingPage — 9-section composition (PL+EN)"
```

---

## Task 11: `<PricingPage>` shared component

**Files:**
- Create: `components/marketing/pricing-page.tsx`
- Test: `tests/components/marketing/pricing-page.test.tsx`

Hero + slider + ladder table + free tier + included list + FAQ + final CTA.

- [ ] **Step 1: Test**

`tests/components/marketing/pricing-page.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PricingPage } from "@/components/marketing/pricing-page";

describe("<PricingPage>", () => {
  it("renders the hero headline (PL)", () => {
    render(<PricingPage locale="pl" />);
    expect(screen.getByRole("heading", { level: 1, name: /Cennik prosty jak faktura/i })).toBeInTheDocument();
  });

  it("renders the pricing slider", () => {
    render(<PricingPage locale="pl" />);
    expect(screen.getByRole("slider")).toBeInTheDocument();
  });

  it("renders the price ladder table with all 5 sizes", () => {
    render(<PricingPage locale="pl" />);
    expect(screen.getByRole("cell", { name: "5" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "100" })).toBeInTheDocument();
  });

  it("renders the free tier callout", () => {
    render(<PricingPage locale="pl" />);
    expect(screen.getByRole("heading", { name: /1 darmowa faktura w miesiącu/i })).toBeInTheDocument();
  });

  it("renders the pricing FAQ", () => {
    render(<PricingPage locale="pl" />);
    expect(screen.getByRole("heading", { name: /Pytania o cenę/i })).toBeInTheDocument();
  });

  it("switches the hero headline for EN locale", () => {
    render(<PricingPage locale="en" />);
    expect(screen.getByRole("heading", { level: 1, name: /Pricing as simple as an invoice/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run-fail.**

- [ ] **Step 3: Create**

`components/marketing/pricing-page.tsx`:

```tsx
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { PublicHeader } from "@/components/layout/public-header";
import { LegalFooter } from "@/components/layout/legal-footer";
import { MarketingFAQ } from "@/components/marketing/marketing-faq";
import { PublicPricingSlider } from "@/components/marketing/public-pricing-slider";
import { PricingLadderTable } from "@/components/marketing/pricing-ladder-table";
import { marketingCopy, type MarketingLocale } from "@/lib/marketing/copy";

export interface PricingPageProps {
  locale: MarketingLocale;
}

export function PricingPage({ locale }: PricingPageProps) {
  const t = marketingCopy[locale].pricing;
  const sliderLabels = {
    packageLabel: t.packageLabel,
    totalLabel: t.totalLabel,
    perInvoiceLabel: t.perInvoiceLabel
  };
  const ladderLabels = t.ladder;

  return (
    <div className="flex min-h-screen flex-col bg-surface text-text-strong">
      <PublicHeader locale={locale} />
      <main className="flex flex-1 flex-col">
        <section className="mx-auto w-full max-w-4xl px-5 pt-20 pb-12 text-center md:px-8">
          <h1 className="text-display text-text-strong">{t.heroHeadline}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-body text-text-muted">{t.heroSubhead}</p>
        </section>

        <section className="mx-auto w-full max-w-4xl px-5 pb-16 md:px-8">
          <h2 className="text-h2 text-text-strong">{t.sliderHeading}</h2>
          <div className="mt-6">
            <PublicPricingSlider locale={locale} labels={sliderLabels} />
          </div>
          <p className="mt-3 text-small text-text-muted">{t.vatNote}</p>
        </section>

        <section className="mx-auto w-full max-w-4xl px-5 pb-16 md:px-8">
          <h2 className="text-h2 text-text-strong">{t.ladderHeading}</h2>
          <div className="mt-6">
            <PricingLadderTable locale={locale} labels={ladderLabels} />
          </div>
        </section>

        <section className="bg-surface-muted py-16">
          <div className="mx-auto max-w-3xl px-5 text-center md:px-8">
            <h2 className="text-h2 text-text-strong">{t.freeTierHeading}</h2>
            <p className="mt-3 text-body text-text-muted">{t.freeTierBody}</p>
          </div>
        </section>

        <section className="mx-auto w-full max-w-3xl px-5 py-16 md:px-8">
          <h2 className="text-h2 text-text-strong">{t.includedHeading}</h2>
          <ul className="mt-6 space-y-3">
            {t.included.map((item) => (
              <li key={item} className="flex items-start gap-3 text-body text-text">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto w-full max-w-3xl px-5 py-16 md:px-8">
          <MarketingFAQ heading={t.faqHeading} items={t.faq} />
        </section>

        <section className="mx-auto w-full max-w-3xl px-5 py-20 text-center md:px-8">
          <Link
            href="/login"
            className="inline-flex h-12 items-center justify-center rounded-md bg-accent px-8 text-body font-semibold text-white shadow-sm transition-colors duration-hover ease-out hover:bg-accent-hover"
          >
            {t.finalCta}
          </Link>
        </section>
      </main>
      <LegalFooter locale={locale} />
    </div>
  );
}
```

- [ ] **Step 4: Run-pass.** Expect 6/6.

- [ ] **Step 5: Commit**

```bash
git add components/marketing/pricing-page.tsx tests/components/marketing/pricing-page.test.tsx
git commit -m "feat(marketing): PricingPage — hero + slider + ladder + FAQ"
```

---

## Task 12: `<SecurityPage>` shared component

**Files:**
- Create: `components/marketing/security-page.tsx`
- Test: `tests/components/marketing/security-page.test.tsx`

The credibility page — TL;DR, data flow, storage table, sub-processors, RODO, MF, founder.

- [ ] **Step 1: Test**

`tests/components/marketing/security-page.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SecurityPage } from "@/components/marketing/security-page";

describe("<SecurityPage>", () => {
  it("renders the hero headline (PL)", () => {
    render(<SecurityPage locale="pl" />);
    expect(screen.getByRole("heading", { level: 1, name: /Bezpieczeństwo i prywatność danych/i })).toBeInTheDocument();
  });

  it("renders the TL;DR section with all 4 items", () => {
    render(<SecurityPage locale="pl" />);
    expect(screen.getByRole("heading", { name: /W skrócie/i })).toBeInTheDocument();
    expect(screen.getByText(/Wszystkie dane w UE/)).toBeInTheDocument();
    expect(screen.getByText(/Szyfrowanie/)).toBeInTheDocument();
  });

  it("renders the data flow diagram", () => {
    render(<SecurityPage locale="pl" />);
    expect(screen.getByText(/Twój komputer/)).toBeInTheDocument();
    expect(screen.getByText(/Supabase Frankfurt/)).toBeInTheDocument();
  });

  it("renders the storage table", () => {
    render(<SecurityPage locale="pl" />);
    expect(screen.getByRole("columnheader", { name: /Czas przechowywania/i })).toBeInTheDocument();
    expect(screen.getByText(/30 dni od uploadu/i)).toBeInTheDocument();
  });

  it("renders the sub-processors table", () => {
    render(<SecurityPage locale="pl" />);
    expect(screen.getByRole("heading", { name: /Sub-procesorzy/i })).toBeInTheDocument();
    expect(screen.getByText("Supabase")).toBeInTheDocument();
    expect(screen.getByText("OpenAI")).toBeInTheDocument();
  });

  it("renders the founder card", () => {
    render(<SecurityPage locale="pl" />);
    expect(screen.getByRole("heading", { name: /Stoi za tym konkretny człowiek/i })).toBeInTheDocument();
  });

  it("renders the EN mirror", () => {
    render(<SecurityPage locale="en" />);
    expect(screen.getByRole("heading", { level: 1, name: /Data security and privacy/i })).toBeInTheDocument();
    expect(screen.getByText(/All data in the EU/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run-fail.**

- [ ] **Step 3: Create**

`components/marketing/security-page.tsx`:

```tsx
import { PublicHeader } from "@/components/layout/public-header";
import { LegalFooter } from "@/components/layout/legal-footer";
import { SecurityCard } from "@/components/trust/security-card";
import { FounderCard } from "@/components/trust/founder-card";
import { DataFlowDiagram, type FlowStep } from "@/components/marketing/data-flow-diagram";
import { SubProcessorsTable } from "@/components/marketing/sub-processors-table";
import { marketingCopy, type MarketingLocale } from "@/lib/marketing/copy";
import { FOUNDER } from "@/lib/brand/founder";

export interface SecurityPageProps {
  locale: MarketingLocale;
}

const FLOW_ICONS: ReadonlyArray<FlowStep["icon"]> = [
  "computer",
  "shield",
  "translate",
  "pdf",
  "trash"
];

function buildFlowSteps(labels: ReadonlyArray<string>): ReadonlyArray<FlowStep> {
  return FLOW_ICONS.map((icon, index) => ({ icon, label: labels[index] }));
}

export function SecurityPage({ locale }: SecurityPageProps) {
  const t = marketingCopy[locale].security;

  const flowLabelsPl = [
    "Twój komputer",
    "Supabase Frankfurt",
    "Tłumaczenie OpenAI",
    "Dostarczenie PDF",
    "Kasowanie po 30 dniach"
  ];
  const flowLabelsEn = [
    "Your computer",
    "Supabase Frankfurt",
    "OpenAI translation",
    "PDF delivery",
    "Deleted after 30 days"
  ];
  const flowSteps = buildFlowSteps(locale === "pl" ? flowLabelsPl : flowLabelsEn);

  return (
    <div className="flex min-h-screen flex-col bg-surface text-text-strong">
      <PublicHeader locale={locale} />
      <main className="flex flex-1 flex-col">
        <section className="mx-auto w-full max-w-4xl px-5 pt-20 pb-12 text-center md:px-8">
          <h1 className="text-display text-text-strong">{t.heroHeadline}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-body text-text-muted">{t.heroSubhead}</p>
        </section>

        <section className="mx-auto w-full max-w-3xl px-5 pb-12 md:px-8">
          <SecurityCard title={t.tldrTitle} items={t.tldrItems} />
        </section>

        <section className="mx-auto w-full max-w-5xl px-5 pb-16 md:px-8">
          <h2 className="text-h2 text-text-strong">{t.dataFlowHeading}</h2>
          <div className="mt-6">
            <DataFlowDiagram steps={flowSteps} />
          </div>
        </section>

        <section className="mx-auto w-full max-w-4xl px-5 pb-16 md:px-8">
          <h2 className="text-h2 text-text-strong">{t.whereLivesHeading}</h2>
          <p className="mt-3 text-body text-text">{t.whereLivesBody}</p>
          <p className="mt-4 inline-flex rounded-md bg-surface-muted px-3 py-2 font-mono text-small text-text-strong">
            {t.regionBadge}
          </p>
        </section>

        <section className="mx-auto w-full max-w-4xl px-5 pb-16 md:px-8">
          <h2 className="text-h2 text-text-strong">{t.storageHeading}</h2>
          <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            <table className="w-full">
              <thead className="bg-surface-muted">
                <tr>
                  <th className="px-5 py-3 text-left text-micro uppercase tracking-wide text-text-muted">
                    {t.storage.dataHeader}
                  </th>
                  <th className="px-5 py-3 text-left text-micro uppercase tracking-wide text-text-muted">
                    {t.storage.retentionHeader}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {t.storage.rows.map((row) => (
                  <tr key={row.data}>
                    <td className="px-5 py-3 text-body text-text-strong">{row.data}</td>
                    <td className="px-5 py-3 text-body text-text">{row.retention}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mx-auto w-full max-w-4xl px-5 pb-16 md:px-8">
          <h2 className="text-h2 text-text-strong">{t.notHeading}</h2>
          <ul className="mt-4 space-y-3">
            {t.notItems.map((item) => (
              <li key={item} className="text-body text-text">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto w-full max-w-5xl px-5 pb-16 md:px-8">
          <h2 className="text-h2 text-text-strong">{t.subProcessorsHeading}</h2>
          <p className="mt-3 max-w-3xl text-body text-text">{t.subProcessorsIntro}</p>
          <div className="mt-6">
            <SubProcessorsTable
              labels={{
                nameHeader: t.subProcessors.nameHeader,
                roleHeader: t.subProcessors.roleHeader,
                locationHeader: t.subProcessors.locationHeader
              }}
              rows={t.subProcessors.rows}
            />
          </div>
        </section>

        <section className="mx-auto w-full max-w-4xl px-5 pb-16 md:px-8">
          <h2 className="text-h2 text-text-strong">{t.rodoHeading}</h2>
          <p className="mt-3 text-body text-text">{t.rodoIntro}</p>
          <ul className="mt-4 space-y-2">
            {t.rodoRights.map((right) => (
              <li key={right} className="text-body text-text">
                • {right}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-body text-text">
            {t.rodoContact}{" "}
            <a
              href={`mailto:${FOUNDER.contactEmail}`}
              className="font-medium text-accent hover:text-accent-hover"
            >
              {FOUNDER.contactEmail}
            </a>
          </p>
        </section>

        <section className="mx-auto w-full max-w-4xl px-5 pb-16 md:px-8">
          <h2 className="text-h2 text-text-strong">{t.mfHeading}</h2>
          <p className="mt-3 text-body text-text">{t.mfBody}</p>
          <p className="mt-4">
            <a
              href="https://www.podatki.gov.pl/ksef/struktury-ksef/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-small font-medium text-accent hover:text-accent-hover"
            >
              {t.mfSchemaLink} →
            </a>
          </p>
        </section>

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

        <section className="mx-auto w-full max-w-4xl px-5 pb-20 pt-16 md:px-8">
          <h2 className="text-h2 text-text-strong">{t.incidentsHeading}</h2>
          <p className="mt-3 text-body text-text">{t.incidentsBody}</p>
        </section>
      </main>
      <LegalFooter locale={locale} />
    </div>
  );
}
```

- [ ] **Step 4: Run-pass.** Expect 7/7.

- [ ] **Step 5: Commit**

```bash
git add components/marketing/security-page.tsx tests/components/marketing/security-page.test.tsx
git commit -m "feat(marketing): SecurityPage — credibility page with all trust sections"
```

---

## Task 13: `<TermsPage>` + `<PrivacyPage>` shared components

**Files:**
- Create: `components/marketing/terms-page.tsx`
- Create: `components/marketing/privacy-page.tsx`

Two thin shells around `<LegalDocLayout>` (Task 7) with placeholder content stubs. Real legal text lands in a separate content PR (out of scope here).

- [ ] **Step 1: Create `components/marketing/terms-page.tsx`**

```tsx
import { PublicHeader } from "@/components/layout/public-header";
import { LegalFooter } from "@/components/layout/legal-footer";
import { LegalDocLayout } from "@/components/marketing/legal-doc-layout";
import { marketingCopy, type MarketingLocale } from "@/lib/marketing/copy";

const LAST_UPDATED = "2026-05-18";

export interface TermsPageProps {
  locale: MarketingLocale;
}

export function TermsPage({ locale }: TermsPageProps) {
  const t = marketingCopy[locale].terms;
  const sections = [
    { id: "wstep", title: t.placeholderHeading, content: t.placeholderBody }
  ];

  return (
    <div className="flex min-h-screen flex-col bg-surface text-text-strong">
      <PublicHeader locale={locale} />
      <main className="flex flex-1 flex-col">
        <LegalDocLayout
          title={t.heroHeadline}
          lastUpdatedLabel={t.lastUpdated}
          lastUpdatedDate={LAST_UPDATED}
          tocHeading={t.tocHeading}
          sections={sections}
        />
      </main>
      <LegalFooter locale={locale} />
    </div>
  );
}
```

- [ ] **Step 2: Create `components/marketing/privacy-page.tsx`**

```tsx
import { PublicHeader } from "@/components/layout/public-header";
import { LegalFooter } from "@/components/layout/legal-footer";
import { LegalDocLayout } from "@/components/marketing/legal-doc-layout";
import { marketingCopy, type MarketingLocale } from "@/lib/marketing/copy";

const LAST_UPDATED = "2026-05-18";

export interface PrivacyPageProps {
  locale: MarketingLocale;
}

export function PrivacyPage({ locale }: PrivacyPageProps) {
  const t = marketingCopy[locale].privacy;
  const sections = [
    { id: "wstep", title: t.placeholderHeading, content: t.placeholderBody }
  ];

  return (
    <div className="flex min-h-screen flex-col bg-surface text-text-strong">
      <PublicHeader locale={locale} />
      <main className="flex flex-1 flex-col">
        <LegalDocLayout
          title={t.heroHeadline}
          lastUpdatedLabel={t.lastUpdated}
          lastUpdatedDate={LAST_UPDATED}
          tocHeading={t.tocHeading}
          sections={sections}
        />
      </main>
      <LegalFooter locale={locale} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/marketing/terms-page.tsx components/marketing/privacy-page.tsx
git commit -m "feat(marketing): TermsPage + PrivacyPage stubs with LegalDocLayout"
```

No tests added — these pages are trivial assemblies of already-tested components (`LegalDocLayout`, `PublicHeader`, `LegalFooter`). E2E coverage in Task 16 verifies they render.

---

## Task 14: Wire PL route shells

**Files:**
- Modify: `app/page.tsx` (rebuild)
- Modify: `app/login/page.tsx` (rebuild)
- Create: `app/pricing/page.tsx`
- Create: `app/security/page.tsx`
- Create: `app/terms/page.tsx`
- Create: `app/privacy/page.tsx`
- Create: `app/auth/error/page.tsx`

Each route file is a 5–10 line shell that mounts the shared component. Server components by default; only `app/auth/error/page.tsx` reads `searchParams`.

- [ ] **Step 1: Replace `app/page.tsx`**

```tsx
import { LandingPage } from "@/components/marketing/landing-page";

export default function HomePage() {
  return <LandingPage locale="pl" />;
}
```

- [ ] **Step 2: Replace `app/login/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getOptionalUser } from "@/lib/auth/require-user";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { LegalFooter } from "@/components/layout/legal-footer";
import { LoginForm } from "@/app/login/login-form";
import { marketingCopy } from "@/lib/marketing/copy";

export default async function LoginPage() {
  const user = await getOptionalUser();
  if (user) redirect("/app");

  const t = marketingCopy.pl.login;

  return (
    <div className="flex min-h-screen flex-col bg-surface-muted text-text-strong">
      <main className="flex flex-1 items-center justify-center px-5 py-12 md:px-8">
        <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-sm">
          <div className="flex justify-center">
            <BrandLockup href="/" size="lg" />
          </div>
          <h1 className="mt-8 text-h2 text-text-strong">{t.title}</h1>
          <p className="mt-1 text-small text-text-muted">{t.subtitle}</p>
          <div className="mt-6">
            <LoginForm copy={t} />
          </div>
          <p className="mt-6 text-center text-small text-text-muted">{t.noAccountHint}</p>
        </div>
      </main>
      <LegalFooter />
      <div className="border-t border-border bg-surface py-4 text-center">
        <Link href="/" className="text-small text-text-muted hover:text-text-strong">
          {t.backToHome}
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `app/pricing/page.tsx`**

```tsx
import { PricingPage } from "@/components/marketing/pricing-page";

export default function Pricing() {
  return <PricingPage locale="pl" />;
}
```

- [ ] **Step 4: Create `app/security/page.tsx`**

```tsx
import { SecurityPage } from "@/components/marketing/security-page";

export default function Security() {
  return <SecurityPage locale="pl" />;
}
```

- [ ] **Step 5: Create `app/terms/page.tsx`**

```tsx
import { TermsPage } from "@/components/marketing/terms-page";

export default function Terms() {
  return <TermsPage locale="pl" />;
}
```

- [ ] **Step 6: Create `app/privacy/page.tsx`**

```tsx
import { PrivacyPage } from "@/components/marketing/privacy-page";

export default function Privacy() {
  return <PrivacyPage locale="pl" />;
}
```

- [ ] **Step 7: Create `app/auth/error/page.tsx`**

```tsx
import { BrandLockup } from "@/components/brand/brand-lockup";
import { LegalFooter } from "@/components/layout/legal-footer";
import { AuthErrorView } from "@/components/marketing/auth-error-view";
import { marketingCopy } from "@/lib/marketing/copy";

export default async function AuthErrorPage({
  searchParams
}: {
  searchParams: Promise<{ reason?: string; error_id?: string }>;
}) {
  const params = await searchParams;
  const reason = params.reason ?? "generic";
  const errorId = params.error_id;

  return (
    <div className="flex min-h-screen flex-col bg-surface-muted text-text-strong">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-5 py-3 md:px-8">
          <BrandLockup href="/" size="md" />
        </div>
      </header>
      <AuthErrorView copy={marketingCopy.pl.authError} reason={reason} errorId={errorId} />
      <LegalFooter />
    </div>
  );
}
```

- [ ] **Step 8: Verify the build still passes**

```bash
npm run typecheck && npm run build 2>&1 | tail -15
```

Expected: build succeeds. New routes show in summary: `/`, `/pricing`, `/security`, `/terms`, `/privacy`, `/auth/error`, `/login`.

- [ ] **Step 9: Commit**

```bash
git add 'app/page.tsx' 'app/login/page.tsx' app/pricing/page.tsx app/security/page.tsx app/terms/page.tsx app/privacy/page.tsx 'app/auth/error/page.tsx'
git commit -m "feat(routes): wire PL public-page shells (/, /pricing, /security, /terms, /privacy, /login, /auth/error)"
```

---

## Task 15: Wire EN mirror route shells

**Files:**
- Create: `app/en/page.tsx`
- Create: `app/en/pricing/page.tsx`
- Create: `app/en/security/page.tsx`
- Create: `app/en/terms/page.tsx`
- Create: `app/en/privacy/page.tsx`
- Create: `app/en/login/page.tsx`

Each is identical to the PL shell but passes `locale="en"`.

- [ ] **Step 1: Create `app/en/page.tsx`**

```tsx
import { LandingPage } from "@/components/marketing/landing-page";

export default function EnHomePage() {
  return <LandingPage locale="en" />;
}
```

- [ ] **Step 2: Create `app/en/pricing/page.tsx`**

```tsx
import { PricingPage } from "@/components/marketing/pricing-page";

export default function EnPricing() {
  return <PricingPage locale="en" />;
}
```

- [ ] **Step 3: Create `app/en/security/page.tsx`**

```tsx
import { SecurityPage } from "@/components/marketing/security-page";

export default function EnSecurity() {
  return <SecurityPage locale="en" />;
}
```

- [ ] **Step 4: Create `app/en/terms/page.tsx`**

```tsx
import { TermsPage } from "@/components/marketing/terms-page";

export default function EnTerms() {
  return <TermsPage locale="en" />;
}
```

- [ ] **Step 5: Create `app/en/privacy/page.tsx`**

```tsx
import { PrivacyPage } from "@/components/marketing/privacy-page";

export default function EnPrivacy() {
  return <PrivacyPage locale="en" />;
}
```

- [ ] **Step 6: Create `app/en/login/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getOptionalUser } from "@/lib/auth/require-user";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { LegalFooter } from "@/components/layout/legal-footer";
import { LoginForm } from "@/app/login/login-form";
import { marketingCopy } from "@/lib/marketing/copy";

export default async function EnLoginPage() {
  const user = await getOptionalUser();
  if (user) redirect("/app");

  const t = marketingCopy.en.login;

  return (
    <div className="flex min-h-screen flex-col bg-surface-muted text-text-strong">
      <main className="flex flex-1 items-center justify-center px-5 py-12 md:px-8">
        <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 shadow-sm">
          <div className="flex justify-center">
            <BrandLockup href="/en" size="lg" />
          </div>
          <h1 className="mt-8 text-h2 text-text-strong">{t.title}</h1>
          <p className="mt-1 text-small text-text-muted">{t.subtitle}</p>
          <div className="mt-6">
            <LoginForm copy={t} />
          </div>
          <p className="mt-6 text-center text-small text-text-muted">{t.noAccountHint}</p>
        </div>
      </main>
      <LegalFooter locale="en" />
      <div className="border-t border-border bg-surface py-4 text-center">
        <Link href="/en" className="text-small text-text-muted hover:text-text-strong">
          {t.backToHome}
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Build verify**

```bash
npm run typecheck && npm run build 2>&1 | grep -E "/en"
```

Expected: build references `/en`, `/en/pricing`, `/en/security`, `/en/terms`, `/en/privacy`, `/en/login`.

- [ ] **Step 8: Commit**

```bash
git add 'app/en/'
git commit -m "feat(routes): EN mirror shells for landing, pricing, security, terms, privacy, login"
```

---

## Task 16: E2E coverage for public pages

**Files:**
- Create: `tests/e2e/sprint-2-public-pages.spec.ts`

One spec, multiple smoke tests. Each test loads a page, asserts the key headline + the LegalFooter is present + at least one chrome element.

- [ ] **Step 1: Create the spec**

`tests/e2e/sprint-2-public-pages.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test("landing page (/) renders with new chrome", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: /Faktura KSeF dla klienta z zagranicy/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Zacznij za darmo/i })).toHaveAttribute("href", "/login");
  await expect(page.getByText(/NIP/)).toBeVisible(); // LegalFooter
});

test("EN landing page (/en) renders", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1, name: /Polish KSeF invoice, translated/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Start free/i })).toBeVisible();
});

test("pricing page renders the slider + ladder", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { level: 1, name: /Cennik prosty jak faktura/i })).toBeVisible();
  await expect(page.getByRole("slider")).toBeVisible();
  await expect(page.getByRole("cell", { name: "5" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "100" })).toBeVisible();
});

test("security page renders TL;DR + sub-processors", async ({ page }) => {
  await page.goto("/security");
  await expect(page.getByRole("heading", { level: 1, name: /Bezpieczeństwo i prywatność danych/i })).toBeVisible();
  await expect(page.getByText(/Wszystkie dane w UE/)).toBeVisible();
  await expect(page.getByText("Supabase")).toBeVisible();
  await expect(page.getByText("OpenAI")).toBeVisible();
});

test("terms page renders the TOC + content stub", async ({ page }) => {
  await page.goto("/terms");
  await expect(page.getByRole("heading", { level: 1, name: /Regulamin/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Spis treści/i })).toBeVisible();
});

test("privacy page renders the TOC + content stub", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1, name: /Polityka prywatności/i })).toBeVisible();
});

test("login page renders with new chrome", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /Zaloguj się/i })).toBeVisible();
  await expect(page.getByLabel(/Adres e-mail/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Wyślij link logowania/i })).toBeVisible();
});

test("auth error page renders expired variant via ?reason=expired", async ({ page }) => {
  await page.goto("/auth/error?reason=expired");
  await expect(page.getByRole("heading", { name: /Link wygasł/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Wyślij nowy link/i })).toHaveAttribute("href", "/login");
});

test("auth error page falls back to generic for unknown reasons", async ({ page }) => {
  await page.goto("/auth/error?reason=random");
  await expect(page.getByRole("heading", { name: /Coś poszło nie tak/i })).toBeVisible();
});

test("public header CTA links to /login", async ({ page }) => {
  await page.goto("/pricing");
  const cta = page.getByRole("link", { name: /Zaloguj się/i });
  await expect(cta).toHaveAttribute("href", "/login");
});
```

- [ ] **Step 2: Run E2E**

```bash
tmux kill-session -t dev 2>/dev/null
npm run test:e2e -- sprint-2-public-pages 2>&1 | tail -15
```

Expected: 10/10 passing.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/sprint-2-public-pages.spec.ts
git commit -m "test(e2e): sprint 2 public pages smoke (10 routes)"
```

---

## Task 17: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 2: Unit + integration tests**

```bash
tmux kill-session -t dev 2>/dev/null
tmux new-session -d -s dev "npx next dev"
sleep 8 && curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/
npm test -- --run 2>&1 | tail -10
tmux kill-session -t dev 2>/dev/null
```

Expected: HTTP 200. All non-flaky tests pass (the pre-existing OpenAI-dependent translation-cache failures from Sprint 1's verification are not Sprint 2's responsibility).

- [ ] **Step 3: Full E2E**

```bash
tmux kill-session -t dev 2>/dev/null
npm run test:e2e 2>&1 | tail -25
```

Expected: 15 Sprint 1 tests + 10 Sprint 2 tests = 25 passing.

- [ ] **Step 4: Build**

```bash
npm run build 2>&1 | tail -20
```

Expected: clean build. Route summary shows all new routes (`/`, `/pricing`, `/security`, `/terms`, `/privacy`, `/login`, `/auth/error`, `/en`, `/en/pricing`, `/en/security`, `/en/terms`, `/en/privacy`, `/en/login`).

- [ ] **Step 5: Manual visual smoke**

```bash
tmux kill-session -t dev 2>/dev/null
tmux new-session -d -s dev "npx next dev"
sleep 6
```

Open in browser:
- `http://localhost:3000/` — new landing, Stripe Purple CTAs, founder card visible
- `http://localhost:3000/pricing` — slider interactive, ladder shows highlighted row when slider changes
- `http://localhost:3000/security` — all sections render, sub-processors table visible
- `http://localhost:3000/login` — centered card on muted background
- `http://localhost:3000/en` — EN headline visible

```bash
tmux kill-session -t dev 2>/dev/null
```

- [ ] **Step 6: No commit — verification task only**

If any step fails, fix in its own commit (don't bundle into the verification task).

---

## Explicit deferrals (NOT in Sprint 2)

- **Live demo strip** on the landing page — Sprint 2 ships a static placeholder card. Interactive version with real PDF preview deferred to Sprint 4 polish.
- **`/terms` and `/privacy` actual legal content** — Sprint 2 ships layout-only stubs. Real legal text drafted by a Polish lawyer is a separate content PR.
- **Mobile hamburger menu** — public header still uses the inline nav (responsive but no slide-in sheet). Polish in Sprint 4 if needed.
- **EN auth-error page (`/en/auth/error`)** — per spec §4.1, auth/error is PL only. EN users land on the same `/auth/error` page.

## After this plan

Sprint 2 commits land on top of Sprint 1's commits on `claude/ui-overhaul-sprint-1`. PR #12 grows by ~17 commits. Sprint 3 (workspace rebuild + history) will branch off the same branch next.

PR title update at the end of Sprint 4: "feat: total UI/UX overhaul (Sprints 1–4)".
