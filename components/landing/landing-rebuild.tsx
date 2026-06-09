import type { LandingLocale } from "@/lib/landing/copy";
import { SiteNav } from "@/components/landing/site-nav";
import { FinalCta } from "@/components/landing/final-cta";
import { SiteFooter } from "@/components/landing/site-footer";

export interface LandingRebuildProps {
  locale: LandingLocale;
}

/** Section ids reserved for later sprints (hero, demo, comparison, etc.). */
const SECTION_IDS = [
  "hero",
  "demo",
  "dlaczego",
  "jak-to-dziala",
  "co-zostaje",
  "dla-kogo",
  "cennik",
  "faq"
] as const;

export function LandingRebuild({ locale }: LandingRebuildProps) {
  return (
    <div className="flex min-h-screen flex-col bg-paper font-dm text-copy">
      <SiteNav locale={locale} />
      <main className="flex-1">
        {SECTION_IDS.map((id) => (
          <section key={id} id={id} aria-hidden="true" />
        ))}
      </main>
      <FinalCta locale={locale} />
      <SiteFooter locale={locale} />
    </div>
  );
}

export default LandingRebuild;
