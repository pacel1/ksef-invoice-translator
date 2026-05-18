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
