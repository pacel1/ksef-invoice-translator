/** @vitest-environment jsdom */
import { describe, it, expect, vi, afterEach } from "vitest";
import { pushConsentUpdate } from "@/lib/consent/gtag";
import { createConsentState } from "@/lib/consent/storage";

const decidedAt = new Date("2026-06-11T10:00:00.000Z");

type WindowWithGtag = Window & { gtag?: (...args: unknown[]) => void; dataLayer?: unknown[] };
const win = window as unknown as WindowWithGtag;

afterEach(() => {
  delete win.gtag;
  delete win.dataLayer;
});

describe("pushConsentUpdate", () => {
  it("calls window.gtag when the tag is already loaded", () => {
    const gtag = vi.fn();
    win.gtag = gtag;
    pushConsentUpdate(createConsentState({ analytics: false, marketing: false }, decidedAt));
    expect(gtag).toHaveBeenCalledWith("consent", "update", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied"
    });
  });

  it("queues the update into dataLayer when gtag is not yet defined (revocation race)", () => {
    pushConsentUpdate(createConsentState({ analytics: true, marketing: false }, decidedAt));
    expect(win.dataLayer).toBeDefined();
    const entries = (win.dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>));
    expect(entries).toContainEqual([
      "consent",
      "update",
      {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "granted"
      }
    ]);
  });
});
