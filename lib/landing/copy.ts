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
    demo: {
      eyebrow: "Demo na żywo",
      heading: "Zobacz swoją fakturę w innym języku",
      sub: "Wybierz język i zobacz tłumaczenie od razu. Liczby, NIP, IBAN i kwoty zostają takie same.",
      watermark: "PODGLĄD",
      languagesLabel: "Język",
      moreLabel: "+ więcej",
      moreAria: "Więcej języków",
      moreHref: "/login",
      privacy: "Nie przechowujemy Twojej faktury.",
      cta: "Przetłumacz własną fakturę",
      ctaHref: "/login",
      download: "Pobierz PDF",
      gateHeading: "Wpisz e-mail, wyślemy Ci plik",
      emailLabel: "Adres e-mail",
      emailPlaceholder: "twoj@email.pl",
      consent: "Wyślemy plik na podany adres i link do logowania. Zero spamu.",
      marketingOptIn: "Chcę dostawać wskazówki o KSeF i fakturowaniu (opcjonalnie).",
      submit: "Wyślij i pobierz",
      success: "Gotowe. Plik się pobiera, a link do konta jest w drodze na Twój e-mail.",
      gateError: "Coś poszło nie tak. Spróbuj ponownie za chwilę.",
      rateLimited: "Limit demo na dziś wyczerpany. Załóż darmowe konto, aby tłumaczyć dalej.",
      uploadLink: "albo wgraj własną fakturę",
      uploadDropLabel: "Przeciągnij plik tutaj albo kliknij, aby wybrać",
      uploadHint: "Plik XML z KSeF. Maks 1 MB.",
      uploadBusy: "Tłumaczymy Twoją fakturę...",
      uploadErrUnsupported: "Obsługujemy pliki XML z KSeF.",
      uploadErrTooLarge: "Plik jest za duży. Maks 1 MB.",
      uploadErrParse: "Nie udało się odczytać tej faktury. Upewnij się, że to plik FA(3) z KSeF.",
      uploadErrBreaker: "Demo chwilowo przeciążone. Załóż darmowe konto, aby przetłumaczyć własną fakturę.",
      uploadErrTurnstile: "Weryfikacja nie powiodła się. Odśwież stronę i spróbuj ponownie.",
      uploadErrTranslate: "Coś poszło nie tak przy tłumaczeniu. Spróbuj ponownie za chwilę.",
      pdfFailed: "Nie udało się wygenerować PDF. Spróbuj ponownie."
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
    demo: {
      eyebrow: "Live demo",
      heading: "See your invoice in another language",
      sub: "Pick a language and see the translation right away. Numbers, tax IDs, IBAN and amounts stay exactly the same.",
      watermark: "PREVIEW",
      languagesLabel: "Language",
      moreLabel: "+ more",
      moreAria: "More languages",
      moreHref: "/login",
      privacy: "We do not store your invoice.",
      cta: "Translate your own invoice",
      ctaHref: "/login",
      download: "Download PDF",
      gateHeading: "Enter your email and we will send you the file",
      emailLabel: "Email address",
      emailPlaceholder: "you@email.com",
      consent: "We will send the file and a sign in link to this address. No spam.",
      marketingOptIn: "I want tips about KSeF and invoicing (optional).",
      submit: "Send and download",
      success: "Done. Your file is downloading and a sign in link is on the way to your email.",
      gateError: "Something went wrong. Please try again in a moment.",
      rateLimited: "Daily demo limit reached. Create a free account to keep translating.",
      uploadLink: "or upload your own invoice",
      uploadDropLabel: "Drag a file here or click to choose",
      uploadHint: "An XML file from KSeF. Max 1 MB.",
      uploadBusy: "Translating your invoice...",
      uploadErrUnsupported: "We support XML files from KSeF.",
      uploadErrTooLarge: "The file is too large. Max 1 MB.",
      uploadErrParse: "We could not read this invoice. Make sure it is an FA(3) file from KSeF.",
      uploadErrBreaker: "The demo is temporarily overloaded. Create a free account to translate your own invoice.",
      uploadErrTurnstile: "Verification failed. Refresh the page and try again.",
      uploadErrTranslate: "Something went wrong while translating. Please try again in a moment.",
      pdfFailed: "We could not generate the PDF. Please try again."
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
