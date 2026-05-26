import { requireUser } from "@/lib/auth/require-user";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { getCurrentBalance } from "@/lib/billing/get-current-balance";
import { signOut } from "@/app/actions/auth";
import { BalanceChip } from "@/components/billing/balance-chip";
import { CreditPurchaseDrawer } from "@/components/billing/credit-purchase-drawer";
import { OnboardingNameModal } from "@/components/account/onboarding-name-modal";
import { AuthenticatedHeader } from "@/components/layout/authenticated-header";
import { LegalFooter } from "@/components/layout/legal-footer";
import { copy } from "@/lib/workspace/copy";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const profile = await getCurrentProfile(user.id);
  const { uiLanguage, firstName, lastName } = profile;
  const balance = await getCurrentBalance(user.id);
  const t = copy[uiLanguage];
  const reviewerMissing = !firstName?.trim() || !lastName?.trim();

  const balanceSlot = (
    <BalanceChip
      initialFree={balance.freeCreditsRemaining}
      initialPaid={balance.paidCredits}
      freeLabel={String(t.balanceFree)}
      paidLabel={String(t.balanceFreePaid)}
      topUpLabel={String(t.topUp)}
      outOfCreditsLabel={String(t.creditsExhaustedShort)}
    />
  );

  return (
    <div className="flex min-h-screen flex-col bg-surface text-text-strong">
      <AuthenticatedHeader
        email={user.email ?? ""}
        balanceSlot={balanceSlot}
        signOutAction={signOut}
        labels={{
          workspace: String(t.navWorkspace),
          history: String(t.navHistory),
          signOut: String(t.signOut)
        }}
      />
      <div className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 md:px-8">{children}</div>
      <LegalFooter locale={uiLanguage} />
      <CreditPurchaseDrawer
        sliderLabels={{
          pickPackageLabel: String(t.pickPackage),
          unitPriceLabel: String(t.unitPrice),
          totalLabel: String(t.total),
          totalWithTaxLabel: String(t.totalWithTax),
          continueLabel: String(t.continueToCheckout)
        }}
        labels={{
          title: String(t.drawerTitle),
          closeLabel: String(t.close)
        }}
      />
      <OnboardingNameModal
        missing={reviewerMissing}
        labels={{
          title: String(t.nameCaptureTitle),
          body: String(t.nameCaptureBody),
          firstNameLabel: String(t.nameCaptureFirstNameLabel),
          lastNameLabel: String(t.nameCaptureLastNameLabel),
          saveButton: String(t.nameCaptureSave),
          savingButton: String(t.nameCaptureSaving),
          dismissButton: String(t.nameCaptureDismiss),
          errorMessage: String(t.nameCaptureError)
        }}
      />
    </div>
  );
}
