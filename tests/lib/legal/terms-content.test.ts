import { describe, it, expect } from "vitest";
import { getTermsSections, TERMS_LAST_UPDATED } from "@/lib/legal/terms";
import { LEGAL_ENTITY } from "@/lib/brand/legal";
import { FOUNDER } from "@/lib/brand/founder";

describe("getTermsSections", () => {
  it("returns a substantive document for both locales", () => {
    for (const locale of ["pl", "en"] as const) {
      const sections = getTermsSections(locale);
      expect(sections.length).toBeGreaterThanOrEqual(12);
      for (const section of sections) {
        expect(section.id).not.toBe("");
        expect(section.title).not.toBe("");
        expect(section.content.length).toBeGreaterThan(50);
      }
    }
  });

  it("uses unique section ids shared across locales (stable anchors)", () => {
    const plIds = getTermsSections("pl").map((s) => s.id);
    const enIds = getTermsSections("en").map((s) => s.id);
    expect(new Set(plIds).size).toBe(plIds.length);
    expect(enIds).toEqual(plIds);
  });

  it("identifies the operator from LEGAL_ENTITY and the contact email from FOUNDER", () => {
    const all = getTermsSections("pl").map((s) => s.content).join("\n");
    expect(all).toContain(LEGAL_ENTITY.name);
    expect(all).toContain(LEGAL_ENTITY.nip);
    expect(all).toContain(LEGAL_ENTITY.address);
    expect(all).toContain(FOUNDER.contactEmail);
  });

  it("covers the mandatory elements of art. 8 ustawy o świadczeniu usług drogą elektroniczną (PL)", () => {
    const all = getTermsSections("pl").map((s) => `${s.title}\n${s.content}`).join("\n");
    expect(all).toMatch(/wymagania techniczne/i);
    expect(all).toMatch(/treści o charakterze bezprawnym|treści bezprawn/i);
    expect(all).toMatch(/reklamacj/i);
    expect(all).toMatch(/rozwiązan/i);
  });

  it("covers consumer rights: withdrawal and refunds (PL)", () => {
    const all = getTermsSections("pl").map((s) => `${s.title}\n${s.content}`).join("\n");
    expect(all).toMatch(/odstąpieni/i);
    expect(all).toMatch(/14 dni/);
    expect(all).toMatch(/konsument/i);
  });

  it("describes the actual product: KSeF XML input, AI translation, credits, Stripe", () => {
    const all = getTermsSections("pl").map((s) => s.content).join("\n");
    expect(all).toContain("XML");
    expect(all).toContain("KSeF");
    expect(all).toContain("FA(3)");
    expect(all).toContain("Stripe");
    expect(all).toMatch(/kredyt/i);
  });

  it("includes a data-processing entrustment clause referencing sub-processors (PL)", () => {
    const all = getTermsSections("pl").map((s) => `${s.title}\n${s.content}`).join("\n");
    expect(all).toMatch(/powierz/i);
    expect(all).toContain("Supabase");
    expect(all).toContain("OpenAI");
  });

  it("notes in the EN version that the Polish text prevails", () => {
    const all = getTermsSections("en").map((s) => s.content).join("\n");
    expect(all).toMatch(/Polish (language )?version/i);
  });

  it("contains no em or en dashes and no placeholder copy", () => {
    for (const locale of ["pl", "en"] as const) {
      const all = getTermsSections(locale)
        .map((s) => `${s.title}\n${s.content}`)
        .join("\n");
      expect(all).not.toMatch(/[—–]/);
      expect(all).not.toMatch(/zostanie dodana przed uruchomieniem|will be added before/i);
    }
  });

  it("exposes a current last-updated date", () => {
    expect(TERMS_LAST_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(TERMS_LAST_UPDATED >= "2026-06-01").toBe(true);
  });
});
