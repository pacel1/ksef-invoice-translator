import Link from "next/link";
import { landingCopy, type LandingLocale } from "@/lib/landing/copy";

export interface SiteFooterProps {
  locale: LandingLocale;
}

const linkClass =
  "rounded-[4px] font-dm text-[14px] text-white/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

export function SiteFooter({ locale }: SiteFooterProps) {
  const t = landingCopy[locale].footer;
  const year = 2026;
  return (
    <footer className="bg-ink text-white/70">
      <div className="mx-auto max-w-6xl px-5 py-14 md:px-8">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 font-heading text-[16px] font-bold text-white">
              {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, no optimization needed */}
              <img src="/brand/sygnet.svg" alt="" className="h-7 w-7" />
              TłumaczKSeF
            </div>
            <p className="mt-3 max-w-xs font-dm text-[14px]">{t.tagline}</p>
          </div>
          <div>
            <p className="font-dm text-[12px] font-semibold uppercase tracking-wide text-white/50">{t.productHeading}</p>
            <ul className="mt-3 space-y-2">
              {t.productLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={linkClass}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-dm text-[12px] font-semibold uppercase tracking-wide text-white/50">{t.companyHeading}</p>
            <ul className="mt-3 space-y-2">
              {t.companyLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={linkClass}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 font-dm text-[13px] text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <span>{t.legalNote}</span>
          <span>© {year} TłumaczKSeF. {t.rights}</span>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
