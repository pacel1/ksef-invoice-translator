import { requireUser } from "@/lib/auth/require-user";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { listInvoices } from "@/lib/invoice/recent-invoices";
import { HistoryPage } from "@/components/history/history-page";

const DEFAULT_PER_PAGE = 20;

export default async function HistoryRoute() {
  const user = await requireUser();
  const { uiLanguage } = await getCurrentProfile(user.id);
  const initialData = await listInvoices(user.id, { page: 1, perPage: DEFAULT_PER_PAGE });

  return <HistoryPage initialData={initialData} locale={uiLanguage} />;
}
