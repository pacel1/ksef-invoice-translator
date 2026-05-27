import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Copy, UiLanguage } from "@/lib/workspace/copy";
import { copy } from "@/lib/workspace/copy";

interface PurchaseHistoryProps {
  userId: string;
  uiLanguage: UiLanguage;
}

type FakturaGovStatus = "pending" | "processing" | "ok" | "send_error" | "failed";

interface FakturaInfo {
  govStatus: FakturaGovStatus;
  pdfUrl: string | null;
}

interface FakturaJoinedRow {
  kind: string;
  gov_status: string;
  pdf_url: string | null;
}

function findVatFaktura(rows: FakturaJoinedRow[] | null): FakturaInfo | null {
  if (!rows) return null;
  const vat = rows.find((r) => r.kind === "vat");
  if (!vat) return null;
  return {
    govStatus: vat.gov_status as FakturaGovStatus,
    pdfUrl: vat.pdf_url
  };
}

function fakturaBadgeClass(status: FakturaGovStatus | "none"): string {
  switch (status) {
    case "pending":
    case "processing":
      return "bg-amber-50 text-amber-800 border border-amber-200";
    case "ok":
      return "bg-success/10 text-success border border-success/30";
    case "send_error":
    case "failed":
      return "bg-danger/10 text-danger border border-danger/30";
    default:
      return "bg-surface-muted text-text-muted border border-border";
  }
}

function fakturaLabel(status: FakturaGovStatus | "none", t: Copy): string {
  switch (status) {
    case "pending":
    case "processing":
      return String(t.fakturaInProgress);
    case "ok":
      return String(t.fakturaIssued);
    case "send_error":
    case "failed":
      return String(t.fakturaError);
    default:
      return "—";
  }
}

export async function PurchaseHistory({ userId, uiLanguage }: PurchaseHistoryProps) {
  const admin = getSupabaseAdminClient();
  const { data: rows } = await admin
    .from("stripe_purchases")
    .select(
      "id, package_size, total_amount_cents, currency, status, created_at, paid_at, fakturownia_invoices(id, kind, fakturownia_id, gov_status, gov_id, pdf_url, created_at)"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  const t = copy[uiLanguage];
  const formatter = new Intl.NumberFormat(uiLanguage === "pl" ? "pl-PL" : "en-GB", {
    style: "currency",
    currency: "PLN"
  });
  const dateFormatter = new Intl.DateTimeFormat(uiLanguage === "pl" ? "pl-PL" : "en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });

  function statusLabel(status: string): string {
    switch (status) {
      case "paid":
        return String(t.purchaseStatusPaid);
      case "pending":
        return String(t.purchaseStatusPending);
      case "failed":
        return String(t.purchaseStatusFailed);
      case "refunded":
        return String(t.purchaseStatusRefunded);
      default:
        return status;
    }
  }

  if (!rows || rows.length === 0) {
    return null;
  }

  return (
    <section className="mt-8">
      <h2 className="text-h2 font-semibold text-text-strong">{String(t.purchaseHistory)}</h2>
      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
        <table className="w-full text-small">
          <thead className="bg-surface-muted text-left text-micro uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-3">{String(t.purchaseDate)}</th>
              <th className="px-4 py-3">{String(t.purchaseSize)}</th>
              <th className="px-4 py-3">{String(t.purchaseTotal)}</th>
              <th className="px-4 py-3">{String(t.purchaseStatus)}</th>
              <th className="px-4 py-3">{String(t.fakturaHeader)}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const fakturaRows = (
                row as unknown as {
                  fakturownia_invoices: FakturaJoinedRow[] | null;
                }
              ).fakturownia_invoices;
              const info = findVatFaktura(fakturaRows);
              const fakturaStatus: FakturaGovStatus | "none" = info?.govStatus ?? "none";
              return (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-text">
                    {dateFormatter.format(new Date(row.created_at))}
                  </td>
                  <td className="px-4 py-3 text-text tabular-nums">{row.package_size}</td>
                  <td className="px-4 py-3 text-text tabular-nums">
                    {formatter.format(row.total_amount_cents / 100)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-micro font-medium ${statusClass(row.status)}`}
                    >
                      {statusLabel(row.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-micro font-medium ${fakturaBadgeClass(fakturaStatus)}`}
                      >
                        {fakturaLabel(fakturaStatus, t)}
                      </span>
                      {info?.pdfUrl ? (
                        <a
                          href={info.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-small font-medium text-accent hover:text-accent-hover"
                        >
                          {String(t.fakturaDownload)}
                        </a>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function statusClass(status: string): string {
  switch (status) {
    case "paid":
      return "bg-success/10 text-success border border-success/30";
    case "pending":
      return "bg-amber-50 text-amber-800 border border-amber-200";
    case "refunded":
      return "bg-surface-muted text-text border border-border";
    case "failed":
      return "bg-danger/10 text-danger border border-danger/30";
    default:
      return "bg-surface-muted text-text border border-border";
  }
}
