"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { persistenceFor } from "@/lib/analytics/consent";
import type { ConsentState } from "@/lib/consent/types";

/**
 * Applies the cookie banner's analytics decision to PostHog. Mounted inside
 * ConsentProvider next to GoogleAdsTag. On decline or revoke, reset() runs
 * while the old persistence is still active so prior ph_* storage residue
 * is cleared before dropping to cookieless memory mode.
 */
export function PostHogConsentSync({ consent }: { consent: ConsentState | null }) {
  useEffect(() => {
    if (!consent) return; // undecided: init-time persistence stands
    if (consent.analytics) {
      posthog.set_config({ persistence: persistenceFor(consent) });
      return;
    }
    posthog.reset();
    posthog.set_config({ persistence: "memory" });
  }, [consent]);

  return null;
}
