import { SITE_URL } from "./site-url";

/**
 * Builds the `/llms.txt` document (https://llmstxt.org): a concise, linkable
 * map of the public site for LLM crawlers and assistants.
 *
 * Only indexable 200 pages are listed. The bare auth/legacy routes (/app,
 * /translate, ...) are deliberately excluded because they 3xx-redirect and are
 * blocked in robots.ts. Every href is absolute on the canonical origin so the
 * file is correct no matter which host serves it.
 */

interface LlmLink {
  readonly path: string;
  readonly label: string;
  readonly description: string;
}

interface LlmSection {
  readonly heading: string;
  readonly links: readonly LlmLink[];
}

const TITLE = "KSeF Invoice Translator (TłumaczKSeF)";

const SUMMARY =
  "SaaS narzędzie, które tłumaczy polskie faktury KSeF FA(3) XML na czytelny podgląd i profesjonalny PDF dla zagranicznych kontrahentów.";

const INTRO =
  "KSeF Invoice Translator (TłumaczKSeF) przyjmuje plik faktury KSeF w formacie FA(3) XML, generuje wielojęzyczny podgląd pozycji faktury i eksportuje gotowy do wysłania dokument PDF. Produkt działa wyłącznie na danych wejściowych XML. Serwis jest dwujęzyczny: polski (ścieżki bez prefiksu) oraz angielski (ścieżki z prefiksem /en).";

const SECTIONS: readonly LlmSection[] = [
  {
    heading: "Strony główne (PL)",
    links: [
      { path: "/", label: "Strona główna", description: "Co robi narzędzie i jak zacząć." },
      { path: "/pricing", label: "Cennik", description: "Pakiety kredytów i ceny tłumaczeń." },
      { path: "/faq", label: "FAQ", description: "Pytania o KSeF, format FA(3) i tłumaczenia." },
      { path: "/blog", label: "Blog", description: "Artykuły o KSeF i fakturowaniu." },
      { path: "/contact", label: "Kontakt", description: "Formularz kontaktowy." }
    ]
  },
  {
    heading: "English",
    links: [
      { path: "/en", label: "Home", description: "What the tool does and how to start." },
      { path: "/en/pricing", label: "Pricing", description: "Credit packages and translation pricing." },
      { path: "/en/faq", label: "FAQ", description: "Questions about KSeF, the FA(3) format and translations." },
      { path: "/en/blog", label: "Blog", description: "Articles about KSeF and invoicing." },
      { path: "/en/contact", label: "Contact", description: "Contact form." }
    ]
  },
  {
    heading: "Legal",
    links: [
      { path: "/privacy", label: "Polityka prywatności", description: "Privacy policy (PL)." },
      { path: "/terms", label: "Regulamin", description: "Terms of service (PL)." },
      { path: "/security", label: "Bezpieczeństwo", description: "Security overview (PL)." },
      { path: "/en/privacy", label: "Privacy Policy", description: "Privacy policy (EN)." },
      { path: "/en/terms", label: "Terms of Service", description: "Terms of service (EN)." },
      { path: "/en/security", label: "Security", description: "Security overview (EN)." }
    ]
  },
  {
    heading: "Optional",
    links: [
      { path: "/sitemap.xml", label: "Sitemap", description: "Full list of indexable URLs." }
    ]
  }
];

function renderLink({ path, label, description }: LlmLink): string {
  return `- [${label}](${SITE_URL}${path}): ${description}`;
}

function renderSection({ heading, links }: LlmSection): string {
  return [`## ${heading}`, "", ...links.map(renderLink)].join("\n");
}

export function buildLlmsTxt(): string {
  const blocks = [`# ${TITLE}`, `> ${SUMMARY}`, INTRO, ...SECTIONS.map(renderSection)];
  return `${blocks.join("\n\n")}\n`;
}
