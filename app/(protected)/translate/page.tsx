import { TranslatorWizardClient } from "@/components/translate/translator-wizard-client";
import { LowBalanceBanner } from "@/components/billing/low-balance-banner";
import { RecentInvoicesSidebar } from "@/components/workspace/recent-invoices-sidebar";
import { requireUser } from "@/lib/auth/require-user";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { getCurrentBalance } from "@/lib/billing/get-current-balance";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadPreloadedInvoice } from "@/lib/invoice/preloaded-invoice";
import { copy } from "@/lib/workspace/copy";

/**
 * Tłumacz wizard route — see specs/2026-05-20-tlumacz-workspace-redesign.md.
 *
 * Cutover landed in PR #E (2026-05-20): the NEXT_PUBLIC_TRANSLATE_V2 flag
 * is gone, this is the canonical authoring surface, and /app now permanent-
 * redirects here.
 */
export default async function TranslatePage({
  searchParams
}: {
  searchParams?: Promise<{ invoiceId?: string }>;
}) {
  const user = await requireUser();
  const { uiLanguage } = await getCurrentProfile(user.id);
  const balance = await getCurrentBalance(user.id);
  const t = copy[uiLanguage];

  // Total credits the user has access to right now (free remainder + paid pool).
  const totalCredits = balance.freeCreditsRemaining + balance.paidCredits;

  // ?invoiceId=… → user clicked a row in the Recent sidebar or History page
  // and wants to jump back into a saved translation. The wizard hydrates
  // into Step 3 if a cached translation exists, else Step 2 with the file
  // pre-attached. Either way, give the sidebar's collapse default a hint
  // so the preview gets full width by default.
  const params = (await searchParams) ?? {};
  const candidateInvoiceId = params.invoiceId?.match(/^[0-9a-f-]{36}$/i)
    ? params.invoiceId
    : undefined;
  const preloaded = candidateInvoiceId
    ? await loadPreloadedInvoice(await createSupabaseServerClient(), candidateInvoiceId)
    : null;
  const sidebarStartsCollapsed = Boolean(preloaded);

  return (
    <div className="-mx-5 -my-8 flex md:-mx-8">
      <RecentInvoicesSidebar
        userId={user.id}
        uiLanguage={uiLanguage}
        defaultCollapsed={sidebarStartsCollapsed}
      />
      <main className="flex-1 overflow-x-hidden px-5 py-8 md:px-8">
        <LowBalanceBanner
          initialFree={balance.freeCreditsRemaining}
          initialPaid={balance.paidCredits}
          title={String(t.lowBalanceBannerTitle)}
          body={String(t.lowBalanceBannerBody)}
          buyLabel={String(t.buyCredits)}
          closeLabel={String(t.close)}
        />
        {/* Keying by invoiceId (or 'fresh') forces a remount whenever the
            user navigates between /translate and /translate?invoiceId=…
            URLs — useReducer's lazy initial state only fires on mount, so
            without the key the wizard would keep the previous step state
            even though a new preloaded prop arrived. */}
        <TranslatorWizardClient
          key={preloaded?.invoiceId ?? "fresh"}
          uiLanguage={uiLanguage}
          initialBalance={totalCredits}
          preloaded={preloaded}
        />
      </main>
    </div>
  );
}
