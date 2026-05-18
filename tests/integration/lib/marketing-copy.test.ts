import { describe, it, expect } from "vitest";
import { marketingCopy } from "@/lib/marketing/copy";

describe("marketingCopy", () => {
  it("has parity between PL and EN top-level keys", () => {
    expect(Object.keys(marketingCopy.pl).sort()).toEqual(Object.keys(marketingCopy.en).sort());
  });

  it("PL footer carries product, trust, and sitemap groups", () => {
    expect(marketingCopy.pl.footer.sitemap.cennik).toBe("Cennik");
    expect(marketingCopy.pl.footer.sitemap.security).toBe("Bezpieczeństwo");
    expect(marketingCopy.pl.footer.trust.hosting).toMatch(/Frankfurt/);
    expect(marketingCopy.pl.footer.trust.stripe).toMatch(/Stripe/);
    expect(marketingCopy.pl.footer.trust.rodo).toMatch(/RODO/);
  });

  it("EN mirror translates the trust strings", () => {
    expect(marketingCopy.en.footer.trust.hosting).toMatch(/Frankfurt/);
    expect(marketingCopy.en.footer.trust.rodo).toMatch(/GDPR|RODO/i);
  });

  it("404 + error500 keys exist on both locales", () => {
    expect(marketingCopy.pl.notFound.title).toBeTruthy();
    expect(marketingCopy.pl.serverError.title).toBeTruthy();
    expect(marketingCopy.en.notFound.title).toBeTruthy();
    expect(marketingCopy.en.serverError.title).toBeTruthy();
  });

  it("has all public-page groups on both locales (Sprint 2)", () => {
    const expectedGroups = [
      "landing",
      "pricing",
      "security",
      "terms",
      "privacy",
      "login",
      "authError"
    ];
    for (const group of expectedGroups) {
      expect(marketingCopy.pl).toHaveProperty(group);
      expect(marketingCopy.en).toHaveProperty(group);
    }
  });
});
