import { marketingCopy, type MarketingLocale } from "@/lib/marketing/copy";

export interface TrustStripProps {
  locale?: MarketingLocale;
}

export function TrustStrip({ locale = "pl" }: TrustStripProps) {
  const t = marketingCopy[locale].trustStrip;
  const items = [t.stripe, t.supabase, t.openai, t.rodo, t.mf];

  return (
    <ul
      aria-label={t.label}
      className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-small text-text-muted"
    >
      {items.map((label) => (
        <li key={label} className="font-medium tracking-tight">
          {label}
        </li>
      ))}
    </ul>
  );
}
