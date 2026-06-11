import Link from "next/link";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { MobileNav } from "@/components/layout/mobile-nav";
import { marketingCopy, type MarketingLocale } from "@/lib/marketing/copy";

export interface PublicHeaderProps {
  locale?: MarketingLocale;
}

export function PublicHeader({ locale = "pl" }: PublicHeaderProps) {
  const t = marketingCopy[locale];
  // Marketing pages exist per locale (/pricing vs /en/pricing); the app
  // routes (/login) are locale-agnostic and stay unprefixed.
  const path = (p: string) => (locale === "en" ? `/en${p}` : p);
  const baseLink = "rounded-md px-3 py-2 text-small text-text hover:text-text-strong";
  const ctaLink =
    "inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-small font-semibold text-white shadow-sm hover:bg-accent-hover transition-colors duration-hover ease-out";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-3 md:px-8">
        <BrandLockup href="/" size="md" />
        <nav className="hidden items-center gap-2 md:flex">
          <Link href={path("/pricing")} className={baseLink}>{t.publicHeader.pricing}</Link>
          <Link href={path("/security")} className={baseLink}>{t.publicHeader.security}</Link>
          <Link href={path("/blog")} className={baseLink}>{t.publicHeader.blog}</Link>
          <Link href={path("/faq")} className={baseLink}>{t.publicHeader.faq}</Link>
          <Link href="/login" className={ctaLink}>{t.publicHeader.login}</Link>
        </nav>
        <div className="md:hidden">
          <MobileNav
            links={[
              { href: path("/pricing"), label: t.publicHeader.pricing },
              { href: path("/security"), label: t.publicHeader.security },
              { href: path("/blog"), label: t.publicHeader.blog },
              { href: path("/faq"), label: t.publicHeader.faq }
            ]}
            cta={{ href: "/login", label: t.publicHeader.login }}
            openLabel={t.publicHeader.menuOpen}
            closeLabel={t.publicHeader.menuClose}
          />
        </div>
      </div>
    </header>
  );
}
