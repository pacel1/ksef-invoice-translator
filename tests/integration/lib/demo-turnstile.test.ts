import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyTurnstile } from "@/lib/demo/turnstile";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  delete process.env.TURNSTILE_SECRET_KEY;
  vi.stubEnv("NODE_ENV", "test");
});
afterEach(() => vi.unstubAllEnvs());

describe("verifyTurnstile", () => {
  it("passes in dev when no secret is configured (non-production)", async () => {
    expect(await verifyTurnstile("dev")).toEqual({ ok: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed in production when no secret is configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await verifyTurnstile("anything")).toEqual({ ok: false });
  });

  it("calls siteverify and returns ok on success", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    fetchMock.mockResolvedValueOnce({ json: async () => ({ success: true }) });
    expect(await verifyTurnstile("tok", "1.2.3.4")).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("returns not-ok when siteverify rejects or the token is missing", async () => {
    process.env.TURNSTILE_SECRET_KEY = "secret";
    expect(await verifyTurnstile("")).toEqual({ ok: false });
    fetchMock.mockResolvedValueOnce({ json: async () => ({ success: false }) });
    expect(await verifyTurnstile("tok")).toEqual({ ok: false });
  });
});
