import { describe, it, expect, vi, beforeEach } from "vitest";

const { verifyTurnstile, consumeContactMessage, sendContactEmail, createResendSendFn } =
  vi.hoisted(() => ({
    verifyTurnstile: vi.fn(),
    consumeContactMessage: vi.fn(),
    sendContactEmail: vi.fn(),
    createResendSendFn: vi.fn()
  }));
vi.mock("@/lib/demo/turnstile", () => ({ verifyTurnstile }));
vi.mock("@/lib/demo/rate-limit", () => ({ clientIpFrom: () => "1.2.3.4" }));
vi.mock("@/lib/contact/rate-limit", () => ({ consumeContactMessage }));
vi.mock("@/lib/contact/send-contact-email", () => ({ sendContactEmail }));
vi.mock("@/lib/email/resend-sender", () => ({ createResendSendFn }));

import { POST } from "@/app/api/contact/route";

const fakeSend = async () => ({ data: { id: "em_1" } });

function post(body: unknown) {
  return new Request("http://x/api/contact", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

const valid = {
  name: "Jan",
  email: "jan@firma.pl",
  message: "Dzień dobry, mam pytanie o tłumaczenie faktury.",
  turnstileToken: "t"
};

beforeEach(() => {
  verifyTurnstile.mockReset().mockResolvedValue({ ok: true });
  consumeContactMessage.mockReset().mockResolvedValue({ allowed: true, ipCount: 1, globalCount: 1 });
  sendContactEmail.mockReset().mockResolvedValue({ ok: true });
  createResendSendFn.mockReset().mockReturnValue(fakeSend);
});

describe("POST /api/contact", () => {
  it("delivers the message on the happy path", async () => {
    const res = await POST(post(valid));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
    expect(sendContactEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Jan",
        email: "jan@firma.pl",
        message: valid.message,
        send: fakeSend
      })
    );
  });

  it("rejects an invalid email (400)", async () => {
    const res = await POST(post({ ...valid, email: "nope" }));
    expect(res.status).toBe(400);
    expect(sendContactEmail).not.toHaveBeenCalled();
  });

  it("rejects a too-short message (400)", async () => {
    const res = await POST(post({ ...valid, message: "hi" }));
    expect(res.status).toBe(400);
  });

  it("rejects an oversized message (400)", async () => {
    const res = await POST(post({ ...valid, message: "x".repeat(5001) }));
    expect(res.status).toBe(400);
  });

  it("rejects a malformed body (400)", async () => {
    const res = await POST(
      new Request("http://x/api/contact", { method: "POST", body: "not json" })
    );
    expect(res.status).toBe(400);
  });

  it("returns 403 when Turnstile fails and never counts the attempt", async () => {
    verifyTurnstile.mockResolvedValueOnce({ ok: false });
    const res = await POST(post(valid));
    expect(res.status).toBe(403);
    expect(consumeContactMessage).not.toHaveBeenCalled();
  });

  it("returns 429 when over the per-IP daily limit", async () => {
    consumeContactMessage.mockResolvedValueOnce({
      allowed: false,
      reason: "ip",
      ipCount: 99,
      globalCount: 99
    });
    const res = await POST(post(valid));
    expect(res.status).toBe(429);
    expect(sendContactEmail).not.toHaveBeenCalled();
  });

  it("returns 503 when no email provider is configured", async () => {
    createResendSendFn.mockReturnValueOnce(null);
    const res = await POST(post(valid));
    expect(res.status).toBe(503);
    expect(sendContactEmail).not.toHaveBeenCalled();
  });

  it("returns 502 when delivery fails so the user can fall back to plain email", async () => {
    sendContactEmail.mockResolvedValueOnce({ ok: false });
    const res = await POST(post(valid));
    expect(res.status).toBe(502);
  });
});
