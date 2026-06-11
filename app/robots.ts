import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/app/",
          "/account/",
          "/billing/",
          "/translate/",
          "/tlumaczenie/",
          "/auth/"
        ]
      }
    ],
    sitemap: `${SITE_URL}/sitemap.xml`
  };
}
