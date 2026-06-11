import { describe, it, expect, vi, afterEach } from "vitest";
import { isAllowedPublicKsefUrl, verifyPublicKsefQrUrl } from "@/lib/ksef/public-verification";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("isAllowedPublicKsefUrl", () => {
  it("accepts the canonical KSeF QR host over https", () => {
    expect(
      isAllowedPublicKsefUrl("https://qr.ksef.mf.gov.pl/invoice/1234567890/12-05-2026/abc")
    ).toBe(true);
  });

  it.each([
    ["http (not https)", "http://qr.ksef.mf.gov.pl/invoice/x"],
    ["foreign host", "https://evil.com/phish"],
    ["protocol-relative", "//evil.com"],
    ["suffix-spoofed host", "https://qr.ksef.mf.gov.pl.evil.com/x"],
    ["cloud metadata", "http://169.254.169.254/latest/meta-data/"],
    ["loopback", "http://localhost:54321/"],
    ["private range", "http://10.0.0.5/"],
    ["non-url garbage", "not a url"],
    ["empty", ""]
  ])("rejects %s", (_label, url) => {
    expect(isAllowedPublicKsefUrl(url)).toBe(false);
  });
});

describe("verifyPublicKsefQrUrl SSRF guard", () => {
  it("never issues a network request for a disallowed URL", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await verifyPublicKsefQrUrl("http://169.254.169.254/latest/meta-data/");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.confirmed).toBe(false);
  });

  it("does follow redirects manually so an allowed host cannot bounce internally", async () => {
    // A 302 from the allowed host must be treated as a non-OK response, not followed.
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 302, headers: { location: "http://169.254.169.254/" } })
    );
    const result = await verifyPublicKsefQrUrl("https://qr.ksef.mf.gov.pl/invoice/x");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.redirect).toBe("manual");
    expect(result.confirmed).toBe(false);
  });
});
