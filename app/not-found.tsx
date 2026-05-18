import Link from "next/link";
import { BrandLockup } from "@/components/brand/brand-lockup";
import { LegalFooter } from "@/components/layout/legal-footer";
import { marketingCopy } from "@/lib/marketing/copy";

export default function NotFound() {
  const t = marketingCopy.pl.notFound;
  return (
    <div className="flex min-h-screen flex-col bg-surface text-text-strong">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-5 py-3 md:px-8">
          <BrandLockup href="/" size="md" />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-5 py-16 text-center md:px-8">
        <span className="text-display tabular-nums text-border-strong">404</span>
        <h1 className="text-h1 text-text-strong">{t.title}</h1>
        <p className="text-body text-text-muted">{t.body}</p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-md bg-accent px-5 py-3 text-small font-semibold text-white shadow-sm hover:bg-accent-hover transition-colors duration-hover ease-out"
        >
          {t.cta}
        </Link>
      </main>
      <LegalFooter />
    </div>
  );
}
