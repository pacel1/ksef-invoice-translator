import { TranslatorWorkspace } from "@/components/workspace/translator-workspace";
import { LowBalanceBanner } from "@/components/billing/low-balance-banner";
import { RecentInvoicesSidebar } from "@/components/workspace/recent-invoices-sidebar";
import { requireUser } from "@/lib/auth/require-user";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { getCurrentBalance } from "@/lib/billing/get-current-balance";
import { copy } from "@/lib/workspace/copy";

export default async function AppPage() {
  const user = await requireUser();
  const { uiLanguage } = await getCurrentProfile(user.id);
  const balance = await getCurrentBalance(user.id);
  const t = copy[uiLanguage];

  return (
    <div className="-mx-5 -my-8 flex min-h-[calc(100vh-72px)] md:-mx-8">
      <RecentInvoicesSidebar userId={user.id} uiLanguage={uiLanguage} />
      <main className="flex-1 overflow-x-hidden px-5 py-8 md:px-8">
        <LowBalanceBanner
          initialFree={balance.freeCreditsRemaining}
          initialPaid={balance.paidCredits}
          title={String(t.lowBalanceBannerTitle)}
          body={String(t.lowBalanceBannerBody)}
          buyLabel={String(t.buyCredits)}
          closeLabel={String(t.close)}
        />
        <TranslatorWorkspace uiLanguage={uiLanguage} />
      </main>
    </div>
  );
}
