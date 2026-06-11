import { describe, it, expect, vi, beforeEach } from "vitest";
import { SITE_URL } from "@/lib/seo/site-url";

const fetchMock = vi.fn();

vi.mock("@/sanity/lib/client", () => ({
  client: { fetch: (...args: unknown[]) => fetchMock(...args) },
  isSanityConfigured: true
}));

import sitemap from "@/app/sitemap";

describe("sitemap route", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("merges Sanity blog posts into the sitemap", async () => {
    fetchMock.mockResolvedValueOnce([
      { slug: "ksef-obowiazkowy", publishedAt: "2026-02-01T00:00:00Z" }
    ]);

    const entries = await sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls).toContain(`${SITE_URL}/blog/ksef-obowiazkowy`);
    expect(urls).toContain(`${SITE_URL}/`);
  });

  it("still returns the static pages when the Sanity fetch fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fetchMock.mockRejectedValueOnce(new Error("sanity down"));

    const entries = await sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls).toContain(`${SITE_URL}/`);
    expect(urls).toContain(`${SITE_URL}/pricing`);
    expect(urls.some((u) => u.startsWith(`${SITE_URL}/blog/`) && u !== `${SITE_URL}/blog`)).toBe(false);
    expect(errorSpy).toHaveBeenCalledOnce();
    errorSpy.mockRestore();
  });

  it("tolerates a malformed Sanity response", async () => {
    fetchMock.mockResolvedValueOnce(null);

    const entries = await sitemap();

    expect(entries.map((e) => e.url)).toContain(`${SITE_URL}/`);
  });
});
