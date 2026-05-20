import Link from "next/link";
import { Plus, HelpCircle, Mail } from "lucide-react";
import { getRecentInvoices, type InvoiceSummary } from "@/lib/invoice/recent-invoices";

export interface RecentInvoicesSidebarProps {
  userId: string;
  uiLanguage: "pl" | "en";
}

export interface RecentInvoicesSidebarLabels {
  newInvoiceLabel: string;
  recentHeading: string;
  allArchive: string;
  helpLabel: string;
  contactLabel: string;
}

export interface RecentInvoicesSidebarViewProps {
  invoices: InvoiceSummary[];
  labels: RecentInvoicesSidebarLabels;
}

const RECENT_LIMIT = 5;

/**
 * Server-rendered sidebar wrapper — fetches recent invoices then delegates to View.
 */
export async function RecentInvoicesSidebar({ userId, uiLanguage }: RecentInvoicesSidebarProps) {
  const invoices = await getRecentInvoices(userId, RECENT_LIMIT);
  // Cutover relabels (spec §4) — sidebar now points at /translate, with
  // the action-oriented "Nowe tłumaczenie" replacing "Nowa faktura" and
  // a clean "Historia" (was "Cały archiwum" which had a Polish grammar
  // bug — neuter noun "archiwum" needed neuter "Całe").
  const labels: RecentInvoicesSidebarLabels =
    uiLanguage === "pl"
      ? {
          newInvoiceLabel: "+ Nowe tłumaczenie",
          recentHeading: "Ostatnie",
          allArchive: "Historia",
          helpLabel: "Pomoc",
          contactLabel: "Kontakt"
        }
      : {
          newInvoiceLabel: "+ New translation",
          recentHeading: "Recent",
          allArchive: "History",
          helpLabel: "Help",
          contactLabel: "Contact"
        };

  return <RecentInvoicesSidebarView invoices={invoices} labels={labels} />;
}

/**
 * Pure presentational sidebar. Exported separately for unit testing without a DB.
 */
export function RecentInvoicesSidebarView({ invoices, labels }: RecentInvoicesSidebarViewProps) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface-muted/60 py-6 md:flex">
      <div className="px-4">
        <Link
          href="/translate"
          className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-1 rounded-md bg-accent px-4 text-small font-semibold text-white shadow-sm transition-colors duration-hover ease-out hover:bg-accent-hover"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {labels.newInvoiceLabel.replace(/^\+\s*/, "")}
        </Link>
      </div>

      <div className="mt-8 flex-1 overflow-y-auto px-4">
        <h2 className="text-micro uppercase tracking-wide text-text-muted">
          {labels.recentHeading}
        </h2>
        <ul className="mt-3 space-y-3">
          {invoices.map((invoice) => (
            <li key={invoice.id} className="rounded-md border border-border bg-surface p-3 shadow-sm">
              <p className="font-mono text-small text-text-strong">
                {invoice.invoiceNumber ?? "—"}
              </p>
              {invoice.issueDate ? (
                <p className="mt-0.5 text-micro text-text-muted">{invoice.issueDate}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="inline-flex h-5 items-center rounded-full bg-accent-soft px-2 text-[10px] font-semibold uppercase tracking-wide text-accent">
                  PL
                </span>
                {invoice.translatedLanguages.map((lang) => (
                  <span
                    key={lang}
                    className="inline-flex h-5 items-center rounded-full bg-surface-muted px-2 text-[10px] font-semibold tracking-wide text-text"
                  >
                    {lang.toUpperCase()}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <Link
            href="/translate/history"
            className="inline-flex cursor-pointer text-small font-medium text-accent hover:text-accent-hover"
          >
            {labels.allArchive} →
          </Link>
        </div>
      </div>

      <div className="mt-6 border-t border-border px-4 pt-4 space-y-2 text-small text-text-muted">
        <Link href="/security" className="flex items-center gap-2 hover:text-text-strong">
          <HelpCircle className="h-4 w-4" aria-hidden="true" />
          {labels.helpLabel}
        </Link>
        <Link href="/security#kontakt" className="flex items-center gap-2 hover:text-text-strong">
          <Mail className="h-4 w-4" aria-hidden="true" />
          {labels.contactLabel}
        </Link>
      </div>
    </aside>
  );
}
