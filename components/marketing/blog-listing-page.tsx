import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { LegalFooter } from "@/components/layout/legal-footer";
import { client, isSanityConfigured } from "@/sanity/lib/client";
import { ALL_POSTS_QUERY } from "@/sanity/lib/queries";
import { marketingCopy, type MarketingLocale } from "@/lib/marketing/copy";

export interface BlogListingPageProps {
  locale: MarketingLocale;
}

interface PostSummary {
  _id: string;
  title: string;
  slug: { current: string };
  publishedAt: string | null;
  excerpt: string | null;
}

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === "pl" ? "pl-PL" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function BlogListingPage({ locale }: BlogListingPageProps) {
  const t = marketingCopy[locale].blog;
  const posts: PostSummary[] = isSanityConfigured
    ? await client.fetch(ALL_POSTS_QUERY)
    : [];

  return (
    <div className="flex min-h-screen flex-col bg-surface text-text-strong">
      <PublicHeader locale={locale} />
      <main className="flex flex-1 flex-col">
        <section className="mx-auto w-full max-w-4xl px-5 py-20 md:px-8">
          <h1 className="text-h1 font-bold text-text-strong">{t.heading}</h1>
          <p className="mt-3 text-body text-text">{t.subheading}</p>

          {posts.length === 0 ? (
            <p className="mt-12 text-body text-text-muted">Brak artykułów.</p>
          ) : (
            <ul className="mt-12 grid gap-6 sm:grid-cols-2">
              {posts.map((post) => (
                <li key={post._id}>
                  <Link
                    href={`/blog/${post.slug.current}`}
                    className="group flex h-full flex-col rounded-xl border border-border bg-surface p-6 shadow-sm transition-shadow duration-hover ease-out hover:shadow-md"
                  >
                    <h2 className="text-h3 font-semibold text-text-strong group-hover:text-accent transition-colors duration-hover ease-out">
                      {post.title}
                    </h2>
                    {post.publishedAt && (
                      <p className="mt-2 text-micro uppercase tracking-wide text-text-muted">
                        {t.publishedLabel}: {formatDate(post.publishedAt, locale)}
                      </p>
                    )}
                    {post.excerpt && (
                      <p className="mt-3 flex-1 text-small text-text line-clamp-3">
                        {post.excerpt}
                      </p>
                    )}
                    <span className="mt-4 text-small font-semibold text-accent">
                      {t.readMore} →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <LegalFooter locale={locale} />
    </div>
  );
}
