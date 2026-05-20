import Link from "next/link";
import { Plus, HelpCircle, Mail } from "lucide-react";
import { getRecentInvoices, type InvoiceSummary } from "@/lib/invoice/recent-invoices";
import { CollapsibleSidebar } from "./collapsible-sidebar";

export interface RecentInvoicesSidebarProps {
  userId: string;
  uiLanguage: "pl" | "en";
  /** Pass true when the user lands directly into Step 3 so the sidebar
   * starts collapsed and the preview gets full width. */
  defaultCollapsed?: boolean;
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

const RECENT_LIMIT = 8;

/**
 * Server-rendered sidebar wrapper — fetches recent invoices, picks a
 * locale-appropriate label set, then hands the rendered tree to
 * <CollapsibleSidebar> (client) for the collapse/expand control.
 */
export async function RecentInvoicesSidebar({
  userId,
  uiLanguage,
  defaultCollapsed = false
}: RecentInvoicesSidebarProps) {
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

  const collapseLabel =
    uiLanguage === "pl" ? "Zwiń pasek boczny" : "Collapse sidebar";
  const expandLabel =
    uiLanguage === "pl" ? "Rozwiń pasek boczny" : "Expand sidebar";

  return (
    <CollapsibleSidebar
      defaultCollapsed={defaultCollapsed}
      labels={{
        newInvoiceLabel: labels.newInvoiceLabel,
        recentHeading: labels.recentHeading,
        allArchive: labels.allArchive,
        helpLabel: labels.helpLabel,
        collapseLabel,
        expandLabel
      }}
    >
      <RecentInvoicesSidebarView invoices={invoices} labels={labels} />
    </CollapsibleSidebar>
  );
}

/**
 * Pure presentational sidebar. Exported separately for unit testing without a DB.
 */
export function RecentInvoicesSidebarView({ invoices, labels }: RecentInvoicesSidebarViewProps) {
  // Visibility (hidden md:flex) and width (w-60) live on this aside even
  // though the CollapsibleSidebar wraps it. When expanded, the wrapper
  // renders this aside directly; when collapsed, it renders an icon rail
  // instead.
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface-muted/60 py-6">
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
            <li key={invoice.id}>
              <Link
                href={`/translate?invoiceId=${invoice.id}`}
                className="block cursor-pointer rounded-md border border-border bg-surface p-3 shadow-sm transition-colors duration-hover hover:border-accent hover:bg-accent-soft/40"
              >
                <p className="font-mono text-small text-text-strong">
                  {invoice.invoiceNumber ?? "—"}
                </p>
                {invoice.issueDate ? (
                  <p className="mt-0.5 text-micro text-text-muted">
                    {invoice.issueDate}
                  </p>
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
              </Link>
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
