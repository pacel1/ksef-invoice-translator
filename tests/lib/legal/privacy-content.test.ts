import { describe, it, expect } from "vitest";
import { getPrivacySections, PRIVACY_LAST_UPDATED } from "@/lib/legal/privacy";
import { LEGAL_ENTITY } from "@/lib/brand/legal";

describe("getPrivacySections", () => {
  it("returns a substantive document for both locales", () => {
    for (const locale of ["pl", "en"] as const) {
      const sections = getPrivacySections(locale);
      expect(sections.length).toBeGreaterThanOrEqual(10);
      for (const section of sections) {
        expect(section.id).not.toBe("");
        expect(section.title).not.toBe("");
        expect(section.content.length).toBeGreaterThan(50);
      }
    }
  });

  it("uses unique section ids shared across locales (stable anchors)", () => {
    const plIds = getPrivacySections("pl").map((s) => s.id);
    const enIds = getPrivacySections("en").map((s) => s.id);
    expect(new Set(plIds).size).toBe(plIds.length);
    expect(enIds).toEqual(plIds);
  });

  it("identifies the administrator and contact email from LEGAL_ENTITY", () => {
    const all = getPrivacySections("pl").map((s) => s.content).join("\n");
    expect(all).toContain(LEGAL_ENTITY.name);
    expect(all).toContain(LEGAL_ENTITY.nip);
    expect(all).toContain(LEGAL_ENTITY.address);
    expect(all).toContain(LEGAL_ENTITY.contactEmail);
  });

  it("covers the art. 13 RODO catalogue: purposes, legal bases, retention, rights, PUODO", () => {
    const all = getPrivacySections("pl").map((s) => `${s.title}\n${s.content}`).join("\n");
    expect(all).toMatch(/art\. 6 ust\. 1 lit\. b/i);
    expect(all).toMatch(/art\. 6 ust\. 1 lit\. c/i);
    expect(all).toMatch(/art\. 6 ust\. 1 lit\. f/i);
    expect(all).toMatch(/Prezes(a)? Urzędu Ochrony Danych Osobowych/i);
    expect(all).toMatch(/prawo do/i);
    expect(all).toMatch(/sprostowani/i);
    expect(all).toMatch(/usunięci/i);
    expect(all).toMatch(/przenoszeni/i);
    expect(all).toMatch(/sprzeciw/i);
  });

  it("lists all actual processors and recipients", () => {
    const all = getPrivacySections("pl").map((s) => s.content).join("\n");
    for (const name of ["Supabase", "Vercel", "OpenAI", "Stripe", "Resend", "iFirma", "Cloudflare"]) {
      expect(all).toContain(name);
    }
  });

  it("states the real retention periods", () => {
    const all = getPrivacySections("pl").map((s) => s.content).join("\n");
    expect(all).toMatch(/30 dni/);
    expect(all).toMatch(/5 lat/);
    expect(all).toMatch(/90 dni/);
    expect(all).toMatch(/60 minut/);
  });

  it("covers transfers outside the EEA and the processor role for invoice data", () => {
    const all = getPrivacySections("pl").map((s) => `${s.title}\n${s.content}`).join("\n");
    expect(all).toMatch(/EOG/);
    expect(all).toMatch(/standardow(e|ych) klauzul/i);
    expect(all).toMatch(/podmiot(em)? przetwarzając/i);
  });

  it("describes cookies honestly (essential only, no analytics)", () => {
    const all = getPrivacySections("pl").map((s) => `${s.title}\n${s.content}`).join("\n");
    expect(all).toMatch(/cookies/i);
    expect(all).toMatch(/sesj/i);
  });

  it("notes in the EN version that the Polish text prevails", () => {
    const all = getPrivacySections("en").map((s) => s.content).join("\n");
    expect(all).toMatch(/Polish (language )?version/i);
  });

  it("contains no em or en dashes and no placeholder copy", () => {
    for (const locale of ["pl", "en"] as const) {
      const all = getPrivacySections(locale)
        .map((s) => `${s.title}\n${s.content}`)
        .join("\n");
      expect(all).not.toMatch(/[—–]/);
      expect(all).not.toMatch(/zostanie dodana przed uruchomieniem|will be added before/i);
    }
  });

  it("exposes a current last-updated date", () => {
    expect(PRIVACY_LAST_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(PRIVACY_LAST_UPDATED >= "2026-06-01").toBe(true);
  });
});
