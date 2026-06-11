/**
 * Browser-side analytics API. The only module allowed to talk to posthog-js
 * outside instrumentation-client.ts. Import from client components only.
 */
import posthog from "posthog-js";
import type { AnalyticsEventMap, AnalyticsEventName } from "./events";
import { persistenceFor, readConsentChoice } from "./consent";

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
 * Identify a logged-in user by Supabase user id (spec §4). Logged-in users
 * get cookie persistence under legitimate interest, disclosed in the
 * privacy policy. Safe to call on every render of the protected layout;
 * re-identification is skipped when the distinct id already matches.
 */
export function identifyAuthenticatedUser(
  userId: string,
  props: { email?: string; locale?: string }
): void {
  if (typeof window === "undefined") return;
  if (posthog.get_distinct_id() === userId) return;
  posthog.set_config({ persistence: "localStorage+cookie" });
  posthog.identify(userId, props);
}

/** Call on sign-out: unlink the person and drop back to the consent-derived persistence. */
export function resetAnalyticsIdentity(): void {
  if (typeof window === "undefined") return;
  posthog.reset();
  posthog.set_config({
    persistence: persistenceFor(readConsentChoice(window.localStorage))
  });
}

/** Session id for stitching client sessions onto server-side captures. */
export function getAnalyticsSessionId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return posthog.get_session_id();
}
