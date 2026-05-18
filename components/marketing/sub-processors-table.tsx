export interface SubProcessorRow {
  name: string;
  role: string;
  location: string;
}

export interface SubProcessorsTableLabels {
  nameHeader: string;
  roleHeader: string;
  locationHeader: string;
}

export interface SubProcessorsTableProps {
  labels: SubProcessorsTableLabels;
  rows: ReadonlyArray<SubProcessorRow>;
}

export function SubProcessorsTable({ labels, rows }: SubProcessorsTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <table className="w-full">
        <thead className="bg-surface-muted">
          <tr>
            <th className="px-5 py-3 text-left text-micro uppercase tracking-wide text-text-muted">
              {labels.nameHeader}
            </th>
            <th className="px-5 py-3 text-left text-micro uppercase tracking-wide text-text-muted">
              {labels.roleHeader}
            </th>
            <th className="px-5 py-3 text-left text-micro uppercase tracking-wide text-text-muted">
              {labels.locationHeader}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row.name}>
              <td className="px-5 py-3 text-body font-semibold text-text-strong">{row.name}</td>
              <td className="px-5 py-3 text-body text-text">{row.role}</td>
              <td className="px-5 py-3 text-body text-text">{row.location}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
