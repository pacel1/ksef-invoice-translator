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
});
