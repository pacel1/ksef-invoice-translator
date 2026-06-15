"use client";

import { useEffect, useRef } from "react";

/**
 * Fires a single `sign_up` event into the GTM dataLayer after a new user
 * completes registration. The auth callback redirects fresh signups with a
 * `signup=1` query flag (app/auth/callback/route.ts); this component reads it
 * once, pushes the event, then strips the flag from the URL so a refresh does
 * not re-fire. A GTM trigger fires the Google Ads registration conversion off
 * this event (subject to consent). Renders no DOM. Mounted globally because the
 * post-signup redirect destination varies.
 */
export function SignupConversion() {
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("signup") !== "1") return;
    handled.current = true;

    const w = window as { dataLayer?: Array<Record<string, unknown>> };
    w.dataLayer = w.dataLayer ?? [];
    w.dataLayer.push({ event: "sign_up" });

    params.delete("signup");
    const query = params.toString();
    const cleaned = window.location.pathname + (query ? `?${query}` : "") + window.location.hash;
    window.history.replaceState(null, "", cleaned);
  }, []);

  return null;
}
