import Link from "next/link";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { LEGAL_ENTITY } from "@/lib/brand/legal";
import { formatLegalLine, marketingCopy, type MarketingLocale } from "@/lib/marketing/copy";

export interface LegalFooterProps {
  locale?: MarketingLocale;
}

export function LegalFooter({ locale = "pl" }: LegalFooterProps) {
  const t = marketingCopy[locale];
  const legalLine = formatLegalLine(locale, LEGAL_ENTITY);

  return (
    <footer className="mt-16 border-t border-border bg-surface-muted">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-3 md:px-8">
        <div className="space-y-3">
          <BrandLockup size="md" />
          <p className="max-w-xs text-small text-text-muted">{legalLine}</p>
        </div>
        <div className="space-y-3">
          <h3 className="text-micro uppercase tracking-wide text-text-muted">{t.footer.sitemap.heading}</h3>
          <ul className="space-y-2 text-small">
            <li><Link href="/pricing" className="text-text hover:text-text-strong">{t.footer.sitemap.cennik}</Link></li>
            <li><Link href="/security" className="text-text hover:text-text-strong">{t.footer.sitemap.security}</Link></li>
            <li><Link href="/app/history" className="text-text hover:text-text-strong">{t.footer.sitemap.history}</Link></li>
            <li><Link href="/security#kontakt" className="text-text hover:text-text-strong">{t.footer.sitemap.help}</Link></li>
          </ul>
        </div>
        <div className="space-y-3">
          <h3 className="text-micro uppercase tracking-wide text-text-muted">{t.footer.trust.heading}</h3>
          <ul className="space-y-2 text-small">
            <li className="text-text">{t.footer.trust.hosting}</li>
            <li className="text-text">{t.footer.trust.stripe}</li>
            <li className="text-text">{t.footer.trust.rodo}</li>
            <li><Link href="/terms" className="text-text hover:text-text-strong">{t.footer.trust.terms}</Link></li>
            <li><Link href="/privacy" className="text-text hover:text-text-strong">{t.footer.trust.privacy}</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
