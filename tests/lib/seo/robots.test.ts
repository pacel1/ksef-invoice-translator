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
      "/api/",
      "/app/",
      "/account/",
      "/billing/",
      "/translate/",
      "/tlumaczenie/",
      "/auth/"
    ]) {
      expect(disallow).toContain(path);
    }
  });

  it("points crawlers at the sitemap on the production origin", () => {
    expect(result.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
  });
});
