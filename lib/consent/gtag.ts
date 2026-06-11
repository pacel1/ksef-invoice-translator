import type { ConsentState } from "./types";

type GtagFn = (...args: unknown[]) => void;

/**
 * Pushes the current consent decision to gtag if the Google tag is already
 * loaded in this session. A no-op before the tag loads (basic consent mode:
 * the tag is never loaded without marketing consent in the first place).
 */
export function pushConsentUpdate(state: ConsentState): void {
  if (typeof window === "undefined") return;
  const gtag = (window as { gtag?: GtagFn }).gtag;
  if (typeof gtag !== "function") return;
  const signal = (granted: boolean) => (granted ? "granted" : "denied");
  gtag("consent", "update", {
    ad_storage: signal(state.marketing),
    ad_user_data: signal(state.marketing),
    ad_personalization: signal(state.marketing),
    analytics_storage: signal(state.analytics)
  });
}
