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
    hero: {
      eyebrow: "Faktura KSeF dla kontrahenta z zagranicy",
      headlineLead: "Znowu przepisujesz fakturę z KSeF do Worda, żeby klient z zagranicy ją zrozumiał?",
      headlineTurn: "Już nie musisz.",
      subline: "Wgrywasz fakturę z KSeF, a po kilku sekundach masz jej profesjonalną wersję w języku klienta. Bez przepisywania. Numery, kwoty i kod QR zostają nietknięte.",
      ctaPrimary: "Przetłumacz swoją fakturę",
      ctaSecondary: "Zobacz na przykładzie",
      reassurance: "Pierwsza faktura w miesiącu za darmo, bez karty. Dane w UE, kasujemy po 30 dniach."
    },
    whyOldWay: {
      eyebrow: "Dlaczego nie wystarczy polski plik",
      heading: "„Wyślę polską fakturę albo przetłumaczę w Google.” Znamy to. I wiemy, czym się to kończy.",
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
    hero: {
      eyebrow: "KSeF invoice for a foreign client",
      headlineLead: "Still retyping your KSeF invoice into Word so a foreign client can read it?",
      headlineTurn: "You don't have to anymore.",
      subline: "Upload your KSeF invoice and in a few seconds you have a professional version in your client's language. No retyping. Numbers, amounts and the QR code stay untouched.",
      ctaPrimary: "Translate your invoice",
      ctaSecondary: "See it on a sample",
      reassurance: "First invoice each month is free, no card. Data in the EU, deleted after 30 days."
    },
    whyOldWay: {
      eyebrow: "Why the Polish file is not enough",
      heading: "\"I'll send the Polish invoice, or run it through Google.” We know that one. And we know how it ends.",
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
