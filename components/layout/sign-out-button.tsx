"use client";

import { resetAnalyticsIdentity } from "@/lib/analytics/client";

/**
 * Submit button for the sign-out server-action form. Resets the analytics
 * identity on click, before the action redirects away.
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
