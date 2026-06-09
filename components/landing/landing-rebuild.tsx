import type { LandingLocale } from "@/lib/landing/copy";
import { SiteNav } from "@/components/landing/site-nav";
import { Hero } from "@/components/landing/hero";
import { FinalCta } from "@/components/landing/final-cta";
import { SiteFooter } from "@/components/landing/site-footer";

export interface LandingRebuildProps {
  locale: LandingLocale;
}

/** Section ids reserved for later sprints (demo, comparison, etc.). The hero is built. */
const SECTION_IDS = [
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
        <Hero locale={locale} />
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
