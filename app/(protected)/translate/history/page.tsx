import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { listInvoices } from "@/lib/invoice/recent-invoices";
import { HistoryPage } from "@/components/history/history-page";

/**
 * History route under the new /translate prefix. Re-uses the Sprint 3
 * <HistoryPage> composition unchanged — the only thing different from
 * /app/history is the URL.
 *
 * Same flag gate as /translate. When off, falls through to the legacy
 * /app/history route.
 */
const DEFAULT_PER_PAGE = 20;
const FLAG_ON = process.env.NEXT_PUBLIC_TRANSLATE_V2 === "1";

export default async function TranslateHistoryRoute() {
  if (!FLAG_ON) redirect("/app/history");

  const user = await requireUser();
  const { uiLanguage } = await getCurrentProfile(user.id);
  const initialData = await listInvoices(user.id, {
    page: 1,
    perPage: DEFAULT_PER_PAGE
  });
  return <HistoryPage initialData={initialData} locale={uiLanguage} />;
}
