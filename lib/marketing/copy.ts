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
          { title: "MF-compliant PDF", body: "Wynik zgodny ze schematem FA(3) 2025-06-25. Gotowy do wysyłki." },
          { title: "Bez subskrypcji", body: "Płacisz tylko za faktury, które tłumaczysz." },
          { title: "Dane w UE 🇪🇺", body: "Supabase Frankfurt. RODO. Kasowanie po 30 dniach." }
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
          { q: "Czy potrzebuję integracji z KSeF?", a: "Nie. Wystarczy plik FA(3) XML pobrany z KSeF albo PDF z fakturą. Nie podłączamy się do KSeF i nie wymagamy żadnej integracji." },
          { q: "Co jeśli tłumaczenie nie jest dokładne?", a: "Tłumaczenie wykonuje OpenAI GPT-4 na podstawie kontekstu faktury. Możesz zwrócić pakiet w ciągu 14 dni jeśli nie jest satysfakcjonujący." },
          { q: "Czy moje dane są bezpieczne?", a: "Tak. Wszystkie faktury i metadane przechowujemy w Supabase Frankfurt. Faktury kasujemy po 30 dniach. RODO-compliant." },
          { q: "Czy działa z FA(1) lub FA(2)?", a: "Aktualnie obsługujemy FA(3) — najnowszy schemat MF z 2025-06-25. Wsparcie FA(1)/FA(2) planowane na późniejszy etap." },
          { q: "Czy dostanę fakturę VAT?", a: "Tak. Każdy zakup pakietu generuje fakturę VAT z 23% podatkiem. Otrzymasz link do pobrania faktury e-mailem po zakupie." }
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
        { q: "Czy faktury w pakiecie wygasają?", a: "Nie. Niewykorzystane faktury z pakietu nie tracą ważności. Możesz je wykorzystać kiedy zechcesz." },
        { q: "Czy mogę zwrócić niewykorzystany pakiet?", a: "Tak. Zwroty na życzenie w ciągu 14 dni od zakupu, proporcjonalnie do niewykorzystanych faktur." },
        { q: "Co jeśli tłumaczenie się nie udało?", a: "Jeśli faktura nie zostanie pomyślnie przetłumaczona (np. błąd po naszej stronie), kredyt nie zostaje zużyty. Możesz spróbować ponownie." },
        { q: "Czy dostanę fakturę VAT?", a: "Tak. Każdy zakup generuje fakturę VAT 23%. Otrzymasz link do pobrania e-mailem." },
        { q: "Czy płatność jest bezpieczna?", a: "Płatności obsługuje Stripe — światowy standard bezpieczeństwa płatności. Nie przechowujemy danych kart." },
        { q: "Czy mogę zmienić ilość po zakupie?", a: "Nie po zakupie, ale możesz w każdym momencie dokupić kolejny pakiet. Niewykorzystane faktury się sumują." }
      ],
      finalCta: "Zacznij od 1 darmowej faktury"
    },
    security: {
      heroHeadline: "Bezpieczeństwo i prywatność danych",
      heroSubhead: "Faktury to dane wrażliwe. Tłumaczksef.pl podchodzi do nich z należytą starannością.",
      tldrTitle: "W skrócie",
      tldrItems: [
        "Wszystkie dane w UE — Supabase Frankfurt (AWS eu-central-1)",
        "Szyfrowanie w trakcie transferu i w spoczynku",
        "Faktury kasowane po 30 dniach od uploadu",
        "RODO-compliant — pełna kontrola nad twoimi danymi"
      ],
      dataFlowHeading: "Jak płyną twoje dane",
      whereLivesHeading: "Gdzie żyją twoje dane",
      whereLivesBody: "Wszystkie faktury, tłumaczenia i metadane przechowujemy w Supabase (Frankfurt, region AWS eu-central-1). Dane nigdy nie opuszczają Unii Europejskiej w ramach naszej platformy.",
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
      subProcessorsIntro: "Korzystamy z czterech sub-procesorów. Każdy jest GDPR/RODO compliant i wybrany pod kątem bezpieczeństwa danych.",
      subProcessors: {
        nameHeader: "Nazwa",
        roleHeader: "Rola",
        locationHeader: "Lokalizacja",
        rows: [
          { name: "Supabase", role: "Storage + Auth", location: "Frankfurt 🇩🇪 (AWS eu-central-1)" },
          { name: "OpenAI", role: "Tłumaczenie treści faktur", location: "USA (data processing agreement zawarte)" },
          { name: "Stripe", role: "Płatności", location: "Irlandia 🇮🇪 (Stripe Payments Europe)" },
          { name: "Resend", role: "Magic-link i transakcyjne e-maile", location: "USA (data processing agreement zawarte)" }
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
      mfBody: "Wynikowy PDF jest zgodny ze schematem FA(3) Ministerstwa Finansów wersja 2025-06-25. QR code KSeF jest zachowany — twój oryginalny dokument pozostaje walidowalny.",
      mfSchemaLink: "Schemat MF FA(3) — gov.pl",
      founderHeading: "Stoi za tym konkretny człowiek",
      incidentsHeading: "Polityka incydentów",
      incidentsBody: "Logi zachowujemy przez 90 dni. W razie naruszenia bezpieczeństwa danych powiadamiamy poszkodowanych w ciągu 72 godzin, zgodnie z art. 34 RODO."
    },
    terms: {
      heroHeadline: "Regulamin świadczenia usług",
      lastUpdated: "Ostatnia aktualizacja",
      tocHeading: "Spis treści",
      placeholderHeading: "Treść regulaminu",
      placeholderBody: "Pełna treść regulaminu zostanie dodana przed uruchomieniem produkcyjnym. W razie pytań prosimy o kontakt z administratorem."
    },
    privacy: {
      heroHeadline: "Polityka prywatności",
      lastUpdated: "Ostatnia aktualizacja",
      tocHeading: "Spis treści",
      placeholderHeading: "Treść polityki prywatności",
      placeholderBody: "Pełna treść polityki prywatności zostanie dodana przed uruchomieniem produkcyjnym. Już teraz przestrzegamy zasad RODO — szczegóły w sekcji Bezpieczeństwo."
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
      errorRateLimited: "Za dużo prób. Odczekaj chwilę i spróbuj jeszcze raz."
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
      heroSubhead: "Translate FA(3) invoices into 20+ languages. Download an MF-compliant PDF, ready to send to your international clients.",
      heroCtaPrimary: "Start free",
      heroCtaSecondary: "See example",
      heroFreeNote: "1 free invoice per month. No card.",
      demoStripHeading: "Translation preserves MF structure and numbering",
      demoStripCaption: "Polish original on the left · professional translation on the right",
      valueProps: {
        heading: "What does it cost you? No subscription.",
        items: [
          { title: "MF-compliant PDF", body: "Output matches the FA(3) 2025-06-25 schema. Ready to send." },
          { title: "No subscription", body: "Pay only for invoices you actually translate." },
          { title: "EU-based data 🇪🇺", body: "Supabase Frankfurt. GDPR. Deleted after 30 days." }
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
          { q: "Do I need to integrate with KSeF?", a: "No. Just upload your FA(3) XML or PDF. We never connect to KSeF and require no integration." },
          { q: "What if the translation isn't accurate?", a: "Translations are done by OpenAI GPT-4 with invoice context. You can return an unused package within 14 days if you're not satisfied." },
          { q: "Is my data safe?", a: "Yes. All invoices and metadata are stored in Supabase Frankfurt. Invoices are deleted after 30 days. GDPR-compliant." },
          { q: "Does it work with FA(1) or FA(2)?", a: "We currently support FA(3) — the latest MF schema from 2025-06-25. FA(1)/FA(2) support is on the roadmap." },
          { q: "Can I get a VAT receipt?", a: "Yes. Every purchase generates a 23% VAT invoice. You'll receive a download link via email after purchase." }
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
        { q: "Do package invoices expire?", a: "No. Unused invoices in a package never expire. Use them whenever you want." },
        { q: "Can I return an unused package?", a: "Yes. Refund on request within 14 days of purchase, prorated by unused invoices." },
        { q: "What if a translation fails?", a: "If an invoice doesn't translate successfully (e.g. error on our side), no credit is consumed. Try again." },
        { q: "Will I get a VAT invoice?", a: "Yes. Every purchase generates a 23% VAT invoice. Download link delivered via email." },
        { q: "Is payment secure?", a: "Payments are handled by Stripe — the global standard for payment security. We never store card data." },
        { q: "Can I change the package size after purchase?", a: "Not after purchase, but you can buy another package any time. Unused invoices stack." }
      ],
      finalCta: "Start with 1 free invoice"
    },
    security: {
      heroHeadline: "Data security and privacy",
      heroSubhead: "Invoices are sensitive data. Tłumacz Faktur KSeF treats them with appropriate care.",
      tldrTitle: "TL;DR",
      tldrItems: [
        "All data in the EU — Supabase Frankfurt (AWS eu-central-1)",
        "Encryption in transit and at rest",
        "Invoices deleted 30 days after upload",
        "GDPR-compliant — full control over your data"
      ],
      dataFlowHeading: "How your data flows",
      whereLivesHeading: "Where your data lives",
      whereLivesBody: "All invoices, translations, and metadata are stored in Supabase (Frankfurt, AWS eu-central-1). Data never leaves the European Union within our platform.",
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
      subProcessorsIntro: "We use four sub-processors. Each is GDPR-compliant and selected for data security.",
      subProcessors: {
        nameHeader: "Name",
        roleHeader: "Role",
        locationHeader: "Location",
        rows: [
          { name: "Supabase", role: "Storage + Auth", location: "Frankfurt 🇩🇪 (AWS eu-central-1)" },
          { name: "OpenAI", role: "Invoice content translation", location: "USA (data processing agreement in place)" },
          { name: "Stripe", role: "Payments", location: "Ireland 🇮🇪 (Stripe Payments Europe)" },
          { name: "Resend", role: "Magic-link and transactional emails", location: "USA (data processing agreement in place)" }
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
      mfBody: "Output PDFs conform to the Polish Ministry of Finance FA(3) schema version 2025-06-25. The KSeF QR code is preserved — your original document stays validatable.",
      mfSchemaLink: "MF FA(3) schema — gov.pl",
      founderHeading: "Run by a real person",
      incidentsHeading: "Incident policy",
      incidentsBody: "Logs are retained for 90 days. In case of a data breach, we notify affected users within 72 hours per GDPR Article 34."
    },
    terms: {
      heroHeadline: "Terms of service",
      lastUpdated: "Last updated",
      tocHeading: "Table of contents",
      placeholderHeading: "Terms content",
      placeholderBody: "Full terms will be added before production launch. For questions please contact the administrator."
    },
    privacy: {
      heroHeadline: "Privacy policy",
      lastUpdated: "Last updated",
      tocHeading: "Table of contents",
      placeholderHeading: "Privacy policy content",
      placeholderBody: "Full privacy policy will be added before production launch. We already follow GDPR — see the Security page for details."
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
