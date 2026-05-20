import { requireUser } from "@/lib/auth/require-user";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { listInvoices } from "@/lib/invoice/recent-invoices";
import { HistoryPage } from "@/components/history/history-page";

/**
 * History route under the /translate prefix. Re-uses the Sprint 3
 * <HistoryPage> composition unchanged — only the URL changed when the
 * cutover landed (PR #E).
 */
const DEFAULT_PER_PAGE = 20;

export default async function TranslateHistoryRoute() {
  const user = await requireUser();
  const { uiLanguage } = await getCurrentProfile(user.id);
  const initialData = await listInvoices(user.id, {
    page: 1,
    perPage: DEFAULT_PER_PAGE
  });
  return <HistoryPage initialData={initialData} locale={uiLanguage} />;
}
