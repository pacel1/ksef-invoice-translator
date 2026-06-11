import posthog from "posthog-js";
import { analyticsPersistenceFromCookie } from "@/lib/analytics/consent";

// Cookieless by default: memory persistence unless the visitor accepted the
// analytics category in the cookie banner (lib/consent). Autocapture stays
// off because invoice content renders in the DOM.
const persistence =
  typeof document === "undefined"
    ? "memory"
    : analyticsPersistenceFromCookie(document.cookie);

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
  api_host: "/ingest",
  ui_host: "https://eu.posthog.com",
  defaults: "2026-01-30",
  capture_exceptions: true,
  autocapture: false,
  persistence,
  debug: process.env.NODE_ENV === "development"
});
