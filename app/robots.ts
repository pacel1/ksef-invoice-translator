import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Bare prefixes (no trailing slash) so the bare routes are blocked too:
        // "/app", "/translate", "/account" etc. 3xx-redirect (to /translate or
        // /login), which Google reported as "Page contains redirect". A trailing
        // slash would only match sub-paths and leave the bare URL crawlable.
        disallow: [
          "/api",
          "/app",
          "/account",
          "/billing",
          "/translate",
          "/tlumaczenie",
          "/auth"
        ]
      }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`
  };
}
