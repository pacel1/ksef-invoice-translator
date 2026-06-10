import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({ rpc })
}));

import { hashIp, clientIpFrom, consumeUnlock } from "@/lib/demo/rate-limit";

beforeEach(() => {
  rpc.mockReset();
  process.env.DEMO_IP_SALT = "test-salt";
});

describe("demo rate-limit", () => {
  it("hashes the IP deterministically with the salt and never returns the raw IP", () => {
    const a = hashIp("203.0.113.7");
    const b = hashIp("203.0.113.7");
    expect(a).toBe(b);
    expect(a).not.toContain("203.0.113.7");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    process.env.DEMO_IP_SALT = "other-salt";
    expect(hashIp("203.0.113.7")).not.toBe(a);
  });

  it("reads the first x-forwarded-for hop", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "198.51.100.5, 10.0.0.1" } });
    expect(clientIpFrom(req)).toBe("198.51.100.5");
    const none = new Request("http://x");
    expect(clientIpFrom(none)).toBe("0.0.0.0");
  });

  it("allows up to the cap and blocks beyond it", async () => {
    process.env.DEMO_UNLOCK_PER_IP_PER_DAY = "3";
    rpc.mockResolvedValueOnce({ data: 3, error: null });
    expect(await consumeUnlock("1.2.3.4")).toEqual({ allowed: true, count: 3 });
    rpc.mockResolvedValueOnce({ data: 4, error: null });
    expect(await consumeUnlock("1.2.3.4")).toEqual({ allowed: false, count: 4 });
    expect(rpc).toHaveBeenLastCalledWith("increment_demo_unlock", { p_ip_hash: hashIp("1.2.3.4") });
  });

  it("fails open if the counter errors (does not block real users on infra hiccups)", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "down" } });
    expect(await consumeUnlock("1.2.3.4")).toEqual({ allowed: true, count: 0 });
  });
});
