import { ChevronDown } from "lucide-react";

export interface FAQItem {
  q: string;
  a: string;
}

export interface MarketingFAQProps {
  heading: string;
  items: ReadonlyArray<FAQItem>;
}

export function MarketingFAQ({ heading, items }: MarketingFAQProps) {
  return (
    <section className="space-y-6">
      <h2 className="text-h2 text-text-strong">{heading}</h2>
      <div className="divide-y divide-border rounded-xl border border-border bg-surface">
        {items.map((item) => (
          <details
            key={item.q}
            className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-4 text-body font-semibold text-text-strong">
              <span>{item.q}</span>
              <ChevronDown className="h-5 w-5 shrink-0 text-text-muted transition-transform duration-hover ease-out group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-small text-text">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
