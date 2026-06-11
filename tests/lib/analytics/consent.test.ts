import { describe, expect, it } from "vitest";
import {
  analyticsPersistenceFromCookie,
  persistenceFor
} from "@/lib/analytics/consent";
import { buildConsentCookie, createConsentState } from "@/lib/consent/storage";

const DECIDED_AT = new Date("2026-06-11T12:00:00.000Z");

function stateFor(prefs: { analytics: boolean; marketing: boolean }) {
  return createConsentState(prefs, DECIDED_AT);
}

/** Extracts the `name=value` segment a browser would expose via document.cookie. */
function cookiePair(prefs: { analytics: boolean; marketing: boolean }): string {
  return buildConsentCookie(stateFor(prefs), false).split(";")[0];
}

describe("persistenceFor", () => {
  it("uses cookieless memory persistence when no decision is stored", () => {
    expect(persistenceFor(null)).toBe("memory");
  });

  it("stays in memory when analytics is declined even if marketing is granted", () => {
    expect(persistenceFor(stateFor({ analytics: false, marketing: true }))).toBe("memory");
  });

  it("upgrades to cookie persistence when analytics is granted", () => {
    expect(persistenceFor(stateFor({ analytics: true, marketing: false }))).toBe(
      "localStorage+cookie"
    );
  });
});

describe("analyticsPersistenceFromCookie", () => {
  it("returns memory for an empty cookie string", () => {
    expect(analyticsPersistenceFromCookie("")).toBe("memory");
  });

  it("returns cookie persistence when the stored cookie granted analytics", () => {
    expect(analyticsPersistenceFromCookie(cookiePair({ analytics: true, marketing: false }))).toBe(
      "localStorage+cookie"
    );
  });

  it("returns memory when the stored cookie declined analytics", () => {
    expect(analyticsPersistenceFromCookie(cookiePair({ analytics: false, marketing: true }))).toBe(
      "memory"
    );
  });

  it("returns memory for a garbage cookie value", () => {
    expect(analyticsPersistenceFromCookie("cookie_consent=garbage")).toBe("memory");
  });
});
