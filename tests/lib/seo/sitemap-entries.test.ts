import { describe, it, expect } from "vitest";
import { buildSitemapEntries } from "@/lib/seo/sitemap-entries";
import { SITE_URL } from "@/lib/seo/site-url";

describe("SITE_URL", () => {
  it("is the canonical production origin without a trailing slash", () => {
    expect(SITE_URL).toBe("https://tlumaczksef.pl");
  });
});

describe("buildSitemapEntries", () => {
  it("includes the Polish homepage with pl/en hreflang alternates", () => {
    const entries = buildSitemapEntries([]);
    const home = entries.find((e) => e.url === `${SITE_URL}/`);

    expect(home).toBeDefined();
    expect(home?.alternates?.languages).toEqual({
      pl: `${SITE_URL}/`,
      en: `${SITE_URL}/en`
    });
  });

  it("includes every public marketing page in both locales", () => {
    const entries = buildSitemapEntries([]);
    const urls = entries.map((e) => e.url);

    for (const path of ["blog", "faq", "pricing", "privacy", "security", "terms"]) {
      expect(urls).toContain(`${SITE_URL}/${path}`);
      const entry = entries.find((e) => e.url === `${SITE_URL}/${path}`);
      expect(entry?.alternates?.languages).toEqual({
        pl: `${SITE_URL}/${path}`,
        en: `${SITE_URL}/en/${path}`
      });
    }
  });

  it("adds one entry per blog post with lastModified from publishedAt", () => {
    const entries = buildSitemapEntries([
      { slug: "ksef-2026-zmiany", publishedAt: "2026-01-15T08:00:00Z" },
      { slug: "faktura-po-angielsku" }
    ]);
    const urls = entries.map((e) => e.url);

    expect(urls).toContain(`${SITE_URL}/blog/ksef-2026-zmiany`);
    expect(urls).toContain(`${SITE_URL}/blog/faktura-po-angielsku`);

    const dated = entries.find((e) => e.url === `${SITE_URL}/blog/ksef-2026-zmiany`);
    expect(dated?.lastModified).toEqual(new Date("2026-01-15T08:00:00Z"));

    const undated = entries.find((e) => e.url === `${SITE_URL}/blog/faktura-po-angielsku`);
    expect(undated?.lastModified).toBeUndefined();
  });

  it("ignores posts with empty or missing slugs", () => {
    const entries = buildSitemapEntries([{ slug: "" }, { slug: "   " }]);
    const blogPosts = entries.filter((e) => e.url.startsWith(`${SITE_URL}/blog/`));

    expect(blogPosts).toHaveLength(0);
  });

  it("never includes auth, app, or api routes", () => {
    const urls = buildSitemapEntries([]).map((e) => e.url);

    for (const forbidden of ["/login", "/auth", "/api", "/app", "/account", "/billing", "/translate", "/tlumaczenie"]) {
      expect(urls.some((u) => u.includes(forbidden))).toBe(false);
    }
  });

  it("only emits absolute https URLs on the production origin", () => {
    const urls = buildSitemapEntries([{ slug: "post" }]).map((e) => e.url);

    for (const url of urls) {
      expect(url.startsWith(`${SITE_URL}/`) || url === SITE_URL).toBe(true);
    }
  });
});
