import { describe, it, expect, vi, beforeEach } from "vitest";

const captureServerMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/analytics/server", () => ({
  captureServer: captureServerMock
}));

const exchangeMock = vi.hoisted(() => vi.fn());
const verifyMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => ({
    auth: { exchangeCodeForSession: exchangeMock, verifyOtp: verifyMock }
  }))
}));

import { GET } from "@/app/auth/callback/route";

function req(url: string) {
  return new Request(url) as unknown as import("next/server").NextRequest;
}

describe("auth callback analytics", () => {
  beforeEach(() => {
    captureServerMock.mockClear();
    exchangeMock.mockReset();
    verifyMock.mockReset();
  });

  it("captures signup_completed for a brand-new google user", async () => {
    exchangeMock.mockResolvedValue({
      data: { user: { id: "u1", created_at: new Date().toISOString(), user_metadata: {} } },
      error: null
    });
    await GET(req("https://app.test/auth/callback?code=abc"));
    expect(captureServerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: "u1",
        event: "signup_completed",
        properties: { method: "google", signup_source: "direct" }
      })
    );
  });

  it("redirects a brand-new user with signup=1 so the client can fire the registration conversion", async () => {
    exchangeMock.mockResolvedValue({
      data: { user: { id: "u1", created_at: new Date().toISOString(), user_metadata: {} } },
      error: null
    });
    const res = await GET(req("https://app.test/auth/callback?code=abc"));
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.searchParams.get("signup")).toBe("1");
    // Must land on a page that does NOT redirect again (e.g. /app -> /translate
    // drops the query string), otherwise the client never sees signup=1.
    expect(location.pathname).toBe("/translate");
  });

  it("does NOT add signup=1 for an existing (returning) user", async () => {
    exchangeMock.mockResolvedValue({
      data: { user: { id: "u4", created_at: "2019-05-05T00:00:00Z", user_metadata: {} } },
      error: null
    });
    const res = await GET(req("https://app.test/auth/callback?code=abc"));
    expect(res.headers.get("location")).not.toContain("signup=1");
  });

  it("captures signup_completed source=landing_demo for a new magic-link user from the demo", async () => {
    verifyMock.mockResolvedValue({
      data: {
        user: {
          id: "u2",
          created_at: new Date().toISOString(),
          user_metadata: { source: "landing_demo" }
        }
      },
      error: null
    });
    await GET(req("https://app.test/auth/callback?token_hash=h&type=email"));
    expect(captureServerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: "u2",
        event: "signup_completed",
        properties: { method: "magic_link", signup_source: "landing_demo" }
      })
    );
  });

  it("captures login_completed for an existing magic-link user (created long ago)", async () => {
    verifyMock.mockResolvedValue({
      data: { user: { id: "u3", created_at: "2020-01-01T00:00:00Z", user_metadata: {} } },
      error: null
    });
    await GET(req("https://app.test/auth/callback?token_hash=h&type=email"));
    expect(captureServerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: "u3",
        event: "login_completed",
        properties: { method: "magic_link" }
      })
    );
  });

  it("captures login_completed for an existing google user (PKCE branch)", async () => {
    exchangeMock.mockResolvedValue({
      data: { user: { id: "u4", created_at: "2019-05-05T00:00:00Z", user_metadata: {} } },
      error: null
    });
    await GET(req("https://app.test/auth/callback?code=abc"));
    expect(captureServerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: "u4",
        event: "login_completed",
        properties: { method: "google" }
      })
    );
  });

  it("does NOT capture a completion event when the exchange errors", async () => {
    exchangeMock.mockResolvedValue({ data: { user: null }, error: { message: "bad" } });
    await GET(req("https://app.test/auth/callback?code=abc"));
    expect(captureServerMock).not.toHaveBeenCalled();
  });

  it("does NOT capture a completion event when verifyOtp errors", async () => {
    verifyMock.mockResolvedValue({ data: { user: null }, error: { message: "expired" } });
    await GET(req("https://app.test/auth/callback?token_hash=h&type=email"));
    expect(captureServerMock).not.toHaveBeenCalled();
  });
});
