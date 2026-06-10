import { describe, it, expect } from "vitest";
import { landingCopy } from "@/lib/landing/copy";

describe("landingCopy", () => {
  it("has matching top-level locale keys", () => {
    expect(Object.keys(landingCopy.pl).sort()).toEqual(Object.keys(landingCopy.en).sort());
  });

  it("has nav, finalCta, and footer groups on both locales", () => {
    for (const loc of [landingCopy.pl, landingCopy.en]) {
      expect(loc.nav.cta).toBeTruthy();
      expect(loc.nav.menuOpen).toBeTruthy();
      expect(loc.nav.menuClose).toBeTruthy();
      expect(loc.nav.links).toHaveLength(4);
      expect(loc.finalCta.heading).toBeTruthy();
      expect(loc.finalCta.cta).toBeTruthy();
      expect(loc.footer.legalNote).toBeTruthy();
    }
  });

  it("contains no em or en dashes", () => {
    const flat = JSON.stringify(landingCopy);
    expect(flat).not.toMatch(/—|–/);
  });

  it("has a hero group with headline parts, two CTAs, and reassurance on both locales", () => {
    for (const loc of [landingCopy.pl, landingCopy.en]) {
      expect(loc.hero.eyebrow).toBeTruthy();
      expect(loc.hero.headlineLead).toBeTruthy();
      expect(loc.hero.headlineTurn).toBeTruthy();
      expect(loc.hero.subline).toBeTruthy();
      expect(loc.hero.ctaPrimary).toBeTruthy();
      expect(loc.hero.ctaSecondary).toBeTruthy();
      expect(loc.hero.reassurance).toBeTruthy();
    }
  });

  it("has the four explainer-section groups on both locales", () => {
    for (const loc of [landingCopy.pl, landingCopy.en]) {
      expect(loc.whyOldWay.heading).toBeTruthy();
      expect(loc.whyOldWay.problems).toHaveLength(3);
      expect(loc.whyOldWay.resolution).toBeTruthy();
      expect(loc.howItWorks.steps).toHaveLength(3);
      expect(loc.howItWorks.footnote).toBeTruthy();
      expect(loc.whatStays.kept.length).toBeGreaterThanOrEqual(5);
      expect(loc.whatStays.translated.length).toBeGreaterThanOrEqual(5);
      expect(loc.whatStays.trust).toBeTruthy();
      expect(loc.builtForTwo.lanes).toHaveLength(2);
    }
  });

  it("has a demo group on both locales", () => {
    for (const loc of [landingCopy.pl, landingCopy.en]) {
      expect(loc.demo.eyebrow).toBeTruthy();
      expect(loc.demo.heading).toBeTruthy();
      expect(loc.demo.sub).toBeTruthy();
      expect(loc.demo.watermark).toBeTruthy();
      expect(loc.demo.languagesLabel).toBeTruthy();
      expect(loc.demo.privacy).toBeTruthy();
      expect(loc.demo.cta).toBeTruthy();
      expect(loc.demo.ctaHref).toMatch(/login/);
      expect(loc.demo.moreLabel).toBeTruthy();
    }
  });

  it("has the demo gate copy on both locales", () => {
    for (const loc of [landingCopy.pl, landingCopy.en]) {
      expect(loc.demo.download).toBeTruthy();
      expect(loc.demo.gateHeading).toBeTruthy();
      expect(loc.demo.emailLabel).toBeTruthy();
      expect(loc.demo.emailPlaceholder).toBeTruthy();
      expect(loc.demo.consent).toBeTruthy();
      expect(loc.demo.marketingOptIn).toBeTruthy();
      expect(loc.demo.submit).toBeTruthy();
      expect(loc.demo.success).toBeTruthy();
      expect(loc.demo.gateError).toBeTruthy();
      expect(loc.demo.rateLimited).toBeTruthy();
    }
  });

  it("has the demo upload-lane copy on both locales", () => {
    for (const loc of [landingCopy.pl, landingCopy.en]) {
      expect(loc.demo.uploadLink).toBeTruthy();
      expect(loc.demo.uploadDropLabel).toBeTruthy();
      expect(loc.demo.uploadHint).toBeTruthy();
      expect(loc.demo.uploadBusy).toBeTruthy();
      expect(loc.demo.uploadErrUnsupported).toBeTruthy();
      expect(loc.demo.uploadErrTooLarge).toBeTruthy();
      expect(loc.demo.uploadErrParse).toBeTruthy();
      expect(loc.demo.uploadErrBreaker).toBeTruthy();
      expect(loc.demo.uploadErrTurnstile).toBeTruthy();
      expect(loc.demo.uploadErrTranslate).toBeTruthy();
      expect(loc.demo.pdfFailed).toBeTruthy();
    }
  });

  it("has pricing and faq groups on both locales", () => {
    for (const loc of [landingCopy.pl, landingCopy.en]) {
      expect(loc.pricing.heading).toBeTruthy();
      expect(loc.pricing.promises.length).toBeGreaterThanOrEqual(5);
      expect(loc.pricing.ladder).toHaveLength(3);
      expect(loc.pricing.ctaHref).toMatch(/pricing/);
      expect(loc.faq.heading).toBeTruthy();
      expect(loc.faq.items).toHaveLength(6);
      for (const item of loc.faq.items) {
        expect(item.q).toBeTruthy();
        expect(item.a).toBeTruthy();
      }
    }
  });
});
