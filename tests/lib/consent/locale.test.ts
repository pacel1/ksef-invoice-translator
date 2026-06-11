import { describe, it, expect } from "vitest";
import { localeFromPathname } from "@/lib/consent/locale";

describe("localeFromPathname", () => {
  it("returns pl for the root and Polish pages", () => {
    expect(localeFromPathname("/")).toBe("pl");
    expect(localeFromPathname("/pricing")).toBe("pl");
    expect(localeFromPathname("/privacy")).toBe("pl");
  });

  it("returns en for /en and nested English pages", () => {
    expect(localeFromPathname("/en")).toBe("en");
    expect(localeFromPathname("/en/")).toBe("en");
    expect(localeFromPathname("/en/pricing")).toBe("en");
  });

  it("does not treat lookalike segments as English", () => {
    expect(localeFromPathname("/enterprise")).toBe("pl");
    expect(localeFromPathname("/entry/en")).toBe("pl");
  });
});
