import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({ rpc })
}));

import { hashIp } from "@/lib/demo/rate-limit";
import { consumeContactMessage } from "@/lib/contact/rate-limit";

beforeEach(() => {
  rpc.mockReset();
  process.env.DEMO_IP_SALT = "test-salt";
  delete process.env.CONTACT_MESSAGES_PER_IP_PER_DAY;
  delete process.env.CONTACT_MESSAGES_GLOBAL_PER_DAY;
});

describe("contact rate-limit", () => {
  it("allows under both caps and reports counts", async () => {
    rpc.mockResolvedValueOnce({ data: [{ ip_count: 2, global_count: 10 }], error: null });
    expect(await consumeContactMessage("1.2.3.4")).toEqual({
      allowed: true,
      ipCount: 2,
      globalCount: 10
    });
    expect(rpc).toHaveBeenLastCalledWith("increment_contact_message", {
      p_ip_hash: hashIp("1.2.3.4")
    });
  });

  it("blocks with reason ip past the per-IP cap", async () => {
    process.env.CONTACT_MESSAGES_PER_IP_PER_DAY = "5";
    rpc.mockResolvedValueOnce({ data: [{ ip_count: 6, global_count: 10 }], error: null });
    expect(await consumeContactMessage("1.2.3.4")).toEqual({
      allowed: false,
      reason: "ip",
      ipCount: 6,
      globalCount: 10
    });
  });

  it("blocks with reason global past the global daily cap, even for a fresh IP", async () => {
    process.env.CONTACT_MESSAGES_GLOBAL_PER_DAY = "100";
    rpc.mockResolvedValueOnce({ data: [{ ip_count: 1, global_count: 101 }], error: null });
    expect(await consumeContactMessage("5.6.7.8")).toEqual({
      allowed: false,
      reason: "global",
      ipCount: 1,
      globalCount: 101
    });
  });

  it("fails open if the counter errors (does not block real users on infra hiccups)", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "down" } });
    expect(await consumeContactMessage("1.2.3.4")).toEqual({
      allowed: true,
      ipCount: 0,
      globalCount: 0
    });
  });
});
