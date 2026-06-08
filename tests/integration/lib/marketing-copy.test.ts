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

  it("landing exposes hero eyebrow + proof line on both locales", () => {
    expect(marketingCopy.pl.landing.heroEyebrow).toBeTruthy();
    expect(marketingCopy.pl.landing.heroProofLine).toBeTruthy();
    expect(marketingCopy.en.landing.heroEyebrow).toBeTruthy();
    expect(marketingCopy.en.landing.heroProofLine).toBeTruthy();
  });

  it("landing howItWorks has an eyebrow, heading, and exactly three steps (both locales)", () => {
    for (const loc of [marketingCopy.pl, marketingCopy.en]) {
      expect(loc.landing.howItWorks.eyebrow).toBeTruthy();
      expect(loc.landing.howItWorks.heading).toBeTruthy();
      expect(loc.landing.howItWorks.steps).toHaveLength(3);
      for (const step of loc.landing.howItWorks.steps) {
        expect(step.title).toBeTruthy();
        expect(step.body).toBeTruthy();
      }
    }
  });

  it("landing riskReversal has an eyebrow, heading, cta, and exactly four items (both locales)", () => {
    for (const loc of [marketingCopy.pl, marketingCopy.en]) {
      expect(loc.landing.riskReversal.eyebrow).toBeTruthy();
      expect(loc.landing.riskReversal.heading).toBeTruthy();
      expect(loc.landing.riskReversal.cta).toBeTruthy();
      expect(loc.landing.riskReversal.items).toHaveLength(4);
    }
  });

  it("landing pricingTeaser and faq carry eyebrows (both locales)", () => {
    expect(marketingCopy.pl.landing.pricingTeaser.eyebrow).toBeTruthy();
    expect(marketingCopy.pl.landing.faq.eyebrow).toBeTruthy();
    expect(marketingCopy.en.landing.pricingTeaser.eyebrow).toBeTruthy();
    expect(marketingCopy.en.landing.faq.eyebrow).toBeTruthy();
  });
});
