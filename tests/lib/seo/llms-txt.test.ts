import { describe, it, expect } from "vitest";
import { buildLlmsTxt } from "@/lib/seo/llms-txt";
import { SITE_URL } from "@/lib/seo/site-url";

describe("buildLlmsTxt", () => {
  const content = buildLlmsTxt();

  it("starts with an H1 title and a blockquote summary", () => {
    const lines = content.split("\n");
    expect(lines[0].startsWith("# ")).toBe(true);
    expect(content).toContain("\n> ");
  });

  it("links the key public pages on the production origin", () => {
    for (const url of [
      `${SITE_URL}/`,
      `${SITE_URL}/pricing`,
      `${SITE_URL}/faq`,
      `${SITE_URL}/blog`,
      `${SITE_URL}/en`,
      `${SITE_URL}/sitemap.xml`
    ]) {
      expect(content).toContain(`(${url})`);
    }
  });

  it("only links absolute URLs on the canonical origin", () => {
    const hrefs = [...content.matchAll(/\]\(([^)]+)\)/g)].map((m) => m[1]);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href.startsWith(`${SITE_URL}/`)).toBe(true);
    }
  });

  it("never points crawlers at a disallowed/redirecting route", () => {
    // llms.txt must only advertise indexable 200 pages, never the bare
    // auth/legacy routes that 3xx-redirect (the GSC "Page contains redirect").
    for (const blocked of ["/app", "/account", "/billing", "/translate", "/tlumaczenie", "/auth", "/api"]) {
      expect(content).not.toContain(`${SITE_URL}${blocked})`);
      expect(content).not.toContain(`${SITE_URL}${blocked}/`);
    }
  });

  it("contains no em or en dashes (house copy rule)", () => {
    expect(content).not.toMatch(/[—–]/);
  });
});
