import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Step descriptor. `id` is the stable handle the wizard uses to identify
 * which step is current/completed; `label` is the user-visible Polish
 * (or English, in EN UI) text shown next to the step number.
 */
export interface StepperStep {
  id: string;
  label: string;
}

export interface StepperProps {
  /** Ordered list of steps. Order matters — index 0 is rendered as "1." */
  steps: ReadonlyArray<StepperStep>;
  /** The id of the currently active step. */
  current: string;
  /**
   * Set of step ids already completed. Steps in this set get a check icon
   * and become clickable iff `onJumpBack` is provided.
   */
  completedIds?: ReadonlySet<string>;
  /**
   * Optional handler fired when the user clicks a completed step. Receives
   * the step id. If omitted, completed steps render as static `<span>`s.
   */
  onJumpBack?: (id: string) => void;
  /** Accessible name for the wrapping `<nav>`. Defaults to "Steps". */
  ariaLabel?: string;
  className?: string;
}

/**
 * Semantic wizard step indicator.
 *
 * Renders `<nav aria-label="…"><ol><li>` — screen readers announce
 * "step N of M" and can navigate back to completed steps when the
 * `onJumpBack` callback is wired up. Visual states:
 *
 *   - completed → `success` color + check icon, button if jumpable
 *   - current   → `accent` color + bold label, aria-current="step"
 *   - future    → `text-muted`, never interactive
 *
 * No layout transitions on hover (avoids shifting the next step).
 * `cursor-pointer` only on clickable items so users see the affordance.
 */
export function Stepper({
  steps,
  current,
  completedIds,
  onJumpBack,
  ariaLabel = "Steps",
  className
}: StepperProps) {
  return (
    <nav aria-label={ariaLabel} className={cn("w-full", className)}>
      <ol className="flex w-full items-center gap-2 md:gap-3">
        {steps.map((step, index) => {
          const isCurrent = step.id === current;
          const isCompleted = completedIds?.has(step.id) ?? false;
          const isFuture = !isCurrent && !isCompleted;
          const isJumpable = isCompleted && typeof onJumpBack === "function";
          const isLast = index === steps.length - 1;

          const circleClasses = cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-small font-semibold transition-colors duration-hover",
            isCompleted && "border-success bg-success text-white",
            isCurrent && "border-accent bg-accent text-white",
            isFuture &&
              "border-border-strong bg-surface text-text-muted"
          );

          const labelClasses = cn(
            "text-small md:text-body",
            isCompleted && "font-medium text-text",
            isCurrent && "font-semibold text-text-strong",
            isFuture && "font-normal text-text-muted"
          );

          const stepBody = (
            <>
              <span className={circleClasses} aria-hidden="true">
                {isCompleted ? (
                  <Check
                    className="h-4 w-4"
                    data-testid="stepper-check"
                    aria-hidden="true"
                  />
                ) : (
                  index + 1
                )}
              </span>
              <span className={labelClasses}>{step.label}</span>
            </>
          );

          return (
            <li
              key={step.id}
              {...(isCurrent ? { "aria-current": "step" as const } : {})}
              className={cn(
                "flex flex-1 items-center gap-2 md:gap-3",
                isLast ? "flex-none" : "flex-1"
              )}
            >
              {isJumpable ? (
                <button
                  type="button"
                  onClick={() => onJumpBack?.(step.id)}
                  className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent md:gap-3 cursor-pointer"
                >
                  {stepBody}
                </button>
              ) : (
                <span className="flex items-center gap-2 md:gap-3">
                  {stepBody}
                </span>
              )}

              {!isLast ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-px flex-1",
                    isCompleted ? "bg-success/40" : "bg-border"
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
