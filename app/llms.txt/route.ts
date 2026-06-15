import { buildLlmsTxt } from "@/lib/seo/llms-txt";

// Static content built from a constant origin, so it can be served from the
// edge cache. Mirrors how robots.ts / sitemap.ts are produced.
export const dynamic = "force-static";

export function GET() {
  return new Response(buildLlmsTxt(), {
    headers: { "content-type": "text/plain; charset=utf-8" }
  });
}
