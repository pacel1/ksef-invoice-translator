import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RiskReversalProps {
  eyebrow: string;
  heading: string;
  items: ReadonlyArray<string>;
  ctaText: string;
  ctaHref: string;
  className?: string;
}

/**
 * "Zacznij bez ryzyka" — replaces the old (fake) testimonials block with
 * honest, already-true promises plus the primary CTA. Pure presentational.
 */
export function RiskReversal({
  eyebrow,
  heading,
  items,
  ctaText,
  ctaHref,
  className
}: RiskReversalProps) {
  return (
    <section className={cn("bg-surface-muted", className)}>
      <div className="mx-auto w-full max-w-3xl px-5 py-20 text-center md:px-8">
        <p className="text-micro uppercase tracking-wide text-accent">{eyebrow}</p>
        <h2 className="mt-3 text-h2 text-text-strong">{heading}</h2>

        <ul className="mx-auto mt-8 grid max-w-xl gap-x-8 gap-y-4 text-left sm:grid-cols-2">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="text-body text-text">{item}</span>
            </li>
          ))}
        </ul>

        <div className="mt-10">
          <Link
            href={ctaHref}
            className="inline-flex h-12 items-center justify-center rounded-md bg-accent px-8 text-body font-semibold text-white shadow-sm transition-colors duration-hover ease-out hover:bg-accent-hover"
          >
            {ctaText}
          </Link>
        </div>
      </div>
    </section>
  );
}

export default RiskReversal;
