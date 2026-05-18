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
