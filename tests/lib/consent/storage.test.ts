import { describe, it, expect } from "vitest";
import {
  CONSENT_COOKIE_NAME,
  CONSENT_VERSION,
  type ConsentState
} from "@/lib/consent/types";
import {
  buildConsentCookie,
  createConsentState,
  parseConsentValue,
  readStoredConsent,
  serializeConsentValue
} from "@/lib/consent/storage";

const decidedAt = new Date("2026-06-11T10:00:00.000Z");

describe("createConsentState", () => {
  it("builds a complete state from preferences", () => {
    const state = createConsentState({ analytics: false, marketing: true }, decidedAt);
    expect(state).toEqual({
      necessary: true,
      analytics: false,
      marketing: true,
      version: CONSENT_VERSION,
      decidedAt: "2026-06-11T10:00:00.000Z"
    });
  });

  it("does not mutate its inputs", () => {
    const prefs = { analytics: true, marketing: false };
    const frozen = Object.freeze(prefs);
    expect(() => createConsentState(frozen, decidedAt)).not.toThrow();
  });
});

describe("serialize/parse round-trip", () => {
  it("survives a round-trip unchanged", () => {
    const state = createConsentState({ analytics: true, marketing: true }, decidedAt);
    expect(parseConsentValue(serializeConsentValue(state))).toEqual(state);
  });
});

describe("parseConsentValue", () => {
  it("returns null for undefined, null and empty input", () => {
    expect(parseConsentValue(undefined)).toBeNull();
    expect(parseConsentValue(null)).toBeNull();
    expect(parseConsentValue("")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseConsentValue("not-json")).toBeNull();
    expect(parseConsentValue("%7Bbroken")).toBeNull();
  });

  it("returns null when the shape is wrong", () => {
    expect(parseConsentValue(encodeURIComponent(JSON.stringify({ analytics: "yes" })))).toBeNull();
  });

  it("returns null when decidedAt is not an ISO datetime", () => {
    const tampered = {
      ...createConsentState({ analytics: true, marketing: true }, decidedAt),
      decidedAt: "yesterday"
    };
    expect(parseConsentValue(serializeConsentValue(tampered))).toBeNull();
  });

  it("returns null on version mismatch so the banner re-prompts", () => {
    const stale: ConsentState = {
      necessary: true,
      analytics: true,
      marketing: true,
      version: CONSENT_VERSION + 1,
      decidedAt: decidedAt.toISOString()
    };
    expect(parseConsentValue(serializeConsentValue(stale))).toBeNull();
  });
});

describe("readStoredConsent", () => {
  it("finds the consent cookie among others", () => {
    const state = createConsentState({ analytics: false, marketing: false }, decidedAt);
    const cookieString = `other=1; ${CONSENT_COOKIE_NAME}=${serializeConsentValue(state)}; another=x`;
    expect(readStoredConsent(cookieString)).toEqual(state);
  });

  it("returns null when the cookie is absent", () => {
    expect(readStoredConsent("other=1; another=x")).toBeNull();
    expect(readStoredConsent("")).toBeNull();
  });
});

describe("buildConsentCookie", () => {
  const state = createConsentState({ analytics: true, marketing: false }, decidedAt);

  it("sets name, path, max-age of one year and SameSite=Lax", () => {
    const cookie = buildConsentCookie(state, false);
    expect(cookie).toContain(`${CONSENT_COOKIE_NAME}=${serializeConsentValue(state)}`);
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=31536000");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).not.toContain("Secure");
  });

  it("appends Secure on https", () => {
    expect(buildConsentCookie(state, true)).toContain("Secure");
  });
});
