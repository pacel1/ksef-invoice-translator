import { describe, it, expect } from "vitest";
import { consentCopy } from "@/lib/consent/copy";

describe("consentCopy", () => {
  it("provides complete copy for both locales", () => {
    for (const locale of ["pl", "en"] as const) {
      const t = consentCopy[locale];
      expect(t.banner.ariaLabel).not.toBe("");
      expect(t.banner.body.length).toBeGreaterThan(40);
      expect(t.banner.acceptAll).not.toBe("");
      expect(t.banner.rejectAll).not.toBe("");
      expect(t.banner.settings).not.toBe("");
      expect(t.banner.privacyLinkLabel).not.toBe("");
      expect(t.modal.title).not.toBe("");
      expect(t.modal.save).not.toBe("");
      expect(t.modal.alwaysOn).not.toBe("");
      for (const category of ["necessary", "analytics", "marketing"] as const) {
        expect(t.modal.categories[category].label).not.toBe("");
        expect(t.modal.categories[category].description.length).toBeGreaterThan(20);
      }
      expect(t.footerLink).not.toBe("");
    }
  });

  it("contains no em or en dashes", () => {
    const all = JSON.stringify(consentCopy);
    expect(all).not.toMatch(/[—–]/);
  });
});
