import { TranslatorWorkspace } from "@/components/workspace/translator-workspace";
import { LowBalanceBanner } from "@/components/billing/low-balance-banner";
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
    <>
      <LowBalanceBanner
        initialFree={balance.freeCreditsRemaining}
        initialPaid={balance.paidCredits}
        title={String(t.lowBalanceBannerTitle)}
        body={String(t.lowBalanceBannerBody)}
        buyLabel={String(t.buyCredits)}
        closeLabel={String(t.close)}
      />
      <TranslatorWorkspace uiLanguage={uiLanguage} />
    </>
  );
}
