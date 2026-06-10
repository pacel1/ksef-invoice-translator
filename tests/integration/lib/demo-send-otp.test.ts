import { describe, it, expect, vi, beforeEach } from "vitest";

const signInWithOtp = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { signInWithOtp } })
}));

import { sendDemoOtp } from "@/lib/demo/send-demo-otp";

beforeEach(() => {
  signInWithOtp.mockReset();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com";
});

describe("sendDemoOtp", () => {
  it("fires signInWithOtp with the callback redirect and demo metadata", async () => {
    signInWithOtp.mockResolvedValueOnce({ error: null });
    await sendDemoOtp("user@example.com", true);
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "user@example.com",
      options: {
        emailRedirectTo: "https://app.example.com/auth/callback",
        data: { source: "landing_demo", marketing_opt_in: true }
      }
    });
  });

  it("never throws when Supabase returns an error (download must not be blocked)", async () => {
    signInWithOtp.mockResolvedValueOnce({ error: { status: 429, message: "rate limited" } });
    await expect(sendDemoOtp("user@example.com", false)).resolves.toBeUndefined();
  });

  it("never throws when the client rejects", async () => {
    signInWithOtp.mockRejectedValueOnce(new Error("network"));
    await expect(sendDemoOtp("user@example.com", false)).resolves.toBeUndefined();
  });
});
