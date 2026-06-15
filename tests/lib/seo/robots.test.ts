import { describe, it, expect } from "vitest";
import robots from "@/app/robots";
import { SITE_URL } from "@/lib/seo/site-url";

describe("robots", () => {
  const result = robots();

  it("allows crawling of the public site", () => {
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const wildcard = rules.find((r) => r?.userAgent === "*");

    expect(wildcard).toBeDefined();
    expect(wildcard?.allow).toBe("/");
  });

  it("disallows api, auth, and account surfaces", () => {
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const wildcard = rules.find((r) => r?.userAgent === "*");
    const disallow = wildcard?.disallow ?? [];

    for (const path of [
      "/api",
      "/app",
      "/account",
      "/billing",
      "/translate",
      "/tlumaczenie",
      "/auth"
    ]) {
      expect(disallow).toContain(path);
    }
  });

  it("uses bare prefixes so the bare redirecting routes are also blocked", () => {
    // A trailing slash (e.g. "/app/") matches "/app/history" but NOT the bare
    // "/app", which 3xx-redirects to /translate. Google reported those bare
    // redirecting URLs as "Page contains redirect". Bare prefixes cover both.
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const disallow = rules.find((r) => r?.userAgent === "*")?.disallow ?? [];
    const list = Array.isArray(disallow) ? disallow : [disallow];

    for (const path of list) {
      expect(path.endsWith("/")).toBe(false);
    }
  });

  it("points crawlers at the sitemap on the production origin", () => {
    expect(result.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});
