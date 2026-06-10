import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyTurnstile, consumeUnlock, sendDemoOtp } = vi.hoisted(() => ({
  verifyTurnstile: vi.fn(),
  consumeUnlock: vi.fn(),
  sendDemoOtp: vi.fn()
}));
vi.mock("@/lib/demo/turnstile", () => ({ verifyTurnstile }));
vi.mock("@/lib/demo/rate-limit", () => ({ consumeUnlock, clientIpFrom: () => "1.2.3.4" }));
vi.mock("@/lib/demo/send-demo-otp", () => ({ sendDemoOtp }));

import { POST } from "@/app/api/demo/unlock/route";
import { verifyDownloadToken } from "@/lib/demo/download-token";

function post(body: unknown) {
  return new Request("http://x/api/demo/unlock", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  verifyTurnstile.mockReset().mockResolvedValue({ ok: true });
  consumeUnlock.mockReset().mockResolvedValue({ allowed: true, count: 1 });
  sendDemoOtp.mockReset().mockResolvedValue(undefined);
  process.env.DEMO_TOKEN_SECRET = "unit-secret";
});

describe("POST /api/demo/unlock", () => {
  it("issues a valid download token and fires OTP on the happy path", async () => {
    const res = await POST(post({ email: "a@b.com", lang: "de", turnstileToken: "t", marketingOptIn: true }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(verifyDownloadToken(json.downloadToken).valid).toBe(true);
    expect(verifyDownloadToken(json.downloadToken).payload).toMatchObject({ lang: "de", source: "sample" });
    expect(sendDemoOtp).toHaveBeenCalledWith("a@b.com", true);
  });

  it("rejects an invalid email (400)", async () => {
    const res = await POST(post({ email: "nope", lang: "en", turnstileToken: "t" }));
    expect(res.status).toBe(400);
    expect(sendDemoOtp).not.toHaveBeenCalled();
  });

  it("rejects an unsupported language (400)", async () => {
    const res = await POST(post({ email: "a@b.com", lang: "xx", turnstileToken: "t" }));
    expect(res.status).toBe(400);
  });

  it("returns 403 when Turnstile fails", async () => {
    verifyTurnstile.mockResolvedValueOnce({ ok: false });
    const res = await POST(post({ email: "a@b.com", lang: "en", turnstileToken: "bad" }));
    expect(res.status).toBe(403);
    expect(consumeUnlock).not.toHaveBeenCalled();
  });

  it("returns 429 when over the rate limit", async () => {
    consumeUnlock.mockResolvedValueOnce({ allowed: false, count: 99 });
    const res = await POST(post({ email: "a@b.com", lang: "en", turnstileToken: "t" }));
    expect(res.status).toBe(429);
    expect(sendDemoOtp).not.toHaveBeenCalled();
  });

  it("still returns a token if OTP sending fails (download not blocked)", async () => {
    sendDemoOtp.mockRejectedValueOnce(new Error("boom"));
    const res = await POST(post({ email: "a@b.com", lang: "en", turnstileToken: "t" }));
    expect(res.status).toBe(200);
  });

  it("signs source upload into the download token when requested", async () => {
    const res = await POST(post({ email: "a@b.com", lang: "de", turnstileToken: "t", source: "upload" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(verifyDownloadToken(json.downloadToken).payload).toMatchObject({ lang: "de", source: "upload" });
  });

  it("rejects an unknown source (400)", async () => {
    const res = await POST(post({ email: "a@b.com", lang: "de", turnstileToken: "t", source: "evil" }));
    expect(res.status).toBe(400);
  });
});
