import type { ConsentState } from "./types";

type GtagFn = (...args: unknown[]) => void;

interface GtagWindow {
  gtag?: GtagFn;
  dataLayer?: unknown[];
}

/**
 * Pushes the current consent decision to Google. If gtag is not defined yet
 * (the tag is still loading, or a revocation landed before the bootstrap
 * executed), the command is queued into dataLayer using the canonical
 * arguments-object form, so gtag.js replays it on load. This closes the
 * revocation race: a decision is never silently dropped.
 */
export function pushConsentUpdate(state: ConsentState): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as GtagWindow;
  const signal = (granted: boolean) => (granted ? "granted" : "denied");
  const payload = {
    ad_storage: signal(state.marketing),
    ad_user_data: signal(state.marketing),
    ad_personalization: signal(state.marketing),
    analytics_storage: signal(state.analytics)
  };
  if (typeof w.gtag === "function") {
    w.gtag("consent", "update", payload);
    return;
  }
  w.dataLayer = w.dataLayer ?? [];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- the signature carries arity for TS; the body must push the genuine arguments object because gtag.js ignores plain arrays
  const queue = function (..._args: unknown[]) {
    // eslint-disable-next-line prefer-rest-params -- gtag.js only replays genuine arguments objects, not arrays
    (w.dataLayer as unknown[]).push(arguments);
  };
  queue("consent", "update", payload);
}
