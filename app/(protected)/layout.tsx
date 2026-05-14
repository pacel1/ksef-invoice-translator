import Link from "next/link";
import { FileText } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { getCurrentProfile } from "@/lib/auth/get-current-profile";
import { getCurrentBalance } from "@/lib/billing/get-current-balance";
import { signOut } from "@/app/actions/auth";
import { BalanceChip } from "@/components/billing/balance-chip";
import { copy } from "@/lib/workspace/copy";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const { uiLanguage } = await getCurrentProfile(user.id);
  const balance = await getCurrentBalance(user.id);
  const t = copy[uiLanguage];

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-3 md:px-8">
          <Link href="/app" className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <FileText className="h-5 w-5 text-cyan-700" />
            KSeF Invoice Translator
          </Link>
          <nav className="flex items-center gap-3 text-sm text-slate-700">
            <Link href="/app" className="rounded-md px-3 py-2 hover:bg-slate-100">Workspace</Link>
            <BalanceChip
              initialFree={balance.freeCreditsRemaining}
              initialPaid={balance.paidCredits}
              freeLabel={String(t.balanceFree)}
              paidLabel={String(t.balanceFreePaid)}
              topUpLabel={String(t.topUp)}
              outOfCreditsLabel={String(t.creditsExhaustedShort)}
            />
            <Link href="/account" className="rounded-md px-3 py-2 hover:bg-slate-100">
              {user.email}
            </Link>
            <form action={signOut}>
              <button type="submit" className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
                Wyloguj
              </button>
            </form>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-8 md:px-8">{children}</div>
    </div>
  );
}
