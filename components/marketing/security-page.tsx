import { PublicHeader } from "@/components/layout/public-header";
import { LegalFooter } from "@/components/layout/legal-footer";
import { SecurityCard } from "@/components/trust/security-card";
import { FounderCard } from "@/components/trust/founder-card";
import { DataFlowDiagram, type FlowStep } from "@/components/marketing/data-flow-diagram";
import { SubProcessorsTable } from "@/components/marketing/sub-processors-table";
import { marketingCopy, type MarketingLocale } from "@/lib/marketing/copy";
import { FOUNDER } from "@/lib/brand/founder";

export interface SecurityPageProps {
  locale: MarketingLocale;
}

const FLOW_ICONS: ReadonlyArray<FlowStep["icon"]> = [
  "computer",
  "shield",
  "translate",
  "pdf",
  "trash"
];

function buildFlowSteps(labels: ReadonlyArray<string>): ReadonlyArray<FlowStep> {
  return FLOW_ICONS.map((icon, index) => ({ icon, label: labels[index] }));
}

export function SecurityPage({ locale }: SecurityPageProps) {
  const t = marketingCopy[locale].security;

  const flowLabelsPl = [
    "Twój komputer",
    "Supabase Frankfurt",
    "Tłumaczenie OpenAI",
    "Dostarczenie PDF",
    "Kasowanie po 30 dniach"
  ];
  const flowLabelsEn = [
    "Your computer",
    "Supabase Frankfurt",
    "OpenAI translation",
    "PDF delivery",
    "Deleted after 30 days"
  ];
  const flowSteps = buildFlowSteps(locale === "pl" ? flowLabelsPl : flowLabelsEn);

  return (
    <div className="flex min-h-screen flex-col bg-surface text-text-strong">
      <PublicHeader locale={locale} />
      <main className="flex flex-1 flex-col">
        <section className="mx-auto w-full max-w-4xl px-5 pt-20 pb-12 text-center md:px-8">
          <h1 className="text-display text-text-strong">{t.heroHeadline}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-body text-text-muted">{t.heroSubhead}</p>
        </section>

        <section className="mx-auto w-full max-w-3xl px-5 pb-12 md:px-8">
          <SecurityCard title={t.tldrTitle} items={t.tldrItems} />
        </section>

        <section className="mx-auto w-full max-w-5xl px-5 pb-16 md:px-8">
          <h2 className="text-h2 text-text-strong">{t.dataFlowHeading}</h2>
          <div className="mt-6">
            <DataFlowDiagram steps={flowSteps} />
          </div>
        </section>

        <section className="mx-auto w-full max-w-4xl px-5 pb-16 md:px-8">
          <h2 className="text-h2 text-text-strong">{t.whereLivesHeading}</h2>
          <p className="mt-3 text-body text-text">{t.whereLivesBody}</p>
          <p className="mt-4 inline-flex rounded-md bg-surface-muted px-3 py-2 font-mono text-small text-text-strong">
            {t.regionBadge}
          </p>
        </section>

        <section className="mx-auto w-full max-w-4xl px-5 pb-16 md:px-8">
          <h2 className="text-h2 text-text-strong">{t.storageHeading}</h2>
          <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            <table className="w-full">
              <thead className="bg-surface-muted">
                <tr>
                  <th className="px-5 py-3 text-left text-micro uppercase tracking-wide text-text-muted">
                    {t.storage.dataHeader}
                  </th>
                  <th className="px-5 py-3 text-left text-micro uppercase tracking-wide text-text-muted">
                    {t.storage.retentionHeader}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {t.storage.rows.map((row) => (
                  <tr key={row.data}>
                    <td className="px-5 py-3 text-body text-text-strong">{row.data}</td>
                    <td className="px-5 py-3 text-body text-text">{row.retention}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mx-auto w-full max-w-4xl px-5 pb-16 md:px-8">
          <h2 className="text-h2 text-text-strong">{t.notHeading}</h2>
          <ul className="mt-4 space-y-3">
            {t.notItems.map((item) => (
              <li key={item} className="text-body text-text">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto w-full max-w-5xl px-5 pb-16 md:px-8">
          <h2 className="text-h2 text-text-strong">{t.subProcessorsHeading}</h2>
          <p className="mt-3 max-w-3xl text-body text-text">{t.subProcessorsIntro}</p>
          <div className="mt-6">
            <SubProcessorsTable
              labels={{
                nameHeader: t.subProcessors.nameHeader,
                roleHeader: t.subProcessors.roleHeader,
                locationHeader: t.subProcessors.locationHeader
              }}
              rows={t.subProcessors.rows}
            />
          </div>
        </section>

        <section className="mx-auto w-full max-w-4xl px-5 pb-16 md:px-8">
          <h2 className="text-h2 text-text-strong">{t.rodoHeading}</h2>
          <p className="mt-3 text-body text-text">{t.rodoIntro}</p>
          <ul className="mt-4 space-y-2">
            {t.rodoRights.map((right) => (
              <li key={right} className="text-body text-text">
                • {right}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-body text-text">
            {t.rodoContact}{" "}
            <a
              href={`mailto:${FOUNDER.contactEmail}`}
              className="font-medium text-accent hover:text-accent-hover"
            >
              {FOUNDER.contactEmail}
            </a>
          </p>
        </section>

        <section className="mx-auto w-full max-w-4xl px-5 pb-16 md:px-8">
          <h2 className="text-h2 text-text-strong">{t.mfHeading}</h2>
          <p className="mt-3 text-body text-text">{t.mfBody}</p>
          <p className="mt-4">
            <a
              href="https://www.podatki.gov.pl/ksef/struktury-ksef/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-small font-medium text-accent hover:text-accent-hover"
            >
              {t.mfSchemaLink} →
            </a>
          </p>
        </section>

        <section className="bg-surface-muted py-16">
          <div className="mx-auto max-w-3xl px-5 md:px-8">
            <h2 className="text-center text-h2 text-text-strong">{t.founderHeading}</h2>
            <div className="mt-8">
              <FounderCard
                name={FOUNDER.name}
                photoUrl={FOUNDER.photoUrl}
                statement={FOUNDER.statement}
                contactEmail={FOUNDER.contactEmail}
              />
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-4xl px-5 pb-20 pt-16 md:px-8">
          <h2 className="text-h2 text-text-strong">{t.incidentsHeading}</h2>
          <p className="mt-3 text-body text-text">{t.incidentsBody}</p>
        </section>
      </main>
      <LegalFooter locale={locale} />
    </div>
  );
}
