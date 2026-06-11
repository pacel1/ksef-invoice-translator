import { PublicHeader } from "@/components/layout/public-header";
import { LegalFooter } from "@/components/layout/legal-footer";
import { ContactForm } from "@/components/marketing/contact-form";
import { LEGAL_ENTITY } from "@/lib/brand/legal";
import { marketingCopy, type MarketingLocale } from "@/lib/marketing/copy";

export interface ContactPageProps {
  locale?: MarketingLocale;
}

export function ContactPage({ locale = "pl" }: ContactPageProps) {
  const t = marketingCopy[locale].contact;

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <PublicHeader locale={locale} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-12 md:px-8 md:py-16">
        <h1 className="text-h1 text-text-strong">{t.heading}</h1>
        <p className="mt-3 max-w-prose text-body text-text-muted">{t.sub}</p>
        <div className="mt-8">
          <ContactForm copy={t} contactEmail={LEGAL_ENTITY.contactEmail} />
        </div>
        <p className="mt-8 text-small text-text-muted">
          {t.directLabel}{" "}
          <a
            href={`mailto:${LEGAL_ENTITY.contactEmail}`}
            className="font-medium text-text-strong underline"
          >
            {LEGAL_ENTITY.contactEmail}
          </a>
        </p>
      </main>
      <LegalFooter locale={locale} />
    </div>
  );
}
