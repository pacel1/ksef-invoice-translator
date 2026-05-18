import { Monitor, Shield, Languages, FileText, Trash2, ArrowRight } from "lucide-react";

export type FlowIcon = "computer" | "shield" | "translate" | "pdf" | "trash";

export interface FlowStep {
  icon: FlowIcon;
  label: string;
}

export interface DataFlowDiagramProps {
  steps: ReadonlyArray<FlowStep>;
}

const ICONS: Record<FlowIcon, typeof Monitor> = {
  computer: Monitor,
  shield: Shield,
  translate: Languages,
  pdf: FileText,
  trash: Trash2
};

export function DataFlowDiagram({ steps }: DataFlowDiagramProps) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface p-6 shadow-sm md:flex-row md:items-stretch md:justify-between md:gap-2">
      {steps.map((step, index) => {
        const Icon = ICONS[step.icon];
        return (
          <div key={step.label} className="flex items-center gap-2 md:flex-1 md:flex-col md:items-center md:text-center">
            <div className="flex flex-col items-center gap-2 md:flex-col">
              <span
                data-flow-icon
                className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-accent-soft text-accent"
              >
                <Icon className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="text-small font-medium text-text-strong">{step.label}</span>
            </div>
            {index < steps.length - 1 ? (
              <ArrowRight
                data-flow-arrow
                className="h-5 w-5 shrink-0 text-text-muted rotate-90 md:rotate-0"
                aria-hidden="true"
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
