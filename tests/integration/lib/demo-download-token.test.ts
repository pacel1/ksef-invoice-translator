import { describe, it, expect, beforeEach } from "vitest";
import { signDownloadToken, verifyDownloadToken } from "@/lib/demo/download-token";

beforeEach(() => {
  process.env.DEMO_TOKEN_SECRET = "unit-secret";
});

const NOW = 1_750_000_000_000;

describe("download token", () => {
  it("round-trips a valid token within its TTL", () => {
    const token = signDownloadToken({ lang: "de", source: "sample" }, NOW);
    const result = verifyDownloadToken(token, NOW + 60_000);
    expect(result.valid).toBe(true);
    expect(result.payload).toMatchObject({ lang: "de", source: "sample" });
  });

  it("rejects an expired token", () => {
    const token = signDownloadToken({ lang: "en", source: "sample" }, NOW);
    expect(verifyDownloadToken(token, NOW + 11 * 60_000).valid).toBe(false);
  });

  it("rejects a tampered token", () => {
    const token = signDownloadToken({ lang: "en", source: "sample" }, NOW);
    const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
    expect(verifyDownloadToken(tampered, NOW + 1000).valid).toBe(false);
  });

  it("rejects garbage", () => {
    expect(verifyDownloadToken("not-a-token", NOW).valid).toBe(false);
    expect(verifyDownloadToken("", NOW).valid).toBe(false);
  });
});
