import Link from "next/link";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { marketingCopy, type MarketingLocale } from "@/lib/marketing/copy";

export interface PublicHeaderProps {
  locale?: MarketingLocale;
}

export function PublicHeader({ locale = "pl" }: PublicHeaderProps) {
  const t = marketingCopy[locale];
  const baseLink = "rounded-md px-3 py-2 text-small text-text hover:text-text-strong";
  const ctaLink =
    "inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-small font-semibold text-white shadow-sm hover:bg-accent-hover transition-colors duration-hover ease-out";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-3 md:px-8">
        <BrandLockup href="/" size="md" />
        <nav className="flex items-center gap-2">
          <Link href="/pricing" className={baseLink}>{t.publicHeader.pricing}</Link>
          <Link href="/security" className={baseLink}>{t.publicHeader.security}</Link>
          <Link href="/login" className={ctaLink}>{t.publicHeader.login}</Link>
        </nav>
      </div>
    </header>
  );
}
