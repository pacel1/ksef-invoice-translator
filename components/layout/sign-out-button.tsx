"use client";

import { resetAnalyticsIdentity } from "@/lib/analytics/client";

/**
 * Submit button for the sign-out server-action form. Resets the analytics
 * identity on click, before the action redirects away.
 *
 * The reset is wired to onClick, which fires for pointer and keyboard
 * activation of the button itself. The sign-out form must stay
 * single-control: another focusable field inside it would enable implicit
 * Enter-key submission that bypasses this handler.
 */
export function SignOutButton({ label }: { label: string }) {
  return (
    <button
      type="submit"
      onClick={() => resetAnalyticsIdentity()}
      className="rounded-md px-3 py-2 text-small text-text hover:bg-surface-muted"
    >
      {label}
    </button>
  );
}
