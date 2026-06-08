import { cn } from "@/lib/utils";

export interface HowItWorksStep {
  title: string;
  body: string;
}

export interface HowItWorksProps {
  eyebrow: string;
  heading: string;
  steps: ReadonlyArray<HowItWorksStep>;
  className?: string;
}

/**
 * "Jak to działa" — three-step explainer that sits directly under the hero.
 * Pure presentational (no client state), so it renders as a server component.
 */
export function HowItWorks({ eyebrow, heading, steps, className }: HowItWorksProps) {
  return (
    <section className={cn("bg-surface", className)}>
      <div className="mx-auto w-full max-w-5xl px-5 py-20 md:px-8 md:py-24">
        <p className="text-micro uppercase tracking-wide text-accent">{eyebrow}</p>
        <h2 className="mt-3 max-w-2xl text-balance text-h2 text-text-strong">{heading}</h2>

        <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
          {steps.map((step, i) => (
            <li key={step.title} className="flex flex-col">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-h3 font-semibold tabular-nums text-accent">
                {i + 1}
              </span>
              <h3 className="mt-5 text-h3 text-text-strong">{step.title}</h3>
              <p className="mt-2 text-small text-text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export default HowItWorks;
