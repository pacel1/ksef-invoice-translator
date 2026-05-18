export interface LegalSection {
  id: string;
  title: string;
  content: string;
}

export interface LegalDocLayoutProps {
  title: string;
  lastUpdatedLabel: string;
  lastUpdatedDate: string;
  tocHeading: string;
  sections: ReadonlyArray<LegalSection>;
}

export function LegalDocLayout({
  title,
  lastUpdatedLabel,
  lastUpdatedDate,
  tocHeading,
  sections
}: LegalDocLayoutProps) {
  return (
    <article className="mx-auto max-w-6xl px-5 py-12 md:px-8">
      <header className="mb-8">
        <h1 className="text-h1 text-text-strong">{title}</h1>
        <p className="mt-2 text-small text-text-muted">
          {lastUpdatedLabel}: <time dateTime={lastUpdatedDate}>{lastUpdatedDate}</time>
        </p>
      </header>
      <div className="grid gap-8 md:grid-cols-[240px_1fr]">
        <aside className="md:sticky md:top-24 md:self-start">
          <h2 className="text-micro uppercase tracking-wide text-text-muted">{tocHeading}</h2>
          <ul className="mt-3 space-y-2 text-small">
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="text-text hover:text-text-strong">
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </aside>
        <div className="space-y-10">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <h2 className="text-h2 text-text-strong">{section.title}</h2>
              <p className="mt-3 whitespace-pre-line text-body text-text">{section.content}</p>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
