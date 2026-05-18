import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLockup } from "@/components/brand/brand-lockup";

export interface AuthenticatedHeaderProps {
  email: string;
  /** Slot for the live <BalanceChip>. Passed in as JSX so this component stays purely presentational. */
  balanceSlot: ReactNode;
  /** Server action bound to the logout form. */
  signOutAction: () => Promise<void> | void;
}

export function AuthenticatedHeader({ email, balanceSlot, signOutAction }: AuthenticatedHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-3 md:px-8">
        <BrandLockup href="/app" size="md" />
        <nav className="flex items-center gap-3 text-small text-text">
          <Link href="/app" className="rounded-md px-3 py-2 hover:bg-surface-muted">Workspace</Link>
          <Link href="/app/history" className="rounded-md px-3 py-2 hover:bg-surface-muted">Historia</Link>
          {balanceSlot}
          <Link href="/account" className="rounded-md px-3 py-2 hover:bg-surface-muted">
            {email}
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-md px-3 py-2 text-small text-text hover:bg-surface-muted"
            >
              Wyloguj
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
