import { requireUser } from "@/lib/auth/require-user";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { listInvoices } from "@/lib/invoice/recent-invoices";
import { HistoryPage } from "@/components/history/history-page";
import { RecentInvoicesSidebar } from "@/components/workspace/recent-invoices-sidebar";

/**
 * History route under the /translate prefix. Re-uses the Sprint 3
 * <HistoryPage> composition, wrapped in the same sidebar shell as
 * /translate so the user can navigate back to a new translation or
 * open a recent invoice without using the browser back button.
 *
 * Mobile (no md): sidebar is hidden by the CollapsibleSidebar wrapper,
 * so the history table gets the full width as before.
 */
const DEFAULT_PER_PAGE = 20;

export default async function TranslateHistoryRoute() {
  const user = await requireUser();
  const { uiLanguage } = await getCurrentProfile(user.id);
  const initialData = await listInvoices(user.id, {
    page: 1,
    perPage: DEFAULT_PER_PAGE
  });

  return (
    <div className="-mx-5 -my-8 flex min-h-[calc(100vh-72px)] md:-mx-8">
      <RecentInvoicesSidebar userId={user.id} uiLanguage={uiLanguage} />
      <main className="flex-1 overflow-x-hidden px-5 py-8 md:px-8">
        <HistoryPage initialData={initialData} locale={uiLanguage} />
      </main>
    </div>
  );
}
