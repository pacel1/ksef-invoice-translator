import { PublicHeader } from "@/components/layout/public-header";
import { LegalFooter } from "@/components/layout/legal-footer";
import { MarketingFAQ } from "@/components/marketing/marketing-faq";
import { client, isSanityConfigured } from "@/sanity/lib/client";
import { ALL_FAQ_ITEMS_QUERY } from "@/sanity/lib/queries";
import { marketingCopy, type MarketingLocale } from "@/lib/marketing/copy";

export interface FaqPageProps {
  locale: MarketingLocale;
}

interface FaqItem {
  _id: string;
  question: string;
  shortAnswer: string | null;
  fullAnswer: string | null;
  category: string | null;
  priority: string | null;
  tags: string[] | null;
  section: string | null;
  order: number | null;
}

export async function FaqPage({ locale }: FaqPageProps) {
  const t = marketingCopy[locale].faq;
  const items: FaqItem[] = isSanityConfigured
    ? await client.fetch(ALL_FAQ_ITEMS_QUERY)
    : [];

  const grouped = new Map<string, FaqItem[]>();
  for (const item of items) {
    const cat = item.category ?? "Inne";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(item);
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface text-text-strong">
      <PublicHeader locale={locale} />
      <main className="flex flex-1 flex-col">
        <section className="mx-auto w-full max-w-4xl px-5 py-20 md:px-8 space-y-16">
          <div>
            <h1 className="text-h1 font-bold text-text-strong">{t.heading}</h1>
            <p className="mt-3 text-body text-text">{t.subheading}</p>
          </div>

          {grouped.size === 0 ? (
            <p className="text-body text-text-muted">Brak pytań.</p>
          ) : (
            Array.from(grouped.entries()).map(([category, categoryItems]) => (
              <div key={category} className="space-y-4">
                <h2 className="text-h2 font-semibold text-text-strong">{category}</h2>
                <MarketingFAQ
                  heading=""
                  items={categoryItems.map((item) => ({
                    q: item.question,
                    a: item.fullAnswer ?? item.shortAnswer ?? "",
                  }))}
                />
              </div>
            ))
          )}
        </section>
      </main>
      <LegalFooter locale={locale} />
    </div>
  );
}
