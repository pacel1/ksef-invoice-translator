/**
 * Browser-side analytics API. The only module allowed to talk to posthog-js
 * outside instrumentation-client.ts. Import from client components only.
 */
import posthog from "posthog-js";
import type { AnalyticsEventMap, AnalyticsEventName } from "./events";
import { analyticsPersistenceFromCookie } from "./consent";

export function captureClient<E extends AnalyticsEventName>(
  event: E,
  properties: AnalyticsEventMap[E]
): void {
  if (typeof window === "undefined") return;
  posthog.capture(event, properties);
}

export function captureClientError(error: unknown): void {
  if (typeof window === "undefined") return;
  posthog.captureException(error);
}

/**
 * Identify a logged-in user by Supabase user id (spec §4). Identification is
 * independent of cookie consent: persistence is governed solely by the
 * consent banner's analytics category (PostHogConsentSync at runtime,
 * instrumentation-client.ts at init), so this function never changes it.
 * Safe to call on every render of the protected layout; re-identification is
 * skipped when the distinct id already matches.
 */
export function identifyAuthenticatedUser(
  userId: string,
  props: { email?: string; locale?: string }
): void {
  if (typeof window === "undefined") return;
  if (posthog.get_distinct_id() === userId) return;
  posthog.identify(userId, props);
}

/** Call on sign-out: unlink the person and drop back to the consent-derived persistence. */
export function resetAnalyticsIdentity(): void {
  if (typeof window === "undefined") return;
  posthog.reset();
  posthog.set_config({
    persistence: analyticsPersistenceFromCookie(document.cookie)
  });
}

/** Session id for stitching client sessions onto server-side captures. */
export function getAnalyticsSessionId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  const id = posthog.get_session_id();
  return id || undefined;
}
