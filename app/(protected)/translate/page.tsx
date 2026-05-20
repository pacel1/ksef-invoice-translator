import { TranslatorWizardClient } from "@/components/translate/translator-wizard-client";
import { LowBalanceBanner } from "@/components/billing/low-balance-banner";
import { RecentInvoicesSidebar } from "@/components/workspace/recent-invoices-sidebar";
import { requireUser } from "@/lib/auth/require-user";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { getCurrentBalance } from "@/lib/billing/get-current-balance";
import { copy } from "@/lib/workspace/copy";

/**
 * Tłumacz wizard route — see specs/2026-05-20-tlumacz-workspace-redesign.md.
 *
 * Cutover landed in PR #E (2026-05-20): the NEXT_PUBLIC_TRANSLATE_V2 flag
 * is gone, this is the canonical authoring surface, and /app now permanent-
 * redirects here.
 */
export default async function TranslatePage() {
  const user = await requireUser();
  const { uiLanguage } = await getCurrentProfile(user.id);
  const balance = await getCurrentBalance(user.id);
  const t = copy[uiLanguage];

  // Total credits the user has access to right now (free remainder + paid pool).
  const totalCredits = balance.freeCreditsRemaining + balance.paidCredits;

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
        <TranslatorWizardClient
          uiLanguage={uiLanguage}
          initialBalance={totalCredits}
        />
      </main>
    </div>
  );
}
