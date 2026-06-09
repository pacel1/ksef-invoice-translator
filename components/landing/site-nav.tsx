import Link from "next/link";
import { landingCopy, type LandingLocale } from "@/lib/landing/copy";
import { MobileNavSheet } from "@/components/landing/mobile-nav-sheet";

export interface SiteNavProps {
  locale: LandingLocale;
}

export function SiteNav({ locale }: SiteNavProps) {
  const t = landingCopy[locale].nav;
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3.5 md:px-8">
        <Link href={locale === "en" ? "/en" : "/"} className="flex items-center gap-2.5 font-heading text-[17px] font-bold text-ink">
          <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-gradient-to-br from-brand to-iris text-[15px] font-bold text-white">T</span>
          TłumaczKSeF
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {t.links.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-[9px] px-3 py-2 font-dm text-[14px] font-medium text-copy hover:text-ink">
              {l.label}
            </Link>
          ))}
          <Link href="/login" className="ml-2 inline-flex h-10 items-center rounded-[9px] bg-brand px-4 font-dm text-[14px] font-semibold text-white hover:bg-brand-hover">
            {t.cta}
          </Link>
        </nav>

        <MobileNavSheet
          links={t.links}
          ctaHref="/login"
          ctaLabel={t.cta}
          openLabel={t.menuOpen}
          closeLabel={t.menuClose}
        />
      </div>
    </header>
  );
}

export default SiteNav;
