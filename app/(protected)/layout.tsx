import { requireUser } from "@/lib/auth/require-user";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { getCurrentBalance } from "@/lib/billing/get-current-balance";
import { signOut } from "@/app/actions/auth";
import { BalanceChip } from "@/components/billing/balance-chip";
import { AuthenticatedHeader } from "@/components/layout/authenticated-header";
import { LegalFooter } from "@/components/layout/legal-footer";
import { copy } from "@/lib/workspace/copy";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { uiLanguage } = await getCurrentProfile(user.id);
  const balance = await getCurrentBalance(user.id);
  const t = copy[uiLanguage];

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
      <AuthenticatedHeader email={user.email ?? ""} balanceSlot={balanceSlot} signOutAction={signOut} />
      <div className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 md:px-8">{children}</div>
      <LegalFooter locale={uiLanguage} />
    </div>
  );
}
