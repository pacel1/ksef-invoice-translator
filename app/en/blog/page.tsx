import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { LegalFooter } from "@/components/layout/legal-footer";
import { marketingCopy } from "@/lib/marketing/copy";

export default function BlogEn() {
  const t = marketingCopy.en.blog;
  return (
    <div className="flex min-h-screen flex-col bg-surface text-text-strong">
      <PublicHeader locale="en" />
      <main className="flex flex-1 flex-col items-center justify-center">
        <div className="mx-auto max-w-lg px-5 py-20 text-center md:px-8">
          <h1 className="text-h1 font-bold text-text-strong">{t.enInfoHeading}</h1>
          <p className="mt-4 text-body text-text">{t.enInfoBody}</p>
          <Link
            href="/blog"
            className="mt-8 inline-flex items-center justify-center rounded-md bg-accent px-6 py-3 text-small font-semibold text-white shadow-sm hover:bg-accent-hover transition-colors duration-hover ease-out"
          >
            {t.enInfoCta} →
          </Link>
        </div>
      </main>
      <LegalFooter locale="en" />
    </div>
  );
}
