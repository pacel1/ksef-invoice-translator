// instrumentation-client.ts
import posthog from "posthog-js";
import { persistenceFor, readConsentChoice } from "@/lib/analytics/consent";

// Cookieless by default (spec §2): memory persistence until the visitor
// accepts the consent prompt or logs in. Autocapture stays off because
// invoice content renders in the DOM (spec §3).
const consentChoice =
  typeof window === "undefined" ? null : readConsentChoice(window.localStorage);

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
  api_host: "/ingest",
  ui_host: "https://eu.posthog.com",
  defaults: "2026-01-30",
  capture_exceptions: true,
  autocapture: false,
  persistence: persistenceFor(consentChoice),
  debug: process.env.NODE_ENV === "development"
});
