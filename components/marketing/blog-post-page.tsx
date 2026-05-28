import Link from "next/link";
import { PortableText, type PortableTextBlock } from "@portabletext/react";
import { PublicHeader } from "@/components/layout/public-header";
import { LegalFooter } from "@/components/layout/legal-footer";
import { client, isSanityConfigured } from "@/sanity/lib/client";
import { POST_BY_SLUG_QUERY } from "@/sanity/lib/queries";
import { marketingCopy, type MarketingLocale } from "@/lib/marketing/copy";
import { notFound } from "next/navigation";

export interface BlogPostPageProps {
  locale: MarketingLocale;
  slug: string;
}

interface Post {
  _id: string;
  title: string;
  slug: { current: string };
  publishedAt: string | null;
  excerpt: string | null;
  body: PortableTextBlock[];
  metaTitle: string | null;
  metaDescription: string | null;
}

function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale === "pl" ? "pl-PL" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function BlogPostPage({ locale, slug }: BlogPostPageProps) {
  const t = marketingCopy[locale].blog;
  if (!isSanityConfigured) notFound();
  const post: Post | null = await client.fetch(POST_BY_SLUG_QUERY, { slug });

  if (!post) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-surface text-text-strong">
      <PublicHeader locale={locale} />
      <main className="flex flex-1 flex-col">
        <article className="mx-auto w-full max-w-3xl px-5 py-20 md:px-8">
          <Link
            href="/blog"
            className="text-small text-text-muted hover:text-text-strong transition-colors duration-hover ease-out"
          >
            {t.backToList}
          </Link>

          <h1 className="mt-6 text-h1 font-bold text-text-strong">{post.title}</h1>

          {post.publishedAt && (
            <p className="mt-3 text-micro uppercase tracking-wide text-text-muted">
              {t.publishedLabel}: {formatDate(post.publishedAt, locale)}
            </p>
          )}

          {post.excerpt && (
            <p className="mt-6 text-body text-text border-l-2 border-accent pl-4 italic">
              {post.excerpt}
            </p>
          )}

          {post.body && post.body.length > 0 && (
            <div className="prose-custom mt-10">
              <PortableText value={post.body} components={portableTextComponents} />
            </div>
          )}
        </article>
      </main>
      <LegalFooter locale={locale} />
    </div>
  );
}

const portableTextComponents = {
  block: {
    normal: ({ children }: { children?: React.ReactNode }) => (
      <p className="mt-4 text-body leading-relaxed text-text">{children}</p>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="mt-10 text-h2 font-semibold text-text-strong">{children}</h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="mt-8 text-h3 font-semibold text-text-strong">{children}</h3>
    ),
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className="mt-6 border-l-2 border-accent pl-4 italic text-text">{children}</blockquote>
    ),
  },
  list: {
    bullet: ({ children }: { children?: React.ReactNode }) => (
      <ul className="mt-4 list-disc pl-6 space-y-2 text-body text-text">{children}</ul>
    ),
    number: ({ children }: { children?: React.ReactNode }) => (
      <ol className="mt-4 list-decimal pl-6 space-y-2 text-body text-text">{children}</ol>
    ),
  },
  listItem: {
    bullet: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
    number: ({ children }: { children?: React.ReactNode }) => <li>{children}</li>,
  },
  marks: {
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong className="font-semibold text-text-strong">{children}</strong>
    ),
    em: ({ children }: { children?: React.ReactNode }) => <em>{children}</em>,
    link: ({ value, children }: { value?: { href: string }; children?: React.ReactNode }) => (
      <a
        href={value?.href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent underline hover:text-accent-hover"
      >
        {children}
      </a>
    ),
  },
};
