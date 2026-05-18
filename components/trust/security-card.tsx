import { CheckCircle2 } from "lucide-react";

export interface SecurityCardProps {
  title: string;
  items: ReadonlyArray<string>;
}

export function SecurityCard({ title, items }: SecurityCardProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <h3 className="text-h3 text-text-strong">{title}</h3>
      <ul className="mt-4 space-y-3 text-body text-text">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3">
            <CheckCircle2
              data-security-check
              className="mt-0.5 h-5 w-5 shrink-0 text-success"
              aria-hidden="true"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
