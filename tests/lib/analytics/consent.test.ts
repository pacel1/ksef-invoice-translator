import { describe, expect, it } from "vitest";
import {
  CONSENT_REPROMPT_DAYS,
  CONSENT_STORAGE_KEY,
  persistenceFor,
  readConsentChoice,
  shouldShowConsentPrompt,
  storeConsentChoice
} from "@/lib/analytics/consent";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    }
  };
}

const NOW = new Date("2026-06-11T12:00:00.000Z");

describe("consent storage", () => {
  it("round-trips a stored choice", () => {
    const storage = memoryStorage();
    const stored = storeConsentChoice(storage, "accepted", NOW);
    expect(stored).toEqual({ value: "accepted", at: NOW.toISOString() });
    expect(readConsentChoice(storage)).toEqual(stored);
  });

  it("returns null for missing or corrupted values", () => {
    expect(readConsentChoice(memoryStorage())).toBeNull();
    expect(
      readConsentChoice(memoryStorage({ [CONSENT_STORAGE_KEY]: "not json" }))
    ).toBeNull();
    expect(
      readConsentChoice(
        memoryStorage({ [CONSENT_STORAGE_KEY]: JSON.stringify({ value: "??" }) })
      )
    ).toBeNull();
  });
});

describe("shouldShowConsentPrompt", () => {
  it("shows when there is no stored choice", () => {
    expect(shouldShowConsentPrompt(null, NOW)).toBe(true);
  });

  it("hides forever after accept", () => {
    expect(
      shouldShowConsentPrompt({ value: "accepted", at: "2025-01-01T00:00:00.000Z" }, NOW)
    ).toBe(false);
  });

  it("hides a recent decline but re-asks after the re-prompt window", () => {
    expect(
      shouldShowConsentPrompt({ value: "declined", at: "2026-06-01T00:00:00.000Z" }, NOW)
    ).toBe(false);
    const old = new Date(
      NOW.getTime() - (CONSENT_REPROMPT_DAYS + 1) * 86_400_000
    ).toISOString();
    expect(shouldShowConsentPrompt({ value: "declined", at: old }, NOW)).toBe(true);
  });

  it("re-asks when the stored timestamp is in the future (untrustworthy)", () => {
    const future = new Date(NOW.getTime() + 86_400_000).toISOString();
    expect(shouldShowConsentPrompt({ value: "declined", at: future }, NOW)).toBe(true);
  });

  it("stays hidden at exactly the re-prompt boundary", () => {
    const exactly = new Date(
      NOW.getTime() - CONSENT_REPROMPT_DAYS * 86_400_000
    ).toISOString();
    expect(shouldShowConsentPrompt({ value: "declined", at: exactly }, NOW)).toBe(false);
  });
});

describe("persistenceFor", () => {
  it("uses cookieless memory persistence unless consent was accepted", () => {
    expect(persistenceFor(null)).toBe("memory");
    expect(persistenceFor({ value: "declined", at: NOW.toISOString() })).toBe("memory");
    expect(persistenceFor({ value: "accepted", at: NOW.toISOString() })).toBe(
      "localStorage+cookie"
    );
  });
});
