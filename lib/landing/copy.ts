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
