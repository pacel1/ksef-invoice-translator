/**
 * Adapter between the site-wide consent system (lib/consent, PR #63) and
 * PostHog persistence. The cookie banner's "analytics" category governs
 * PostHog cookies for everyone, logged-in or not: memory persistence
 * (cookieless) unless analytics consent was given.
 */
import { readStoredConsent } from "@/lib/consent/storage";
import type { ConsentState } from "@/lib/consent/types";

export type AnalyticsPersistence = "memory" | "localStorage+cookie";

export function persistenceFor(state: ConsentState | null): AnalyticsPersistence {
  return state?.analytics ? "localStorage+cookie" : "memory";
}

export function analyticsPersistenceFromCookie(cookieString: string): AnalyticsPersistence {
  return persistenceFor(readStoredConsent(cookieString));
}
