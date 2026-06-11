import Link from "next/link";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { CookieSettingsButton } from "@/components/consent/cookie-settings-button";
import { LEGAL_ENTITY } from "@/lib/brand/legal";
import { formatLegalLine, marketingCopy, type MarketingLocale } from "@/lib/marketing/copy";

export interface LegalFooterProps {
  locale?: MarketingLocale;
  /** Drop the default top margin — used by the workspace layout where the
   * full-height sidebar should touch the footer with no gap. */
  flush?: boolean;
}

export function LegalFooter({ locale = "pl", flush = false }: LegalFooterProps) {
  const t = marketingCopy[locale];
  const legalLine = formatLegalLine(locale, LEGAL_ENTITY);
  // Marketing pages exist per locale (/pricing vs /en/pricing).
  const path = (p: string) => (locale === "en" ? `/en${p}` : p);

  return (
    <footer className={`${flush ? "" : "mt-16 "}border-t border-border bg-surface-muted`}>
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-3 md:px-8">
        <div className="space-y-3">
          <BrandLockup size="md" />
          <p className="max-w-xs text-small text-text-muted">{legalLine}</p>
        </div>
        <div className="space-y-3">
          <h3 className="text-micro uppercase tracking-wide text-text-muted">{t.footer.sitemap.heading}</h3>
          <ul className="space-y-2 text-small">
            <li><Link href={path("/pricing")} className="text-text hover:text-text-strong">{t.footer.sitemap.cennik}</Link></li>
            <li><Link href={path("/security")} className="text-text hover:text-text-strong">{t.footer.sitemap.security}</Link></li>
            <li><Link href={path("/blog")} className="text-text hover:text-text-strong">{t.footer.sitemap.blog}</Link></li>
            <li><Link href={path("/faq")} className="text-text hover:text-text-strong">{t.footer.sitemap.faq}</Link></li>
            <li><Link href={path("/contact")} className="text-text hover:text-text-strong">{t.footer.sitemap.contact}</Link></li>
          </ul>
        </div>
        <div className="space-y-3">
          <h3 className="text-micro uppercase tracking-wide text-text-muted">{t.footer.trust.heading}</h3>
          <ul className="space-y-2 text-small">
            <li className="text-text">{t.footer.trust.hosting}</li>
            <li className="text-text">{t.footer.trust.stripe}</li>
            <li className="text-text">{t.footer.trust.rodo}</li>
            <li><Link href={path("/terms")} className="text-text hover:text-text-strong">{t.footer.trust.terms}</Link></li>
            <li><Link href={path("/privacy")} className="text-text hover:text-text-strong">{t.footer.trust.privacy}</Link></li>
            <li><CookieSettingsButton locale={locale} className="text-text hover:text-text-strong" /></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
